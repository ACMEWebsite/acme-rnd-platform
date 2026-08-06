import csv
from functools import lru_cache
from pathlib import Path


DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _normalise(value):
    return " ".join("".join(char if char.isalnum() else " " for char in str(value).upper()).split())


@lru_cache(maxsize=1)
def _orange_book():
    path = DATA_DIR / "orange_book" / "products.txt"
    with path.open(encoding="latin1", newline="") as handle:
        return list(csv.DictReader(handle, delimiter="~"))


@lru_cache(maxsize=1)
def _iid():
    path = DATA_DIR / "IIR_OCOMM.csv"
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def orange_book_search(query):
    needle = _normalise(query)
    matches = []
    for row in _orange_book():
        if needle in _normalise(row.get("Ingredient", "")) or needle in _normalise(row.get("Trade_Name", "")):
            matches.append({
                "active_ingredient": row.get("Ingredient", ""), "proprietary_name": row.get("Trade_Name", ""),
                "application_number": f"{row.get('Appl_Type', '')}{row.get('Appl_No', '')}",
                "dosage_form": row.get("DF;Route", "").split(";")[0], "route": row.get("DF;Route", "").split(";")[-1],
                "strength": row.get("Strength", ""), "te_code": row.get("TE_Code", ""), "rld": row.get("RLD", ""),
                "rs": row.get("RS", ""), "applicant_holder": row.get("Applicant_Full_Name", ""),
                "approval_date": row.get("Approval_Date", ""),
            })
    rld = [row for row in matches if row["rld"].lower() == "yes"]
    return rld[:100]


def iid_search(query):
    needle = query.strip().upper()
    rows = [row for row in _iid() if needle in row.get("INGREDIENT_NAME", "").upper()]
    rows.sort(key=lambda row: (row.get("INGREDIENT_NAME", ""), row.get("ROUTE", ""), row.get("DOSAGE_FORM", "")))
    return rows[:500]
