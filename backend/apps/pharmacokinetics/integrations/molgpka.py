import os

import requests


UPLOAD_URL = os.getenv(
    "MOLGPKA_UPLOAD_URL",
    "http://xundrug.cn:5001/modules/upload0/",
)
REQUEST_TIMEOUT = 20


def _to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_gen_datas(gen_datas):
    acid_pkas, base_pkas = [], []
    if not isinstance(gen_datas, dict):
        return acid_pkas, base_pkas
    for key, value in gen_datas.items():
        kind = key.lower()
        if kind not in {"acid", "base"}:
            continue
        raw_values = value.values() if isinstance(value, dict) else value
        if not isinstance(raw_values, (list, tuple, dict_values)):
            continue
        for raw_value in raw_values:
            pka = _to_float(raw_value)
            if pka is not None:
                (acid_pkas if kind == "acid" else base_pkas).append(pka)
    return acid_pkas, base_pkas


try:
    dict_values = type({}.values())
except Exception:  # pragma: no cover
    dict_values = tuple


def predict_pka(smiles):
    token = os.getenv("MOLGPKA_TOKEN", "").strip()
    if not token:
        return {
            "acid_pkas": [],
            "base_pkas": [],
            "source": "local heuristic",
            "error": "MolGpKa is not configured.",
        }
    try:
        response = requests.post(
            UPLOAD_URL,
            files={"Smiles": ("smiles.smi", smiles)},
            headers={"token": token},
            timeout=REQUEST_TIMEOUT,
        )
        payload = response.json()
        if payload.get("status") != 200:
            raise ValueError(f"MolGpKa returned status {payload.get('status')!r}.")
        acid_pkas, base_pkas = _parse_gen_datas(payload.get("gen_datas"))
        if not acid_pkas and not base_pkas:
            raise ValueError("MolGpKa did not return an ionization site.")
        return {
            "acid_pkas": acid_pkas,
            "base_pkas": base_pkas,
            "source": "graph neural network",
            "error": None,
        }
    except (requests.RequestException, ValueError) as exc:
        return {
            "acid_pkas": [],
            "base_pkas": [],
            "source": "local heuristic",
            "error": str(exc),
        }
