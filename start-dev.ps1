# start-dev.ps1
# Starter Next.js dashboard med Cloudflare-tunnel.
# Oppdaterer next.config.ts automatisk med ny tunnel-URL.
# Bruk: npm run tunnel
#
# Port 3002 — avgrenset til EGNE tidligere prosesser (lagret PID), ikke alt som
# heter node/cloudflared, slik at dette kan kjøre samtidig med andre prosjekter
# (mitt-dashboard på 3000, cl-spillet på 3001) uten å drepe hverandre.

$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $root

$devPidFile = Join-Path $root "dev-server.pid"
$tunnelPidFile = Join-Path $root "cloudflared.pid"

# -- 1. Rydd opp KUN denne appens tidligere prosesser -------------------------
Write-Host ""
Write-Host "  Stopper denne appens tidligere prosesser..." -ForegroundColor DarkGray
foreach ($pidFile in @($devPidFile, $tunnelPidFile)) {
    if (Test-Path $pidFile) {
        $oldPid = Get-Content $pidFile -ErrorAction SilentlyContinue
        if ($oldPid) {
            # /T dreper hele prosess-treet (cmd.exe -> npm -> node), ikke bare wrapperen
            taskkill /PID $oldPid /T /F 2>$null | Out-Null
        }
        Remove-Item $pidFile -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 1
Remove-Item "$root\cloudflared-err.log","$root\dev-server.log" -ErrorAction SilentlyContinue

# -- 2. Start cloudflared -----------------------------------------------------
Write-Host "  Starter Cloudflare-tunnel..." -ForegroundColor DarkGray
$tunnelProcess = Start-Process -FilePath "$root\cloudflared.exe" `
    -ArgumentList "tunnel","--url","http://localhost:3002" `
    -RedirectStandardError "$root\cloudflared-err.log" `
    -NoNewWindow -PassThru
$tunnelProcess.Id | Out-File -FilePath $tunnelPidFile -Encoding ascii

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

# -- 5. Start dev-server på port 3002 med oppdatert config --------------------
Write-Host "  Starter Next.js dev-server (port 3002)..." -ForegroundColor DarkGray
$devProcess = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npx next dev -p 3002 > `"$root\dev-server.log`" 2>&1" `
    -WorkingDirectory $root `
    -WindowStyle Hidden -PassThru
$devProcess.Id | Out-File -FilePath $devPidFile -Encoding ascii

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
Write-Host "  Lokalt:      http://localhost:3002" -ForegroundColor DarkGray
Write-Host "  Dev-logg:    $root\dev-server.log" -ForegroundColor DarkGray
Write-Host "  Tunnel-logg: $root\cloudflared-err.log" -ForegroundColor DarkGray
Write-Host ""

# -- 7. Start Claude Code med Remote Control i eget vindu ---------------------
Write-Host "  Starter Claude Code (Remote Control) i eget vindu..." -ForegroundColor DarkGray
$claudeCmd = "Set-Location `"$root`"; claude --remote-control `"Mikke-mus`""
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit","-Command",$claudeCmd `
    -WorkingDirectory $root

Write-Host "  Se etter link/QR-kode i det nye vinduet - apne den i Claude-appen pa mobilen." -ForegroundColor DarkGray
Write-Host ""
