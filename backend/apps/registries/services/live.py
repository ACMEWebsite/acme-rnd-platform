from functools import lru_cache
from html import unescape
import re
from urllib.parse import quote_plus, urljoin
import xml.etree.ElementTree as ET

import requests


def dailymed_search(query):
    response = requests.get("https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=" + quote_plus(query), timeout=15)
    if response.status_code != 200:
        return []
    return [{"title": item.get("title", "Unknown label"), "setid": item.get("setid"), "label_url": f"https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={item.get('setid')}", "pdf_url": f"https://dailymed.nlm.nih.gov/dailymed/downloadpdffile.cfm?setId={item.get('setid')}"} for item in response.json().get("data", [])[:20] if item.get("setid")]


def _name(element):
    return element.tag.rsplit("}", 1)[-1].lower()


def _clean(value):
    return " ".join((value or "").split())


def dailymed_details(setid):
    response = requests.get(f"https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/{setid}.xml", timeout=20)
    if response.status_code != 200:
        return {"inactive_ingredients": [], "product_characteristics": []}
    root = ET.fromstring(response.text)
    tables = []
    for element in root.iter():
        if _name(element) == "table":
            text = _clean(" ".join(element.itertext())).lower()
            tables.append((text, element))
    inactive, characteristics = [], []
    for text, table in tables:
        rows = []
        for tr in table.iter():
            if _name(tr) == "tr":
                cells = [_clean(" ".join(cell.itertext())) for cell in tr if _name(cell) in {"td", "th"}]
                if cells:
                    rows.append(cells)
        if "inactive ingredients" in text:
            inactive.extend({"ingredient_name": row[0], "strength": row[1] if len(row) > 1 else "—"} for row in rows if row and "inactive ingredient" not in " ".join(row).lower())
        if "product characteristics" in text:
            for row in rows:
                for index in range(0, len(row) - 1, 2):
                    if row[index].lower() in {"color", "shape", "score", "size", "imprint code", "flavor", "contains"}:
                        characteristics.append({"characteristic": row[index], "value": row[index + 1]})
    return {"inactive_ingredients": inactive, "product_characteristics": characteristics}


MHRA_PORTAL = "https://products.mhra.gov.uk"
MHRA_SEARCH_PAGE = f"{MHRA_PORTAL}/search/"


@lru_cache(maxsize=1)
def _mhra_search_config():
    """Read the public search configuration used by the official MHRA website.

    The products site publishes its search configuration in its browser bundle.
    Discovering it at runtime avoids copying that short-lived configuration into
    this project or an environment file.
    """
    page = requests.get(MHRA_SEARCH_PAGE, timeout=15)
    page.raise_for_status()
    scripts = re.findall(r'src=["\']([^"\']+\.js)["\']', page.text)
    scripts.sort(key=lambda path: ("/chunks/843-" not in path, path))

    for script in scripts:
        response = requests.get(urljoin(MHRA_PORTAL, script), timeout=15)
        if response.status_code != 200 or "search.windows.net" not in response.text:
            continue
        service = re.search(
            r'concat\("([A-Za-z0-9-]+)","\.search\.windows\.net/indexes/"\)',
            response.text,
        )
        api_key = re.search(r'api-key","([A-Za-z0-9_-]+)"', response.text)
        if service and api_key:
            return service.group(1), api_key.group(1)

    raise RuntimeError("The official MHRA search configuration is unavailable.")


def _plain_highlight(value):
    if isinstance(value, list):
        value = " … ".join(str(item) for item in value)
    return " ".join(unescape(re.sub(r"<[^>]+>", "", str(value or ""))).split())


def mhra_search(query, document_types, limit=200):
    service, api_key = _mhra_search_config()
    selected_types = [item.title() for item in document_types]
    filters = " or ".join(f"doc_type eq '{item}'" for item in selected_types)
    endpoint = f"https://{service}.search.windows.net/indexes/products-index/docs"
    response = requests.get(
        endpoint,
        params={
            "api-key": api_key,
            "api-version": "2017-11-11",
            "highlight": "content",
            "queryType": "simple",
            "$count": "true",
            "$top": str(limit),
            "$skip": "0",
            "search": query,
            "scoringProfile": "preferKeywords",
            "searchMode": "all",
            "$filter": f"({filters})",
        },
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    results = []
    for item in payload.get("value", []):
        highlights = item.get("@search.highlights") or {}
        results.append(
            {
                "document": str(item.get("doc_type") or "").upper(),
                "product": item.get("product_name") or "Unknown product",
                "description": item.get("title") or item.get("file_name") or "MHRA document",
                "context": _plain_highlight(highlights.get("content")),
                "pdf_url": item.get("metadata_storage_path") or "",
            }
        )

    total = int(payload.get("@odata.count") or len(results))
    return {
        "source": "UK MHRA Products public search",
        "results": results,
        "count": total,
        "returned_count": len(results),
        "truncated": total > len(results),
        "portal_url": MHRA_SEARCH_PAGE + "?search=" + quote_plus(query),
        "document_types": document_types,
    }
