$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$python = Join-Path $PSScriptRoot '.runtime\Scripts\python.exe'
if (-not (Test-Path $python)) {
    Write-Host 'Setup has not been completed. Run install_windows.bat first.' -ForegroundColor Yellow
    Read-Host 'Press Enter to exit'
    exit 1
}

if (-not (Test-Path (Join-Path $PSScriptRoot 'index_data\product_index.faiss'))) {
    Write-Host 'Product index is missing: index_data\product_index.faiss' -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
}

Write-Host 'Starting AI Product Scan...' -ForegroundColor Cyan
$proc = Start-Process -FilePath $python -ArgumentList 'app.py --index_dir .\index_data --host 127.0.0.1 --port 5000' -WorkingDirectory $PSScriptRoot -PassThru -NoNewWindow

try {
    $ready = $false
    for ($i = 0; $i -lt 180; $i++) {
        Start-Sleep -Seconds 1
        if ($proc.HasExited) { throw 'The application stopped before the web server was ready.' }
        try {
            $client = New-Object Net.Sockets.TcpClient
            $client.Connect('127.0.0.1', 5000)
            $client.Close()
            $ready = $true
            break
        } catch { }
    }
    if (-not $ready) { throw 'The web server did not start within 180 seconds.' }
    Start-Process 'http://127.0.0.1:5000'
    Write-Host 'Browser opened at http://127.0.0.1:5000' -ForegroundColor Green
    Write-Host 'Close this window to stop the application.' -ForegroundColor Yellow
    Wait-Process -Id $proc.Id
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
    Read-Host 'Press Enter to exit'
    exit 1
}
