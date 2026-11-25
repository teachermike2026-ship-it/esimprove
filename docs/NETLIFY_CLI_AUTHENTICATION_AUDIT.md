# Netlify CLI Authentication & Token Security Audit — ESIMPROVE

**Audit date:** 2026-11-24 (UTC+07:00)  
**Scope:** Read-only investigation  
**Project:** `C:\Users\hp\esimprove`  
**Netlify site:** `esimprove` (`40c1119e-df9c-46b0-aa3b-a511c08debb1`)  
**Netlify team:** `teachermike2026-ship-it`  
**Status:** Final; no remediation performed  
**Sensitivity:** Internal — identifiers and security metadata only; no secret values

> **Redaction statement.** No token, password, key, or secret value is reproduced in this report. Tokens were read only in memory to validate status and to perform exact-match comparisons. The active token was used only as the `Authorization` header for read-only HTTPS `GET` requests to `api.netlify.com` — the same Netlify service the CLI itself uses. It was not printed, copied to a file, or sent to any other destination.

---

## Executive summary

- **The Netlify CLI is installed and authenticated on this machine.** The active credential is an **OAuth CLI login session**, not a manually created personal access token (PAT). It belongs to **Teacher Mike** (`teacher.mike2026@gmail.com`, user ID `6ad6f488d20a4caab8a83ffa`) and the personal team `teachermike2026-ship-it`.
- **The CLI token is stored in the Netlify CLI config store** at `%APPDATA%\netlify\Config\config.json`, under `users.<userId>.auth.token`. It is a 40-character opaque string. The report does not reproduce it.
- **The active CLI token is valid as of this audit.** Read-only calls to `getCurrentUser` and `listSites` succeeded. It has at least account read access and can list six sites. Write scope was **not tested** and must not be assumed absent: the account owns the `esimprove` site.
- **OpenCode has no Netlify-specific integration in the inspected configuration.** There is no Netlify MCP server, no project OpenCode config, no deploy script, and no Netlify environment variable. No `netlify deploy`, `netlify deploy --prod`, or `netlify build` command was found in PowerShell history, OpenCode shell output/logs, project scripts, or CI.
- **If OpenCode ran a `netlify` shell command, it would inherit the machine-wide CLI OAuth session** described above. That is a capability, not evidence that OpenCode has actually deployed through the CLI.
- **The current deployment trigger is unresolved.** The site is Git-connected to `teachermike2026-ship-it/esimprove` branch `main`, but `build_settings.stop_builds=true` currently disables Netlify automatic builds. The five most recent deploys are `deploy_source=api`, `manual_deploy=false`, and every deploy commit maps to known `origin/main` history. The exact tool or actor that triggered them is not proven.
- **The “previously exposed” token cannot be matched to the active CLI token.** The prior audit records no token type, prefix, ID, creation date, or fingerprint. The active CLI OAuth token is the leading candidate because it is the only active Netlify credential found locally, but it is **not proven** to be the exposed credential. A separate PAT, build hook, environment token, or token on another machine remains possible.
- **If the exposed credential is the active CLI token, it is still active and unrevoked.** No revocation evidence was found. If the exposed credential was a separate PAT, its status cannot be verified without its identifier and a Netlify token inventory.
- **Revoking the CLI authorization would not interrupt Git-based Netlify deploys, but it would break any CLI/API deploy path that uses this stored token** until `netlify login` is run again. Because the actual path is unconfirmed, revocation should be treated as potentially disruptive and scheduled with a reauthentication window.
- **The safest remediation is targeted revocation, not `netlify logout`.** `netlify logout` only clears the active `userId`; it does **not** revoke the server-side OAuth grant and does **not** delete the token from disk. Authoritative revocation must be done in the Netlify account UI.
- **Overall operational risk remains HIGH until the exposed credential is identified and revoked**, consistent with the prior audit’s `OPS-01`. No evidence of unauthorized deploys was found in the five returned deploys, but Netlify audit logs were not reviewed.

### Bottom line

| Question | Answer | Confidence |
|---|---|---|
| How does the CLI authenticate? | OAuth login via `netlify login`; token stored in the CLI config | Confirmed |
| Is the CLI logged in? | Yes, as Teacher Mike / `teachermike2026-ship-it` | Confirmed |
| Does OpenCode invoke Netlify CLI directly? | No invocation found in inspected config, scripts, history, logs, or CI | Confirmed for inspected evidence; not proven globally |
| Is CLI authorization needed for Git-based deploys? | No | Confirmed in principle; but automatic Git builds are currently disabled by `stop_builds=true` |
| Is CLI authorization needed for CLI deploys? | Yes, unless `NETLIFY_AUTH_TOKEN` or `--auth` is supplied | Confirmed by CLI source behavior |
| Is the exposed token the active CLI token? | Possible, not proven | Unknown |
| Is the exposed token still active? | If it is the CLI token: yes. If a PAT: unverifiable | Partially confirmed |
| Would revoking CLI authorization interrupt deployments? | No for Git-based; yes for CLI-based; unknown for the actual current path | Conditional |
| What should be done first? | Identify/fingerprint the credential in Netlify, then revoke the specific grant or PAT | Recommendation |

**Confidence labels used in this report**

- **Confirmed** — directly observed in this audit.
- **Inferred** — supported by evidence but not proven.
- **Unknown** — not determinable from the available read-only evidence.

---

## 1. Scope, rules, and method

### 1.1 Rules observed

The following actions were **not** performed:

- No `netlify deploy`, `netlify deploy --prod`, `netlify build`, or build-hook invocation.
- No Git commit, push, fetch, merge, or branch change.
- No `netlify login`, `netlify logout`, `netlify switch`, or `netlify login --new`.
- No Netlify personal access token creation, rotation, or revocation.
- No Netlify site, team, DNS, domain, deploy, environment-variable, or production setting change.
- No environment-variable change at process, user, or machine scope.
- No source-code or dependency change.
- No secret or token value printed, copied to a file, or transmitted to any destination other than `api.netlify.com` for the read-only GETs described below.

### 1.2 Read-only evidence sources

