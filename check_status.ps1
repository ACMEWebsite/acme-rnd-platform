# ACME R&D Platform - Automated Status Checker Script

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " ACME R&D Platform - System Health Check " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check Backend Tests
Write-Host "`n[1/2] Running Backend Django Unit Tests..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\backend"
$uvPath = "C:\Users\Mir Minhaz Uddin\.local\bin\uv.exe"

if (Test-Path $uvPath) {
    & $uvPath run python manage.py test
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Backend Tests: PASSED (All tests clean)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Backend Tests: FAILED" -ForegroundColor Red
    }
} else {
    Write-Host "[FAIL] uv executable not found at $uvPath" -ForegroundColor Red
}

# 2. Check Frontend Build
Write-Host "`n[2/2] Running Frontend Build Check..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\frontend"
$env:PATH = "C:\Users\Mir Minhaz Uddin\AppData\Local\Programs\NodeJS;" + $env:PATH

npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Frontend Build: PASSED (Clean Vite build)" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Frontend Build: FAILED" -ForegroundColor Red
}

Set-Location $PSScriptRoot
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host " Health Check Complete. Log: PROGRESS_LOG.md" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
