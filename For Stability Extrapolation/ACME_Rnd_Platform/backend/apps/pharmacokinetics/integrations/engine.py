"""Local RDKit/QSAR pharmacokinetics screening engine.

The equations and property order are preserved from the Streamlit prototype.
Results are screening estimates, not validated clinical or regulatory outputs.
"""

import math

from rdkit import Chem, rdBase
from rdkit.Chem import Crippen, Descriptors, Fragments, Lipinski

from .molgpka import predict_pka
from .pubchem import PubChemError, find_by_smiles, resolve_name


def _clip(value, lower, upper):
    return max(min(value, upper), lower)


def _frag_count(molecule, *names):
    total = 0
    for name in names:
        function = getattr(Fragments, name, None)
        if function is not None:
            try:
                total += function(molecule)
            except Exception:
                pass
    return total


def _has_match(molecule, smarts):
    pattern = Chem.MolFromSmarts(smarts)
    return pattern is not None and molecule.HasSubstructMatch(pattern)


def _descriptors(molecule):
    heavy_atoms = molecule.GetNumHeavyAtoms()
    aromatic_atoms = sum(atom.GetIsAromatic() for atom in molecule.GetAtoms())
    return {
        "MW": Descriptors.MolWt(molecule),
        "LogP": Crippen.MolLogP(molecule),
        "TPSA": Descriptors.TPSA(molecule),
        "HBD": Lipinski.NumHDonors(molecule),
        "HBA": Lipinski.NumHAcceptors(molecule),
        "RotB": Descriptors.NumRotatableBonds(molecule),
        "AromRings": Lipinski.NumAromaticRings(molecule),
        "RingCount": Lipinski.RingCount(molecule),
        "HeavyAtoms": heavy_atoms,
        "AromaticProportion": aromatic_atoms / heavy_atoms if heavy_atoms else 0.0,
        "HasBasicN": _frag_count(
            molecule, "fr_NH2", "fr_NH1", "fr_NH0", "fr_pyridine"
        )
        > 0,
        "HasAcidGroup": _frag_count(molecule, "fr_Al_COOH", "fr_Ar_COOH") > 0,
        "HasNitroOrAzo": _frag_count(
            molecule, "fr_nitro", "fr_nitro_arom", "fr_azo", "fr_nitroso"
        )
        > 0,
    }


ACID_SMARTS = [
    ("[CX3](=O)[OX2H1]", 4.2),
    ("[SX4](=O)(=O)[OX2H]", -1.0),
    ("[SX4](=O)(=O)[NX3;H1,H2]", 10.0),
    ("[OX2H][c]", 10.0),
    ("c1nnn[nH]1", 4.9),
]
BASE_SMARTS = [
    ("[NX3][CX3]=[NX2]", 11.5),
    ("[NX3;H2][CX4]", 10.6),
    ("[NX3;H1]([CX4])[CX4]", 10.7),
    ("[NX3;H0]([CX4])([CX4])[CX4]", 9.8),
    ("c1cnc[nH]1", 7.0),
    ("[NX3;H2,H1][c]", 4.6),
    ("n1ccccc1", 5.2),
]


def _pka_profile(molecule, smiles):
    remote = predict_pka(smiles)
    if remote["acid_pkas"] or remote["base_pkas"]:
        return remote
    acid_pkas = [pka for smarts, pka in ACID_SMARTS if _has_match(molecule, smarts)][:1]
    base_pkas = [pka for smarts, pka in BASE_SMARTS if _has_match(molecule, smarts)][:1]
    return {
        "acid_pkas": acid_pkas,
        "base_pkas": base_pkas,
        "source": "local structural heuristic",
        "error": remote.get("error"),
    }


def _pka_acid(profile):
    if not profile["acid_pkas"]:
        return "No ionizable acidic group predicted"
    value = str(round(min(profile["acid_pkas"]), 2))
    if profile["source"] == "graph neural network":
        return f"{value} (graph neural network)"
    return value


def _pka_base(profile):
    if not profile["base_pkas"]:
        return "No ionizable basic group predicted"
    value = str(round(max(profile["base_pkas"]), 2))
    if profile["source"] == "graph neural network":
        return f"{value} (graph neural network)"
    return value


