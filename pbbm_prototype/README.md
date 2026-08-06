# Research-Prototype Physiologically Based Biopharmaceutics Model (PBBM)

> **Disclaimer**: This codebase is a research prototype developed for exploratory and academic biopharmaceutical modeling. It is **not intended for regulatory submissions** (e.g. FDA/EMA IVIVC biowaiver applications).

---

## 🧬 Scientific & Mathematical Foundations

### 1. Dissolution Kinetics — Noyes-Whitney / Nernst-Brunner Equation
Particles are discretized into a log-normal population distribution across $N$ size bins:

$$\frac{dM_i}{dt} = -\frac{D \cdot A_i(r_i)}{h} \cdot \left( C_s(\text{pH}) - C_{\text{bulk}} \right)$$

- **Shrinking Particle Radius**: $\frac{dr_i}{dt} = -\frac{D}{\rho \cdot h} \left( C_s(\text{pH}) - C_{\text{bulk}} \right)$
- **Diffusion Coefficient ($D$)**: Estimated via Hayduk-Laudie formula: $\log_{10}(D) = -4.113 - 0.4609 \cdot \log_{10}(MW)$

### 2. Ionization & pH-Solubility — Henderson-Hasselbalch Equation
- **Weak Acid**: $C_s(\text{pH}) = S_0 \cdot \left(1 + 10^{\text{pH} - \text{pKa}}\right)$
- **Weak Base**: $C_s(\text{pH}) = S_0 \cdot \left(1 + 10^{\text{pKa} - \text{pH}}\right)$
- **Neutral**: $C_s(\text{pH}) = S_0$

### 3. Multi-Compartment GI Transit & Permeability Absorption
First-order compartmental transit across 5 GI segments (Stomach, Duodenum, Jejunum, Ileum, Colon):

$$\frac{dM_{\text{abs},k}}{dt} = P_{\text{eff}} \cdot A_{\text{gut},k} \cdot C_{\text{dissolved},k}$$

### 4. Systemic Pharmacokinetics (PK)
- **1-Compartment**: $\frac{dC_p}{dt} = \frac{1}{V_c} \frac{dM_{\text{absorbed}}}{dt} - \frac{CL}{V_c} C_p$
- **2-Compartment**: Central $V_c$, Peripheral $V_p$, Clearance $CL$, Inter-compartmental $Q$.

---

## 📚 Cited Physiological Default Parameters

All default parameters in `data/physiology_params.yaml` are sourced directly from published literature:

1. **Stomach**: pH 1.7, Volume 50 mL, Transit 0.25 h
   - *Citation*: Oberle RL et al. *J Pharmacokinet Biopharm*. 1990;18(3):211-226; Yu LX, Amidon GL. *Int J Pharm*. 1999;186(2):119-125.
2. **Duodenum**: pH 6.0, Volume 50 mL, Transit 0.25 h
   - *Citation*: Yu LX et al. *Pharm Res*. 2002;19(7):921-925.
3. **Jejunum**: pH 6.5, Volume 150 mL, Transit 1.5 h
   - *Citation*: Mudie DM et al. *Mol Pharm*. 2010;7(5):1388-1405.
4. **Ileum**: pH 7.4, Volume 100 mL, Transit 1.5 h
   - *Citation*: Mudie DM et al. *Mol Pharm*. 2010;7(5):1388-1405.
5. **Colon**: pH 6.8, Volume 50 mL, Transit 18.0 h
   - *Citation*: Yu LX et al. *Pharm Res*. 1996;13(11):1730-1738.

---

## ⚠️ Known Limitations (Regulatory vs. Exploratory)

If adapting for formal biopharmaceutics or regulatory modeling, note the following simplified assumptions:

1. **Simplified Compartments**: Uses a 5-compartment GI transit model rather than full 9-segment ACAT/Advanced Compartmental Absorption & Transit or GastroPlus/Simcyp spatial grids.
2. **No Population Inter-Individual Variability (IIV)**: Runs deterministic ODEs without Monte Carlo parameter sampling across patient demographics.
3. **Constant Fluid Volumes**: Assumes constant static lumen volume per compartment; does not simulate dynamic fluid secretion or mucosal reabsorption.
4. **No Bile Salt Micellar Solubilization**: Solubilization of highly lipophilic (BCS II/IV) drugs by bile salts (BS) in fed/fasted state is omitted unless $S_0$ is explicitly measured in FaSSIF/FeSSIF.
5. **Hydrodynamics & Shear Rates**: Uses a simplified diffusion layer boundary model ($h$) rather than computational fluid dynamics (CFD) for USP I/II paddle shear stress.

---

## 🚀 How to Run

### 1. Install Dependencies
```powershell
pip install -r requirements.txt
```

### 2. Run End-to-End Simulation
```powershell
python simulate.py
```
*Outputs*: Saved to `pbbm_prototype/output/pbbm_simulation_results.csv` and `pbbm_simulation_profiles.png`.

### 3. Run Sensitivity Analysis
```powershell
python sensitivity_analysis.py
```
*Outputs*: Saved to `pbbm_prototype/output/pbbm_sensitivity_tornado.png`.

### 4. Run Smoke Test
```powershell
python smoke_test.py
```
