import re
from urllib.parse import quote_plus

import requests


TIMEOUT = 15
HEADERS = {"User-Agent": "ACME-RND-Platform/1.0 (internal research tool)"}
SALT_SUFFIXES = {
    "bisulfate", "sulfate", "hydrochloride", "hcl", "besylate", "maleate",
    "sodium", "calcium", "fumarate", "tartrate", "potassium", "mesylate",
    "citrate", "phosphate", "succinate", "hydrobromide", "acetate",
}


def _property(value, source, link):
    return {"value": value, "source": source, "link": link}


def _strip_salt_suffix(query):
    words = query.strip().split()
    if words and words[-1].lower() in SALT_SUFFIXES:
        return " ".join(words[:-1])
    return query


def _pubchem_cas(cid):
    endpoint = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/synonyms/JSON"
    response = requests.get(endpoint, headers=HEADERS, timeout=TIMEOUT)
    if response.status_code != 200:
        return ""
    synonyms = response.json().get("InformationList", {}).get("Information", [{}])[0].get("Synonym", [])
    return next((value for value in synonyms if re.fullmatch(r"\d{2,7}-\d{2}-\d", value)), "")


def _first_pugview_string(section):
    for item in section.get("Information", []):
        for value in item.get("Value", {}).get("StringWithMarkup", []):
            text = value.get("String")
            if text:
                return re.sub(r"<.*?>", "", text).replace("\n", " ").strip()
    return ""


def _pubchem_pugview(cid, link):
    endpoint = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON"
    response = requests.get(endpoint, headers=HEADERS, timeout=TIMEOUT)
    if response.status_code != 200:
        return {}
    heading_map = {
        "Solubility": "Solubility (Aqueous / Organic)",
        "Melting Point": "Melting Point",
        "pKa": "pKa",
        "Physical Description": "Physical Description",
    }
    found = {}

    def walk(sections, depth=0):
        if depth > 8:
            return
        for section in sections or []:
            property_name = heading_map.get(section.get("TOCHeading"))
            if property_name and property_name not in found:
                value = _first_pugview_string(section)
                if value:
                    found[property_name] = _property(value, "PubChem", link)
            walk(section.get("Section"), depth + 1)

    walk(response.json().get("Record", {}).get("Section", []))
    return found


def _pubchem_profile(cid, query):
    endpoint = (
        "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/"
        f"{cid}/property/MolecularFormula,MolecularWeight,ConnectivitySMILES,"
        "InChI,IUPACName,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,"
        "RotatableBondCount/JSON"
    )
    response = requests.get(endpoint, headers=HEADERS, timeout=TIMEOUT)
    response.raise_for_status()
    item = response.json()["PropertyTable"]["Properties"][0]
    link = f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}"
    data = {
        "API Name": _property(query, "PubChem", link),
        "Structure": _property(
            f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/PNG",
            "PubChem",
            link,
        ),
        "PubChem CID": _property(str(cid), "PubChem", link),
        "Molecular Formula": _property(item.get("MolecularFormula"), "PubChem", link),
        "Molecular Weight": _property(item.get("MolecularWeight"), "PubChem", link),
        "IUPAC Name": _property(item.get("IUPACName"), "PubChem", link),
        "Canonical SMILES": _property(item.get("ConnectivitySMILES"), "PubChem", link),
        "InChI": _property(item.get("InChI"), "PubChem", link),
        "Partition Coefficient (LogP / LogD)": _property(item.get("XLogP"), "PubChem", link),
        "XLogP3-AA": _property(item.get("XLogP"), "PubChem", link),
        "Hydrogen Bond Donor": _property(item.get("HBondDonorCount"), "PubChem", link),
        "Hydrogen Bond Acceptor": _property(item.get("HBondAcceptorCount"), "PubChem", link),
        "Rotatable Bond Count": _property(item.get("RotatableBondCount"), "PubChem", link),
        "Topological Polar Surface Area": _property(item.get("TPSA"), "PubChem", link),
    }
    try:
        cas_number = _pubchem_cas(cid)
        if cas_number:
            data["CAS Number"] = _property(cas_number, "PubChem", link)
    except (requests.RequestException, ValueError, KeyError, IndexError):
        pass
    try:
        data.update(_pubchem_pugview(cid, link))
    except (requests.RequestException, ValueError, KeyError, IndexError):
        pass
    return {key: value for key, value in data.items() if value["value"] not in (None, "")}


