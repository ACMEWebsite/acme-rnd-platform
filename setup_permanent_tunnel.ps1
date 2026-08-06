# ACME R&D Platform - Cloudflare & Server Permanent Setup Script
$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " ACME R&D Platform - Permanent Setup Tool " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Ensure Docker Stack is Running
Write-Host "[1/3] Starting Docker Container Stack..." -ForegroundColor Yellow
docker compose up -d

# 2. Setup Cloudflare Tunnel Executable
$toolsDir = "$PSScriptRoot\.tools"
if (-not (Test-Path $toolsDir)) { New-Item -ItemType Directory -Path $toolsDir | Out-Null }
$cfExe = "$toolsDir\cloudflared.exe"

if (-not (Test-Path $cfExe) -or (Get-Item $cfExe).Length -lt 1000000) {
    Write-Host "[2/3] Downloading official Cloudflare Tunnel binary..." -ForegroundColor Yellow
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cfExe -UserAgent "Mozilla/5.0"
}

# 3. Create Desktop 1-Click Auto-Start Shortcut
$desktopPath = [System.IO.Path]::Combine($env:USERPROFILE, "OneDrive", "Desktop")
if (-not (Test-Path $desktopPath)) { $desktopPath = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop") }

$batContent = @"
@echo off
title Starting ACME R&D Platform & Global Link...
cd /d "$PSScriptRoot"
echo Starting Docker containers...
docker compose up -d
echo Launching Global Cloudflare Online Tunnel...
"$cfExe" tunnel --url http://127.0.0.1:80
pause
"@

Set-Content -Path "$desktopPath\Start_ACME_Platform.bat" -Value $batContent
Write-Host "[3/3] Created Desktop 1-Click Launcher: Start_ACME_Platform.bat" -ForegroundColor Green

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Setup Complete! You can double-click 'Start_ACME_Platform.bat' on your Desktop anytime." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
