$out = "$PSScriptRoot\.tools\pinggy_out.log"
$err = "$PSScriptRoot\.tools\pinggy_err.log"
if (Test-Path $out) { Remove-Item $out }
if (Test-Path $err) { Remove-Item $err }
Start-Process -FilePath "ssh" -ArgumentList "-o", "StrictHostKeyChecking=no", "-p", "443", "-R0:localhost:80", "a.pinggy.io" -RedirectStandardOutput $out -RedirectStandardError $err -NoNewWindow
Start-Sleep -Seconds 6
if (Test-Path $out) { Get-Content $out }
if (Test-Path $err) { Get-Content $err }
