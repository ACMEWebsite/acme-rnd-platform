$out = "$PSScriptRoot\.tools\serveo_out.log"
$err = "$PSScriptRoot\.tools\serveo_err.log"
if (Test-Path $out) { Remove-Item $out }
if (Test-Path $err) { Remove-Item $err }
Start-Process -FilePath "ssh" -ArgumentList "-o", "StrictHostKeyChecking=no", "-R", "80:127.0.0.1:80", "serveo.net" -RedirectStandardOutput $out -RedirectStandardError $err -NoNewWindow
Start-Sleep -Seconds 6
if (Test-Path $out) { Get-Content $out }
if (Test-Path $err) { Get-Content $err }