- Netlify CLI `27.16.1` on Node `v24.22.0`.
- `netlify status --json` (read-only status).
- `netlify api getCurrentUser` and `netlify api listSites` (read-only GET methods exposed by the CLI).
- Direct HTTPS `GET` requests to `https://api.netlify.com/api/v1/sites/40c1119e-df9c-46b0-aa3b-a511c08debb1` and `.../deploys?per_page=20`, using the existing CLI token only as the authorization header. These were used because the CLI `api` wrapper returned no JSON for `getSite` and `listSiteDeploys` in this environment.
- Local files:
  - `%APPDATA%\netlify\Config\config.json` (metadata only; token values never printed).
  - `C:\Users\hp\esimprove\.netlify\state.json`.
  - `C:\Users\hp\esimprove\netlify.toml`.
  - `C:\Users\hp\esimprove\package.json`.
  - `C:\Users\hp\esimprove\.github\workflows\ci.yml`.
  - `C:\Users\hp\esimprove\.env.local` and `.env.netlify.production` (key names only; values not read).
  - `C:\Users\hp\.config\opencode\opencode.json`.
  - PowerShell history at `%APPDATA%\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt` (Netlify-related lines only; token-like strings redacted).
  - OpenCode shell output, tool output, logs, and a read-only SQLite query of the OpenCode session database.
- Netlify CLI source code under `C:\Users\hp\AppData\Roaming\npm\node_modules\netlify-cli\dist` for login, token resolution, and logout behavior.
- Bundled Netlify OpenAPI schema under `...\netlify-cli\node_modules\@netlify\open-api\dist\swagger.json` for the `stop_builds` definition.

### 1.3 What “read-only” meant for the token

The token value was loaded into memory for two purposes only:

1. To validate that the CLI session works (`netlify status`, `getCurrentUser`, `listSites`).
2. To perform exact-match comparisons against scanned files and the OpenCode database, returning only booleans/counts.

No token value was written to the report, terminal output, a temporary file, a log, or a third-party service. Temporary scripts were deleted after use. The only network destination was `api.netlify.com`.

---

## 2. Netlify CLI installation and authentication

### 2.1 Installation

| Item | Observed value |
|---|---|
| CLI version | `netlify-cli/27.16.1 win32-x64 node-v24.22.0` |
| Node version | `v24.22.0` |
| Global npm root | `C:\Users\hp\AppData\Roaming\npm\node_modules` |
| Resolved command | `C:\Users\hp\AppData\Roaming\npm\netlify.ps1` |
| CLI package directory | `C:\Users\hp\AppData\Roaming\npm\node_modules\netlify-cli` |
| Install method | Global npm install (`npm install -g netlify-cli`) |

### 2.2 Authentication status

`netlify status --json` reported:

| Field | Value |
|---|---|
| `loggedIn` | `true` |
| `linked` | `true` |
| Account name | Teacher Mike |
| Account email | `teacher.mike2026@gmail.com` |
| Account user ID | `6ad6f488d20a4caab8a83ffa` |
| Team | `teachermike2026-ship-it` (“teachermike2026-ship-it’s team”) |
| Team type | Personal |
| Account/team ID | `6ad6f488d20a4caab8a83ffd` |
| Linked site | `esimprove` |
| Site ID | `40c1119e-df9c-46b0-aa3b-a511c08debb1` |
| Site URL | `https://esimprove.com` |
| Admin URL | `https://app.netlify.com/projects/esimprove` |
| Linked config | `C:\Users\hp\esimprove\netlify.toml` |

The site object returned by the Netlify API has `user_id=6ad6f488d20a4caab8a83ffa` and `account_id=6ad6f488d20a4caab8a83ffd`, matching the active CLI user and team. The active CLI account is therefore the owner of the `esimprove` site.

### 2.3 Authentication mechanism

**Confirmed: this is an OAuth CLI authorization, not a manually created PAT.**

Evidence:

- `netlify login --help` describes the command as: “Opens a web browser to acquire an OAuth token.”
- The CLI source (`dist/commands/login/login.js`) obtains the token through the OAuth flow (`buildAuthorizeUrl`, login ticket, poll/check) and then calls `storeToken`.
- `dist/commands/base-command.js` defines `storeToken` to write the token to the global config under `users.<userId>.auth.token`.
- The global config contains two user entries, each with `auth.token` of length 40. No token value is reproduced.
- `netlify status` and the Netlify API calls succeeded with this token, confirming it is a live bearer credential.

**Token resolution order** (from `dist/utils/command-helpers.js`, `getToken`):

1. `--auth <token>` command flag.
2. `NETLIFY_AUTH_TOKEN` environment variable.
3. The token stored in the CLI config for the active `userId`.

Because no `--auth` flag and no `NETLIFY_AUTH_TOKEN` are present in this environment, normal CLI commands on this machine use the config-stored OAuth token.

**Storage location and metadata:**

| Item | Observed value |
|---|---|
| Config file | `C:\Users\hp\AppData\Roaming\netlify\Config\config.json` |
| File size | 609 bytes |
| Top-level keys | `telemetryDisabled`, `cliId`, `userId`, `users` |
| Active `userId` | `6ad6f488d20a4caab8a83ffa` |
| Stored user sessions | 2 |
| Active user token length | 40 characters |
| Second user token length | 40 characters |
| Token values printed | None |

**File ACL:** the config file is owned by `DESKTOP-G17FPF4\hp`; `SYSTEM`, `BUILTIN\Administrators`, and `DESKTOP-G17FPF4\hp` have FullControl. No `Everyone` or `Users` group access was observed. This is a reasonable Windows profile ACL, but the token is still a long-lived bearer credential stored in plaintext JSON within the user profile.

**Important logout semantics:** `dist/commands/logout/logout.js` sets `globalConfig.set('userId', null)`. The source comment says “unset userID without deleting key.” Therefore:

- `netlify logout` does **not** revoke the OAuth grant on Netlify’s servers.
- `netlify logout` does **not** delete the token from `config.json`; the token remains under `users.<userId>.auth.token`.
- `netlify logout` is a local deactivation, not a security remediation.

### 2.4 Second stored CLI session

The same config file contains a second, non-active session:

| Field | Value |
|---|---|
| Name | mohamed ouaarab |
| Email | `mohamed.ouaarab17@gmail.com` |
| Active | No |
| Token length | 40 characters |
| Validity | Not tested (would require switching accounts or using another user’s credential) |

This account matches the identity associated with the local `new-origin` Git remote (`mohamedouaarab-dotcom/esimprove`) and the latest local commit author. It does **not** match the Git repository the Netlify site builds from (`teachermike2026-ship-it/esimprove`). This is an inference from email/remote/commit metadata, not proof that the second token was used for any deployment.

**Risk implication:** revoking only the active Teacher Mike CLI authorization would leave the second stored token in place. If the exposure could involve the second account, it must be reviewed separately.

### 2.5 Demonstrated scope

Using the active CLI token, the following read-only calls succeeded:

