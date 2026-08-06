$out = "$PSScriptRoot\.tools\tunnel_ipv4_out.log"
$err = "$PSScriptRoot\.tools\tunnel_ipv4_err.log"
if (Test-Path $out) { Remove-Item $out }
if (Test-Path $err) { Remove-Item $err }
Start-Process -FilePath "ssh" -ArgumentList "-o", "StrictHostKeyChecking=no", "-R", "80:127.0.0.1:80", "nokey@localhost.run" -RedirectStandardOutput $out -RedirectStandardError $err -NoNewWindow
Start-Sleep -Seconds 6
if (Test-Path $out) { Get-Content $out }
if (Test-Path $err) { Get-Content $err }
