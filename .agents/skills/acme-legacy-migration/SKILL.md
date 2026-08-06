---
name: acme-legacy-migration
description: Legacy Streamlit to Django REST + React migration roadmap and extraction rules for ACME R&D Platform.
---

# ACME Legacy Migration Skill

Use this skill when auditing, implementing, or verifying legacy Streamlit migration tasks referenced in `MIGRATION_INVENTORY.md`.

## Key Migration Rules

1. **Streamlit Decoupling Rule**:
   - Strip all `st.session_state`, `st.write`, `st.sidebar`, Pandas, and Plotly calls from backend engines.
   - Domain functions must accept plain Python dicts/primitives and return JSON-serializable structures.

2. **Frontend Visual Language**:
   - Modern React + TypeScript + Tailwind CSS UI shell.
   - Retain two-level navigation layout (horizontal module rail + sidebar sub-navigation).
   - Use dynamic animations, dark mode capabilities, and clear visual hierarchy.

3. **Status Tracker**:
   - **Migrated**: Dissolution, Pharmacokinetics, API Characterization, Registries, Literature Intelligence, Excipient Compatibility, DOE Factorial Design.
   - **Pending**: AI Assistant (requires approved egress/redaction policy), Preformulation Design (placeholder integration).
