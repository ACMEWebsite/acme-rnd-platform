# Legacy migration inventory

Source reviewed: E:\ACME_Rnd_Intelligence. The source repository remains unchanged.

## Module migration order

| Legacy module | Target feature | Status | Notes |
|---|---|---|---|
| modules/dissolution_behavior.py | backend/apps/dissolution + frontend dissolution feature | First slice created | Pure engine extracted; ADMET lookup remains a later integration |
| utils/dissolution_predictor.py | backend/apps/dissolution/domain.py | Migrated | Reimplemented without Streamlit, Pandas, Plotly, or NumPy |
| utils/rdkit_degradation_engine.py | Not planned | Excluded by owner | Unnecessary for the target platform |
| utils/local_admet_predictor.py, pubchem.py, molgpka_client.py | backend/apps/pharmacokinetics | Migrated | 24-property RDKit/QSAR engine with optional external enrichment |
| modules/pharmacokinetics.py | frontend pharmacokinetics feature | Migrated | Two-tab React interface preserving the original visual language |
| utils/psg_reg_sync.py, psg_search.py | backend/apps/pharmacokinetics + React PSG tab | Migrated | Regulations.gov data is stored relationally and FDA PDFs are proxied securely |
| utils/psg_live_scrape.py | optional backend integration | Migrated, disabled by default | Enable only when the synchronized dataset has no result and Playwright is installed |
| modules/api_characterization.py | backend/apps/characterization + frontend characterization feature | Migrated | PubChem/ChEMBL record selection and source-linked property table; optional web-search enrichment remains unimplemented by design |
| utils/api_characterization_engine.py | backend/apps/characterization | Migrated | Streamlit and Tavily scraping removed from the core workflow; sources are direct APIs |
| modules/rld_information.py | backend/apps/registries + frontend registries feature | Migrated | Local Orange Book and IID snapshots; DailyMed live adapter; MHRA official portal link due browser-mediated disclaimer |
| modules/literature_intelligence.py | backend/apps/literature + frontend literature feature | Migrated | Local PDF extraction and page-cited evidence are default; Gemini requires server enablement and per-request consent |
| modules/drug_excipient_compatibility.py | backend/apps/preformulation + frontend compatibility feature | Migrated | Local RDKit rules, local excipient catalogue, and optional PubMed title matches replace generated evidence |
| modules/ai_assistant.py | backend/apps/assistant | Pending | Requires approved egress and data-redaction policy |
| modules/doe_optimization.py | backend/apps/doe + frontend DOE feature | Migrated | Two-level factorial design generation, manual response entry, weighted goal ranking |
| modules/preformulation_design.py | backend/frontend preformulation feature | Pending | Currently a placeholder |
| modules/home.py | frontend home dashboard | Migrated | Hero, module launcher cards, horizontal navigation rail, values strip, and footer retained in React |
| app.py | React application shell + DashboardLayout | Migrated | Authenticated route shell, sidebar navigation, current-user panel, and module routing are implemented in React |
| modules/login.py | Django authentication + React login | Replaced for first slice | Later integrate AD/LDAP/OIDC with IT |

## Utility categories

- Domain engines: dissolution_predictor, rdkit_degradation_engine, pk_simulation, local_admet_predictor.
- External adapters: pubchem, chembl, dailymed, mhra, orange_book, molgpka_client, psg_reg_sync, psg_live_scrape.
- Document processing: literature extractors, patent_extractor, dailymed_pdf_reader, pdf_reader.
- Reporting: excel_export, rld_excel_export.
- Reference data: excipient_database, inactive_ingredients, bcs_class.
- Streamlit-only code to retire: navigation, api_characterization_tab, rendering sections of processing and psg_search.

## Extraction rule

Each migrated domain function must accept plain Python values, return JSON-safe values, avoid session state and UI libraries, validate its inputs, document scientific limitations, and have regression tests before the React screen replaces its Streamlit counterpart.
