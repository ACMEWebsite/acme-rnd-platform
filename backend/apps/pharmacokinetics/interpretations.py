CATEGORY_COLORS = {
    "Absorption": "#0066ff",
    "Distribution": "#0284c7",
    "Metabolism": "#16a34a",
    "Excretion": "#ea580c",
    "Toxicity": "#dc2626",
    "Molecule Properties": "#7c3aed",
}

_CYP_TEXT = (
    "Cytochrome P450 inhibition predicts whether a compound can inhibit major "
    "drug-metabolizing enzymes. A positive screening prediction is a signal "
    "for confirmatory enzyme-inhibition testing, not a clinical conclusion."
)

PROPERTY_INTERPRETATIONS = {
    "Caco-2 (logPaap)": (
        "Caco-2 permeability predicts intestinal membrane transport using human "
        "colorectal epithelial cells as an in-vitro model. Higher predicted "
        "permeability supports intestinal uptake."
    ),
    "Human Intestinal Absorption": (
        "Human intestinal absorption estimates the fraction of an oral dose "
        "absorbed through the small intestine. Values above 30% are generally "
        "considered to indicate acceptable uptake."
    ),
    "Human Oral Bioavailability (50%F)": (
        "Oral bioavailability represents the proportion of a dose reaching "
        "systemic circulation unchanged after absorption and first-pass metabolism."
    ),
    "P-glycoprotein Inhibitor": (
        "P-glycoprotein modulation can alter intestinal efflux and exposure of "
        "P-gp substrates. Confirm positive predictions experimentally."
    ),
    "Skin Permeability": (
        "Skin permeability estimates penetration of the skin barrier and is "
        "reported as a LogKp screening approximation."
    ),
    "Blood-Brain Barrier (Central Nervous System)": (
        "Blood-brain barrier permeability estimates the potential for central "
        "nervous system penetration. Higher logPS values indicate greater permeability."
    ),
    "Fraction Unbound (Human)": (
        "Fraction unbound is the estimated proportion not bound to plasma proteins. "
        "Only unbound drug is directly available for distribution and elimination."
    ),
    "Plasma Protein Binding": (
        "Plasma protein binding estimates nonspecific association with circulating "
        "proteins and therefore influences free-drug exposure."
    ),
    "Steady State Volume of Distribution": (
        "Volume of distribution describes the apparent extent of tissue distribution. "
        "Higher values suggest greater distribution outside plasma."
    ),
    "CYP 1A2 Inhibitor": _CYP_TEXT,
    "CYP 2C19 Inhibitor": _CYP_TEXT,
    "CYP 2C9 Inhibitor": _CYP_TEXT,
    "CYP 2D6 Inhibitor": _CYP_TEXT,
    "CYP 3A4 Inhibitor": _CYP_TEXT,
    "Clearance": (
        "Clearance estimates the body's ability to eliminate a drug and is a key "
        "determinant of exposure and dosing frequency."
    ),
        "Biological Half-Life": (
        "PubChem's curated, literature-reported elimination half-life—typically "
        "an experimentally observed value or range from human or animal "
        "pharmacokinetic studies."
    ),
    "AMES Mutagenesis": (
        "AMES mutagenicity flags structural features associated with bacterial "
        "mutagenicity. A positive result requires confirmatory testing."
    ),
    "hERG Blockers": (
        "hERG inhibition is associated with QT-interval prolongation and cardiac "
        "arrhythmia risk. This structural screen is not an electrophysiology assay."
    ),
    "Maximum Tolerated Dose": (
        "Maximum tolerated dose is an early screening estimate of the highest "
        "daily dose likely to be tolerated."
    ),
    "Bioconcentration Factor": (
        "Bioconcentration factor estimates the tendency to accumulate in aquatic "
        "organisms. Higher values indicate greater potential bioaccumulation."
    ),
    "log P": (
        "LogP is the pH-independent octanol/water partition coefficient and a "
        "measure of neutral-molecule lipophilicity."
    ),
    "log S": (
        "LogS is estimated aqueous solubility in log mol/L. Most marketed drugs "
        "have a logS greater than approximately -4."
    ),
    "log D (pH 7.4)": (
        "LogD is the pH-dependent distribution coefficient and includes the "
        "ionized fraction at physiological pH."
    ),
    "pKa acid": (
        "Acidic pKa describes proton dissociation. MolGpKa is used when configured; "
        "otherwise the engine reports a local structural-alert approximation."
    ),
    "pKa basic": (
        "Basic pKa describes conjugate-acid dissociation. MolGpKa is used when "
        "configured; otherwise the engine reports a local approximation."
    ),
}


def decorate_predictions(predictions):
    return [
        {
            **item,
            "interpretation": PROPERTY_INTERPRETATIONS.get(
                item["property"],
                "No interpretation text is available for this property.",
            ),
            "color": CATEGORY_COLORS.get(item["category"], "#64748b"),
        }
        for item in predictions
    ]

