"""Pure dissolution calculations extracted from the Streamlit prototype."""

import math

FORMULATION_NOTES = {
    "Class I": "High solubility and permeability; dissolution rarely limits absorption.",
    "Class II": "Low solubility and high permeability; consider particle-size reduction, amorphous dispersions, salts, or solubilizing excipients.",
    "Class III": "High solubility and low permeability; permeability is usually limiting.",
    "Class IV": "Low solubility and permeability; combined formulation strategies may be required.",
    "Indeterminate": "HIA was not provided, so only the solubility classification is reliable.",
}


def estimate_diffusion_coefficient(molecular_weight):
    if molecular_weight is None or molecular_weight <= 0:
        raise ValueError("Molecular weight must be a positive number.")
    return 10 ** (-4.113 - 0.4609 * math.log10(molecular_weight))


def classify_bcs(dose_mg, molecular_weight, log_s, hia_percent=None):
    if dose_mg <= 0:
        raise ValueError("Dose must be a positive number.")
    if molecular_weight <= 0:
        raise ValueError("Molecular weight must be a positive number.")
    solubility = (10 ** log_s) * molecular_weight
    dose_volume = dose_mg / solubility if solubility > 0 else math.inf
    solubility_class = "High Solubility" if dose_volume <= 250 else "Low Solubility"
    if hia_percent is None:
        permeability_class = "Unknown"
        bcs_class = "Indeterminate"
    else:
        permeability_class = "High Permeability" if hia_percent >= 90 else "Low Permeability"
        mapping = {
            ("High Solubility", "High Permeability"): "Class I",
            ("Low Solubility", "High Permeability"): "Class II",
            ("High Solubility", "Low Permeability"): "Class III",
            ("Low Solubility", "Low Permeability"): "Class IV",
        }
        bcs_class = mapping[(solubility_class, permeability_class)]
    return {
        "class": bcs_class,
        "solubility_class": solubility_class,
        "permeability_class": permeability_class,
        "solubility_mg_per_ml": solubility,
        "dose_volume_ml": dose_volume,
        "hia_percent": hia_percent,
        "formulation_note": FORMULATION_NOTES[bcs_class],
    }


def simulate_profile(*, dose_mg, molecular_weight, log_s, particle_diameter_um=25.0,
                     drug_density_g_cm3=1.2, medium_volume_ml=900.0,
                     boundary_layer_um=30.0, duration_min=120,
                     output_points=30, total_steps=1500):
    positive = {
        "dose_mg": dose_mg, "molecular_weight": molecular_weight,
        "particle_diameter_um": particle_diameter_um,
        "drug_density_g_cm3": drug_density_g_cm3,
        "medium_volume_ml": medium_volume_ml,
        "boundary_layer_um": boundary_layer_um, "duration_min": duration_min,
        "output_points": output_points, "total_steps": total_steps,
    }
    for name, value in positive.items():
        if value is None or value <= 0:
            raise ValueError(f"{name} must be a positive number.")

    diffusion = estimate_diffusion_coefficient(molecular_weight)
    layer_cm = boundary_layer_um * 1e-4
    radius_initial_cm = (particle_diameter_um / 2.0) * 1e-4
    saturation_mg_ml = (10 ** log_s) * molecular_weight
    particle_volume = (4.0 / 3.0) * math.pi * radius_initial_cm ** 3
    particle_mass_mg = particle_volume * drug_density_g_cm3 * 1000.0
    particle_count = dose_mg / particle_mass_mg
    dt_seconds = (duration_min * 60.0) / total_steps
    radius_cm = radius_initial_cm
    dissolved_mg = 0.0
    profile = []
    emit_every = max(1, total_steps // output_points)

    for step in range(total_steps + 1):
        elapsed_seconds = step * dt_seconds
        concentration = dissolved_mg / medium_volume_ml
        driving_force = max(saturation_mg_ml - concentration, 0.0)
        if radius_cm > 0 and dissolved_mg < dose_mg:
            area = 4.0 * math.pi * radius_cm ** 2 * particle_count
            rate_mg_s = area * diffusion * driving_force / layer_cm
            increment = min(rate_mg_s * dt_seconds, dose_mg - dissolved_mg)
            dissolved_mg += increment
            removed_particle_mg = increment / particle_count
            removed_volume = (removed_particle_mg / 1000.0) / drug_density_g_cm3
            current_volume = (4.0 / 3.0) * math.pi * radius_cm ** 3
            new_volume = max(current_volume - removed_volume, 0.0)
            radius_cm = (3.0 * new_volume / (4.0 * math.pi)) ** (1.0 / 3.0) if new_volume else 0.0
        if step % emit_every == 0 or step == total_steps:
            profile.append({
                "time_min": round(elapsed_seconds / 60.0, 2),
                "dissolved_percent": round(min(100.0, dissolved_mg / dose_mg * 100.0), 2),
            })

    capacity_mg = saturation_mg_ml * medium_volume_ml
    metrics = {
        "diffusion_coefficient_cm2_s": diffusion,
        "saturation_solubility_mg_ml": saturation_mg_ml,
        "estimated_particle_count": particle_count,
        "maximum_soluble_mass_mg": capacity_mg,
        "sink_conditions": capacity_mg >= 3 * dose_mg,
        "final_dissolved_percent": profile[-1]["dissolved_percent"],
    }
    warnings = [
        "Screening model only; not a validated IVIVC or regulatory simulation.",
        "The model assumes spherical monodisperse particles and constant medium conditions.",
    ]
    return profile, metrics, warnings