- `netlify api getCurrentUser` — HTTP success, returned the Teacher Mike user object.
- `netlify api listSites` — HTTP success, returned six sites.
- `GET /api/v1/sites/40c1119e-df9c-46b0-aa3b-a511c08debb1` — HTTP 200.
- `GET /api/v1/sites/40c1119e-df9c-46b0-aa3b-a511c08debb1/deploys?per_page=20` — HTTP 200.

The six visible sites were:

| Site | Site ID |
|---|---|
| `magnificent-stardust-514df0` | `0be43a4e-3586-406d-ba79-4168edaf3162` |
| `lafangames-production` | `e5a01fb9-604f-40cd-bc20-9df7c9452911` |
| `lafangames-staging` | `a5d8c63c-9533-47f0-98c9-0de49c84216f` |
| `esimprove` | `40c1119e-df9c-46b0-aa3b-a511c08debb1` |
| `tangerine-sunflower-88b862` | `1d31d4e2-006a-4aec-862f-0e0fb3b1755e` |
| `preeminent-tartufo-44fe51` | `f45b7301-46cd-4c27-9e4e-3ab86518634e` |

**Scope conclusion:** the token has at least account-level read access across the team’s sites. Write scope (deploy, environment variables, site settings, member changes) was **not tested** because write operations were prohibited. Because the token belongs to the site owner, it should be treated as potentially write-capable until proven otherwise.

### 2.6 Caveats about timestamps and identity

- The CLI config file’s filesystem timestamp changed during the investigation. No `netlify login`, `logout`, `switch`, token-creation, or token-revocation command was executed. The exact cause of the rewrite was not determined; CLI bookkeeping or config-store behavior is the likely explanation, but this is **inferred**.
- The config does not store a token creation date, last-used date, or fingerprint. File timestamps are therefore not reliable evidence of token age.
- The active token’s exact identity relative to the authorization shown in the Netlify account UI was not fingerprinted. The account entry is **likely** the same OAuth grant because the CLI is logged in and the token is active, but this is an inference, not a cryptographic match.

---

## 3. OpenCode integration and deployment mechanism

### 3.1 OpenCode configuration

| Location | Finding |
|---|---|
| `C:\Users\hp\.config\opencode\opencode.json` | Top-level keys are only `$schema` and `provider`. No `mcp`, `command`, or `agent` section. Zero Netlify key or string matches. |
| Project-level `opencode.json` / `opencode.jsonc` / `.opencode` | None found under `C:\Users\hp\esimprove`. |
| OpenCode MCP resources | Zero resources and zero templates returned by the MCP resource listing. |
| `package.json` scripts | No deploy script. The only Netlify-related script is `netlify:preflight` (`tsx scripts/netlify-preflight.ts`), which validates configuration and does not deploy. |
| `.github/workflows/ci.yml` | Runs checkout, `npm ci`, typecheck, lint, and tests. No Netlify deploy step. `permissions: contents: read`. |
| `netlify.toml` | Present; build configuration only, no credentials. |
| `.netlify/state.json` | Contains only `siteId=40c1119e-df9c-46b0-aa3b-a511c08debb1`. |
| `.env.local`, `.env.netlify.production` | No Netlify key names (`NETLIFY_*` count = 0). Values were not read. |
| PowerShell history | Netlify-related commands are limited to `netlify --version`, `npm install -g netlify-cli`, `netlify login`, and `netlify status`. No `netlify deploy`, `build`, `link`, `api`, `logout`, or `switch`. |
| OpenCode shell output/logs | Netlify matches are documentation/config text (`netlify.toml`, deployment docs, `.env.example` comments). No executed `netlify deploy`/`build` command was found. |
| OpenCode session database | Historical Netlify discussion text exists, including the literal string `nfp_`, but no complete `nfp_`-prefixed token candidate was found and neither stored CLI token string appears in the database. |

### 3.2 How OpenCode would authenticate if it ran the CLI

OpenCode does not have a separate Netlify credential in the inspected configuration. It executes shell commands and tools. If an OpenCode session ran a `netlify` command in this environment, the CLI would:

1. Look for `--auth`.
2. Look for `NETLIFY_AUTH_TOKEN` (absent).
3. Fall back to the active OAuth token in `%APPDATA%\netlify\Config\config.json`.

In that scenario, OpenCode would act as **Teacher Mike** and could use whatever scope the OAuth token has. This is a **capability**, not evidence of an actual deployment. No such invocation was found in the recorded history, shell output, logs, or CI.

### 3.3 Site build settings — critical finding

The `esimprove` site returned by the Netlify API has the following settings:

| Setting | Value | Interpretation |
|---|---|---|
| `build_settings.provider` | `github` | The site is Git-connected. |
| `build_settings.repo_url` | `https://github.com/teachermike2026-ship-it/esimprove` | Builds from the Teacher Mike repository. |
| `build_settings.repo_branch` | `main` | Production branch is `main`. |
| `build_settings.allowed_branches` | `main` | Only `main` is allowed. |
| `build_settings.stop_builds` | `true` | **Netlify will not build the project automatically.** |
| `build_settings.skip_automatic_builds` | `null` | Not set. |
| `build_settings.skip_prs` | `null` | Not set. |
| `build_settings.public_repo` | `true` | Repository is public. |
| `prevent_non_git_prod_deploys` | `false` | Non-Git production deploys are allowed. |
| `deploy_hook` | Non-empty | Value withheld; whether it is a build hook, notification hook, or internal identifier was not confirmed. |
| `site.updated_at` | `2026-11-24T05:22:52.648Z` | Later than the most recent deploy (see below); cause unknown. |
| `site.lifecycle_state` | `active` | Site is active. |
| `site.disabled` | `false` | Site is not disabled. |

The bundled Netlify OpenAPI schema defines `stop_builds` as:

> “When true, Netlify will not build your project automatically. You can build locally via the CLI and then publish new deploys manually via the CLI or the API.”

**Confirmed consequence:** as configured at the time of this audit, a push to `main` should **not** trigger an automatic Netlify build. If the intended “OpenCode → Netlify automatic deployment” workflow depends on Git pushes, that workflow is currently disabled by this setting, independently of the token issue.

**Inferred consequence:** the setting may have been changed after the most recent deploy. The site’s `updated_at` is later than the last deploy, which is consistent with a settings change after that deploy, but `updated_at` is not a change audit log and the exact time `stop_builds` became `true` is unknown.

### 3.4 Recent deploys

The deploy list returned five deploys. All five are production deploys on `main`, all have `manual_deploy=false`, and all have `deploy_source=api`.

