# Installe toutes les dépendances du projet (à lancer une seule fois)
$ErrorActionPreference = "Stop"

foreach ($svc in "auth-service", "ost-service") {
    Write-Host "== $svc (Python)" -ForegroundColor Cyan
    Push-Location "$PSScriptRoot\$svc"
    python -m venv .venv
    .\.venv\Scripts\python -m pip install -q -r requirements-dev.txt  # dépendances + outils de test
    Pop-Location
}

foreach ($app in "bff", "frontend") {
    Write-Host "== $app (TypeScript)" -ForegroundColor Cyan
    Push-Location "$PSScriptRoot\$app"
    npm install
    Pop-Location
}

Write-Host "Installation terminée. Lance .\start.ps1" -ForegroundColor Green
