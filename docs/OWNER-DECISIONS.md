# Consolidated owner decisions

**Purpose:** One response form. Do not send secrets in chat. Values such as API keys and database URLs must be added through the hosting secret store or a secure channel.

> **Current state (2026-10-23):** The owner approved the Phase 0 direction and authorised the local
> Phases 1–3 demo build. The decisions below are still open unless separately confirmed. The local
> demo uses mock integrations and `SITE_URL=http://localhost:3000`; no domain, supplier, payment,
> email, managed database, or Netlify site is connected.

Reply in one message using the table below. Items marked **blocking** prevent Phase 1 or launch.

| # | Decision | Options / required value | Blocking? | Default if unanswered |
|---|---|---|---|---|
| 1 | Domain ownership | Confirm you control `esimprove.com` at a registrar, or say “not owned yet”. Public checks on 2026-10-23 showed no registration/DNS. | Yes | No DNS work; use a Netlify staging hostname only |
| 2 | Brand | `eSIMprove` / `Improva` / `RoamProof` / another name | Yes for public launch | Working codename `eSIMprove`; no public launch |
| 3 | Legal entity | Registered legal name, registration number, country/state, registered address, VAT/tax ID (if any) | Yes for launch | Placeholders; no invented company details |
| 4 | Supplier | eSIM Access / eSIM Go / another approved supplier / “abstraction only for now” | Yes for real delivery | Disabled eSIM Access adapter + fixtures only |
| 5 | Supplier test budget | Amount you authorise for a capped supplier test deposit, or “none” | Yes for real Phase 1 test | No spend; no supplier order |
| 6 | Supplier credentials | Add `ESIM_ACCESS_CODE` and optional secret/signature key in the secret store after approval | Yes for real delivery | No API calls |
| 7 | Payment processor | Stripe / another processor / “interface only for now” | Yes for live money | Provider-neutral interface; no live checkout |
| 8 | Payment test credentials | Add test-mode keys and webhook signing secret through the secret store | Yes for payment testing | No payment calls |
| 9 | Netlify access | Invite the agent to a site/team or provide a scoped deploy token after reviewing permissions | Yes for deployment | No site, no deploy |
| 10 | Managed PostgreSQL | Neon / Supabase / another provider | Yes for production | Local PGlite only; no production DB |
| 11 | Transactional email | Resend / another provider / “later” | Yes for delivery email | No email; adapters disabled |
| 12 | Sending domain | Confirm `mail.esimprove.com` plan and provide provider DNS records | Yes for email | No email sent |
| 13 | Support mailboxes | Addresses for `support@`, `billing@`, `security@`, `abuse@` and who reads them | Yes for launch | Not published |
| 14 | Target markets | Worldwide or a specific list; any excluded/sanctioned countries | Yes for launch | Worldwide English/USD, no market-specific claims |
| 15 | Currency/language at launch | USD / another currency; English / another locale | No | USD, English |
| 16 | Budget ceiling | Monthly infrastructure ceiling; approval for any paid add-on | Yes for paid services | Free/low tiers only; no spend |
| 17 | Reviews | None until genuine permissioned reviews exist / provide a source | No | No reviews displayed |
| 18 | Legal/tax review | Confirm you will obtain professional review before launch | Yes for launch | Policies remain drafts; launch blocked |
| 19 | Admin accounts | Who needs admin access and who can approve refunds/price changes | Yes for launch | No production admin seed |
| 20 | Launch authorisation | “Authorise live payments/provisioning” only after gates are demonstrated | Yes | Live money and provisioning remain off |

## Suggested safe Phase 1 authorisation

If you want to move without committing to live commerce:

```text
Domain: not owned yet / owned (delete one)
Brand: eSIMprove (pending clearance)
Supplier: eSIM Access abstraction; do not place an order; do not spend money
Payment: interface only; no live payments
Netlify: authorised to create a free staging site once I provide access
Database: I will provide a free Neon/Supabase database
Email: no email yet
Legal: unknown; keep launch blocked
Budget: free tiers only
```

## What the agent will not do without explicit approval

- Buy or renew a domain
- Change registrar or DNS settings
- Spend money on a supplier deposit, paid plan, or service
- Enable live payments or live supplier provisioning
- Create a production database without ownership/access confirmation
- Send marketing or transactional email to real customers
- Delete data or run destructive commands
- Publish legal policies as final without review
- Deploy to production