| Deploy ID | State | Commit | Commit time (UTC) | Deploy created (UTC) | Approx. lag | Source | Manual |
|---|---|---|---|---|---|---|---|
| `6b0515ff6041e7848a07a847` | ready | `f52e25e` | 2026-11-24 04:34:05 | 2026-11-24 04:43:43 | 9m 38s | api | false |
| `6b05121e06b81ebc73620f1f` | ready | `b8e9955` | 2026-11-24 04:24:16 | 2026-11-24 04:27:10 | 2m 54s | api | false |
| `6b0510bfc1329aa03eebe7de` | error | `50cf2ef` | 2026-11-24 04:17:26 | 2026-11-24 04:21:19 | 3m 53s | api | false |
| `6b046739ec5161135a8410aa` | error | `ce8f328` | 2026-11-23 15:42:06 | 2026-11-23 16:18:01 | 35m 55s | api | false |
| `6adb89dc865de61cdd9a621d` | ready | `5dcb3ba` | 2026-10-23 15:58:45 | 2026-10-23 16:22:52 | 24m 07s | api | false |

Additional observations:

- All five commit SHAs exist in the local repository and are ancestors of `origin/main`.
- All five commits were authored by `teachermike2026-ship-it`.
- The two error deploys failed during the build stage with “Build script returned non-zero exit code: 2.” Build logs were not fetched or reviewed.
- The latest deployed commit is `f52e25e` (`origin/main`), while the local worktree HEAD is `6580a03` on `fix/master-remediation`. The current local checkout is **behind** the deployed commit; the deployed commits did not come from the current local working tree.
- `deploy_source` is not defined in the bundled OpenAPI schema, so its exact semantics are not documented in the locally available specification. “api” is treated as an API/CLI/hook-style trigger, but that interpretation is **inferred**.
- `manual_deploy=false` indicates the deploys were not recorded as manual UI deploys; it does not prove they were automated by OpenCode.

### 3.5 What is confirmed, inferred, and unknown

**Confirmed**

- The site is Git-connected to `teachermike2026-ship-it/esimprove`, branch `main`.
- `stop_builds=true` at the time of this audit; automatic Netlify builds are disabled by this setting.
- The five returned deploys are all production, all on `main`, all `source=api`, all `manual=false`.
- All five deploy commits are known commits on `origin/main`, authored by the site owner account.
- The local checkout is not at the deployed commit.
- OpenCode has no Netlify MCP server, no project OpenCode config, no deploy script, and no `NETLIFY_AUTH_TOKEN`.
- No `netlify deploy`/`build` command appears in PowerShell history or OpenCode shell output/logs.

**Inferred**

- The deploys may have occurred while `stop_builds` was still `false`, or they may have been triggered through an API/build-hook/CLI path that bypasses the automatic-build setting.
- The short lag between commits and deploys (2–10 minutes for the latest three) is consistent with push-triggered automation or a tool that deploys shortly after each push.
- The deployed commits likely came from another machine, another checkout, the GitHub web UI, or an external automation, because the current local checkout is behind `origin/main`.
- OpenCode probably did not perform the latest deployments from this workspace via the CLI, but this cannot be proven for other sessions or machines.

**Unknown**

- Which actor/tool triggered each deploy.
- Whether a build hook, a PAT, the CLI OAuth token, the Netlify UI, or Netlify’s Git integration was used.
- Whether `stop_builds` was `true` at the time of each deploy.
- Whether OpenCode has ever run `netlify deploy` in an unrecorded session or on another machine.
- Whether the current “automatic deployment workflow” is intended to be Git-based or CLI-based.

### 3.6 The automatic-deployment inconsistency

The user’s stated goal is to preserve the “OpenCode → Netlify automatic deployment workflow.” The evidence shows two different possible workflows, and the current site configuration does not cleanly support the Git-based one:

1. **Git-based workflow:** OpenCode pushes to GitHub; Netlify’s GitHub integration builds and deploys. This does **not** require the local Netlify CLI token. However, `stop_builds=true` currently prevents automatic builds.
2. **CLI-based workflow:** OpenCode runs `netlify deploy` / `netlify deploy --prod`. This **does** require CLI authentication (the stored OAuth token or `NETLIFY_AUTH_TOKEN`), and it would not be blocked by `stop_builds` because the build happens locally or is published as a prebuilt deploy.
3. **API/build-hook workflow:** An external tool calls the Netlify API or a build hook. This uses a PAT/hook, not the CLI OAuth token.

The evidence does not prove which workflow is actually in use. Before revoking anything, the owner should decide which of these is intended. The token remediation differs for each.

---

## 4. Is Netlify CLI authorization necessary?

### 4.1 Decision matrix

| Deployment path | Requires the local CLI OAuth token? | Why |
|---|---|---|
| Git push → Netlify GitHub integration | **No** | Netlify’s GitHub connection uses its own Git integration credentials, not the local CLI token. The site’s `provider=github` and `repo_url` confirm the connection. |
| `netlify deploy` from this machine | **Yes** (unless `--auth`/`NETLIFY_AUTH_TOKEN` is supplied) | The CLI resolves the token from the config store. No environment token is present. |
| `netlify deploy --prod` from this machine | **Yes** (same) | Same CLI authentication path. |
| Netlify API with a PAT | **No** (uses the PAT) | A PAT is a separate credential. |
| Netlify build hook | **No** (uses the hook URL/ID) | A build hook is a separate secret. |
| Netlify UI manual deploy | **No** | The UI uses the browser session. `prevent_non_git_prod_deploys=false` allows it. |
| OpenCode shell command invoking `netlify` | **Yes**, because it inherits the CLI session | OpenCode has no separate Netlify auth. |

### 4.2 Conclusion

- **For Git-based deployment, the CLI authorization is not necessary.** Revoking it would not stop Netlify’s GitHub integration from building (once `stop_builds` is resolved).
- **For CLI-based deployment, the CLI authorization is necessary.** Revoking it would break `netlify deploy` until reauthentication.
- **The current evidence does not prove which path is in use.** The site’s automatic builds are currently disabled, and the recent deploys are API-sourced. Therefore, the only safe answer for the current workflow is: **CLI authorization is not required for the Git path, but it may be required for the actual path; do not assume it is disposable without confirming the path or planning reauthentication.**
- The CLI authorization is **not** the same thing as Netlify’s GitHub App/integration connection. Revoking the CLI grant does not disconnect the GitHub repository, and disconnecting GitHub would not revoke the CLI token.

---

## 5. The “previously exposed” token

### 5.1 What the prior audit actually says

