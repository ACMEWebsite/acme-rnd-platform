# ACME R&D Platform Coding Standards & Rules

## 1. Backend Standards (Django REST Framework)
- Keep view classes thin; delegate complex business logic to `services` or `domain.py`.
- Ensure all API endpoints are authenticated (`IsAuthenticated`) unless explicitly designated as public/auth views.
- Write unit tests under `<app>/tests/` for all new endpoints or calculations.
- Maintain test coverage for RDKit molecular parsing fallbacks and external API timeouts.

## 2. Frontend Standards (React + TypeScript + Tailwind CSS)
- Maintain strict TypeScript types for API request/response payloads in `src/api/`.
- Prioritize clean UX with modern design aesthetics, clear typography, and responsive layouts.
- Avoid inline hardcoded static magic numbers for layout heights.

## 3. Data Privacy & Egress
- Literature extraction text and local PDFs must remain strictly on internal infrastructure by default.
- External API calls (PubChem, Regulations.gov, ChEMBL) must handle request timeouts gracefully without blocking the UI.
