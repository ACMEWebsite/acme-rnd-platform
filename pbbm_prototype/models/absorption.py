"""
Absorption & GI Transit Module.

Couples GI compartmental transit (plug flow / first-order compartmental transit)
with Noyes-Whitney dissolution kinetics and permeability-driven intestinal absorption flux.

State tracking:
- Undissolved particle mass per size bin across 5 GI compartments
- Dissolved drug mass in each compartment
- Cumulative absorbed drug mass
- Unabsorbed / excreted drug mass
"""

import numpy as np
from .dissolution import DissolutionModel
from .gi_physiology import GIPhysiology


class GIModel:
    def __init__(self, dissolution_model: DissolutionModel, gi_physiology: GIPhysiology, peff_cm_s: float = 1e-4):
        """
        Parameters:
        -----------
        dissolution_model : DissolutionModel
            Configured dissolution model instance.
        gi_physiology : GIPhysiology
            Configured GI physiological parameters instance.
        peff_cm_s : float
            Effective intestinal membrane permeability in cm/s.
            Citation: Sun D et al. In vitro and in silico approaches to estimate intestinal permeability.
                      Pharm Res. 2002;19(10):1400-1416.
        """
        self.diss = dissolution_model
        self.gi = gi_physiology
        self.peff_cm_s = float(peff_cm_s)
        self.peff_cm_hr = self.peff_cm_s * 3600.0  # Convert to cm/hr

    def build_initial_state(self):
        """
        Initial state vector layout:
        For each compartment (5 compartments):
            - num_bins undissolved particle masses (mg)
            - 1 dissolved mass (mg)
        Followed by:
            - 1 cumulative absorbed mass (mg)
            - 1 unabsorbed excreted mass (mg)
        """
        n_comp = len(self.gi.compartments)
        n_bins = self.diss.num_bins

        # Initial dose is in stomach (compartment 0) as undissolved particle bins
        y0 = []
        for c_idx in range(n_comp):
            if c_idx == 0:
                # Stomach gets full initial dose distributed across particle bins
                for bin_data in self.diss.particle_bins:
                    y0.append(bin_data["initial_mass_mg"])
            else:
                for _ in range(n_bins):
                    y0.append(0.0)
            # Dissolved mass in compartment
            y0.append(0.0)

        # Absorbed mass & Excreted mass
        y0.append(0.0)  # Absorbed
        y0.append(0.0)  # Excreted

        return np.array(y0, dtype=np.float64)

    def compute_derivatives(self, t_hr: float, y: np.ndarray):
        """Calculates ODE system derivatives dy/dt at time t_hr."""
        n_comp = len(self.gi.compartments)
        n_bins = self.diss.num_bins
        dydt = np.zeros_like(y)

        abs_idx = n_comp * (n_bins + 1)
        excr_idx = abs_idx + 1

        total_absorbed_rate = 0.0

        for c_idx, comp_id in enumerate(self.gi.compartments):
            comp_start = c_idx * (n_bins + 1)
            undiss_masses = y[comp_start : comp_start + n_bins]
            dissolved_mass = max(0.0, y[comp_start + n_bins])

            # Physiological parameters
            vol_ml = self.gi.get_volume_ml(comp_id)
            ph = self.gi.get_ph(comp_id)
            k_transit = self.gi.get_transit_rate_1_hr(comp_id)
            c_bulk = dissolved_mass / vol_ml if vol_ml > 0 else 0.0

            # Calculate current particle radii from undissolved bin masses
            radii_cm = np.zeros(n_bins)
            particle_counts = np.zeros(n_bins)
            for b_idx in range(n_bins):
                m_bin = max(0.0, undiss_masses[b_idx])
                count = self.diss.particle_bins[b_idx]["particle_count"]
                particle_counts[b_idx] = count
                if count > 0 and m_bin > 0:
                    single_mass_mg = m_bin / count
                    single_vol_cm3 = (single_mass_mg / 1000.0) / self.diss.drug_density
                    radii_cm[b_idx] = (3.0 * single_vol_cm3 / (4.0 * np.pi)) ** (1.0 / 3.0)
                else:
                    radii_cm[b_idx] = 0.0

            # Dissolution rates for current compartment (mg/s -> mg/hr)
            diss_rates_mg_s = self.diss.calculate_dissolution_rate(
                radii_cm, particle_counts, ph, c_bulk, vol_ml
            )
            diss_rates_mg_hr = diss_rates_mg_s * 3600.0

            # Limit dissolution rate to remaining undissolved mass
            for b_idx in range(n_bins):
                if undiss_masses[b_idx] <= 0:
                    diss_rates_mg_hr[b_idx] = 0.0
                else:
                    diss_rates_mg_hr[b_idx] = min(diss_rates_mg_hr[b_idx], undiss_masses[b_idx] * 3600.0)

            total_dissolution_rate = np.sum(diss_rates_mg_hr)

            # Undissolved particle bin derivatives:
            # dM_undiss/dt = -dissolution - transit_out + transit_in
            for b_idx in range(n_bins):
                d_undiss = -diss_rates_mg_hr[b_idx] - k_transit * undiss_masses[b_idx]
                if c_idx > 0:
                    prev_start = (c_idx - 1) * (n_bins + 1)
                    prev_k_transit = self.gi.get_transit_rate_1_hr(self.gi.compartments[c_idx - 1])
                    prev_undiss_bin = max(0.0, y[prev_start + b_idx])
                    d_undiss += prev_k_transit * prev_undiss_bin
                dydt[comp_start + b_idx] = d_undiss

                # Excreted undissolved drug from colon
                if c_idx == n_comp - 1:
                    dydt[excr_idx] += k_transit * undiss_masses[b_idx]

            # Intestinal absorption flux (mg/hr)
            absorption_rate = 0.0
            if self.gi.is_absorptive(comp_id) and vol_ml > 0:
                area_cm2 = self.gi.get_surface_area_cm2(comp_id)
                # Flux J = Peff * A * C_bulk  (Peff in cm/hr, C_bulk in mg/mL = mg/cm3)
                c_bulk_mg_cm3 = c_bulk  # 1 mL = 1 cm3
                absorption_rate = self.peff_cm_hr * area_cm2 * c_bulk_mg_cm3
                absorption_rate = min(absorption_rate, dissolved_mass * 3600.0)

            total_absorbed_rate += absorption_rate

            # Dissolved mass derivative:
            # dM_diss/dt = +dissolution - absorption - transit_out + transit_in
            d_dissolved = total_dissolution_rate - absorption_rate - k_transit * dissolved_mass
            if c_idx > 0:
                prev_start = (c_idx - 1) * (n_bins + 1)
                prev_k_transit = self.gi.get_transit_rate_1_hr(self.gi.compartments[c_idx - 1])
                prev_dissolved = max(0.0, y[prev_start + n_bins])
                d_dissolved += prev_k_transit * prev_dissolved
            dydt[comp_start + n_bins] = d_dissolved

            # Excreted dissolved drug from colon
            if c_idx == n_comp - 1:
                dydt[excr_idx] += k_transit * dissolved_mass

        # Systemic cumulative absorption rate
        dydt[abs_idx] = total_absorbed_rate

        return dydt
