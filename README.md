# ACME R&D Platform

Incremental replacement for the legacy Streamlit prototype. The original ACME_Rnd_Intelligence repository is intentionally not modified.

## First migration slice

- Django REST Framework backend
- PostgreSQL persistence and calculation audit records
- Token-authenticated API
- React, TypeScript and Tailwind dashboard shell
- Dissolution simulation API and screen
- Pharmacokinetics prediction and PSG guidance workspace
- Literature review with local PDF/OCR extraction and page-cited evidence retrieval
- FDA/UK registry workspace and DOE factorial-design workflow
- Caddy reverse proxy and Docker Compose deployment
- PostgreSQL backup script

## Layout

- backend: Django application and domain services
- frontend: React dashboard
- deployment: reverse proxy and operational scripts
- compose.yaml: office-server stack

## Local development

Backend (PowerShell):

    cd backend
    py -m venv .venv
    .\.venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    $env:DATABASE_ENGINE = "sqlite"
    python manage.py migrate
    python manage.py createsuperuser
    python manage.py runserver

Frontend, in a second terminal:

    cd frontend
    npm install
    npm run dev

Open http://localhost:5173 and sign in with the Django user. Vite proxies API calls to port 8000. For office deployment, read deployment/README.md.

The current Docker deployment is served over HTTP while the Windows-hosted
environment is being prepared for a trusted certificate. Do not expose it
outside a trusted development network. The backend entrypoint automatically
repairs ownership of the `django_static` named volume before dropping to the
unprivileged `acme` user, so `collectstatic` no longer needs a manual
permission fix.

## Pharmacokinetics migration

After updating an existing installation:

    cd backend
    .\.venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    $env:DATABASE_ENGINE = "sqlite"
    $env:DJANGO_DEBUG = "true"
    python manage.py migrate
    python manage.py test apps.pharmacokinetics

The first PSG search synchronizes the official Regulations.gov dataset. Set
`REGULATIONS_GOV_API_KEY` for a higher API quota. Direct SMILES predictions
remain local unless PubChem enrichment is selected. MolGpKa is optional and
falls back to the local structural heuristic unless `MOLGPKA_TOKEN` is set.

## Literature review migration

The literature workspace processes up to 10 PDFs per review (25 MB each,
300 pages total). Text-based PDFs are extracted directly, while scanned pages
use local Tesseract OCR. Raw PDFs remain in the browser for preview and are not saved
by Django. Extracted text is stored in the local database only for the active
workspace and supports offline, page-cited evidence retrieval.

OCR defaults to English at 200 DPI. These can be adjusted with
`LITERATURE_OCR_LANGUAGES` and `LITERATURE_OCR_DPI` (100-300) before deployment.

Gemini synthesis is disabled by default because it sends extracted document
text outside the office network. To make the option available, set
`LITERATURE_EXTERNAL_AI_ENABLED=true` and `GEMINI_API_KEY` on the backend.
Users must still acknowledge the privacy notice for each Gemini request.
