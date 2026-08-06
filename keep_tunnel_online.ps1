# Persistent Auto-Reconnecting SSH Tunnel Keeper for ACME R&D Platform
$ErrorActionPreference = "SilentlyContinue"

Write-Host "========================================="
Write-Host " ACME Platform Persistent Tunnel Keeper  "
Write-Host "========================================="

while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Launching online SSH tunnel..."
    
    # Run SSH tunnel to localhost.run, outputting to tunnel_live.txt
    ssh -o StrictHostKeyChecking=no -R 80:127.0.0.1:80 nokey@localhost.run > tunnel_live.txt 2>&1
    
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Tunnel disconnected. Auto-reconnecting in 3 seconds..."
    Start-Sleep -Seconds 3
}
