---
name: acme-cheminformatics-and-registries
description: Guidance on using scientific engines, RDKit QSAR, PubChem, ChEMBL, OpenFDA, and literature extractors in ACME R&D Platform.
---

# ACME Scientific & Cheminformatics Skill

Use this skill when modifying or expanding scientific calculation modules, molecular property predictors, or regulatory registry query services.

## Engine & Service Architecture

1. **Pharmacokinetics & ADMET** (`backend/apps/pharmacokinetics/`):
   - Local RDKit descriptor calculation (24 topological/physicochemical properties).
   - Local Lipinski, Veber, and lead-likeness rule evaluation.
   - Optional external enrichment via PubChem and ChEMBL APIs (fallback to local prediction when offline/unreachable).

2. **Dissolution Simulation** (`backend/apps/dissolution/`):
   - Pure Python mathematical simulation engine (`domain.py`) with zero external graphics library dependencies.
   - Accepts plain Python values, outputs JSON-safe records.

3. **API Characterization** (`backend/apps/characterization/`):
   - Fetches structure, CAS, formula, MW, and solubility directly from PubChem and ChEMBL REST endpoints.
   - Pure REST API calls without web scraping.

4. **Regulatory Registries & PSG** (`backend/apps/registries/`):
   - Local Orange Book and Inactive Ingredients Database (IID) relational tables.
   - FDA Product Specific Guidance (PSG) synchronization with Regulations.gov API.

5. **Literature Intelligence & Local Extraction** (`backend/apps/literature/`):
   - Direct PyMuPDF text extraction with local Tesseract OCR fallback for scanned pages.
   - Local page-cited vector / evidence search.
   - External LLM synthesis (Gemini) requires explicit server enablement (`LITERATURE_EXTERNAL_AI_ENABLED=true`) and user consent per request.

## Standard Domain Guidelines

- **Decoupling**: Keep domain logic pure Python functions in `domain.py` or `services/`.
- **Validation**: Validate input types and SMILES strings before passing to RDKit.
- **Audit Logging**: Store calculation parameters and timestamped audit logs in PostgreSQL/SQLite models.
