EXCIPIENTS = {
    "Microcrystalline Cellulose (MCC) PH-101": {"cas": "9004-34-6", "formula": "(C6H10O5)n", "category": "Filler / dry binder", "synonyms": "MCC, cellulose"},
    "Microcrystalline Cellulose (MCC) PH-102": {"cas": "9004-34-6", "formula": "(C6H10O5)n", "category": "Filler / dry binder", "synonyms": "MCC, cellulose"},
    "Lactose Monohydrate (Fine Powder)": {"cas": "10039-26-6", "formula": "C12H22O11·H2O", "category": "Filler", "synonyms": "Lactose monohydrate"},
    "Spray-Dried Lactose": {"cas": "63-42-3", "formula": "C12H22O11", "category": "Filler", "synonyms": "Lactose"},
    "Anhydrous Lactose": {"cas": "63-42-3", "formula": "C12H22O11", "category": "Filler", "synonyms": "Lactose"},
    "Mannitol (Pearlitol SD200)": {"cas": "69-65-8", "formula": "C6H14O6", "category": "Filler", "synonyms": "Mannitol"},
    "Povidone K30 (PVP K30)": {"cas": "9003-39-8", "formula": "(C6H9NO)n", "category": "Binder", "synonyms": "Povidone, PVP"},
    "Copovidone (VA64)": {"cas": "25086-89-9", "formula": "Polymer", "category": "Binder", "synonyms": "Copovidone"},
    "Hydroxypropyl Methylcellulose (HPMC E5)": {"cas": "9004-65-3", "formula": "Polymer", "category": "Binder / film former", "synonyms": "Hypromellose, HPMC"},
    "Crosspovidone (Polyplasdone XL)": {"cas": "9003-39-8", "formula": "Polymer", "category": "Disintegrant", "synonyms": "Crospovidone"},
    "Sodium Starch Glycolate (Primojel)": {"cas": "9063-38-1", "formula": "Polymer", "category": "Disintegrant", "synonyms": "Sodium starch glycolate"},
    "Croscarmellose Sodium (Ac-Di-Sol)": {"cas": "74811-65-7", "formula": "Polymer", "category": "Disintegrant", "synonyms": "Croscarmellose sodium"},
    "Magnesium Stearate (Vegetable Grade)": {"cas": "557-04-0", "formula": "C36H70MgO4", "category": "Lubricant", "synonyms": "Magnesium stearate"},
    "Sodium Stearyl Fumarate (PRUV)": {"cas": "4070-80-8", "formula": "C22H39NaO4", "category": "Lubricant", "synonyms": "Sodium stearyl fumarate"},
    "Talc (Purified)": {"cas": "14807-96-6", "formula": "Mg3Si4O10(OH)2", "category": "Glidant", "synonyms": "Talc"},
    "Colloidal Silicon Dioxide (Aerosil 200)": {"cas": "7631-86-9", "formula": "SiO2", "category": "Glidant", "synonyms": "Colloidal silica"},
    "Sodium Lauryl Sulfate (SLS)": {"cas": "151-21-3", "formula": "C12H25NaO4S", "category": "Surfactant", "synonyms": "Sodium dodecyl sulfate"},
    "Poloxamer 407": {"cas": "9003-11-6", "formula": "Polymer", "category": "Surfactant / solubilizer", "synonyms": "Poloxamer"},
    "Polysorbate 80 (Tween 80)": {"cas": "9005-65-6", "formula": "C64H124O26", "category": "Surfactant", "synonyms": "Tween 80"},
    "Citric Acid Anhydrous": {"cas": "77-92-9", "formula": "C6H8O7", "category": "Acidifier", "synonyms": "Citric acid"},
    "Sodium Bicarbonate": {"cas": "144-55-8", "formula": "NaHCO3", "category": "Alkalizing agent", "synonyms": "Sodium hydrogen carbonate"},
    "Calcium Carbonate": {"cas": "471-34-1", "formula": "CaCO3", "category": "Alkalizing agent / filler", "synonyms": "Calcium carbonate"},
}


def profile_for(name):
    if name in EXCIPIENTS:
        return EXCIPIENTS[name]
    lower = name.lower()
    for label, profile in EXCIPIENTS.items():
        if lower in label.lower() or any(token in lower for token in profile["synonyms"].lower().split(", ")):
            return profile
    return {"cas": "Not available", "formula": "Not available", "category": "Review manually", "synonyms": "No local catalogue match"}