def pubchem_records(query):
    endpoint = (
        "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/"
        f"{quote_plus(query)}/cids/JSON"
    )
    response = requests.get(endpoint, headers=HEADERS, timeout=TIMEOUT)
    if response.status_code != 200:
        stripped_query = _strip_salt_suffix(query)
        if stripped_query != query:
            endpoint = (
                "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/"
                f"{quote_plus(stripped_query)}/cids/JSON"
            )
            response = requests.get(endpoint, headers=HEADERS, timeout=TIMEOUT)
    if response.status_code != 200:
        return []
    records = []
    for cid in response.json().get("IdentifierList", {}).get("CID", [])[:3]:
        try:
            data = _pubchem_profile(cid, query)
            records.append({
                "source": "PubChem", "record_name": query, "record_id": f"CID {cid}",
                "formula": data.get("Molecular Formula", {}).get("value", "—"),
                "molecular_weight": data.get("Molecular Weight", {}).get("value", "—"),
                "smiles": data.get("Canonical SMILES", {}).get("value", ""),
                "structure_url": f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/PNG",
                "link": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}", "data": data,
            })
        except (requests.RequestException, KeyError, IndexError, ValueError):
            continue
    return records


def chembl_records(query):
    endpoint = "https://www.ebi.ac.uk/chembl/api/data/molecule/search.json?q=" + quote_plus(query)
    response = requests.get(endpoint, headers=HEADERS, timeout=TIMEOUT)
    if response.status_code != 200:
        return []
    records = []
    for item in response.json().get("molecules", [])[:3]:
        chembl_id = item.get("molecule_chembl_id")
        if not chembl_id:
            continue
        try:
            detail = requests.get(
                f"https://www.ebi.ac.uk/chembl/api/data/molecule/{chembl_id}.json",
                headers=HEADERS, timeout=TIMEOUT,
            )
            detail.raise_for_status()
            molecule = detail.json()
            props = molecule.get("molecule_properties") or {}
            structures = molecule.get("molecule_structures") or {}
            link = f"https://www.ebi.ac.uk/chembl/compound_report_card/{chembl_id}/"
            data = {
                "ChEMBL ID": _property(chembl_id, "ChEMBL", link),
                "Structure": _property(
                    f"https://www.ebi.ac.uk/chembl/api/data/image/{chembl_id}.svg",
                    "ChEMBL",
                    link,
                ),
                "Molecular Formula": _property(props.get("full_molformula"), "ChEMBL", link),
                "Molecular Weight": _property(props.get("full_mwt"), "ChEMBL", link),
                "Canonical SMILES": _property(structures.get("canonical_smiles"), "ChEMBL", link),
                "Partition Coefficient (LogP / LogD)": _property(props.get("alogp"), "ChEMBL", link),
            }
            pka = [f"Acidic pKa: {props['cx_most_apka']}" for _ in [0] if props.get("cx_most_apka")]
            pka += [f"Basic pKa: {props['cx_most_bpka']}" for _ in [0] if props.get("cx_most_bpka")]
            if pka:
                data["pKa"] = _property("; ".join(pka), "ChEMBL", link)
            records.append({
                "source": "ChEMBL", "record_name": item.get("pref_name") or query,
                "record_id": chembl_id,
                "formula": props.get("full_molformula") or "—", "molecular_weight": props.get("full_mwt") or "—",
                "smiles": structures.get("canonical_smiles") or "",
                "structure_url": f"https://www.ebi.ac.uk/chembl/api/data/image/{chembl_id}.svg",
                "link": link, "data": {key: value for key, value in data.items() if value["value"] not in (None, "")},
            })
        except (requests.RequestException, ValueError):
            continue
    return records


def find_records(query):
    return pubchem_records(query) + chembl_records(query)
