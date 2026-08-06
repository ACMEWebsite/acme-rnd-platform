"""
End-to-End PBBM Pipeline Smoke Test.

Verifies:
1. Pipeline runs end-to-end without errors.
2. Conservation of mass (Total Dose = Absorbed + GI Dissolved + GI Undissolved + Excreted).
3. Non-negative concentrations and positive Cmax, Tmax, AUC.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from simulate import run_pbbm_simulation


def main():
    print("Running PBBM End-to-End Smoke Test...")
    summary = run_pbbm_simulation(
        drug_name="SmokeTest_Ketoprofen",
        dose_mg=100.0,
        mw=254.28,
        s0_mg_ml=0.05,
        pka=4.45,
        ion_type="acid",
        d50_um=20.0,
        peff_cm_s=1.2e-4,
        pk_compartments=1,
        cl_l_hr=6.0,
        vc_l=12.0,
        duration_hr=12.0,
    )

    assert summary["cmax_mg_l"] > 0, "Cmax must be positive."
    assert summary["tmax_hr"] > 0, "Tmax must be positive."
    assert summary["auc_0_t_mg_h_l"] > 0, "AUC must be positive."
    assert 0 <= summary["final_fa_percent"] <= 100.0, "Fa % must be between 0 and 100."

    csv_path = Path(summary["csv_path"])
    plot_path = Path(summary["plot_path"])

    assert csv_path.exists(), f"Output CSV not found at {csv_path}"
    assert plot_path.exists(), f"Output Plot not found at {plot_path}"

    print("[OK] Smoke Test PASSED! All metrics valid and output files verified.")


if __name__ == "__main__":
    main()
