PROPERTY_GROUPS = {
    "Identity": [
        "API Name", "Structure", "CAS Number", "PubChem CID", "ChEMBL ID",
        "IUPAC Name", "Molecular Formula", "Molecular Weight", "Canonical SMILES", "InChI",
    ],
    "Physical Properties": [
        "Physical Description", "Melting Point", "Solid-state Form / Polymorph", "Hygroscopicity",
        "Bulk Density", "Tapped Density", "Flowability",
    ],
    "Chemical Properties": [
        "XLogP3-AA", "Hydrogen Bond Donor", "Hydrogen Bond Acceptor", "Rotatable Bond Count",
        "Topological Polar Surface Area", "Photostability", "Chemical Stability - Solid State",
        "Chemical Stability - Solution", "Forced Degradation Data",
    ],
    "Solubility Profiling": [
        "BCS Classification", "pKa",
        "Solubility (Aqueous / Organic)", "Solubility vs pH Profile", "Intrinsic Solubility (S0)",
        "Dissolution Rate", "Biorelevant Media Solubility (FaSSIF / FeSSIF)",
        "Partition Coefficient (LogP / LogD)",
    ],
}


def category_for(property_name):
    for category, properties in PROPERTY_GROUPS.items():
        if property_name in properties:
            return category
    return "Other"
