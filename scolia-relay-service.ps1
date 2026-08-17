# scolia-relay-service.ps1
# Holder scolia-relay kjørende i bakgrunnen: starter automatisk ved innlogging
# (registrert som Scheduled Task "MikkeMus-ScoliaRelay") og restarter den selv
# hvis prosessen crasher, slik at brettet er klart uten manuelle steg.

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

while ($true) {
    Add-Content -Path "$root\scolia-relay-run.log" -Value "`n[service] starter relay $(Get-Date -Format o)" -Encoding utf8
    cmd /c "npm run scolia-relay >> `"$root\scolia-relay-run.log`" 2>&1"
    Add-Content -Path "$root\scolia-relay-run.log" -Value "[service] relay stoppet (exit $LASTEXITCODE) - restarter om 5 sek..." -Encoding utf8
    Start-Sleep -Seconds 5
}
