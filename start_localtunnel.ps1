$env:PATH = "C:\Users\Mir Minhaz Uddin\AppData\Local\Programs\NodeJS;" + $env:PATH
$out = "$PSScriptRoot\.tools\lt_out.log"
$err = "$PSScriptRoot\.tools\lt_err.log"
if (Test-Path $out) { Remove-Item $out }
if (Test-Path $err) { Remove-Item $err }
Start-Process -FilePath "npx.cmd" -ArgumentList "localtunnel", "--port", "80", "--subdomain", "acme-platform" -RedirectStandardOutput $out -RedirectStandardError $err -NoNewWindow
Start-Sleep -Seconds 6
if (Test-Path $out) { Get-Content $out }
if (Test-Path $err) { Get-Content $err }
