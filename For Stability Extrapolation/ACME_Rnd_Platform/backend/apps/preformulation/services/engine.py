from urllib.parse import quote_plus

import requests
from rdkit import Chem
from rdkit.Chem import Descriptors

from .catalog import profile_for


def _resolve_api(value):
    molecule = Chem.MolFromSmiles(value)
    if molecule:
        return value, value, molecule, []
    try:
        response = requests.get(
            "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/"
            + quote_plus(value)
            + "/property/ConnectivitySMILES,MolecularWeight,IUPACName/JSON",
            timeout=15,
        )
        response.raise_for_status()
        entry = response.json()["PropertyTable"]["Properties"][0]
        smiles = entry.get("ConnectivitySMILES")
        molecule = Chem.MolFromSmiles(smiles) if smiles else None
        if molecule:
            return entry.get("IUPACName") or value, smiles, molecule, []
    except (requests.RequestException, ValueError, KeyError, IndexError):
        pass
    return value, "", None, ["Could not resolve a structure. Rule-based screening is unavailable; review manually."]


def _groups(molecule):
    patterns = {
        "primary/secondary amine": "[NX3;H1,H2;!$(NC=O)]",
        "amide": "C(=O)N",
        "carboxylic acid": "C(=O)[OH]",
        "ester": "C(=O)O[#6]",
        "phenol": "c[OH]",
        "alcohol": "[CX4][OH]",
        "aldehyde": "[CH]=O",
        "ketone": "[#6][CX3](=O)[#6]",
        "thiol": "[SH]",
    }
    return [name for name, smarts in patterns.items() if molecule.HasSubstructMatch(Chem.MolFromSmarts(smarts))]


def _rules(groups, excipient):
    lower = excipient.lower()
    rules = []
    if "lactose" in lower and "primary/secondary amine" in groups:
        rules.append(("High", "Maillard reaction", "Reducing-sugar lactose may react with a free amine under heat or humidity; run stress compatibility testing."))
    if ("citric acid" in lower) and ("ester" in groups or "amide" in groups):
        rules.append(("Medium", "Acid-catalysed hydrolysis", "Acidification can increase hydrolysis risk for susceptible ester or amide functionality; evaluate pH and moisture."))
    if ("sodium bicarbonate" in lower or "calcium carbonate" in lower) and ("ester" in groups or "amide" in groups):
        rules.append(("Medium", "Base-catalysed hydrolysis", "Alkalising excipients can increase hydrolysis risk for susceptible ester or amide functionality; evaluate pH and moisture."))
    if "magnesium stearate" in lower:
        rules.append(("Medium", "Hydrophobic lubricant effect", "Hydrophobic lubrication may reduce wetting or dissolution; assess blend time and dissolution performance."))
    if "sodium lauryl sulfate" in lower or "polysorbate" in lower or "poloxamer" in lower:
        rules.append(("Low", "Surfactant interaction", "Surfactants can alter apparent solubility and dissolution; verify assay, impurity, and dissolution behaviour."))
    return rules


def _pubmed(api_name, excipient):
    try:
        search = requests.get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", params={"db": "pubmed", "term": f"{api_name} AND {excipient} AND compatibility", "retmode": "json", "retmax": 5}, timeout=12)
        ids = search.json().get("esearchresult", {}).get("idlist", [])
        if not ids:
            return []
        summary = requests.get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi", params={"db": "pubmed", "id": ",".join(ids), "retmode": "json"}, timeout=12).json().get("result", {})
        return [{"pmid": pmid, "title": summary.get(pmid, {}).get("title", "Untitled"), "journal": summary.get(pmid, {}).get("source", "PubMed"), "date": summary.get(pmid, {}).get("pubdate", ""), "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"} for pmid in ids]
    except (requests.RequestException, ValueError):
        return []


def run_screen(api_input, excipients, include_pubmed=True):
    api_name, smiles, molecule, warnings = _resolve_api(api_input)
    groups = _groups(molecule) if molecule else []
    rule_rows, evidence = [], []
    risk_order = {"Low": 1, "Medium": 2, "High": 3}
    highest = "Low"
    profiles = []
    for excipient in excipients:
        profile = profile_for(excipient)
        profiles.append({"name": excipient, **profile})
        matched_rules = _rules(groups, excipient) if molecule else []
        if not matched_rules:
            matched_rules = [("Low", "No rule flagged", "No defined functional-group rule was triggered. This is not proof of compatibility.")]
        for risk, reaction, description in matched_rules:
            highest = risk if risk_order[risk] > risk_order[highest] else highest
            rule_rows.append({"excipient": excipient, "drug_groups": groups or ["Not resolved"], "reaction_type": reaction, "risk": risk, "description": description})
        if include_pubmed:
            evidence.extend([{**item, "excipient": excipient} for item in _pubmed(api_input, excipient)])
    drug_profile = {"name": api_name, "smiles": smiles, "molecular_weight": round(Descriptors.MolWt(molecule), 2) if molecule else None, "functional_groups": groups}
    return {"drug_profile": drug_profile, "excipient_profiles": profiles, "recommended_risk": highest, "rule_based_evidence": rule_rows, "pubmed_evidence": evidence, "warnings": warnings + ["Screening output is a formulation-development aid and must be confirmed by stress compatibility studies."]}
