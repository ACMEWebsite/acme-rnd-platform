$exe = "$PSScriptRoot\.tools\cloudflared_go.exe"
$out = "$PSScriptRoot\.tools\cf_tunnel_out.log"
$err = "$PSScriptRoot\.tools\cf_tunnel_err.log"
if (Test-Path $out) { Remove-Item $out }
if (Test-Path $err) { Remove-Item $err }
Start-Process -FilePath $exe -ArgumentList "tunnel", "--url", "http://127.0.0.1:80" -RedirectStandardOutput $out -RedirectStandardError $err -NoNewWindow
Start-Sleep -Seconds 7
if (Test-Path $err) { Get-Content $err }
if (Test-Path $out) { Get-Content $out }
