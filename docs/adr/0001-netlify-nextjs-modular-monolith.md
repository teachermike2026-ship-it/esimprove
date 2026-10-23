# ADR-0001: Netlify + Next.js App Router modular monolith

- **Status:** Implemented locally; production acceptance and deployment pending
- **Date:** 2026-10-23
- **Deciders:** Project owner (pending), implementing engineer
- **Related:** ADR-0002, ADR-0006, ADR-0010

## Context

The target is a new eSIM travel storefront that must be mobile-first, SEO-visible, operable by a small team, and cheap to run before revenue. The owner named Netlify as the host. The application needs server-rendered catalogue and content pages, authenticated customer and admin areas, payment and supplier webhooks, and background fulfillment work.

The domain and Netlify account are not verified. At the time of this proposal no application
existed; a local demo now exists, but the choice remains provisional and must survive a real
staging deployment.

## Decision

Build a **modular monolith** using:

- Next.js App Router with React and TypeScript.
- Server Components by default; Client Components only for interaction.
- Route Handlers and Server Actions for mutations.
- Netlify hosting through the current OpenNext adapter.
- A custom CSS design-token system for a mobile-first, WCAG 2.2 AA-targeted UI. Tailwind was
  considered but is not a dependency in the local implementation.
- Clear internal module boundaries (catalogue, checkout, payments, suppliers, provisioning, portal, admin, audit), without separate deployables.

## Consequences

**Positive**

- One deployable, one database, one transaction boundary; simpler money correctness and auditing.
- Server rendering supports SEO and fast first paint without a separate frontend API.
- Netlify provides CDN, TLS, deploy previews, environment secrets, background functions, and scheduled functions.
- A small team can operate it without Kubernetes or a service mesh.

**Negative / risks**

- Netlify's serverless runtime imposes duration, body-size, and cold-start limits.
- The OpenNext adapter can lag Next.js releases; upgrades need staging verification.
- Framework coupling to Next.js is significant.
- A monolith requires discipline to keep module boundaries; it can rot into a ball of mud.
- Free-plan staging lacks built-in password protection (see ADR-0010).
- Netlify credit pricing and limits must be monitored; no unlimited free assumption.

**Neutral**

- Background and scheduled functions are separate entry points but share the same repository and database.
- No microservices, message broker, Redis, or self-managed server in the MVP.

## Alternatives considered

| Alternative | Why not now |
|---|---|
| Vercel + Next.js | Viable technically, but the owner specified Netlify and no migration evidence justifies switching. |
| Cloudflare Workers/Pages | Strong edge story, but the Postgres/Node compatibility and operational model add risk for this team. |
| Shopify/headless commerce | Adds subscription cost and constrains supplier/payment flows; not justified for a single-supplier MVP. |
| Microservices | Premature operational complexity; no measured scaling constraint. |
| Static site + serverless API only | Poor fit for authenticated portals, admin workflows, and transactional state machines. |

## Verification

This ADR remains `Proposed` until all of the following are recorded:

1. A staging site builds and deploys from the repository on the owner's Netlify account.
2. SSR, a Server Action, a Route Handler, middleware, and image optimisation work on the deployed site.
3. A Background Function completes a >30-second simulated job.
4. A Scheduled Function invokes the sweeper on a published deploy.
5. Postgres connectivity works through the chosen pooled connection string.
6. The staging access control and `noindex` headers are verified.

## Revisit triggers

- A required Next.js feature is unsupported by the Netlify adapter.
- Function limits make fulfillment or admin workflows unreliable.
- Netlify cost exceeds the approved budget at realistic traffic.
- The owner selects a different host with documented reasons.
