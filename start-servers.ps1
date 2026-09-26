$ErrorActionPreference = "Stop"
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$VENV_PYTHON = Join-Path $DIR "backend\.venv\Scripts\python.exe"
$NPM_CMD = "C:\Program Files\nodejs\npm.cmd"

foreach ($port in 8000, 5173) {
    $lines = netstat -ano | Select-String ":${port}\s" | Select-String "LISTENING"
    foreach ($line in $lines) {
        $tokens = ($line.ToString().Trim() -split "\s+")
        Stop-Process -Id ([int]$tokens[-1]) -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 2

Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine       = "`"$VENV_PYTHON`" -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
    CurrentDirectory  = Join-Path $DIR "backend"
} | Out-Null

Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine       = "`"$NPM_CMD`" run dev"
    CurrentDirectory  = Join-Path $DIR "frontend"
} | Out-Null