The prior security audit states (`docs/ESIMPROVE_SECURITY_AUDIT_REPORT.md`, line 34):

> “One **operational credential risk** remains outside the application code: an active Netlify access token referenced in the engagement hand-off had previously been exposed and was not rotated because credential rotation was explicitly out of scope.”

The findings JSON (`docs/ESIMPROVE_SECURITY_FINDINGS.json`, `OPS-01`) adds:

> “The engagement hand-off noted that a Netlify access token had previously been exposed and remained active. The token was not used for any write operation, was not printed, and was not rotated because credential rotation was outside the read-only scope.”

The report and JSON do **not** record:

- Whether the token was a PAT or a CLI OAuth token.
- Any token prefix, suffix, length, hash, or fingerprint.
- A token ID, creation date, last-used date, or scope.
- The exact hand-off artifact in which the exposure was described.

The original hand-off artifact was not identified in the repository; only the audit’s restatement is available locally. The prior audit’s statement is therefore a **risk assertion**, not a fingerprint-verified identification.

### 5.2 Local credential inventory

| Candidate | Found locally? | Metadata observed | Match to active CLI token? | Status |
|---|---|---|---|---|
| Active CLI OAuth token (Teacher Mike) | Yes, in `%APPDATA%\netlify\Config\config.json` | 40 chars; active `userId`; `getCurrentUser` and `listSites` succeed | Reference credential | **Active and valid** |
| Second CLI OAuth token (mohamed ouaarab) | Yes, same file | 40 chars; not active; validity not tested | No exact match in scanned surfaces | Present; status unknown |
| `NETLIFY_AUTH_TOKEN` environment variable | No | Checked process, User, and Machine scopes; name only | N/A | Absent |
| Netlify keys in `.env.local` / `.env.netlify.production` | No | Key-name scan only; zero `NETLIFY_*` keys | N/A | Absent |
| PAT with `nfp_` prefix in project/env/OpenCode/docs/history | No complete value | Full-token regex scan; zero complete candidates | N/A | Not found locally |
| PAT in Netlify account or another machine | Not inspectable | No inventory/fingerprint | Unknown | Unknown |
| Build hook | Yes, site field is non-empty | Value withheld; exact type/meaning unconfirmed | Different credential type | Present; status unknown |
| GitHub Actions / CI secret | Not inspected | Workflow has no deploy step | Unknown | Unknown |

### 5.3 Matching and fingerprinting results

- **Exact-match scan:** neither stored CLI token string appears in the project files, OpenCode config, OpenCode tool output, OpenCode shell output, PowerShell history, or the OpenCode session database. Result: `0` exact matches for both tokens.
- **Full `nfp_` scan:** no complete `nfp_`-prefixed token candidate was found in the project docs, env files, OpenCode config/tool output/shell output, or PowerShell history. The OpenCode database contained 158 session-message rows with the literal string `nfp_` at the time of the scan, but a regex requiring `nfp_` followed by 20+ token characters found zero distinct candidates. Those rows are consistent with discussion/pattern text (including this audit’s own regex text), not a stored token.
- **Environment scan:** no `NETLIFY_AUTH_TOKEN` in the current process, User, or Machine scopes. A parent process could inject it at runtime; no evidence of that was found.
- **Project env scan:** no Netlify key names in `.env.local` or `.env.netlify.production`. Values were not read.
- **Token values:** never printed; comparisons returned only booleans/counts.

**Interpretation:** the exposed token is **not present in the scanned local surfaces**, or it has been removed/redacted since exposure. The active CLI token is live, but it cannot be linked to the prior exposure without a fingerprint or an external record.

### 5.4 Is the exposed token the same credential?

**Answer: Cannot be confirmed.**

- **Leading candidate:** the active CLI OAuth token. It is the only active Netlify credential found on the machine, it belongs to the site owner, and it is account-level. If the engagement hand-off referred to “the Netlify token on this machine,” this is the most likely credential.
- **Alternative candidates:** a Netlify PAT (`nfp_...`) used by an external tool; a build hook; an environment variable in another environment/CI; a token on another machine; a token that has already been rotated and is no longer present.
- **No proof:** the prior audit did not record a type, prefix, ID, or fingerprint, and the current audit did not find a second complete Netlify token in the local surfaces. The active CLI token’s value could have been rotated since the exposure, which would also prevent a match.

### 5.5 Is the exposed credential active, revoked, or unverifiable?

| Scenario | Status | Evidence |
|---|---|---|
| Exposed credential = active CLI OAuth token | **Active and not revoked** | `netlify status` logged in; `getCurrentUser` and `listSites` succeed; no revocation command in history |
| Exposed credential = second CLI OAuth token | **Present; validity untested** | Token remains in config; not used in this audit |
| Exposed credential = PAT | **Unverifiable** | No PAT found locally; no fingerprint; no Netlify PAT inventory reviewed |
| Exposed credential = environment variable | **Not present in inspected scopes** | No `NETLIFY_AUTH_TOKEN` in process/User/Machine; no Netlify keys in project env files |
| Exposed credential = build hook | **A hook is present; identity unverified** | Site `deploy_hook` is non-empty; value withheld |
| Exposed credential = unknown/other | **Unverifiable** | No identifier available |

**No revocation evidence was found.** The prior audit said the token was not rotated; nothing in this audit contradicts that. Netlify audit logs were not reviewed, so server-side revocation/creation events cannot be excluded.

### 5.6 Scenario-specific revocation map

| If the exposed credential is… | Revocation action | Effect on CLI | Effect on Git deploys |
|---|---|---|---|
| Active CLI OAuth grant | Revoke the Netlify CLI authorization in the Netlify account UI | Breaks until `netlify login` | None |
| Second CLI OAuth grant | Revoke that account’s CLI authorization separately | Breaks that account’s CLI until reauth | None |
| PAT | Revoke the specific PAT in Netlify | None | None |
| Build hook | Delete/rotate the hook; update any automation | None | None (unless the hook was the deploy trigger) |
| Environment token | Remove/rotate it in the environment/CI where it exists | None if the CLI does not use it | None |
| Unknown | Revoke all suspect CLI/PAT/hook credentials, then reauth and audit | Depends | Depends |

---

## 6. Security risks and evidence

### 6.1 Risk register

