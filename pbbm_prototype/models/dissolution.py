"""
Dissolution Kinetics Module — Noyes-Whitney / Nernst-Brunner Particle Model.

Implements:
1. Particle Size Distribution (PSD) discretization into population bins.
2. Shrinking sphere / shrinking particle radius kinetics across particle population.
3. Henderson-Hasselbalch pH-dependent solubility for ionizable drugs.
4. Configurable diffusion layer thickness.
"""

import math
import numpy as np


class DissolutionModel:
    def __init__(
        self,
        dose_mg: float,
        mw: float,
        s0_mg_ml: float,
        pka: float = None,
        ion_type: str = "neutral",  # 'acid', 'base', 'neutral'
        d50_um: float = 25.0,
        span: float = 1.2,
        num_bins: int = 5,
        drug_density_g_cm3: float = 1.2,
        boundary_layer_um: float = 30.0,
        diffusivity_cm2_s: float = None,
    ):
        """
        Parameters:
        -----------
        dose_mg : float
            Total drug dose in milligrams.
        mw : float
            Molecular weight in g/mol.
        s0_mg_ml : float
            Intrinsic solubility of un-ionized form in mg/mL.
        pka : float, optional
            Acid/base dissociation constant.
        ion_type : str
            Drug ionization type: 'acid', 'base', or 'neutral'.
        d50_um : float
            Median particle diameter D50 in micrometers.
        span : float
            Particle size distribution span factor (width of PSD).
        num_bins : int
            Number of particle size distribution population bins.
        drug_density_g_cm3 : float
            Solid drug crystal density in g/cm3.
        boundary_layer_um : float
            Hydrodynamic diffusion layer thickness in micrometers.
        diffusivity_cm2_s : float, optional
            Diffusion coefficient in cm2/s. Estimated via Hayduk-Laudie if omitted.
        """
        if dose_mg <= 0 or mw <= 0 or s0_mg_ml < 0:
            raise ValueError("Dose, MW, and S0 must be positive numbers.")

        self.dose_mg = float(dose_mg)
        self.mw = float(mw)
        self.s0_mg_ml = float(s0_mg_ml)
        self.pka = float(pka) if pka is not None else None
        self.ion_type = str(ion_type).lower()
        self.d50_um = float(d50_um)
        self.span = float(span)
        self.num_bins = int(num_bins)
        self.drug_density = float(drug_density_g_cm3)
        self.boundary_layer_cm = float(boundary_layer_um) * 1e-4

        # Estimate diffusion coefficient (Hayduk-Laudie / Wilke-Chang approximation)
        if diffusivity_cm2_s is not None and diffusivity_cm2_s > 0:
            self.diffusivity = float(diffusivity_cm2_s)
        else:
            # Literature heuristic: D ≈ 10^(-4.113 - 0.4609 * log10(MW))
            self.diffusivity = 10 ** (-4.113 - 0.4609 * math.log10(self.mw))

        # Generate initial particle size distribution population bins
        self.particle_bins = self._generate_psd_bins()

    def _generate_psd_bins(self):
        """Discretizes particle size distribution into radius bins with particle counts."""
        # Log-normal particle diameter discretization
        sigma = self.span / 2.0
        d_min = max(0.1, self.d50_um / 5.0)
        d_max = self.d50_um * 5.0
        diameters = np.geomspace(d_min, d_max, self.num_bins)

        # Log-normal mass fractions
        log_d = np.log(diameters)
        log_d50 = np.log(self.d50_um)
        pdf = np.exp(-0.5 * ((log_d - log_d50) / sigma) ** 2)
        mass_fractions = pdf / np.sum(pdf)

        bins = []
        for d, mf in zip(diameters, mass_fractions):
            radius_cm = (d / 2.0) * 1e-4
            bin_mass_mg = self.dose_mg * mf
            particle_vol_cm3 = (4.0 / 3.0) * math.pi * (radius_cm ** 3)
            particle_mass_mg = particle_vol_cm3 * self.drug_density * 1000.0
            count = bin_mass_mg / particle_mass_mg if particle_mass_mg > 0 else 0.0
            bins.append({
                "initial_radius_cm": radius_cm,
                "current_radius_cm": radius_cm,
                "particle_count": count,
                "initial_mass_mg": bin_mass_mg,
                "current_mass_mg": bin_mass_mg,
            })
        return bins

    def calculate_solubility(self, ph: float) -> float:
        """
        Calculates equilibrium saturation solubility at a given pH using Henderson-Hasselbalch equation.
        Citation: Bergström CA et al. Early biopharmaceutical appraisal of drug candidates.
                  Adv Drug Deliv Rev. 2007;59(7):606-621.
        """
        if self.pka is None or self.ion_type == "neutral":
            return self.s0_mg_ml

        if self.ion_type == "acid":
            # Weak Acid: Cs = S0 * (1 + 10^(pH - pKa))
            ratio = 10 ** (ph - self.pka)
            return self.s0_mg_ml * (1.0 + ratio)
        elif self.ion_type == "base":
            # Weak Base: Cs = S0 * (1 + 10^(pKa - pH))
            ratio = 10 ** (self.pka - ph)
            return self.s0_mg_ml * (1.0 + ratio)
        else:
            return self.s0_mg_ml

    def calculate_dissolution_rate(
        self,
        radii_cm: np.ndarray,
        particle_counts: np.ndarray,
        ph: float,
        c_bulk_mg_ml: float,
        fluid_volume_ml: float,
    ) -> np.ndarray:
        """
        Noyes-Whitney / Nernst-Brunner dissolution rate per particle bin:
        dM/dt = (D * Area / h) * (Cs(pH) - C_bulk)
        """
        cs = self.calculate_solubility(ph)
        driving_force = max(0.0, cs - c_bulk_mg_ml)

        # Dynamic diffusion layer: min(h_boundary, radius) to handle small particles
        h_cm = np.minimum(self.boundary_layer_cm, np.maximum(radii_cm, 1e-7))

        # Surface area per particle = 4 * pi * r^2
        surface_area_per_particle = 4.0 * math.pi * (radii_cm ** 2)
        total_surface_area = surface_area_per_particle * particle_counts

        # Noyes-Whitney rate in mg/s
        dissolution_rate_mg_s = (self.diffusivity * total_surface_area / h_cm) * driving_force
        return dissolution_rate_mg_s
