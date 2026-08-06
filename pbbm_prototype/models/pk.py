"""
Systemic Pharmacokinetics (PK) Compartment Module.

Implements:
1. One-compartment PK model (Central compartment Vc, Clearance CL).
2. Two-compartment PK model (Central Vc, Peripheral Vp, Clearance CL, Inter-compartmental Q).

Takes the absorption rate dM_absorbed/dt as input and computes plasma concentration profiles.
"""

import numpy as np


class PKModel:
    def __init__(
        self,
        num_compartments: int = 1,
        cl_l_hr: float = 10.0,
        vc_l: float = 20.0,
        vp_l: float = 50.0,
        q_l_hr: float = 5.0,
    ):
        """
        Parameters:
        -----------
        num_compartments : int
            1 for 1-compartment model, 2 for 2-compartment model.
        cl_l_hr : float
            Systemic clearance in L/hr.
        vc_l : float
            Central volume of distribution in L.
        vp_l : float
            Peripheral volume of distribution in L (2-compartment model only).
        q_l_hr : float
            Inter-compartmental clearance in L/hr (2-compartment model only).
        """
        self.num_compartments = int(num_compartments)
        self.cl = float(cl_l_hr)
        self.vc = float(vc_l)
        self.vp = float(vp_l)
        self.q = float(q_l_hr)

        if self.cl <= 0 or self.vc <= 0:
            raise ValueError("CL and Vc must be positive numbers.")

    def get_initial_state(self):
        """Returns initial PK compartment drug masses (central, peripheral if 2-comp)."""
        if self.num_compartments == 1:
            return np.array([0.0])  # Mass in central compartment (mg)
        else:
            return np.array([0.0, 0.0])  # Mass in central, mass in peripheral (mg)

    def compute_derivatives(self, pk_state: np.ndarray, absorption_rate_mg_hr: float):
        """
        Calculates PK compartment mass derivatives dM_pk/dt (mg/hr).

        1-compartment:
            dM_c/dt = dM_abs/dt - (CL/Vc) * M_c

        2-compartment:
            dM_c/dt = dM_abs/dt - (CL/Vc)*M_c - (Q/Vc)*M_c + (Q/Vp)*M_p
            dM_p/dt = (Q/Vc)*M_c - (Q/Vp)*M_p
        """
        if self.num_compartments == 1:
            m_c = pk_state[0]
            dm_c = absorption_rate_mg_hr - (self.cl / self.vc) * m_c
            return np.array([dm_c])
        else:
            m_c = pk_state[0]
            m_p = pk_state[1]
            c_c = m_c / self.vc
            c_p = m_p / self.vp

            dm_c = absorption_rate_mg_hr - self.cl * c_c - self.q * c_c + self.q * c_p
            dm_p = self.q * c_c - self.q * c_p
            return np.array([dm_c, dm_p])

    def calculate_plasma_concentration(self, pk_state: np.ndarray) -> float:
        """Returns plasma concentration Cp in mg/L (equivalent to ug/mL)."""
        m_c = max(0.0, pk_state[0])
        return m_c / self.vc
