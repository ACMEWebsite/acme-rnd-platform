"""Targeted patent and journal evidence search for missing API properties."""

from __future__ import annotations

import re
from urllib.parse import urlparse

import requests
from django.conf import settings


TAVILY_SEARCH_URL = "https://api.tavily.com/search"
TIMEOUT = 15

SEARCH_QUERY_TEMPLATES = {
    "API Name": '"{api}" active pharmaceutical ingredient',
    "Structure": '"{api}" chemical structure',
    "CAS Number": '"{api}" CAS number',
    "PubChem CID": '"{api}" PubChem CID',
    "ChEMBL ID": '"{api}" ChEMBL ID',
    "IUPAC Name": '"{api}" IUPAC name',
    "Molecular Formula": '"{api}" molecular formula',
    "Molecular Weight": '"{api}" molecular weight',
    "Canonical SMILES": '"{api}" canonical SMILES',
    "InChI": '"{api}" InChI',
    "Solubility (Aqueous / Organic)": '"{api}" aqueous solubility organic solvent',
    "Solubility vs pH Profile": '"{api}" solubility pH profile',
    "Intrinsic Solubility (S0)": '"{api}" intrinsic solubility S0',
    "Dissolution Rate": '"{api}" dissolution rate',
    "Biorelevant Media Solubility (FaSSIF / FeSSIF)": '"{api}" FaSSIF FeSSIF solubility',
    "pKa": '"{api}" pKa',
    "Partition Coefficient (LogP / LogD)": '"{api}" logP logD partition coefficient',
    "Physical Description": '"{api}" physical description appearance',
    "Melting Point": '"{api}" melting point',
    "Solid-state Form / Polymorph": '"{api}" polymorph crystal form',
    "Hygroscopicity": '"{api}" hygroscopicity',
    "Bulk Density": '"{api}" bulk density',
    "Tapped Density": '"{api}" tapped density',
    "Flowability": '"{api}" flowability Carr index',
    "XLogP3-AA": '"{api}" XLogP3-AA',
    "Hydrogen Bond Donor": '"{api}" hydrogen bond donor count',
    "Hydrogen Bond Acceptor": '"{api}" hydrogen bond acceptor count',
    "Rotatable Bond Count": '"{api}" rotatable bond count',
    "Topological Polar Surface Area": '"{api}" topological polar surface area TPSA',
    "Photostability": '"{api}" photostability',
    "Chemical Stability - Solid State": '"{api}" solid state stability',
    "Chemical Stability - Solution": '"{api}" solution stability',
    "Forced Degradation Data": '"{api}" forced degradation',
    "BCS Classification": '"{api}" BCS classification',
    "Permeability": '"{api}" permeability Caco-2 Papp',
    "Target Binding Affinity": '"{api}" target binding affinity Ki IC50',
    "Mechanism of Action": '"{api}" mechanism of action',
}

NARRATIVE_PROPERTIES = {
    "Physical Description",
    "Solubility vs pH Profile",
    "Dissolution Rate",
    "Biorelevant Media Solubility (FaSSIF / FeSSIF)",
    "Solid-state Form / Polymorph",
    "Photostability",
    "Chemical Stability - Solid State",
    "Chemical Stability - Solution",
    "Forced Degradation Data",
    "Permeability",
    "Target Binding Affinity",
    "Mechanism of Action",
}

