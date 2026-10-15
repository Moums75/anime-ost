# Lance tous les tests du projet (à lancer après setup.ps1)
$root = $PSScriptRoot
$failed = @()

function Run($name, $dir, $command) {
    Write-Host "`n== $name" -ForegroundColor Cyan
    Push-Location "$root\$dir"
    Invoke-Expression $command
    if ($LASTEXITCODE -ne 0) { $script:failed += $name }
    Pop-Location
}

Run "API Auth (pytest)"   "auth-service" ".\.venv\Scripts\python -m pytest -q"
Run "API Métier (pytest)" "ost-service"  ".\.venv\Scripts\python -m pytest -q"
Run "BFF (node:test)"     "bff"          "npm test --silent"
Run "Front (Vitest)"      "frontend"     "npm test --silent"

if ($failed.Count -eq 0) {
    Write-Host "`nTous les tests passent." -ForegroundColor Green
} else {
    Write-Host "`nÉchecs : $($failed -join ', ')" -ForegroundColor Red
    exit 1
}