| ID | Risk | Evidence | Severity | Confidence |
|---|---|---|---|---|
| `NET-01` | Exposed credential identity unresolved; it may still be active | Prior audit `OPS-01`; no fingerprint/type/ID; active CLI token is a candidate | High | Confirmed risk; identity unknown |
| `NET-02` | Active CLI OAuth token is account-level and long-lived; if the host is compromised, the attacker can act as the site owner | Token stored in config; `getCurrentUser`/`listSites` succeed; site `user_id` matches | High | Confirmed capability; write scope untested |
| `NET-03` | Non-Git production deploys are allowed | `prevent_non_git_prod_deploys=false` | High | Confirmed |
| `NET-04` | A deploy-capable token or hook can publish to production without a Git commit/review | `prevent_non_git_prod_deploys=false`; API-sourced deploys exist; deploy hook present | High | Confirmed setting; exploitability depends on credential scope |
| `NET-05` | `stop_builds=true` disables the intended automatic Git workflow, creating operational pressure to use manual/API deploys | Site build settings; Netlify OpenAPI `stop_builds` definition | Medium | Confirmed |
| `NET-06` | A second stored CLI token increases blast radius and may be overlooked during revocation | Two `users` entries in config; second account not active | Medium | Confirmed presence; validity unknown |
| `NET-07` | A deploy hook is present; if leaked, it can trigger builds | Non-empty `deploy_hook`; value withheld | Medium | Confirmed presence; type/impact unconfirmed |
| `NET-08` | `netlify logout` is commonly mistaken for revocation; it leaves the token on disk and valid server-side | `logout.js` sets `userId=null` only | Medium | Confirmed |
| `NET-09` | Netlify audit logs were not reviewed; unauthorized activity cannot be excluded | No audit-log review performed | Medium | Confirmed gap |
| `NET-10` | Token is stored in plaintext JSON in the user profile; profile backups, sync tools, or malware could capture it | Config file contents/ACL | Medium | Confirmed storage; exploitation depends on host compromise |

### 6.2 Positive controls and mitigating evidence

- No `NETLIFY_AUTH_TOKEN` in the current process, User, or Machine environment.
- No Netlify credential key names in `.env.local` or `.env.netlify.production`.
- No complete `nfp_` PAT candidate in the scanned project/OpenCode/history surfaces.
- The CLI config file ACL is restricted to the user, SYSTEM, and Administrators; no `Everyone`/`Users` access was observed.
- All five returned deploys map to known `origin/main` commits authored by the site owner account; no deploy with an unknown commit was observed in the returned page.
- No `netlify deploy`/`build` command was found in the recorded shell history or OpenCode shell output/logs.
- The repository’s CI workflow is read-only (`permissions: contents: read`) and contains no deploy step.
- OpenCode has no Netlify MCP integration and no project-level Netlify configuration.

### 6.3 Evidence gaps

- No fingerprint/prefix/ID for the exposed token.
- No Netlify audit-log review.
- No test of the CLI token’s write scope (prohibited by the read-only rules).
- No test of the second stored token’s validity (would require switching accounts/using another user’s credential).
- No inspection of Netlify site environment-variable values; if the token had environment-read scope, the exact secrets at risk were not enumerated.
- No inspection of GitHub repository secrets or other CI secret stores.
- No review of the two failed build logs beyond the API error message.
- No proof of which actor/tool triggered the API-sourced deploys.

---

## 7. Safest recommended remediation

> **This section is a recommendation only. No remediation was implemented in this audit.**

### 7.1 Principles

1. **Identify before revoking.** Revoking the wrong credential can break a workflow without removing the exposure.
2. **Revoke the specific credential, not just the local session.** `netlify logout` is not revocation.
3. **Preserve the deployment path deliberately.** Decide whether the workflow is Git-based or CLI-based before changing credentials.
4. **Reauthenticate immediately after revocation** if the CLI path is needed.
5. **Review audit logs and rotate downstream secrets only if the exposure warrants it.** If the token had environment-read/write scope and the audience is unknown, treat the secrets it could reach as potentially exposed.

### 7.2 Recommended sequence

1. **Confirm the intended deployment workflow.**
   - If the intended workflow is “push to GitHub → Netlify builds,” the CLI token is not required for deployment. Plan to resolve `stop_builds=true` separately (see 7.4).
   - If the intended workflow is “OpenCode runs `netlify deploy`,” the CLI token is required; plan a short reauthentication window.
   - If the workflow is a build hook/API integration, identify the PAT/hook used and treat it as the primary credential.

2. **Inventory the Netlify credentials in the account UI.**
   - User settings → Applications/Authorizations: locate the Netlify CLI authorization(s), note last-used/creation metadata if shown, and identify which one corresponds to this machine.
   - User settings → Personal access tokens: list tokens, note prefixes/creation/last-used metadata, and identify any PAT that could have been exposed.
   - Team settings → Members/roles: confirm only trusted members have access.
   - Site settings → Build & deploy → Build hooks: list hooks and identify whether the `esimprove` hook is used.
   - Site settings → Environment variables: review names and scopes (do not copy values into the report).
   - Audit logs (if available on the plan): review deploys, environment-variable changes, member changes, and token/authorization events for the exposure window.

3. **Fingerprint the exposed credential from the original hand-off.**
   - Compare token type, prefix (if any), creation date, last-used date, and scope — **not** the token value.
   - If the hand-off only says “Netlify token,” treat the active CLI OAuth grant and any PAT as suspects until ruled out.

4. **Revoke the specific credential.**
   - **If it is the CLI OAuth grant:** revoke the Netlify CLI authorization in the Netlify account UI. Do not rely on `netlify logout`.
   - **If it is a PAT:** revoke that PAT in Netlify. The CLI OAuth grant can remain if it is not suspect.
   - **If it is unknown:** revoke both the suspect PAT(s) and the CLI OAuth authorization, then reauthenticate. This is the conservative option.
   - **If it is a build hook:** delete or rotate the hook and update any automation that uses it.

5. **Reauthenticate the CLI if needed.**
   - Use the commands in section 9.
   - Verify with `netlify status --json` and `netlify api getCurrentUser`.

6. **Verify the revocation.**
   - Confirm the CLI is logged out or the old token is rejected on a read-only endpoint.
   - Confirm the Netlify UI no longer lists the revoked authorization/PAT.
   - Confirm no unexpected deploy or environment change occurred during the window.

7. **Rotate downstream secrets if warranted.**
   - If the exposed token had environment-read or environment-write scope and the exposure audience is unknown, rotate the Netlify environment variables it could reach (for example `DATABASE_URL`, `AUTH_SECRET`, `SUPPLIER_CREDENTIAL_KEK`, `WHOP_*`, and other production secrets), then redeploy.
   - Coordinate database credential rotation with the database provider, and review database access logs where available.
   - This is a larger incident-response action; do not rotate blindly without a rollback plan.

