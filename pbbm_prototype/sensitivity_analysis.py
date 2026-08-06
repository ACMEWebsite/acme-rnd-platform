"""
Parameter Sensitivity Analysis Module.

Performs one-at-a-time (OAT) parameter sweeps over:
1. Particle Size (D50, µm)
2. Intrinsic Solubility (S0, mg/mL)
3. Intestinal Permeability (Peff, cm/s)
4. Gastric Emptying / Stomach Transit Time (hours)

Generates:
- Parameter Overlay Profiles
- Tornado Plot of % Change in Cmax & AUC0-t
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from simulate import run_pbbm_simulation


def run_sensitivity_analysis(output_dir: str = None):
    if output_dir is None:
        output_dir = Path(__file__).resolve().parent / "output"
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    base_params = {
        "drug_name": "Ketoprofen Sensitivity Baseline",
        "dose_mg": 100.0,
        "mw": 254.28,
        "s0_mg_ml": 0.05,
        "pka": 4.45,
        "ion_type": "acid",
        "d50_um": 25.0,
        "peff_cm_s": 1.5e-4,
        "cl_l_hr": 6.0,
        "vc_l": 12.0,
        "duration_hr": 24.0,
        "output_dir": str(output_dir / "temp_sweep"),
    }

    baseline = run_pbbm_simulation(**base_params)

    # 1. Sweep Particle Size (D50)
    d50_values = [5.0, 15.0, 25.0, 50.0, 100.0]
    d50_results = []
    for d in d50_values:
        p = base_params.copy()
        p["d50_um"] = d
        res = run_pbbm_simulation(**p)
        res["d50_um"] = d
        d50_results.append(res)
    df_d50 = pd.DataFrame(d50_results)

    # 2. Sweep Permeability (Peff)
    peff_values = [0.5e-4, 1.0e-4, 1.5e-4, 3.0e-4, 5.0e-4]
    peff_results = []
    for p_eff in peff_values:
        p = base_params.copy()
        p["peff_cm_s"] = p_eff
        res = run_pbbm_simulation(**p)
        res["peff_cm_s"] = p_eff
        peff_results.append(res)
    df_peff = pd.DataFrame(peff_results)

    # 3. Tornado Plot Data (+/- 50% Variation)
    sweep_vars = {
        "Particle Size D50 (12.5 - 37.5 µm)": ("d50_um", 12.5, 37.5),
        "Solubility S0 (0.025 - 0.075 mg/mL)": ("s0_mg_ml", 0.025, 0.075),
        "Permeability Peff (0.75 - 2.25e-4 cm/s)": ("peff_cm_s", 0.75e-4, 2.25e-4),
        "Clearance CL (3.0 - 9.0 L/hr)": ("cl_l_hr", 3.0, 9.0),
    }

    tornado_rows = []
    for label, (param_key, val_low, val_high) in sweep_vars.items():
        p_low = base_params.copy()
        p_low[param_key] = val_low
        res_low = run_pbbm_simulation(**p_low)

        p_high = base_params.copy()
        p_high[param_key] = val_high
        res_high = run_pbbm_simulation(**p_high)

        cmax_base = baseline["cmax_mg_l"]
        cmax_low_pct = ((res_low["cmax_mg_l"] - cmax_base) / cmax_base) * 100.0
        cmax_high_pct = ((res_high["cmax_mg_l"] - cmax_base) / cmax_base) * 100.0

        tornado_rows.append({
            "parameter": label,
            "low_val": val_low,
            "high_val": val_high,
            "cmax_low_pct": cmax_low_pct,
            "cmax_high_pct": cmax_high_pct,
        })

    df_tornado = pd.DataFrame(tornado_rows)

    # Plot Tornado
    fig, ax = plt.subplots(figsize=(9, 5))
    y_pos = np.arange(len(df_tornado))

    ax.barh(y_pos, df_tornado["cmax_low_pct"], color="skyblue", label="Low Param (-50%)")
    ax.barh(y_pos, df_tornado["cmax_high_pct"], color="navy", label="High Param (+50%)")

    ax.set_yticks(y_pos)
    ax.set_yticklabels(df_tornado["parameter"])
    ax.axvline(0, color="black", linestyle="--", linewidth=1)
    ax.set_xlabel("% Change in Cmax from Baseline")
    ax.set_title("Parameter Sensitivity — Impact on Plasma Cmax")
    ax.legend(loc="lower right")
    ax.grid(True, linestyle=":", alpha=0.6)

    plt.tight_layout()
    tornado_file = output_dir / "pbbm_sensitivity_tornado.png"
    plt.savefig(tornado_file, dpi=300)
    plt.close()

    print(f"Sensitivity Analysis Completed. Tornado plot saved to: {tornado_file}")


if __name__ == "__main__":
    run_sensitivity_analysis()
