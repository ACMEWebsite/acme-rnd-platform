$log = "$PSScriptRoot\.tools\tunnel_fresh.log"
if (Test-Path $log) { Remove-Item $log }
Start-Process -FilePath "ssh" -ArgumentList "-o", "StrictHostKeyChecking=no", "-R", "80:localhost:80", "nokey@localhost.run" -RedirectStandardError $log -NoNewWindow
Start-Sleep -Seconds 6
Get-Content $log
