from concurrent.futures import ThreadPoolExecutor, as_completed

from .catalog import category_for
from .web_search import search_property_evidence, web_search_available


def characterize(api_name, selected_properties, selected_records):
    rows = []
    for property_name in selected_properties:
        values = []
        for record in selected_records:
            entry = (record.get("data") or {}).get(property_name)
            if entry and entry.get("value") not in (None, ""):
                values.append(entry)
        unique = []
        seen = set()
        for entry in values:
            marker = (str(entry.get("value")), entry.get("source"), entry.get("link"))
            if marker not in seen:
                seen.add(marker)
                unique.append(entry)
        rows.append({
            "category": category_for(property_name), "property": property_name,
            "value": " / ".join(str(item["value"]) for item in unique) if unique else "Not found in selected records",
            "status": "found" if unique else "missing",
            "sources": list(dict.fromkeys(item.get("source", "") for item in unique if item.get("source"))),
            "references": list(dict.fromkeys(item.get("link", "") for item in unique if item.get("link"))),
            "overview": "",
            "evidence": [],
        })

    warnings = []
    missing_rows = [row for row in rows if row["status"] == "missing"]
    if not missing_rows:
        return rows, warnings
    if not web_search_available():
        warnings.append(
            "Patent and journal fallback search is unavailable because Tavily is not configured."
        )
        return rows, warnings

    with ThreadPoolExecutor(max_workers=min(6, len(missing_rows))) as executor:
        searches = {
            executor.submit(search_property_evidence, api_name, row["property"]): row
            for row in missing_rows
        }
        for future in as_completed(searches):
            row = searches[future]
            try:
                fallback = future.result()
            except Exception:
                fallback = None
            if not fallback:
                continue
            row["value"] = fallback["value"]
            row["status"] = "web_evidence"
            row["sources"] = list(dict.fromkeys(
                item["source_type"] for item in fallback["evidence"]
            )) or ["Scientific web"]
            row["references"] = [item["url"] for item in fallback["evidence"]]
            row["overview"] = fallback["overview"]
            row["evidence"] = fallback["evidence"]

    unresolved = sum(row["status"] == "missing" for row in rows)
    if unresolved:
        warnings.append(
            f"{unresolved} selected properties were not found in PubChem, ChEMBL, patents, or journals."
        )
    return rows, warnings