def _logd(logp, profile):
    neutral_fraction = 1.0
    if profile["acid_pkas"]:
        neutral_fraction *= 1 / (1 + 10 ** (7.4 - min(profile["acid_pkas"])))
    if profile["base_pkas"]:
        neutral_fraction *= 1 / (1 + 10 ** (max(profile["base_pkas"]) - 7.4))
    value = logp + math.log10(max(neutral_fraction, 1e-6))
    suffix = ", from graph neural network" if profile["source"] == "graph neural network" else ""
    return f"{round(value, 2)} (at pH 7.4{suffix})"


def _property_table(descriptor, pka):
    logp = descriptor["LogP"]
    tpsa = descriptor["TPSA"]
    molecular_weight = descriptor["MW"]
    caco2 = -4.80 - 0.01 * tpsa + 0.14 * logp
    hia = _clip(106 - 0.345 * tpsa, 0, 100)
    hia_class = "High Absorption" if hia >= 80 else (
        "Moderate Absorption" if hia >= 30 else "Low Absorption"
    )
    veber_pass = tpsa <= 140 and descriptor["RotB"] <= 10
    violations = sum(
        (
            molecular_weight > 500,
            logp > 5,
            descriptor["HBD"] > 5,
            descriptor["HBA"] > 10,
        )
    )
    if veber_pass and violations == 0:
        oral_f = "Class 1 - High probability of >50%F"
    elif violations <= 1:
        oral_f = "Borderline - Moderate probability of >50%F"
    else:
        oral_f = "Class 0 - Low probability of >50%F"
    skin = -2.7 + 0.71 * logp - 0.0061 * molecular_weight
    log_bb = 0.152 * logp - 0.0148 * tpsa + 0.139
    bbb_class = (
        "CNS+ (Penetrant)"
        if log_bb >= -2
        else "CNS- (Non-Penetrant)"
        if log_bb <= -3
        else "Borderline"
    )
    ppb = _clip(100 / (1 + math.exp(-(0.8 * logp - 0.5))), 1, 99.5)
    ppb_class = "Highly Bound" if ppb >= 90 else (
        "Moderately Bound" if ppb >= 50 else "Low Binding"
    )
    vdss = _clip(0.7 + 0.23 * logp - 0.004 * tpsa + 0.0015 * molecular_weight, 0.1, 20)
    vdss_class = "High (Tissue Distribution)" if vdss > 2.5 else (
        "Moderate" if vdss >= 0.7 else "Low (Plasma-Confined)"
    )
    clearance = _clip(35 - 3 * logp + 0.03 * tpsa, 1, 120)
    log_s = (
        0.16
        - 0.63 * logp
        - 0.0062 * molecular_weight
        + 0.066 * descriptor["RotB"]
        - 0.74 * descriptor["AromaticProportion"]
    )
    log_bcf = 0.79 * logp - 0.40
    toxic_alerts = int(descriptor["HasNitroOrAzo"]) + int(logp > 5)
    log_mtd = 0.5 - 0.2 * logp - 0.3 * toxic_alerts
    yes = "Yes (Inhibitor)"
    no = "No (Non-Inhibitor)"

    rows = [
        ("Absorption", "Caco-2 (logPaap)", f"{round(caco2, 2)} logPapp ({'High' if caco2 > -5.15 else 'Low'} Permeability)"),
        ("Absorption", "Human Intestinal Absorption", f"{round(hia, 1)}% ({hia_class})"),
        ("Absorption", "Human Oral Bioavailability (50%F)", oral_f),
        ("Absorption", "P-glycoprotein Inhibitor", yes if molecular_weight > 400 and logp > 4 and descriptor["HBA"] >= 4 else no),
        ("Absorption", "Skin Permeability", f"{round(skin, 2)} logKp ({'Low' if skin > -2.5 else 'High'} Skin Permeability)"),
        ("Distribution", "Blood-Brain Barrier (Central Nervous System)", f"{round(log_bb, 2)} logPS ({bbb_class})"),
        ("Distribution", "Fraction Unbound (Human)", f"{round(_clip(100 - ppb, 0.5, 99), 1)}%"),
        ("Distribution", "Plasma Protein Binding", f"{round(ppb, 1)}% bound ({ppb_class})"),
        ("Distribution", "Steady State Volume of Distribution", f"{round(vdss, 2)} L/kg ({vdss_class})"),
        ("Metabolism", "CYP 1A2 Inhibitor", yes if descriptor["AromRings"] >= 2 and logp > 1.5 and tpsa < 75 else no),
        ("Metabolism", "CYP 2C19 Inhibitor", yes if descriptor["AromRings"] >= 1 and descriptor["HBA"] >= 2 and logp > 2 else no),
        ("Metabolism", "CYP 2C9 Inhibitor", yes if descriptor["HasAcidGroup"] and logp > 2 else no),
        ("Metabolism", "CYP 2D6 Inhibitor", yes if descriptor["HasBasicN"] and logp > 3 else no),
        ("Metabolism", "CYP 3A4 Inhibitor", yes if molecular_weight > 300 and logp > 3 and descriptor["AromRings"] >= 1 else no),
        ("Excretion", "Clearance", f"{round(clearance, 2)} mL/min/kg"),
        ("Toxicity", "AMES Mutagenesis", "Positive (Mutagenic Alert)" if descriptor["HasNitroOrAzo"] else "Negative (Non-Mutagenic)"),
        ("Toxicity", "hERG Blockers", "High Risk (QT Prolongation Alert)" if logp > 3.2 and descriptor["HasBasicN"] else "Low Risk"),
        ("Toxicity", "Maximum Tolerated Dose", f"{round(log_mtd, 2)} log(mg/kg/day)"),
        ("Toxicity", "Bioconcentration Factor", f"{round(log_bcf, 2)} log10(L/kg) ({'High' if log_bcf > 3.5 else 'Low'} Bioaccumulation)"),
        ("Molecule Properties", "log P", str(round(logp, 2))),
        ("Molecule Properties", "log S", f"{round(log_s, 2)} log mol/L"),
        ("Molecule Properties", "log D (pH 7.4)", _logd(logp, pka)),
        ("Molecule Properties", "pKa acid", _pka_acid(pka)),
        ("Molecule Properties", "pKa basic", _pka_base(pka)),
    ]
    return [
        {
            "category": category,
            "property": property_name,
            "value": value,
            "source": "Local RDKit/QSAR",
        }
        for category, property_name, value in rows
    ]


