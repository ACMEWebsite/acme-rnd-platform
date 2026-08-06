import urllib.request
import os

url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
out_path = os.path.join(".tools", "cloudflared_fresh.exe")

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
print(f"Downloading from {url}...")
with urllib.request.urlopen(req) as response, open(out_path, "wb") as out_file:
    data = response.read()
    out_file.write(data)
    print(f"Saved {len(data)} bytes to {out_path}")
