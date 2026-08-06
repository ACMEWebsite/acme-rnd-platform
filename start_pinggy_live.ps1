$out = "$PSScriptRoot\.tools\pinggy_live_out.log"
$err = "$PSScriptRoot\.tools\pinggy_live_err.log"
if (Test-Path $out) { Remove-Item $out }
if (Test-Path $err) { Remove-Item $err }
Start-Process -FilePath "ssh" -ArgumentList "-t", "-t", "-o", "StrictHostKeyChecking=no", "-p", "443", "-R0:127.0.0.1:80", "free.pinggy.io" -RedirectStandardOutput $out -RedirectStandardError $err -NoNewWindow
Start-Sleep -Seconds 6
if (Test-Path $out) { Get-Content $out }
if (Test-Path $err) { Get-Content $err }
