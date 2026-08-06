$exe = "$PSScriptRoot\cloudflared_live.exe"
$log = "$PSScriptRoot\tunnel.log"
if (Test-Path $log) { Remove-Item $log }
Start-Process -FilePath $exe -ArgumentList "tunnel", "--url", "http://localhost" -RedirectStandardError $log -NoNewWindow
Start-Sleep -Seconds 6
Get-Content $log
