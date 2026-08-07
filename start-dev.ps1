# start-dev.ps1
# Starter Next.js dashboard med Cloudflare-tunnel.
# Oppdaterer next.config.ts automatisk med ny tunnel-URL.
# Bruk: npm run tunnel

$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $root

# -- 1. Rydd opp eksisterende prosesser ---------------------------------------
Write-Host ""
Write-Host "  Stopper eksisterende prosesser..." -ForegroundColor DarkGray
Get-Process -Name "node","cloudflared" -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Remove-Item "$root\cloudflared-err.log","$root\dev-server.log" -ErrorAction SilentlyContinue

# -- 2. Start cloudflared -----------------------------------------------------
Write-Host "  Starter Cloudflare-tunnel..." -ForegroundColor DarkGray
Start-Process -FilePath "$root\cloudflared.exe" `
    -ArgumentList "tunnel","--url","http://localhost:3000" `
    -RedirectStandardError "$root\cloudflared-err.log" `
    -NoNewWindow

# -- 3. Les tunnel-URL fra logg -----------------------------------------------
Write-Host "  Venter pa tunnel-URL (maks 30 sek)..." -ForegroundColor DarkGray
$tunnelUrl = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    $log = Get-Content "$root\cloudflared-err.log" -Raw -ErrorAction SilentlyContinue
    if ($log -match "https://[a-z0-9][a-z0-9-]+\.trycloudflare\.com") {
        $tunnelUrl = $Matches[0]
        break
    }
}

if (-not $tunnelUrl) {
    Write-Host "  FEIL: Fant ikke tunnel-URL. Sjekk cloudflared-err.log." -ForegroundColor Red
    exit 1
}

$hostname = $tunnelUrl -replace "^https://",""

# -- 4. Oppdater next.config.ts -----------------------------------------------
Write-Host "  Oppdaterer next.config.ts..." -ForegroundColor DarkGray
$configPath = Join-Path $root "next.config.ts"
$config = Get-Content $configPath -Raw

if ($config -match "trycloudflare\.com") {
    $config = $config -replace '"[a-z0-9][a-z0-9-]+\.trycloudflare\.com"', ('"' + $hostname + '"')
} else {
    $config = $config -replace '(allowedDevOrigins\s*:\s*\[)', ('$1' + "`n    `"$hostname`",")
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($configPath, $config, $utf8NoBom)

# -- 5. Start dev-server med oppdatert config ---------------------------------
Write-Host "  Starter Next.js dev-server..." -ForegroundColor DarkGray
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npm run dev > `"$root\dev-server.log`" 2>&1" `
    -WorkingDirectory $root `
    -WindowStyle Hidden

Write-Host "  Venter pa dev-server (maks 30 sek)..." -ForegroundColor DarkGray
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    $log = Get-Content "$root\dev-server.log" -Raw -ErrorAction SilentlyContinue
    if ($log -match "Ready in") { break }
}

# -- 6. Vis resultatet --------------------------------------------------------
$sep = "=" * 58
Write-Host ""
Write-Host "  $sep" -ForegroundColor Green
Write-Host "  Tunnel klar - kopier til mobilen:" -ForegroundColor Green
Write-Host ""
Write-Host "  $tunnelUrl" -ForegroundColor White
Write-Host ""
Write-Host "  $sep" -ForegroundColor Green
Write-Host ""
Write-Host "  Lokalt:      http://localhost:3000" -ForegroundColor DarkGray
Write-Host "  Dev-logg:    $root\dev-server.log" -ForegroundColor DarkGray
Write-Host "  Tunnel-logg: $root\cloudflared-err.log" -ForegroundColor DarkGray
Write-Host ""
