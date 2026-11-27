# Porneste backend-ul (8080) si frontend-ul (8000). Ctrl+C opreste ambele.
$root = $PSScriptRoot
$py = Join-Path $root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }

$backend = Start-Process $py -ArgumentList "-m uvicorn backend.main:app --reload --port 8080" `
    -WorkingDirectory $root -NoNewWindow -PassThru
$frontend = Start-Process "npm.cmd" -ArgumentList "run dev" `
    -WorkingDirectory (Join-Path $root "frontend") -NoNewWindow -PassThru

Write-Host "Backend:  http://localhost:8080  (docs: /docs)"
Write-Host "Frontend: http://localhost:8000"
Write-Host "Ctrl+C pentru oprire."

try {
    while (-not $backend.HasExited -and -not $frontend.HasExited) { Start-Sleep -Seconds 1 }
}
finally {
    foreach ($p in @($backend, $frontend)) {
        if ($p -and -not $p.HasExited) { taskkill /PID $p.Id /T /F | Out-Null }
    }
}
