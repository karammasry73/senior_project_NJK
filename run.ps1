#!/usr/bin/env powershell
# Starts the backend (FastAPI/uvicorn) and frontend (Vite) dev servers together.
# Any stale dev servers on ports 8000/5173 are stopped first so a rerun is always clean.
# Ctrl+C stops both. Ollama is a separate system service and isn't managed here -
# start it yourself first (`ollama serve`) if it isn't already running.
$ErrorActionPreference = "Stop"

$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND_DIR = Join-Path $DIR "backend"
$FRONTEND_DIR = Join-Path $DIR "frontend"

$VENV_PYTHON = Join-Path $BACKEND_DIR ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $VENV_PYTHON)) {
    Write-Error "error: backend/.venv not found - set it up first:"
    Write-Error "  cd backend && python -m venv .venv && .venv\Scripts\pip install -r requirements.txt"
    exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $FRONTEND_DIR "node_modules"))) {
    Write-Error "error: frontend/node_modules not found - run 'npm install' in frontend/ first"
    exit 1
}

function Stop-StaleDevServers {
    # Kill any leftover frontend/backend dev processes from a previous run so
    # stale sockets (and their child processes) never block ports 8000/5173.
    $stale = Get-CimInstance Win32_Process | Where-Object {
        $nc = if ($_.CommandLine) { $_.CommandLine } else { "" }
        ($_.Name -like "python*" -and $nc -match "uvicorn app\.main:app") -or
        ($_.Name -eq "node.exe" -and $nc -match "vite") -or
        ($nc -match "npm.*run dev")
    }
    if ($stale) {
        Write-Host "Stopping stale dev process(es): $(($stale | ForEach-Object { $_.ProcessId }) -join ', ')"
        foreach ($p in $stale) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
    }

    # Net that same net: also kill anything still LISTENING on our two ports.
    foreach ($port in 8000, 5173) {
        $lines = netstat -ano | Select-String ":${port}\s" | Select-String "LISTENING"
        foreach ($line in $lines) {
            $tokens = ($line.ToString().Trim() -split "\s+")
            $ownerPid = [int]$tokens[-1]
            Write-Host "Port ${port} held by PID $ownerPid - stopping."
            Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 2
}

Stop-StaleDevServers

$backend = Start-Process -FilePath $VENV_PYTHON -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload") -WorkingDirectory $BACKEND_DIR -PassThru -NoNewWindow
$frontend = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev") -WorkingDirectory $FRONTEND_DIR -PassThru -NoNewWindow

Write-Host ""
Write-Host "Backend (FastAPI) on http://127.0.0.1:8000 ..."
Write-Host "Frontend (Vite)   on http://localhost:5173 ..."
Write-Host "Press Ctrl+C to stop both."
Write-Host ""

try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    Write-Host "`nStopping..."
    foreach ($p in $backend, $frontend) {
        if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
    }
}