def run_workflow(compound_input, include_pubchem_enrichment=True):
    cleaned = (compound_input or "").strip()
    if not cleaned:
        raise ValueError("Please provide a compound name or a SMILES string.")

    pubchem_record = None
    with rdBase.BlockLogs():
        molecule = Chem.MolFromSmiles(cleaned)

    if molecule is None:
        try:
            pubchem_record = resolve_name(cleaned)
        except PubChemError as exc:
            raise ValueError(str(exc)) from exc
        if not pubchem_record:
            raise ValueError(
                f'Could not resolve "{cleaned}" as a SMILES string or PubChem compound name.'
            )
        smiles = pubchem_record["canonical_smiles"]
        molecule = Chem.MolFromSmiles(smiles)
    else:
        smiles = Chem.MolToSmiles(molecule, canonical=True)
        if include_pubchem_enrichment:
            try:
                pubchem_record = find_by_smiles(smiles)
            except PubChemError:
                pubchem_record = None

    if molecule is None:
        raise ValueError("The resolved molecular structure is invalid.")

    pka = _pka_profile(molecule, smiles)
    predictions = _property_table(_descriptors(molecule), pka)

    biological_half_life = (
        pubchem_record.get("biological_half_life")
        if pubchem_record
        else None
    )

    if biological_half_life:
        half_life_result = {
            "category": "Excretion",
            "property": "Biological Half-Life",
            "value": biological_half_life,
            "source": "PubChem PUG View",
        }

        clearance_index = next(
            (
                index
                for index, item in enumerate(predictions)
                if item["category"] == "Excretion"
                and item["property"] == "Clearance"
            ),
            None,
        )

        if clearance_index is None:
            predictions.append(half_life_result)
        else:
            predictions.insert(
                clearance_index + 1,
                half_life_result,
            )
    warnings = [
        "Screening-level empirical QSAR estimates; confirm important results experimentally.",
        "Predictions are not validated clinical, bioequivalence, or regulatory conclusions.",
    ]
    if pka.get("error"):
        warnings.append(
            "MolGpKa enrichment was unavailable; pKa and logD use the local heuristic."
        )
    return {
        "compound_name": pubchem_record.get("record_name") if pubchem_record else "",
        "smiles": smiles,
        "pubchem_record": pubchem_record,
        "predictions": predictions,
        "warnings": warnings,
    }
