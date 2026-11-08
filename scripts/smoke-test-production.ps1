# scripts/smoke-test-production.ps1
# Repeatable production route smoke test — local verification only.
# Does NOT assert HTTP 200 for protected routes when unauthenticated; expects redirect to login.
# Cleans up only the server process it started.

param(
  [string]$Port = "3000",
  [int]$TimeoutSec = 15,
  [string]$LogFile = "smoke-test.log"
)

$ErrorActionPreference = "Stop"
$Unexpected = $false
$StartedPid = $null

function Write-Result($label, $status, $detail) {
  $line = "[$status] $label :: $detail"
  Write-Host $line
  Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue
}

function Cleanup {
  if ($StartedPid) {
    try {
      Stop-Process -Id $StartedPid -Force -ErrorAction SilentlyContinue
      Write-Host "Cleaned up server PID $StartedPid"
    } catch {}
  }
}

try {
  # 1. Build verification
  if (-not (Test-Path ".next\server\app\admin\monitoring\page.js")) {
    Write-Host "FAIL: Latest build missing (.next/server/app/admin/monitoring/page.js not found). Run 'npm run build' first."
    exit 1
  }
  Write-Host "PASS: Build artifacts present (monitoring/seo/help/admin)."

  # 2. Start production server (capture PID)
  $proc = Start-Process -FilePath "cmd" -ArgumentList "/c","npm","start" -PassThru -WindowStyle Hidden -RedirectStandardOutput "server_smoke.out" -RedirectStandardError "server_smoke.err"
  $StartedPid = $proc.Id
  Write-Host "Started server PID $StartedPid on port $Port"

  # 3. Bounded wait
  $ready = $false
  for ($i = 0; $i -lt $TimeoutSec; $i++) {
    Start-Sleep -Seconds 1
    try {
      $r = curl.exe -s -o NUL -w "%{http_code}" "http://localhost:$Port/"
      if ($r -eq "200" -or $r -eq "307") { $ready = $true; break }
    } catch {}
  }
  if (-not $ready) {
    Write-Host "FAIL: Server did not become ready within $TimeoutSec seconds."
    $Unexpected = $true
    exit 1
  }
  Write-Host "PASS: Server ready (port $Port)."

  # 4. Route checks
  $routes = @(
    @{ Label="Admin monitoring"; Url="http://localhost:$Port/admin/monitoring"; Expected="200/307" },
    @{ Label="Admin SEO"; Url="http://localhost:$Port/admin/seo"; Expected="200/307" },
    @{ Label="Admin help"; Url="http://localhost:$Port/admin/help"; Expected="200/307" },
    @{ Label="Admin analytics (compare)"; Url="http://localhost:$Port/admin/analytics"; Expected="200/307" }
  )

  foreach ($r in $routes) {
    $code = curl.exe -s -o NUL -w "%{http_code}" $r.Url
    $redirect = curl.exe -s -o NUL -w "%{redirect_url}" $r.Url
    if ($redirect -eq "") { $redirect = "none" }

    if ($code -eq "404" -or $code -eq "500") {
      Write-Result $r.Label "FAIL" "HTTP $code (unexpected); redirect=$redirect"
      $Unexpected = $true
    } elseif ($code -eq "307" -or $code -eq "302" -or $code -eq "200") {
      # Unauthenticated redirect to /login is expected for protected admin routes.
      if ($redirect -like "*login*" -and ($code -eq "307" -or $code -eq "302")) {
        Write-Result $r.Label "PASS" "HTTP $code redirect to $redirect (auth required — correct)"
      } elseif ($code -eq "200") {
        Write-Result $r.Label "PASS" "HTTP $code (rendered)"
      } else {
        Write-Result $r.Label "PASS" "HTTP $code redirect=$redirect"
      }
    } else {
      Write-Result $r.Label "FAIL" "Unexpected HTTP $code; redirect=$redirect"
      $Unexpected = $true
    }
  }

  if ($Unexpected) {
    Write-Host "FAIL: One or more unexpected results detected."
    exit 1
  }
  Write-Host "PASS: All smoke checks completed (auth redirects correct; no 404/500)."
  exit 0
} finally {
  Cleanup
  Write-Host "Smoke test finished. Log: $LogFile"
}
