# ESIMPROVE local dev startup — the ONLY sanctioned way to run the app locally.
#
# Usage (from anywhere):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev-local.ps1
#
# What it does:
#   1. Pins PGLITE_DATA_DIR to .audit/impl-db — the CURRENT working database
#      (contains the admin account with its current password, audit history, etc.).
#      The env var wins over .env.local, so .env.local is NOT modified.
#   2. Sets ADMIN_2FA_REQUIRED=false to match the current local configuration
#      (admin can sign in with email+password; TOTP remains enabled on the account
#      and is required wherever TOTP is enforced).
#   3. Starts the Next.js dev server on port 3000 and prints the URLs.
#
# IMPORTANT — shutdown discipline (PGlite on Windows):
#   * Prefer Ctrl+C in THIS window so PGlite shuts down cleanly.
#   * NEVER force-kill the process (Task Manager "End task", Stop-Process -Force,
#     closing the window is tolerated but not ideal). After ANY unclean stop,
#     PGlite replays the WAL automatically on the next start (~1-2 s) — that is
#     normal and safe, but repeated unclean stops are how the database got
#     corrupted in the first place. Avoid them.
#
# Layout notes:
#   .audit/            gitignored scratch space — NEVER commit it, NEVER delete the
#                      archived impl-db-* recovery copies.
#   .audit/impl-db     LIVE working database. Never rebuild, reset or swap it.
#   .pglite/           LEGACY database — untouched, do not point the app at it.
#   .env.local         used as-is (not read or modified by this script beyond
#                      what Next.js itself loads).

$ErrorActionPreference = 'Stop'

# Run from the repository root regardless of the caller's working directory.
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $RepoRoot

$env:PGLITE_DATA_DIR   = '.audit/impl-db'
$env:ADMIN_2FA_REQUIRED = 'false'

Write-Host ''
Write-Host 'ESIMPROVE dev server' -ForegroundColor Cyan
Write-Host '--------------------'
Write-Host "  Repo root : $RepoRoot"
Write-Host '  Database  : .audit/impl-db (PGLITE_DATA_DIR overrides .env.local)'
Write-Host '  2FA login : ADMIN_2FA_REQUIRED=false (account TOTP stays enabled)'
Write-Host '  App URL   : http://localhost:3000'
Write-Host '  Login     : http://localhost:3000/login  (admin dashboard: /admin)'
Write-Host ''
Write-Host 'Stop with Ctrl+C. Do not force-kill the process.' -ForegroundColor Yellow
Write-Host ''

if (-not (Test-Path '.audit/impl-db')) {
  Write-Host 'ERROR: .audit/impl-db not found. Refusing to start against the wrong database.' -ForegroundColor Red
  exit 1
}
if (Test-Path '.audit/impl-db/postmaster.pid') {
  Write-Host 'NOTE: postmaster.pid present — a previous unclean stop will trigger automatic' -ForegroundColor Yellow
  Write-Host '      crash recovery on start (safe, ~1-2 s).' -ForegroundColor Yellow
  Write-Host ''
}

npx next dev -p 3000
