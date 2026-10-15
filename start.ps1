# Lance les 4 briques du projet, chacune dans sa propre fenêtre
$root = $PSScriptRoot

$services = @(
    @{ Name = "API Auth (8001)";  Dir = "auth-service"; Cmd = ".\.venv\Scripts\python -m uvicorn app.main:app --port 8001 --reload" },
    @{ Name = "API OST (8002)";   Dir = "ost-service";  Cmd = ".\.venv\Scripts\python -m uvicorn app.main:app --port 8002 --reload" },
    @{ Name = "BFF (3000)";       Dir = "bff";          Cmd = "npm run dev" },
    @{ Name = "Front (5173)";     Dir = "frontend";     Cmd = "npm run dev" }
)

foreach ($s in $services) {
    $command = "`$Host.UI.RawUI.WindowTitle = '$($s.Name)'; Set-Location '$root\$($s.Dir)'; $($s.Cmd)"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $command
}

Write-Host "Site disponible sur http://localhost:5173" -ForegroundColor Green
