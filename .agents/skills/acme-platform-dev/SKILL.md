---
name: acme-platform-dev
description: Development workflow, environment setup, testing, and building for ACME R&D Platform (Django + React/Vite).
---

# ACME R&D Platform Development Skill

Use this skill when developing, testing, or building features in the ACME R&D Platform.

## Environment & Path Setup

- **Python & Backend Virtual Environment**:
  - Managed via `uv` (`C:\Users\Mir Minhaz Uddin\.local\bin\uv.exe`).
  - Virtualenv location: `backend\.venv` (Using Python 3.12 for native RDKit `rdBase` DLL compatibility on Windows).
  - Setup virtualenv:
    ```powershell
    & "C:\Users\Mir Minhaz Uddin\.local\bin\uv.exe" venv --python 3.12 .venv
    & "C:\Users\Mir Minhaz Uddin\.local\bin\uv.exe" pip install -r requirements.txt
    ```
  - Execute backend commands from `backend/`:
    ```powershell
    & "C:\Users\Mir Minhaz Uddin\.local\bin\uv.exe" run python manage.py <command>
    ```

- **Node.js & Frontend Tooling**:
  - Node.js executable directory: `C:\Users\Mir Minhaz Uddin\AppData\Local\Programs\NodeJS`.
  - Before running `npm` or `vite` commands in PowerShell, prepend to PATH:
    ```powershell
    $env:PATH = "C:\Users\Mir Minhaz Uddin\AppData\Local\Programs\NodeJS;" + $env:PATH
    ```

## Common Workflows

### 1. Backend Testing & Migrations
```powershell
cd backend
& "C:\Users\Mir Minhaz Uddin\.local\bin\uv.exe" run --active python manage.py migrate
& "C:\Users\Mir Minhaz Uddin\.local\bin\uv.exe" run --active python manage.py test
```

### 2. Frontend Development & Build Verification
```powershell
cd frontend
$env:PATH = "C:\Users\Mir Minhaz Uddin\AppData\Local\Programs\NodeJS;" + $env:PATH
npm run build
```

### 3. Local Development Servers
- **Backend API**: `python manage.py runserver` (Port 8000)
- **Frontend Dashboard**: `npm run dev` (Port 5173, proxies `/api` to port 8000)