8. **Harden the workflow.**
   - Enable 2FA on the Netlify account.
   - Use least-privilege team roles and remove unused members.
   - Prefer short-lived/scoped credentials over long-lived PATs.
   - Store CI tokens in a secret manager, never in the repository or shell history.
   - If the workflow should be Git-only, set `prevent_non_git_prod_deploys=true` **after** confirming no CLI/API deploy path is needed. This is a production setting change and was not performed.
   - If the workflow should be Git-automatic, set `stop_builds=false` **after** confirming the intended build path. This is a production setting change and was not performed.
   - Review or remove the second stored CLI session if it is not needed; revoke its server-side authorization first.

### 7.3 Decision tree

| Situation | Recommended action |
|---|---|
| You can confirm the exposed credential is the CLI OAuth grant | Revoke that grant, run `netlify login`, verify. No PAT rotation needed. |
| You can confirm the exposed credential is a PAT | Revoke that PAT, update the automation secret, verify. Keep the CLI grant if trusted. |
| You cannot identify the credential | Revoke the CLI grant and any suspect PAT/hook, reauth, then review audit logs. Treat downstream secrets as potentially exposed if scope was broad. |
| You do not need CLI deploys at all | Revoke the CLI grant and rely on Git; resolve `stop_builds` separately so Git deploys actually run. |
| You need CLI deploys and cannot tolerate downtime | Prepare `netlify login` access first, then revoke and reauth in a short window; verify with a non-production deploy after approval. |

### 7.4 What not to do

- **Do not treat `netlify logout` as revocation.** It only sets the local `userId` to null.
- **Do not delete the CLI config file while the token is still active server-side.** That removes the local copy but not the exposure.
- **Do not revoke the CLI grant and assume Git deploys will continue** while `stop_builds=true`; Git pushes will not auto-build under that setting.
- **Do not set `prevent_non_git_prod_deploys=true` without checking whether the current workflow uses CLI/API deploys.** It could break the workflow.
- **Do not rotate production secrets without a rollback plan and a coordinated redeploy.**
- **Do not paste token values into chat, tickets, logs, or this report.**

---

## 8. Would revoking Netlify CLI authorization interrupt OpenCode deployments?

### 8.1 Impact matrix

| Actual deployment path | Impact of revoking the active CLI OAuth grant | Notes |
|---|---|---|
| Git push → Netlify GitHub integration | **No interruption** | The local CLI token is not used by Netlify’s GitHub integration. However, `stop_builds=true` currently prevents automatic builds; resolve that separately. |
| `netlify deploy` / `netlify deploy --prod` from this machine | **Breaks until `netlify login`** | No `NETLIFY_AUTH_TOKEN` fallback is present. |
| OpenCode shell command invoking `netlify` | **Breaks until reauthentication** | OpenCode inherits the CLI session. Non-interactive commands fail with an authentication-required error. |
| Netlify API with a separate PAT | **No interruption from CLI revocation** | The PAT is a different credential; revoke it separately if it is the exposed one. |
| Build hook | **No interruption from CLI revocation** | The hook is a different credential; delete/rotate it separately if suspect. |
| Netlify UI manual deploy | **No interruption** | The UI uses the browser session. |

### 8.2 The honest answer for the current workflow

**The actual deployment path is not confirmed.** Therefore:

- Revoking the CLI authorization is **safe for the Git path** and **unsafe for the CLI path**.
- Because the site is Git-connected but automatic builds are currently disabled, and because recent deploys are API-sourced, the current workflow may not be purely Git-based. It may rely on a CLI/API/hook credential.
- **Treat revocation as potentially disruptive.** Plan a reauthentication window, revoke, reauthenticate, and verify with a non-production deploy only after explicit approval.
- If deployments stop after revocation, **check `stop_builds` first** before assuming the revocation caused it. The setting alone is sufficient to stop Git-triggered builds.

### 8.3 Non-interactive behavior

- With no token available, `netlify` commands that require authentication fail. The CLI source explicitly returns: “Authentication required. NETLIFY_AUTH_TOKEN is not set and `netlify status` also informs us that you need to use `netlify login --request <message>` as a next step.”
- In an OpenCode session, an interactive browser login may not be possible. Use the `--request`/`--check` flow or set `NETLIFY_AUTH_TOKEN` from a secret store for non-interactive runs.
- A local `netlify logout` would also make the CLI appear logged out, but the token would still exist on disk and may remain valid server-side. Do not use it as a revocation substitute.

---

## 9. Reauthentication commands (not executed)

> The following commands are provided for later use. **None were executed in this audit.**

### 9.1 Interactive reauthentication

```powershell
# Opens a browser to complete the OAuth login.
netlify login

# Verify the active account and linked site.
netlify status --json

# Verify the account identity through a read-only API call.
netlify api getCurrentUser
```

### 9.2 Agent / human-in-the-loop reauthentication

Use this when OpenCode or another non-interactive agent needs a browser-based login:

```powershell
# Create a login ticket and print the authorization URL.
netlify login --request "ESIMPROVE Netlify CLI reauthentication" --json

# Open the returned URL, authorize in the browser, then check the ticket.
# Replace <ticket-id> with the ID returned by the --request command.
netlify login --check <ticket-id> --json

# Verify.
netlify status --json
```

### 9.3 Selecting the correct stored account

If more than one account is stored in the CLI config, select the site owner before verifying:

```powershell
netlify switch --email teacher.mike2026@gmail.com
netlify status --json
```

This changes the local active account only; it does not change Netlify server-side settings.

### 9.4 Adding a new account

```powershell
netlify login --new
```

Use this only if the intended account is not already stored. It may add another session to the local config.

### 9.5 Non-interactive/CI use

For CI or another non-interactive environment, set `NETLIFY_AUTH_TOKEN` from a secret store; do not commit it or paste it into shell history. The CLI’s token precedence is `--auth`, then `NETLIFY_AUTH_TOKEN`, then the config store. Prefer a scoped, short-lived credential over a long-lived PAT.

### 9.6 What not to run as “revocation”

```powershell
# NOT a revocation: only clears the active userId locally.
# The token remains in config.json and may remain valid server-side.
netlify logout
```

Authoritative revocation must be performed in the Netlify account UI (User settings → Applications/Authorizations for the CLI grant; User settings → Personal access tokens for a PAT).

---

## 10. Final confirmations

