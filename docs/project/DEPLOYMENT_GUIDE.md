# Deployment guide

The repository contains `netlify.toml` and [Netlify deployment guidance](../NETLIFY-DEPLOYMENT.md). Configuration in source control is not evidence that a site exists or is connected. Actual production platform, database provider, environment-variable presence, schema, connectivity and account state are **unknown**; no production queries or changes were performed during this recovery step.

Deployed configuration requires PostgreSQL via `DATABASE_URL`; migrations are explicit. See [deployment migrations](../DEPLOY-MIGRATIONS.md). Verify the actual deployment independently and use read-only checks where possible; never print credentials or assume the production database matches local. Do not deploy or change infrastructure as part of local recovery.
