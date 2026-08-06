"""
Full PBBM Simulation Driver — Runs Dissolution -> GI Transit/Absorption -> Systemic PK.

Generates:
1. Output plots saved to pbbm_prototype/output/
2. Raw simulation CSV data saved to pbbm_prototype/output/
3. Console summary of Cmax, Tmax, AUC0-t, and Fraction Absorbed (Fa).
"""

import os
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.integrate import solve_ivp
import matplotlib.pyplot as plt

from models.dissolution import DissolutionModel
from models.gi_physiology import GIPhysiology
from models.absorption import GIModel
from models.pk import PKModel


def run_pbbm_simulation(
    drug_name: str = "Ketoprofen (Example Weak Acid)",
    dose_mg: float = 100.0,
    mw: float = 254.28,
    s0_mg_ml: float = 0.05,
    pka: float = 4.45,
    ion_type: str = "acid",
    d50_um: float = 25.0,
    peff_cm_s: float = 1.5e-4,
    pk_compartments: int = 1,
    cl_l_hr: float = 6.0,
    vc_l: float = 12.0,
    vp_l: float = 30.0,
    q_l_hr: float = 4.0,
    duration_hr: float = 24.0,
    output_dir: str = None,
):
    """
    Runs full PBBM simulation pipeline and exports outputs.
    """
    if output_dir is None:
        output_dir = Path(__file__).resolve().parent / "output"
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Initialize Modules
    diss_model = DissolutionModel(
        dose_mg=dose_mg,
        mw=mw,
        s0_mg_ml=s0_mg_ml,
        pka=pka,
        ion_type=ion_type,
        d50_um=d50_um,
    )
    gi_phys = GIPhysiology()
    gi_model = GIModel(diss_model, gi_phys, peff_cm_s=peff_cm_s)
    pk_model = PKModel(
        num_compartments=pk_compartments,
        cl_l_hr=cl_l_hr,
        vc_l=vc_l,
        vp_l=vp_l,
        q_l_hr=q_l_hr,
    )

    # 2. Build Coupled Initial State
    gi_y0 = gi_model.build_initial_state()
    pk_y0 = pk_model.get_initial_state()
    y0 = np.concatenate([gi_y0, pk_y0])

    n_comp = len(gi_phys.compartments)
    n_bins = diss_model.num_bins
    abs_idx = n_comp * (n_bins + 1)
    pk_start_idx = abs_idx + 2

    # 3. Coupled System RHS
    def full_system_rhs(t_hr, y):
        gi_y = y[:pk_start_idx]
        pk_y = y[pk_start_idx:]

        gi_dydt = gi_model.compute_derivatives(t_hr, gi_y)

        # Absorption rate dM_absorbed/dt (mg/hr)
        d_abs_dt = gi_dydt[abs_idx]

        pk_dydt = pk_model.compute_derivatives(pk_y, d_abs_dt)

        return np.concatenate([gi_dydt, pk_dydt])

    # 4. Solve ODE System
    t_eval = np.linspace(0.0, duration_hr, 500)
    sol = solve_ivp(
        full_system_rhs,
        (0.0, duration_hr),
        y0,
        t_eval=t_eval,
        method="RK45",
        rtol=1e-5,
        atol=1e-7,
    )

    # 5. Process & Post-process Results
    results = []
    for step in range(len(sol.t)):
        t = sol.t[step]
        y_step = sol.y[:, step]

        absorbed_mg = max(0.0, y_step[abs_idx])
        excreted_mg = max(0.0, y_step[abs_idx + 1])
        pk_state = y_step[pk_start_idx:]
        cp_mg_l = pk_model.calculate_plasma_concentration(pk_state)

        row = {
            "time_hr": round(t, 4),
            "absorbed_mg": absorbed_mg,
            "fraction_absorbed": min(1.0, absorbed_mg / dose_mg),
            "excreted_mg": excreted_mg,
            "cp_mg_l": cp_mg_l,
        }

        # Track dissolved & undissolved per GI compartment
        for c_idx, comp_name in enumerate(gi_phys.compartments):
            c_start = c_idx * (n_bins + 1)
            undiss_m = np.sum(y_step[c_start : c_start + n_bins])
            diss_m = y_step[c_start + n_bins]
            row[f"{comp_name}_undissolved_mg"] = max(0.0, undiss_m)
            row[f"{comp_name}_dissolved_mg"] = max(0.0, diss_m)

        results.append(row)

    df = pd.DataFrame(results)
    df.to_csv(output_dir / "pbbm_simulation_results.csv", index=False)

    # Compute PK Metrics (Cmax, Tmax, AUC)
    cmax = df["cp_mg_l"].max()
    tmax = df.loc[df["cp_mg_l"].idxmax(), "time_hr"]
    auc = np.trapezoid(df["cp_mg_l"], df["time_hr"])
    fa_final = df["fraction_absorbed"].iloc[-1]

    # 6. Generate Figures
    fig, axes = plt.subplots(3, 1, figsize=(10, 12), sharex=True)

    # Plot (a): GI Mass Profiles
    ax0 = axes[0]
    for comp_name in gi_phys.compartments:
        ax0.plot(df["time_hr"], df[f"{comp_name}_dissolved_mg"], label=f"{comp_name.capitalize()} Dissolved")
    ax0.set_ylabel("Drug Mass (mg)")
    ax0.set_title(f"A. GI Compartmental Dissolved Drug Mass — {drug_name}")
    ax0.grid(True, linestyle="--", alpha=0.6)
    ax0.legend(loc="upper right")

    # Plot (b): Fraction Absorbed
    ax1 = axes[1]
    ax1.plot(df["time_hr"], df["fraction_absorbed"] * 100.0, color="navy", lw=2, label="Fraction Absorbed (Fa %)")
    ax1.axhline(fa_final * 100.0, color="red", linestyle=":", label=f"Final Fa = {fa_final*100:.1f}%")
    ax1.set_ylabel("Fraction Absorbed (%)")
    ax1.set_title("B. Cumulative Systemic Absorption Profile")
    ax1.grid(True, linestyle="--", alpha=0.6)
    ax1.legend(loc="lower right")

    # Plot (c): Plasma Concentration-Time Profile
    ax2 = axes[2]
    ax2.plot(df["time_hr"], df["cp_mg_l"], color="darkgreen", lw=2, label=f"Cp (Cmax={cmax:.2f} mg/L)")
    ax2.axvline(tmax, color="orange", linestyle="--", label=f"Tmax = {tmax:.2f} h")
    ax2.set_xlabel("Time (hours)")
    ax2.set_ylabel("Plasma Conc (mg/L or µg/mL)")
    ax2.set_title(f"C. Systemic PK Profile (AUC = {auc:.2f} mg·h/L)")
    ax2.grid(True, linestyle="--", alpha=0.6)
    ax2.legend(loc="upper right")

    plt.tight_layout()
    plot_file = output_dir / "pbbm_simulation_profiles.png"
    plt.savefig(plot_file, dpi=300)
    plt.close()

    # Console Summary
    summary = {
        "drug_name": drug_name,
        "dose_mg": dose_mg,
        "cmax_mg_l": round(cmax, 4),
        "tmax_hr": round(tmax, 4),
        "auc_0_t_mg_h_l": round(auc, 4),
        "final_fa_percent": round(fa_final * 100.0, 2),
        "csv_path": str(output_dir / "pbbm_simulation_results.csv"),
        "plot_path": str(plot_file),
    }

    print("\n==========================================")
    print(f" PBBM Simulation Completed: {drug_name}")
    print("==========================================")
    print(" - Dose: {} mg".format(dose_mg))
    print(" - Cmax: {} mg/L".format(summary['cmax_mg_l']))
    print(" - Tmax: {} h".format(summary['tmax_hr']))
    print(" - AUC(0-{}h): {} mg*h/L".format(duration_hr, summary['auc_0_t_mg_h_l']))
    print(" - Fraction Absorbed (Fa): {}%".format(summary['final_fa_percent']))
    print(" - Output Plot Saved: {}".format(summary['plot_path']))
    print("==========================================\n")

    return summary


if __name__ == "__main__":
    run_pbbm_simulation()