| Required confirmation | Status | Evidence |
|---|---|---|
| **No deployment was triggered** | **Confirmed** | No `netlify deploy`, `netlify deploy --prod`, `netlify build`, build-hook call, or Netlify deploy-write API was executed. Netlify calls were read-only `GET`s (`status`, `getCurrentUser`, `listSites`, site GET, deploys GET). |
| **No production settings were changed** | **Confirmed** | No `updateSite`, environment-variable, DNS, domain, build-setting, or member change was made. Observed values include `stop_builds=true` and `prevent_non_git_prod_deploys=false`; this audit did not modify them. |
| **No token was created or revoked** | **Confirmed** | No `netlify login`, `netlify logout`, `netlify switch`, PAT creation, or PAT revocation command was executed. The config still contains two user entries with 40-character tokens. See the caveat below regarding a config-file rewrite. |
| **No source code or dependencies were modified** | **Confirmed** | No source, `package.json`, lockfile, CI workflow, or dependency change was made. The only file added is this report. Pre-existing working-tree changes/untracked files were left untouched. |
| **No secrets were printed or exposed** | **Confirmed** | No token, password, key, or secret value appears in this report or in the audit output. Tokens were used only in memory and, for read-only GETs, as the `Authorization` header to `api.netlify.com`. No secret was sent to any other destination. |

### Additional confirmations

- **No Git commit or push was made.** The repository’s pre-existing working-tree state was preserved.
- **No production database, application setting, or Netlify environment variable was accessed or modified.**
- **No token value was copied to a temporary file or log.** Temporary read-only helper scripts were deleted after use.
- **The two failed deploys’ build logs were not fetched.** Only the API error message was read.
- **The deploy hook value was not printed.** `netlify status:hooks` was deliberately not run because it can display hook URLs.

### Caveat on the CLI config-file rewrite

The CLI config file’s filesystem timestamp changed during the investigation. No authentication or token command was executed by this audit. Both stored user entries and both 40-character tokens remained present, and the active token remained valid before and after. The exact cause of the rewrite was not determined; an automatic CLI/config-store bookkeeping write is the likely explanation (**inferred**). An automatic token refresh cannot be completely excluded from filesystem metadata alone, but no explicit token creation or revocation command was run.

---

## Appendix A — Evidence index

### A.1 Key files

| Path | Purpose |
|---|---|
| `%APPDATA%\netlify\Config\config.json` | CLI credential store; metadata inspected, token values not printed |
| `C:\Users\hp\esimprove\.netlify\state.json` | Linked site ID |
| `C:\Users\hp\esimprove\netlify.toml` | Netlify build configuration |
| `C:\Users\hp\esimprove\package.json` | Scripts; no deploy script |
| `C:\Users\hp\esimprove\.github\workflows\ci.yml` | CI only; no deploy; read-only permissions |
| `C:\Users\hp\esimprove\.env.local` | Key-name scan only; no Netlify keys |
| `C:\Users\hp\esimprove\.env.netlify.production` | Key-name scan only; no Netlify keys |
| `C:\Users\hp\.config\opencode\opencode.json` | OpenCode global config; no Netlify/MCP references |
| `%APPDATA%\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt` | Netlify command history; no deploy |
| `C:\Users\hp\.local\share\opencode\` | OpenCode logs, shell output, tool output, session DB |
| `...\netlify-cli\dist\commands\login\login.js` | OAuth login flow |
| `...\netlify-cli\dist\commands\base-command.js` | `storeToken`, `authenticate` |
| `...\netlify-cli\dist\utils\command-helpers.js` | `getToken` precedence |
| `...\netlify-cli\dist\commands\logout\logout.js` | Local-only logout behavior |
| `...\netlify-cli\node_modules\@netlify\open-api\dist\swagger.json` | `stop_builds` definition |

### A.2 Key read-only commands and endpoints

- `netlify --version`
- `netlify status --json`
- `netlify api getCurrentUser`
- `netlify api listSites`
- `GET https://api.netlify.com/api/v1/sites/40c1119e-df9c-46b0-aa3b-a511c08debb1`
- `GET https://api.netlify.com/api/v1/sites/40c1119e-df9c-46b0-aa3b-a511c08debb1/deploys?per_page=20`
- `netlify login --help`
- `netlify switch --help`
- `netlify status --help`
- `git status`, `git log`, `git remote -v`, `git cat-file`, `git merge-base --is-ancestor` (read-only)
- Read-only SQLite queries against `C:\Users\hp\.local\share\opencode\opencode.db`

### A.3 Prior audit references

- `docs/ESIMPROVE_SECURITY_AUDIT_REPORT.md` — `OPS-01` at lines 34, 301, and 424.
- `docs/ESIMPROVE_SECURITY_FINDINGS.json` — `OPS-01` at lines 248–262 and the related limitation note at line 615.

---

## Appendix B — Unknowns and what would change the conclusions

| Unknown | Why it matters | What would resolve it |
|---|---|---|
| Type/fingerprint of the exposed token | Determines whether revoking the CLI grant is sufficient | Original hand-off record; token prefix/ID/hash; Netlify authorization/PAT inventory |
| Actual deploy trigger | Determines whether CLI auth is required | Netlify audit logs; actor/IP metadata; a controlled deploy test with approval |
| Whether `stop_builds` was true during the recent deploys | Explains why deploys exist despite the current setting | Netlify settings-change audit log; site event history |
| Whether the deploy hook was used | A hook is a separate credential and attack surface | Hook metadata/audit logs; automation inventory |
| CLI token write scope | Determines blast radius if exposed | A controlled, non-production write test with approval (not performed) |
| Second stored token validity/use | Determines whether another account is at risk | Account owner review; controlled read-only test with approval |
| Whether OpenCode ever ran `netlify deploy` in another session/machine | Determines whether revoking the CLI token breaks the workflow | Full session/command audit across machines; shell history review |
| Whether Netlify audit logs show unauthorized activity | Determines whether downstream secret rotation is needed | Netlify audit-log review (plan-dependent) |

**What would change the primary conclusion:**

- Finding a recorded token prefix/ID that matches the active CLI OAuth grant would confirm that the exposed credential is the CLI token.
- Finding a separate `nfp_` PAT in a secret store/CI would make that PAT the primary suspect, and revoking the CLI grant alone would not remediate it.
- A Netlify audit log showing no token/authorization events and no unexpected deploys would reduce the likelihood of active misuse, but would not prove the token was never exposed.
- A controlled deploy test showing Git-triggered builds work with the CLI logged out would confirm that CLI revocation does not interrupt the Git workflow (subject to `stop_builds` being resolved).

---

**End of report. No remediation was implemented.**