KEYWORD_PATTERNS = {
    "CAS Number": r"\b\d{2,7}-\d{2}-\d\b",
    "Melting Point": r"\b\d{2,3}(?:\.\d+)?\s*(?:-|–|to)\s*\d{2,3}(?:\.\d+)?\s*°?\s*C\b|\b\d{2,3}(?:\.\d+)?\s*°\s*C\b",
    "pKa": r"\bpKa\b[^.;:]{0,40}?([-+]?\d{1,2}(?:\.\d+)?)",
    "Partition Coefficient (LogP / LogD)": r"\b(?:logP|logD|XLogP)\b[^.;:]{0,40}?([-+]?\d{1,2}(?:\.\d+)?)",
    "XLogP3-AA": r"\bXLogP3(?:-AA)?\b[^.;:]{0,40}?([-+]?\d{1,2}(?:\.\d+)?)",
    "BCS Classification": r"\b(?:BCS|Biopharmaceutics Classification System)\b[^.;:]{0,50}?\b(?:Class\s+)?(I{1,3}|IV|[1-4])\b",
    "Solubility (Aqueous / Organic)": r"\b\d+(?:\.\d+)?\s*(?:mg/mL|g/L|µg/mL|mcg/mL|mM|M)\b|\b(?:practically insoluble|sparingly soluble|freely soluble|slightly soluble|very soluble|insoluble)\b",
    "Intrinsic Solubility (S0)": r"\b\d+(?:\.\d+)?\s*(?:mg/mL|g/L|µg/mL|mcg/mL|mM|M)\b",
    "Hygroscopicity": r"\b(?:non-?hygroscopic|slightly hygroscopic|highly hygroscopic|hygroscopic)\b",
    "Hydrogen Bond Donor": r"\b(\d{1,2})\s+hydrogen[- ]bond donors?\b",
    "Hydrogen Bond Acceptor": r"\b(\d{1,2})\s+hydrogen[- ]bond acceptors?\b",
    "Rotatable Bond Count": r"\b(\d{1,2})\s+rotatable bonds?\b",
    "Topological Polar Surface Area": r"\b(?:TPSA|topological polar surface area)\b[^.;:]{0,40}?(\d{1,3}(?:\.\d+)?)",
}


def web_search_available() -> bool:
    return bool(settings.TAVILY_API_KEY)


def _clean_text(value: str, max_chars: int = 700) -> str:
    text = re.sub(r"\s+", " ", value or "").strip()
    if len(text) <= max_chars:
        return text
    clipped = text[:max_chars].rsplit(" ", 1)[0]
    return f"{clipped}…"


def _source_type(url: str) -> str:
    domain = urlparse(url).netloc.lower()
    if any(marker in domain for marker in ("patents.google.", "espacenet.", "lens.org", "freepatentsonline.")):
        return "Patent"
    if any(marker in domain for marker in (
        "pubmed.", "ncbi.nlm.nih.gov", "sciencedirect.", "springer.", "wiley.",
        "tandfonline.", "nature.", "acs.org", "rsc.org", "mdpi.", "frontiersin.",
    )):
        return "Journal"
    return "Scientific web"


def _extract_value(text: str, property_name: str) -> str:
    clean = _clean_text(text)
    pattern = KEYWORD_PATTERNS.get(property_name)
    if pattern:
        match = re.search(pattern, clean, re.IGNORECASE)
        if match:
            return match.group(0).strip()
    if property_name in NARRATIVE_PROPERTIES:
        return clean
    property_words = re.sub(r"\s*\([^)]*\)", "", property_name).split("/")[0].strip()
    sentence = re.search(
        rf"[^.!?]*\b{re.escape(property_words)}\b[^.!?]*(?:[.!?]|$)",
        clean,
        re.IGNORECASE,
    )
    return _clean_text(sentence.group(0), 500) if sentence else ""


def search_property_evidence(api_name: str, property_name: str) -> dict | None:
    """Return a cited Tavily overview for one property without exposing the API key."""
    if not web_search_available():
        return None

    base_query = SEARCH_QUERY_TEMPLATES.get(property_name, '"{api}" "{property}"')
    query = base_query.format(api=api_name, property=property_name)
    query = f"{query} patent journal study"

    try:
        response = requests.post(
            TAVILY_SEARCH_URL,
            headers={
                "Authorization": f"Bearer {settings.TAVILY_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "query": query,
                "search_depth": "basic",
                "max_results": 5,
                "include_answer": "advanced",
                "include_raw_content": False,
            },
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError):
        return None

    evidence = []
    for item in payload.get("results", []):
        url = (item.get("url") or "").strip()
        if not url.startswith(("http://", "https://")):
            continue
        evidence.append({
            "title": _clean_text(item.get("title") or urlparse(url).netloc, 180),
            "url": url,
            "content": _clean_text(item.get("content") or "", 420),
            "source_type": _source_type(url),
        })

    answer = _clean_text(payload.get("answer") or "", 700)
    searchable_text = " ".join([answer, *(item["content"] for item in evidence)])
    extracted = _extract_value(searchable_text, property_name)
    overview = answer or (evidence[0]["content"] if evidence else "")
    value = extracted or overview
    if not value and not evidence:
        return None

    return {
        "value": value or "Relevant evidence found; review the cited sources.",
        "overview": overview or value,
        "evidence": evidence,
    }
