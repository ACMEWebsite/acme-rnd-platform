from urllib.parse import quote

import requests


BASE_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"
PUG_VIEW_BASE_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view"

HEADERS = {"User-Agent": "ACME-RND-Platform/1.0"}
TIMEOUT_SECONDS = 20

BIOLOGICAL_HALF_LIFE_HEADINGS = {
    "biological half life",
}
SALT_SUFFIXES = {
    "acetate",
    "besylate",
    "bisulfate",
    "calcium",
    "citrate",
    "fumarate",
    "hcl",
    "hydrobromide",
    "hydrochloride",
    "maleate",
    "mesylate",
    "phosphate",
    "potassium",
    "sodium",
    "succinate",
    "sulfate",
    "tartrate",
}


class PubChemError(RuntimeError):
    pass


def _get_json(url):
    try:
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        raise PubChemError(f"PubChem network error: {exc}") from exc
    if response.status_code == 404:
        return None
    if not response.ok:
        raise PubChemError(f"PubChem returned HTTP {response.status_code}.")
    return response.json()

def _normalise_heading(value):
    """
    Normalize PubChem section headings so that variations such as
    'Biological Half-Life' and 'Biological Half Life' match.
    """
    return " ".join(
        str(value or "")
        .strip()
        .lower()
        .replace("-", " ")
        .split()
    )


def _value_to_text(value):
    """
    Convert a PubChem PUG View Value object into readable text.

    PubChem commonly stores long-form information under
    StringWithMarkup, but numeric values are also supported.
    """
    if not isinstance(value, dict):
        return None

    string_items = value.get("StringWithMarkup") or []

    text_parts = [
        item.get("String", "").strip()
        for item in string_items
        if isinstance(item, dict)
        and item.get("String", "").strip()
    ]

    if text_parts:
        return " ".join(text_parts)

    numbers = value.get("Number")

    if isinstance(numbers, list) and numbers:
        number_text = ", ".join(str(number) for number in numbers)
        unit = str(value.get("Unit") or "").strip()

        if unit:
            return f"{number_text} {unit}"

        return number_text

    return None


def _information_to_text(information):
    """
    Extract all unique readable values from a PubChem Information list.
    """
    extracted_values = []

    for item in information or []:
        if not isinstance(item, dict):
            continue

        text = _value_to_text(item.get("Value"))

        if text and text not in extracted_values:
            extracted_values.append(text)

    if not extracted_values:
        return None

    return " | ".join(extracted_values)


def _find_biological_half_life(sections):
    """
    Recursively search PubChem PUG View sections for Biological Half-Life.
    """
    for section in sections or []:
        if not isinstance(section, dict):
            continue

        heading = _normalise_heading(section.get("TOCHeading"))

        if heading in BIOLOGICAL_HALF_LIFE_HEADINGS:
            value = _information_to_text(section.get("Information"))

            if value:
                return value

        nested_value = _find_biological_half_life(
            section.get("Section")
        )

        if nested_value:
            return nested_value

    return None


def get_biological_half_life(cid):
    """
    Retrieve a literature-reported Biological Half-Life from
    PubChem PUG View.

    Returns None when the compound has no matching PubChem section.
    """
    url = (
        f"{PUG_VIEW_BASE_URL}/data/compound/"
        f"{int(cid)}/JSON"
    )

    payload = _get_json(url)

    if not payload:
        return None

    record = payload.get("Record") or {}

    return _find_biological_half_life(
        record.get("Section")
    )

def _strip_salt_suffix(name):
    parts = name.strip().split()
    while parts and parts[-1].lower() in SALT_SUFFIXES:
        parts.pop()
    return " ".join(parts)


def _lookup_cids_by_name(name):
    payload = _get_json(f"{BASE_URL}/compound/name/{quote(name, safe='')}/cids/JSON")
    return (payload or {}).get("IdentifierList", {}).get("CID", [])


def _lookup_cids_by_smiles(smiles):
    payload = _get_json(
        f"{BASE_URL}/compound/smiles/{quote(smiles, safe='')}/cids/JSON"
    )
    return (payload or {}).get("IdentifierList", {}).get("CID", [])


def _profile_for_cid(cid, fallback_name, preserve_query_name=False):
    fields = (
        "MolecularFormula,MolecularWeight,ConnectivitySMILES,"
        "IUPACName,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,"
        "RotatableBondCount"
    )
    payload = _get_json(f"{BASE_URL}/compound/cid/{cid}/property/{fields}/JSON")
    properties = (payload or {}).get("PropertyTable", {}).get("Properties", [])
    if not properties:
        return None

    item = properties[0]

    # Biological Half-Life is optional enrichment.
    # Failure of the PUG View request must not prevent the main
    # PubChem compound record from loading.
    try:
        biological_half_life = get_biological_half_life(cid)
    except (PubChemError, ValueError, TypeError):
        biological_half_life = None

    smiles = item.get("ConnectivitySMILES")

    if not smiles:
        return None
    return {
        "cid": int(cid),
        "record_id": f"CID {cid}",
        "record_name": (
            fallback_name
            if preserve_query_name
            else item.get("IUPACName") or fallback_name
        ),
        "iupac_name": item.get("IUPACName"),
        "canonical_smiles": smiles,
        "formula": item.get("MolecularFormula"),
        "molecular_weight": item.get("MolecularWeight"),
        "xlogp": item.get("XLogP"),
        "tpsa": item.get("TPSA"),
        "h_bond_donors": item.get("HBondDonorCount"),
        "h_bond_acceptors": item.get("HBondAcceptorCount"),
                "rotatable_bonds": item.get("RotatableBondCount"),
        "biological_half_life": biological_half_life,
        "structure_url": f"{BASE_URL}/compound/cid/{cid}/PNG",
        "link": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}",
    }


def resolve_name(name):
    cids = _lookup_cids_by_name(name)
    stripped = _strip_salt_suffix(name)
    if not cids and stripped and stripped.lower() != name.strip().lower():
        cids = _lookup_cids_by_name(stripped)
    for cid in cids[:3]:
        record = _profile_for_cid(cid, name, preserve_query_name=True)
        if record:
            return record
    return None


def find_by_smiles(smiles):
    for cid in _lookup_cids_by_smiles(smiles)[:3]:
        record = _profile_for_cid(cid, smiles)
        if record:
            return record
    return None
