import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FlaskConical,
  HelpCircle,
  LineChart,
  LoaderCircle,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ModuleBanner } from "../../components/ModuleBanner";
import { ContourCanvas } from "./components/ContourCanvas";
import { TernaryCanvas } from "./components/TernaryCanvas";
import { ExportButton } from "./components/ExportButton";
import {
  ComponentSpec,
  DesignFamily,
  DesignType,
  FactorSpec,
  FractionalGeneratorInfo,
  GeneratedRun,
  generateRunMatrix,
} from "./engine/designGenerators";
import { DesirabilityGoal, calculateCompositeDesirability } from "./engine/desirabilityEngine";
import { ModelOrder, RegressionResult, fitModel } from "./engine/regressionEngine";

export function DoePage() {
  const [isLearnDoeOpen, setIsLearnDoeOpen] = useState(false);
  const [activeMaterial, setActiveMaterial] = useState<string>("model_factor_matrix");

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <ModuleBanner
          icon={FlaskConical}
          eyebrow="DOE Engine 3.0"
          title="Response Surface & DoE Studio (QbD Engine)"
          description="Step-by-step guided experimental design workflow: Model Selection → Factor Setup → Level Configuration → Response Optimization."
        />

        <main className="space-y-6">
          <ResponseSurfaceStudio onOpenLearnDoe={() => setIsLearnDoeOpen(true)} />
        </main>

        <LearnDoeModal
          isOpen={isLearnDoeOpen}
          onClose={() => setIsLearnDoeOpen(false)}
          activeMaterial={activeMaterial}
          setActiveMaterial={setActiveMaterial}
        />
      </div>
    </div>
  );
}

const LEVEL_GUIDANCE: Record<string, { levels: number; title: string; theory: string }> = {
  full_factorial: {
    levels: 2,
    title: "2-Level Full Factorial Screening",
    theory: "Evaluates main effects and 2-factor interactions with minimal run count (-1, +1). Linear assumption only.",
  },
  fractional_factorial: {
    levels: 2,
    title: "2-Level Fractional Factorial",
    theory: "Reduces run count by setting high-order interactions equal to generators. Requires 2 levels (-1, +1).",
  },
  plackett_burman: {
    levels: 2,
    title: "2-Level Plackett-Burman Screening",
    theory: "Hadamard orthogonal matrix screening array for high factor counts. Requires exactly 2 levels (-1, +1).",
  },
  taguchi: {
    levels: 2,
    title: "2-Level Taguchi Array",
    theory: "Robust parameter design screening array. Requires 2 levels (-1, +1).",
  },
  box_behnken: {
    levels: 3,
    title: "3-Level Box-Behnken Design (BBD)",
    theory: "Requires exactly 3 levels (-1, 0, +1). Evaluates quadratic curvature (x²) without running extreme corner points.",
  },
  ccd_face_centered: {
    levels: 3,
    title: "3-Level Central Composite (Face-Centered - CCF)",
    theory: "Requires 3 levels (-1, 0, +1) with α = 1.0. Fits 2nd-order quadratic models staying strictly inside bounds.",
  },
  ccd_circumscribed: {
    levels: 5,
    title: "5-Level Central Composite (Circumscribed - CCC)",
    theory: "Requires 5 levels (-α, -1, 0, +1, +α) with α = (2^k)^0.25 for rotatable uniform prediction variance.",
  },
  ccd_inscribed: {
    levels: 5,
    title: "5-Level Central Composite (Inscribed - CCI)",
    theory: "Requires 5 levels. Factorial points are scaled inward so axial star points land at ±1.",
  },
  three_level_factorial: {
    levels: 3,
    title: "3-Level Full Factorial (3^k)",
    theory: "Requires 3 levels (-1, 0, +1) for every factor combination. Evaluates quadratic curvature.",
  },
  simplex_centroid: {
    levels: 3,
    title: "Simplex Centroid Mixture",
    theory: "Requires component grid (0, 0.5, 1.0) summing to 100%.",
  },
  simplex_lattice: {
    levels: 3,
    title: "Simplex Lattice Mixture {q, m}",
    theory: "Systematic grid of component proportions with sum = 100%.",
  },
};

interface FactorGuidanceItem {
  minFactors: number;
  maxFactors: number;
  recommendedFactors: string;
  levels: string;
  runFormula: string;
  title: string;
  theory: string;
  underMinWarning?: string;
  overMaxWarning?: string;
}

const FACTOR_GUIDANCE: Record<string, FactorGuidanceItem> = {
  full_factorial: {
    minFactors: 2,
    maxFactors: 5,
    recommendedFactors: "2 to 5 Factors",
    levels: "2 Levels (-1, +1)",
    runFormula: "N = 2^k + Center",
    title: "Full Factorial (2^k)",
    theory: "Tests all 2^k factor combinations. Evaluates all main effects and high-order interactions.",
    underMinWarning: "Full Factorial requires at least 2 factors.",
    overMaxWarning: "Full Factorial with >5 factors causes an exponential run explosion (2^6 = 64 runs)! Switch to Fractional Factorial (2^(k-p)) or Plackett-Burman.",
  },
  fractional_factorial: {
    minFactors: 3,
    maxFactors: 7,
    recommendedFactors: "3 to 7 Factors",
    levels: "2 Levels (-1, +1)",
    runFormula: "N = 2^(k-p) + Center",
    title: "Fractional Factorial (2^(k-p))",
    theory: "Requires 3+ factors. Reduces run count by aliasing high-order interactions (Resolution III, IV, V).",
    underMinWarning: "Fractional Factorial requires at least 3 factors to create a fraction (2^(3-1) = 4 runs).",
    overMaxWarning: "For >7 factors, consider Plackett-Burman screening arrays for maximum efficiency.",
  },
  plackett_burman: {
    minFactors: 4,
    maxFactors: 15,
    recommendedFactors: "4 to 15 Factors",
    levels: "2 Levels (-1, +1)",
    runFormula: "N = Multiple of 4 (12, 16, 20)",
    title: "Plackett-Burman Screening",
    theory: "Hadamard matrix screening array designed specifically for screening 4 to 15 factors in minimal runs.",
    underMinWarning: "Plackett-Burman requires at least 4 factors. For 2-3 factors, use Full Factorial.",
    overMaxWarning: "Screening >15 factors simultaneously is high-risk. Group factors into logical blocks first.",
  },
  taguchi: {
    minFactors: 3,
    maxFactors: 7,
    recommendedFactors: "3 to 7 Factors",
    levels: "2 or 3 Levels",
    runFormula: "N = L8, L9, L12, L16 Array",
    title: "Taguchi Orthogonal Array",
    theory: "Robust parameter design screening array for 3+ factors.",
    underMinWarning: "Taguchi arrays require at least 3 factors.",
  },
  box_behnken: {
    minFactors: 3,
    maxFactors: 5,
    recommendedFactors: "3 to 5 Factors",
    levels: "3 Levels (-1, 0, +1)",
    runFormula: "N = 2k(k-1) + Center",
    title: "Box-Behnken Design (BBD)",
    theory: "Requires AT LEAST 3 factors (BBD does not exist for 2 factors!). Evaluates quadratic curvature without extreme corners.",
    underMinWarning: "CRITICAL WARNING: Box-Behnken Design does NOT exist for 2 factors! Add a 3rd factor or switch to Central Composite Design (CCD).",
    overMaxWarning: "For >5 factors, BBD run counts become prohibitive. Use a CCD half-fraction instead.",
  },
  ccd_circumscribed: {
    minFactors: 2,
    maxFactors: 6,
    recommendedFactors: "2 to 5 Factors",
    levels: "5 Levels (-α, -1, 0, +1, +α)",
    runFormula: "N = 2^k + 2k + Center",
    title: "Central Composite (CCD - Circumscribed / Rotatable α)",
    theory: "Requires 2+ factors. Uses Rotatable α = (2^k)^0.25 (Industry Standard) for equal prediction precision in all directions.",
    underMinWarning: "CCD requires at least 2 factors.",
    overMaxWarning: "For >6 factors, run a Plackett-Burman screening design first to select the top 3-4 factors.",
  },
  ccd_face_centered: {
    minFactors: 2,
    maxFactors: 6,
    recommendedFactors: "2 to 5 Factors",
    levels: "3 Levels (-1, 0, +1)",
    runFormula: "N = 2^k + 2k + Center",
    title: "Central Composite (CCD - Face-Centered / CCF)",
    theory: "Requires 2+ factors. Uses α = 1.0 to fit 2nd-order models staying strictly inside factor bounds.",
    underMinWarning: "CCD Face-Centered requires at least 2 factors.",
    overMaxWarning: "For >6 factors, run a screening design first.",
  },
  ccd_inscribed: {
    minFactors: 2,
    maxFactors: 6,
    recommendedFactors: "2 to 5 Factors",
    levels: "5 Levels (Inward scaled)",
    runFormula: "N = 2^k + 2k + Center",
    title: "Central Composite (CCD - Inscribed / CCI)",
    theory: "Requires 2+ factors. Factorial points are scaled inward so axial star points land at ±1.",
    underMinWarning: "CCD Inscribed requires at least 2 factors.",
  },
  three_level_factorial: {
    minFactors: 2,
    maxFactors: 3,
    recommendedFactors: "2 to 3 Factors",
    levels: "3 Levels (-1, 0, +1)",
    runFormula: "N = 3^k + Center",
    title: "3-Level Full Factorial (3^k)",
    theory: "Practical for 2 to 3 factors. Evaluates quadratic curvature for every factor combination.",
    underMinWarning: "3-Level Factorial requires at least 2 factors.",
    overMaxWarning: "HIGH RUN COUNT WARNING: 3-Level Factorial with 4 factors requires 81 runs (3^4)! Switch to Box-Behnken or CCD.",
  },
  simplex_centroid: {
    minFactors: 3,
    maxFactors: 6,
    recommendedFactors: "3 to 6 Components",
    levels: "Grid (0, 0.5, 1.0)",
    runFormula: "N = 2^k - 1 + Center",
    title: "Simplex Centroid Mixture",
    theory: "Requires AT LEAST 3 mixture components bound by sum constraint (Σ Component = 100%).",
    underMinWarning: "Mixture designs require at least 3 components to form a simplex region.",
  },
  simplex_lattice: {
    minFactors: 3,
    maxFactors: 6,
    recommendedFactors: "3 to 6 Components",
    levels: "m-degree Lattice Grid",
    runFormula: "N = (k + m - 1)! / [m! (k-1)!]",
    title: "Simplex Lattice Mixture {q, m}",
    theory: "Requires AT LEAST 3 mixture components on a systematic grid summing to 100%.",
    underMinWarning: "Mixture designs require at least 3 components to form a simplex grid.",
  },
};

function ResponseSurfaceStudio({ onOpenLearnDoe }: { onOpenLearnDoe?: () => void }) {
  // Wizard Stepper State (1: Model -> 2: Factors -> 3: Levels -> 4: Responses)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Factors / Components State
  const [factors, setFactors] = useState<FactorSpec[]>([
    { name: "Binder conc. (%)", low: 2, high: 8, unit: "%", lowLabel: "Low (2%)", highLabel: "High (8%)" },
    { name: "Disintegrant conc. (%)", low: 1, high: 5, unit: "%", lowLabel: "Low (1%)", highLabel: "High (5%)" },
    { name: "Compression force (kN)", low: 5, high: 15, unit: "kN", lowLabel: "Low (5kN)", highLabel: "High (15kN)" },
  ]);

  const [components, setComponents] = useState<ComponentSpec[]>([
    { name: "Active API", min: 0.2, max: 0.5 },
    { name: "Microcrystalline Cellulose", min: 0.3, max: 0.6 },
    { name: "Lactose Monohydrate", min: 0.1, max: 0.4 },
  ]);

  // Step 1: Design Setup State
  const [family, setFamily] = useState<DesignFamily>("rsm");
  const [designType, setDesignType] = useState<DesignType>("box_behnken");
  const [customLevelCount, setCustomLevelCount] = useState<number>(3);
  const [centerPoints, setCenterPoints] = useState(3);
  const [latticeDegree, setLatticeDegree] = useState<number>(2);
  const [customAlpha, setCustomAlpha] = useState<number>(1.682);
  const [showTheoryMatrix, setShowTheoryMatrix] = useState<boolean>(false);

  // Sync customAlpha to Rotatable alpha = (2^k)^0.25 (Industry Standard) whenever designType or factor count changes
  useEffect(() => {
    const k = factors.length;
    if (designType === "ccd_face_centered") {
      setCustomAlpha(1.0);
    } else {
      // Rotatable alpha formula: alpha = (2^k)^0.25
      const rotatableAlpha = Number(Math.pow(Math.pow(2, k), 0.25).toFixed(3));
      setCustomAlpha(rotatableAlpha);
    }
  }, [designType, factors.length]);

  // Model & Responses State
  const [modelOrder, setModelOrder] = useState<ModelOrder>("quadratic");
  const [responseNames, setResponseNames] = useState<string[]>(["Dissolution at 30m (%)", "Tablet Hardness (kp)"]);
  const [goals, setGoals] = useState<DesirabilityGoal[]>([
    { response_name: "Dissolution at 30m (%)", direction: "maximize", target: 85, low: 70, high: 100, weight: 1.0 },
    { response_name: "Tablet Hardness (kp)", direction: "maximize", target: 8.0, low: 4.0, high: 12.0, weight: 0.8 },
  ]);

  // Generated Matrix & Response Inputs
  const [runs, setRuns] = useState<GeneratedRun[]>([]);
  const [fractionalInfo, setFractionalInfo] = useState<FractionalGeneratorInfo | undefined>(undefined);
  const [responseValues, setResponseValues] = useState<Record<number, Record<string, number | "">>>({});

  // Desirability Threshold
  const [desirabilityThreshold, setDesirabilityThreshold] = useState(0.7);

  // Computed Regression & ANOVA Results
  const [regressionResults, setRegressionResults] = useState<Record<string, RegressionResult>>({});
  const [error, setError] = useState("");

  // Model Legality Check
  const isQuadraticLegal = useMemo(() => {
    if (family === "factorial") {
      return designType === "three_level_factorial";
    }
    return true;
  }, [family, designType]);

  // Generate Design Run Matrix
  function handleGenerateDesign() {
    setError("");
    try {
      if (family !== "mixture" && factors.length < 2) {
        throw new Error("At least 2 factors are required for Factorial / RSM designs.");
      }
      if (family === "mixture" && components.length < 2) {
        throw new Error("At least 2 components are required for Mixture designs.");
      }

      const res = generateRunMatrix(family, designType, factors, components, {
        centerPoints,
        latticeDegree,
        customAlpha,
      });

      setRuns(res.runs);
      setFractionalInfo(res.info);

      // Initialize empty response values map
      const initialVals: Record<number, Record<string, number | "">> = {};
      res.runs.forEach((r) => {
        initialVals[r.run_id] = {};
        responseNames.forEach((name) => {
          initialVals[r.run_id][name] = "";
        });
      });
      setResponseValues(initialVals);
      setRegressionResults({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate design matrix.");
    }
  }

  // Populate Synthetic Sample Response Data
  function handleFillSampleData() {
    if (!runs.length) return;
    const sampleVals: Record<number, Record<string, number | "">> = {};
    runs.forEach((r) => {
      sampleVals[r.run_id] = {};
      if (family === "mixture") {
        const c1 = r.coded[components[0]?.name] ?? 0.33;
        const c2 = r.coded[components[1]?.name] ?? 0.33;
        const dis = 75 + 25 * c1 + 15 * c2 - 10 * c1 * c2 + (Math.random() * 2 - 1);
        const hard = 5.0 + 8.0 * c1 + 4.0 * c2 + (Math.random() * 0.4 - 0.2);
        sampleVals[r.run_id][responseNames[0]] = Number(dis.toFixed(2));
        sampleVals[r.run_id][responseNames[1]] = Number(hard.toFixed(2));
      } else {
        const x1 = r.coded[factors[0]?.name] ?? 0;
        const x2 = r.coded[factors[1]?.name] ?? 0;
        const x3 = r.coded[factors[2]?.name] ?? 0;

        const dis = 82 + 8.5 * x1 + 5.2 * x2 - 3.1 * (x1 * x1) + 4.0 * (x1 * x2) - 2.5 * x3 + (Math.random() * 1.8 - 0.9);
        const hard = 6.8 + 1.8 * x1 + 1.2 * x2 + 0.8 * (x2 * x2) + (Math.random() * 0.3 - 0.15);

        sampleVals[r.run_id][responseNames[0]] = Number(dis.toFixed(2));
        sampleVals[r.run_id][responseNames[1]] = Number(hard.toFixed(2));
      }
    });

    setResponseValues(sampleVals);
  }

  // Run Regression & ANOVA Analysis
  function handleRunAnalysis() {
    setError("");
    if (!runs.length) {
      setError("Please generate a design run matrix first.");
      return;
    }

    try {
      const activeFactorNames = family === "mixture" ? components.map((c) => c.name) : factors.map((f) => f.name);
      const results: Record<string, RegressionResult> = {};

      for (const respName of responseNames) {
        const completedRuns: { coded: Record<string, number> }[] = [];
        const yVals: number[] = [];

        runs.forEach((r) => {
          const val = responseValues[r.run_id]?.[respName];
          if (typeof val === "number" && Number.isFinite(val)) {
            completedRuns.push(r);
            yVals.push(val);
          }
        });

        if (completedRuns.length < 3) {
          throw new Error(`Enter at least 3 response values for '${respName}' before running regression analysis.`);
        }

        const fit = fitModel(activeFactorNames, completedRuns, yVals, modelOrder, respName, family === "mixture");
        results[respName] = fit;
      }

      setRegressionResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regression analysis failed.");
    }
  }

  // Ranked Trials with Derringer Desirability Scores
  const rankedTrials = useMemo(() => {
    if (!Object.keys(regressionResults).length) return [];
    return runs.map((r) => {
      const evals = goals.map((g) => {
        const reg = regressionResults[g.response_name];
        const val = responseValues[r.run_id]?.[g.response_name];
        const numVal = typeof val === "number" ? val : reg ? reg.evalModel(r.coded).pred : 0;
        return { goal: g, value: numVal };
      });

      const { composite_D, individual_d } = calculateCompositeDesirability(evals);
      return {
        ...r,
        desirability_score: composite_D,
        individual_d,
      };
    }).sort((a, b) => b.desirability_score - a.desirability_score);
  }, [runs, responseValues, regressionResults, goals]);

  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-semibold">{error}</div>}

      {/* Top Left Action Button - Learn DoE (Positioned at Far-Left Pink Oval Location) */}
      <div className="flex items-center justify-start">
        <button
          type="button"
          onClick={onOpenLearnDoe}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-700 to-cyan-700 hover:from-sky-800 hover:to-cyan-800 px-4 py-2.5 text-xs font-bold text-white shadow-md transition transform active:scale-95 cursor-pointer"
        >
          <BookOpen size={16} className="text-white shrink-0" />
          <span>📖 Learn DoE</span>
        </button>
      </div>

      {/* 3-Tab Navigation Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-panel">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab(1)}
            className={`rounded-xl p-3 border transition ${
              activeTab === 1
                ? "border-cyan-600 bg-cyan-50 text-cyan-900 shadow-sm"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <ClipboardList size={16} className={activeTab === 1 ? "text-cyan-700" : "text-slate-400"} />
              <span>Tab 1: Input Setup (Factor, Level & Response)</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => runs.length > 0 && setActiveTab(2)}
            disabled={runs.length === 0}
            className={`rounded-xl p-3 border transition ${
              activeTab === 2
                ? "border-cyan-600 bg-cyan-50 text-cyan-900 shadow-sm"
                : runs.length > 0
                ? "border-slate-200 text-slate-600 hover:bg-slate-50"
                : "border-slate-200 text-slate-400 opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FlaskConical size={16} className={activeTab === 2 ? "text-cyan-700" : "text-slate-400"} />
              <span>Tab 2: Main Run Matrix & Execution</span>
              {runs.length > 0 && <CheckCircle2 size={14} className="text-emerald-600" />}
            </div>
          </button>

          <button
            type="button"
            onClick={() => Object.keys(regressionResults).length > 0 && setActiveTab(3)}
            disabled={Object.keys(regressionResults).length === 0}
            className={`rounded-xl p-3 border transition ${
              activeTab === 3
                ? "border-cyan-600 bg-cyan-50 text-cyan-900 shadow-sm"
                : Object.keys(regressionResults).length > 0
                ? "border-slate-200 text-slate-600 hover:bg-slate-50"
                : "border-slate-200 text-slate-400 opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <LineChart size={16} className={activeTab === 3 ? "text-cyan-700" : "text-slate-400"} />
              <span>Tab 3: Analysis & Region Graphs (MODR)</span>
              {Object.keys(regressionResults).length > 0 && <CheckCircle2 size={14} className="text-emerald-600" />}
            </div>
          </button>
        </div>
      </div>

      {/* TAB 1: INPUT SETUP (MODEL, FACTORS, LEVELS, RESPONSES) */}
      {activeTab === 1 && (
        <div className="space-y-6">
          {/* Mini 4-Step Stepper Progress Bar inside Tab 1 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-panel">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-bold">
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className={`rounded-xl p-2.5 border transition ${
                  wizardStep === 1
                    ? "border-cyan-600 bg-cyan-50 text-cyan-900 shadow-sm"
                    : wizardStep > 1
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 text-slate-400"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>1. Model Selection</span>
                  {wizardStep > 1 && <CheckCircle2 size={14} className="text-emerald-600" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => wizardStep >= 2 && setWizardStep(2)}
                disabled={wizardStep < 2}
                className={`rounded-xl p-2.5 border transition ${
                  wizardStep === 2
                    ? "border-cyan-600 bg-cyan-50 text-cyan-900 shadow-sm"
                    : wizardStep > 2
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 text-slate-400 opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>2. Factor Setup</span>
                  {wizardStep > 2 && <CheckCircle2 size={14} className="text-emerald-600" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => wizardStep >= 3 && setWizardStep(3)}
                disabled={wizardStep < 3}
                className={`rounded-xl p-2.5 border transition ${
                  wizardStep === 3
                    ? "border-cyan-600 bg-cyan-50 text-cyan-900 shadow-sm"
                    : wizardStep > 3
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 text-slate-400 opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>3. Level Config</span>
                  {wizardStep > 3 && <CheckCircle2 size={14} className="text-emerald-600" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => wizardStep >= 4 && setWizardStep(4)}
                disabled={wizardStep < 4}
                className={`rounded-xl p-2.5 border transition ${
                  wizardStep === 4
                    ? "border-cyan-600 bg-cyan-50 text-cyan-900 shadow-sm"
                    : "border-slate-200 text-slate-400 opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>4. Response Goals</span>
                  {wizardStep >= 4 && runs.length > 0 && <CheckCircle2 size={14} className="text-emerald-600" />}
                </div>
              </button>
            </div>
          </div>

          {/* STEP 1: MODEL SELECTION BAR */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-navy-950">Step 1: Select Experimental Design Model</h2>
                <p className="mt-0.5 text-xs text-slate-500">Choose between Factorial Screening, Response Surface Methodology (RSM), or Mixture Formulation.</p>
              </div>
              {wizardStep > 1 && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 size={14} /> Model Saved
                </span>
              )}
            </div>

            {/* Family Selector Tabs */}
            <div className="mt-5 flex flex-wrap gap-3">
              {(["factorial", "rsm", "mixture"] as const).map((fam) => (
                <button
                  key={fam}
                  type="button"
                  onClick={() => {
                    setFamily(fam);
                    if (fam === "factorial") setDesignType("full_factorial");
                    else if (fam === "rsm") setDesignType("ccd_circumscribed");
                    else setDesignType("simplex_centroid");
                  }}
                  className={`rounded-xl border px-5 py-3 text-xs font-bold transition ${family === fam ? "border-cyan-600 bg-cyan-50 text-cyan-900 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  {fam === "factorial" ? "Factorial (Screening)" : fam === "rsm" ? "Response Surface / RSM (Optimization)" : "Mixture (Formulations)"}
                </button>
              ))}
            </div>

            {/* Design Type Dropdown & Parameters */}
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Design Type">
                <select value={designType} onChange={(e) => setDesignType(e.target.value as DesignType)} className={fieldClass}>
                  {family === "factorial" && (
                    <>
                      <option value="full_factorial">Full Factorial (2-Level)</option>
                      <option value="fractional_factorial">Fractional Factorial (2^(k-p))</option>
                      <option value="plackett_burman">Plackett-Burman (Screening Array)</option>
                      <option value="taguchi">Taguchi Orthogonal Array</option>
                    </>
                  )}
                  {family === "rsm" && (
                    <>
                      <option value="ccd_circumscribed">Central Composite Design (CCD - Circumscribed / Rotatable α)</option>
                      <option value="ccd_face_centered">Central Composite Design (CCD - Face-Centered / CCF)</option>
                      <option value="ccd_inscribed">Central Composite Design (CCD - Inscribed / CCI)</option>
                      <option value="box_behnken">Box-Behnken Design (BBD)</option>
                      <option value="three_level_factorial">Three-Level Full Factorial (3^k)</option>
                    </>
                  )}
                  {family === "mixture" && (
                    <>
                      <option value="simplex_centroid">Simplex Centroid Design</option>
                      <option value="simplex_lattice">Simplex Lattice Design {`{q, m}`}</option>
                    </>
                  )}
                </select>
              </Field>

              {family !== "mixture" && (
                <Field label="Center Points (Replicates)">
                  <input type="number" min={0} max={10} value={centerPoints} onChange={(e) => setCenterPoints(Number(e.target.value))} className={fieldClass} />
                </Field>
              )}

              {family === "mixture" && designType === "simplex_lattice" && (
                <Field label="Lattice Degree (m)">
                  <input type="number" min={1} max={4} value={latticeDegree} onChange={(e) => setLatticeDegree(Number(e.target.value))} className={fieldClass} />
                </Field>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-cyan-800 transition"
              >
                <span>Save Model & Continue to Factor Setup</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </section>

      {/* STEP 2: FACTOR SETUP BAR */}
      {wizardStep >= 2 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-navy-950">Step 2: Factor Setup Bar</h2>
              <p className="mt-0.5 text-xs text-slate-500">Define independent continuous process factors or formulation mixture components.</p>
            </div>
            {wizardStep > 2 && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 flex items-center gap-1">
                <CheckCircle2 size={14} /> Factors Saved
              </span>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-navy-950 text-xs uppercase tracking-wide">{family === "mixture" ? "Mixture Components (Σ Component = 100%)" : "Continuous Process Factors"}</h3>
              <button
                type="button"
                onClick={() => {
                  if (family === "mixture") {
                    setComponents((v) => [...v, { name: `Component ${v.length + 1}`, min: 0, max: 1 }]);
                  } else {
                    setFactors((v) => [...v, { name: `Factor ${v.length + 1}`, low: 0, high: 10 }]);
                  }
                }}
                className="flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-800"
              >
                <Plus size={16} /> Add {family === "mixture" ? "Component" : "Factor"}
              </button>
            </div>

            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
              {family === "mixture" ? (
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left font-semibold uppercase tracking-wide text-slate-500">
                      <th className="pb-2">Component Name</th>
                      <th className="pb-2">Min Proportion</th>
                      <th className="pb-2">Max Proportion</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {components.map((c, idx) => (
                      <tr key={idx} className="border-b border-slate-200/60">
                        <td className="py-1.5 pr-2">
                          <input value={c.name} onChange={(e) => setComponents((v) => v.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item)))} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-semibold text-slate-800" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input type="number" step="0.05" value={c.min} onChange={(e) => setComponents((v) => v.map((item, i) => (i === idx ? { ...item, min: Number(e.target.value) } : item)))} className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input type="number" step="0.05" value={c.max} onChange={(e) => setComponents((v) => v.map((item, i) => (i === idx ? { ...item, max: Number(e.target.value) } : item)))} className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5" />
                        </td>
                        <td className="py-1.5 text-right">
                          <button type="button" onClick={() => setComponents((v) => v.filter((_, i) => i !== idx))} className="text-rose-600 hover:text-rose-700">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left font-semibold uppercase tracking-wide text-slate-500">
                      <th className="pb-2">Factor Name</th>
                      <th className="pb-2">Low (-1) Val</th>
                      <th className="pb-2">Low (-1) Label</th>
                      <th className="pb-2">High (+1) Val</th>
                      <th className="pb-2">High (+1) Label</th>
                      <th className="pb-2">Unit</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {factors.map((f, idx) => (
                      <tr key={idx} className="border-b border-slate-200/60">
                        <td className="py-1.5 pr-2">
                          <input value={f.name} onChange={(e) => setFactors((v) => v.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item)))} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-semibold text-slate-800" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input type="number" value={f.low} onChange={(e) => setFactors((v) => v.map((item, i) => (i === idx ? { ...item, low: Number(e.target.value) } : item)))} className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input value={f.lowLabel ?? ""} placeholder={`Low (${f.low})`} onChange={(e) => setFactors((v) => v.map((item, i) => (i === idx ? { ...item, lowLabel: e.target.value } : item)))} className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1.5" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input type="number" value={f.high} onChange={(e) => setFactors((v) => v.map((item, i) => (i === idx ? { ...item, high: Number(e.target.value) } : item)))} className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input value={f.highLabel ?? ""} placeholder={`High (${f.high})`} onChange={(e) => setFactors((v) => v.map((item, i) => (i === idx ? { ...item, highLabel: e.target.value } : item)))} className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1.5" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input value={f.unit ?? ""} onChange={(e) => setFactors((v) => v.map((item, i) => (i === idx ? { ...item, unit: e.target.value } : item)))} placeholder="e.g. % or kN" className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5" />
                        </td>
                        <td className="py-1.5 text-right">
                          <button type="button" onClick={() => setFactors((v) => v.filter((_, i) => i !== idx))} className="text-rose-600 hover:text-rose-700">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Factor Count Theoretical Guidance Card & Red Warning Banner */}
          <div className="mt-4 space-y-3">
            {/* Theoretical Factor Guidance Box */}
            <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 text-xs">
              <div className="flex items-center gap-2 font-bold text-sky-950">
                <Sparkles size={16} className="text-sky-700" />
                <span>Theoretical Factor Guidance: {FACTOR_GUIDANCE[designType]?.title}</span>
              </div>
              <p className="mt-1 text-sky-900 leading-relaxed">
                {FACTOR_GUIDANCE[designType]?.theory} (Current Factor Count: <strong>{family === "mixture" ? components.length : factors.length}</strong>).
              </p>
            </div>

            {/* Red Warning Banner when factor count violates model rules */}
            {(() => {
              const k = family === "mixture" ? components.length : factors.length;
              const rule = FACTOR_GUIDANCE[designType];
              if (!rule) return null;

              if (k < rule.minFactors) {
                return (
                  <div className="rounded-xl border-2 border-rose-500 bg-rose-50 p-4 text-xs text-rose-900 shadow-md flex items-start gap-3">
                    <HelpCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-950 text-sm">
                        ⚠️ CRITICAL FACTOR COUNT WARNING: {rule.title} Requires AT LEAST {rule.minFactors} Factors!
                      </p>
                      <p className="mt-1 leading-relaxed font-semibold">
                        {rule.underMinWarning ?? `You currently have ${k} factor(s). Please add more factors to reach at least ${rule.minFactors}.`}
                      </p>
                    </div>
                  </div>
                );
              }

              if (rule.maxFactors && k > rule.maxFactors) {
                return (
                  <div className="rounded-xl border-2 border-rose-500 bg-rose-50 p-4 text-xs text-rose-900 shadow-md flex items-start gap-3">
                    <HelpCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-950 text-sm">
                        ⚠️ CRITICAL FACTOR RANGE WARNING: {k} Factors Exceeds Maximum Limit of {rule.maxFactors} for {rule.title}!
                      </p>
                      <p className="mt-1 leading-relaxed font-semibold">
                        {rule.overMaxWarning ?? `Maximum recommended limit is ${rule.maxFactors} factors. High factor counts create prohibitively large trial matrices.`}
                      </p>
                    </div>
                  </div>
                );
              }

              return null;
            })()}
          </div>

          <div className="mt-5 flex justify-end">
            {(() => {
              const kCount = family === "mixture" ? components.length : factors.length;
              const minF = FACTOR_GUIDANCE[designType]?.minFactors ?? 2;
              const maxF = FACTOR_GUIDANCE[designType]?.maxFactors ?? 15;
              const isInvalid = kCount < minF || kCount > maxF;

              return (
                <button
                  type="button"
                  disabled={isInvalid}
                  onClick={() => setWizardStep(3)}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md transition ${
                    isInvalid ? "bg-slate-300 cursor-not-allowed" : "bg-cyan-700 hover:bg-cyan-800"
                  }`}
                >
                  <span>Save Factors & Continue to Level Configuration</span>
                  <ChevronRight size={16} />
                </button>
              );
            })()}
          </div>
        </section>
      )}

      {/* STEP 3: LEVEL CONFIGURATION BAR WITH RED WARNING */}
      {wizardStep >= 3 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-navy-950">Step 3: Factor Level Configuration Bar</h2>
              <p className="mt-0.5 text-xs text-slate-500">Inspect model-specific level recommendations and configure factor settings.</p>
            </div>
            {wizardStep > 3 && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 flex items-center gap-1">
                <CheckCircle2 size={14} /> Levels Saved
              </span>
            )}
          </div>

          <div className="mt-4 space-y-4">
            {/* Level Controls & Theoretical Guidance */}
            <div className="grid gap-4 md:grid-cols-3">
              {family !== "mixture" && (
                <Field label="Factor Levels Count (User Override)">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={2}
                      max={7}
                      value={customLevelCount}
                      onChange={(e) => setCustomLevelCount(Number(e.target.value))}
                      className={fieldClass}
                    />
                    <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                      (Rec: {LEVEL_GUIDANCE[designType]?.levels ?? 2})
                    </span>
                  </div>
                </Field>
              )}

              {designType.startsWith("ccd") && (
                <Field label="Custom Alpha (α) Axial Distance">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min={0.5}
                      max={4.0}
                      value={customAlpha}
                      onChange={(e) => setCustomAlpha(Number(e.target.value))}
                      className={fieldClass}
                    />
                    <span className="text-xs font-semibold text-cyan-700 whitespace-nowrap">
                      (Default: {(Math.pow(2, factors.length / 4.0)).toFixed(3)})
                    </span>
                  </div>
                </Field>
              )}

              <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 text-xs md:col-span-1">
                <div className="flex items-center gap-2 font-bold text-sky-950">
                  <Sparkles size={16} className="text-sky-700" />
                  <span>Theoretical Guidance: {LEVEL_GUIDANCE[designType]?.title}</span>
                </div>
                <p className="mt-1 text-sky-900 leading-relaxed">
                  {LEVEL_GUIDANCE[designType]?.theory}
                </p>
              </div>
            </div>

            {/* Red Warning Banner when user overrides level count */}
            {family !== "mixture" && customLevelCount !== (LEVEL_GUIDANCE[designType]?.levels ?? 2) && (
              <div className="rounded-xl border-2 border-rose-500 bg-rose-50 p-4 text-xs text-rose-900 shadow-md flex items-start gap-3">
                <HelpCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-950 text-sm">
                    ⚠️ CRITICAL WARNING: Level Count Override ({customLevelCount} Levels Selected vs {LEVEL_GUIDANCE[designType]?.levels} Recommended)!
                  </p>
                  <p className="mt-1 leading-relaxed font-semibold">
                    {customLevelCount < (LEVEL_GUIDANCE[designType]?.levels ?? 2)
                      ? "Reducing levels below recommendation prevents quadratic curvature (x²) estimation and risks matrix singularity in RSM regression!"
                      : "Increasing level count beyond recommendation introduces unnecessary trial complexity and extra runs without improving model resolution."}
                  </p>
                </div>
              </div>
            )}

            {/* Computed Factor Level Table Breakdown */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="font-bold text-navy-950 text-xs uppercase tracking-wide">Model Factor Level Breakdown (Calculated Actual Values)</h4>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 uppercase">
                      <th className="py-2">Factor</th>
                      <th className="py-2">Coded Level -1 (Low)</th>
                      <th className="py-2">Coded Level 0 (Center)</th>
                      <th className="py-2">Coded Level +1 (High)</th>
                      {designType.startsWith("ccd") && <th className="py-2 text-cyan-800">Coded Levels ±α (Axial: α = {customAlpha})</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {factors.map((f) => {
                      const mid = (f.low + f.high) / 2;
                      const halfRange = (f.high - f.low) / 2;
                      const alphaLow = mid - customAlpha * halfRange;
                      const alphaHigh = mid + customAlpha * halfRange;

                      return (
                        <tr key={f.name} className="border-b border-slate-200/60">
                          <td className="py-2 font-bold text-navy-950">{f.name}</td>
                          <td className="py-2 font-mono">{f.low} {f.unit} ({f.lowLabel ?? "Low"})</td>
                          <td className="py-2 font-mono text-amber-700">{mid.toFixed(2)} {f.unit} (Center)</td>
                          <td className="py-2 font-mono">{f.high} {f.unit} ({f.highLabel ?? "High"})</td>
                          {designType.startsWith("ccd") && (
                            <td className="py-2 font-mono text-cyan-800">
                              <span className="font-bold">
                                -α: {alphaLow.toFixed(2)} {f.unit}
                              </span>
                              {" | "}
                              <span className="font-bold">
                                +α: {alphaHigh.toFixed(2)} {f.unit}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => setWizardStep(4)}
              className="flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-cyan-800 transition"
            >
              <span>Save Levels & Continue to Response Selection</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </section>
      )}

      {/* STEP 4: RESPONSE SELECTION & OPTIMIZATION BAR */}
      {wizardStep >= 4 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6 transition-all space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-navy-950">Step 4: Response Selection & Optimization Bar</h2>
              <p className="mt-0.5 text-xs text-slate-500">Configure output response goals and generate experimental trial matrix.</p>
            </div>
          </div>

          {/* Custom Responses Manager */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-navy-950 text-xs uppercase tracking-wide">Custom Response Variables (Outputs to Optimize)</h3>
                <p className="text-xs text-slate-500">Add, rename, or remove response variables according to your specific R&D formulation or analytical method needs.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newName = `Custom Response ${responseNames.length + 1}`;
                  setResponseNames((v) => [...v, newName]);
                  setGoals((v) => [...v, { response_name: newName, direction: "maximize", target: 80, low: 50, high: 100, weight: 1.0 }]);
                }}
                className="flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-800 bg-white border border-cyan-300 px-3 py-1.5 rounded-lg shadow-sm"
              >
                <Plus size={16} /> Add Custom Response
              </button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {responseNames.map((name, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
                  <input
                    value={name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setResponseNames((v) => v.map((item, i) => (i === idx ? newName : item)));
                      setGoals((v) => v.map((g, i) => (i === idx ? { ...g, response_name: newName } : g)));
                    }}
                    className="w-full font-semibold text-navy-950 bg-transparent text-xs outline-none px-1"
                  />
                  {responseNames.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setResponseNames((v) => v.filter((_, i) => i !== idx));
                        setGoals((v) => v.filter((_, i) => i !== idx));
                      }}
                      className="text-rose-600 hover:text-rose-700 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

            {/* Level Breakdown Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-xs text-left">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="p-3">Factor Name</th>
                    {designType === "ccd_circumscribed" || designType === "ccd_inscribed" ? (
                      <>
                        <th className="p-3 text-cyan-800">-α ({(-customAlpha).toFixed(2)})</th>
                        <th className="p-3">-1 (Low)</th>
                        <th className="p-3">0 (Center)</th>
                        <th className="p-3">+1 (High)</th>
                        <th className="p-3 text-cyan-800">+α (+{customAlpha.toFixed(2)})</th>
                      </>
                    ) : (
                      <>
                        <th className="p-3">-1 (Low Level)</th>
                        <th className="p-3">0 (Center Level)</th>
                        <th className="p-3">+1 (High Level)</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                  {family === "mixture"
                    ? components.map((c) => (
                        <tr key={c.name} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold font-sans text-navy-950">{c.name}</td>
                          <td className="p-3">{(c.min * 100).toFixed(0)}%</td>
                          <td className="p-3 font-bold text-cyan-800">{(((c.min + c.max) / 2) * 100).toFixed(0)}%</td>
                          <td className="p-3">{(c.max * 100).toFixed(0)}%</td>
                        </tr>
                      ))
                    : factors.map((f) => {
                        const mid = (f.low + f.high) / 2;
                        const halfRange = (f.high - f.low) / 2;
                        const lowAlpha = mid - customAlpha * halfRange;
                        const highAlpha = mid + customAlpha * halfRange;

                        return (
                          <tr key={f.name} className="hover:bg-slate-50/50">
                            <td className="p-3 font-semibold font-sans text-navy-950">{f.name}</td>
                            {designType === "ccd_circumscribed" || designType === "ccd_inscribed" ? (
                              <>
                                <td className="p-3 text-cyan-800 font-bold">{lowAlpha.toFixed(2)} {f.unit}</td>
                                <td className="p-3">{f.low} {f.unit}</td>
                                <td className="p-3 font-bold text-slate-900">{mid.toFixed(2)} {f.unit}</td>
                                <td className="p-3">{f.high} {f.unit}</td>
                                <td className="p-3 text-cyan-800 font-bold">{highAlpha.toFixed(2)} {f.unit}</td>
                              </>
                            ) : (
                              <>
                                <td className="p-3">{f.low} {f.unit}</td>
                                <td className="p-3 font-bold text-slate-900">{mid.toFixed(2)} {f.unit}</td>
                                <td className="p-3">{f.high} {f.unit}</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            {/* Section 4: Response Goals Definition */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-navy-950">4. Response Variables & Optimization Goals</h2>
                <p className="mt-0.5 text-xs text-slate-500">Define critical quality attributes (CQAs) and optimization targets.</p>
              </div>

              {/* R&D Response Presets */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setResponseNames(["Dissolution at 30m (%)", "Tablet Hardness (kp)"]);
                    setGoals([
                      { response_name: "Dissolution at 30m (%)", direction: "maximize", target: 85, low: 70, high: 100, weight: 1.0 },
                      { response_name: "Tablet Hardness (kp)", direction: "maximize", target: 8.0, low: 4.0, high: 12.0, weight: 0.8 },
                    ]);
                  }}
                  className="rounded-lg bg-white border border-cyan-300 px-3 py-1.5 text-cyan-900 font-semibold hover:bg-cyan-50 shadow-sm"
                >
                  💊 Formulation Preset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = ["Resolution Rs", "Retention Time (min)", "Theoretical Plates (N)", "Tailing Factor (T)"];
                    setResponseNames(p);
                    setGoals([
                      { response_name: "Resolution Rs", direction: "maximize", target: 2.0, low: 1.5, high: 3.5, weight: 1.0 },
                      { response_name: "Retention Time (min)", direction: "target", target: 8.0, low: 4.0, high: 12.0, weight: 0.7 },
                      { response_name: "Theoretical Plates (N)", direction: "maximize", target: 5000, low: 3000, high: 10000, weight: 0.8 },
                      { response_name: "Tailing Factor (T)", direction: "minimize", target: 1.0, low: 0.8, high: 1.5, weight: 0.9 },
                    ]);
                  }}
                  className="rounded-lg bg-white border border-purple-300 px-3 py-1.5 text-purple-900 font-semibold hover:bg-purple-50 shadow-sm"
                >
                  🔬 Analytical Method Preset
                </button>
              </div>
            </div>

            {/* Response Goals Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left font-semibold text-slate-500 uppercase">
                    <th className="p-3">Response Variable</th>
                    <th className="p-3">Goal Direction</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">Low Limit</th>
                    <th className="p-3">High Limit</th>
                    <th className="p-3">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {goals.map((g, idx) => (
                    <tr key={g.response_name} className="border-b border-slate-100">
                      <td className="p-3 font-bold text-navy-950">{g.response_name}</td>
                      <td className="p-3 pr-2">
                        <select
                          value={g.direction}
                          onChange={(e) =>
                            setGoals((v) =>
                              v.map((item, i) => (i === idx ? { ...item, direction: e.target.value as DesirabilityGoal["direction"] } : item))
                            )
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-800"
                        >
                          <option value="maximize">Maximize</option>
                          <option value="minimize">Minimize</option>
                          <option value="target">Target Value</option>
                        </select>
                      </td>
                      <td className="p-3 pr-2">
                        <input
                          type="number"
                          value={g.target ?? ""}
                          onChange={(e) => setGoals((v) => v.map((item, i) => (i === idx ? { ...item, target: Number(e.target.value) } : item)))}
                          className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1"
                        />
                      </td>
                      <td className="p-3 pr-2">
                        <input
                          type="number"
                          value={g.low ?? ""}
                          onChange={(e) => setGoals((v) => v.map((item, i) => (i === idx ? { ...item, low: Number(e.target.value) } : item)))}
                          className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1"
                        />
                      </td>
                      <td className="p-3 pr-2">
                        <input
                          type="number"
                          value={g.high ?? ""}
                          onChange={(e) => setGoals((v) => v.map((item, i) => (i === idx ? { ...item, high: Number(e.target.value) } : item)))}
                          className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1"
                        />
                      </td>
                      <td className="p-3 pr-2">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="5.0"
                          value={g.weight}
                          onChange={(e) => setGoals((v) => v.map((item, i) => (i === idx ? { ...item, weight: Number(e.target.value) } : item)))}
                          className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>

            {/* Primary Action Button to Generate Matrix and Go to Tab 2 */}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  handleGenerateDesign();
                  const currentK = family === "mixture" ? components.length : factors.length;
                  const guidance = FACTOR_GUIDANCE[designType];
                  if (guidance && (currentK < guidance.minFactors || currentK > guidance.maxFactors)) {
                    setError(`Cannot generate matrix: ${guidance.title} requires ${guidance.recommendedFactors}.`);
                    return;
                  }
                  setActiveTab(2);
                }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-6 py-3.5 text-xs font-bold text-white shadow-lg transition cursor-pointer"
              >
                <span>🚀 Save Setup & Generate Run Matrix (Tab 2) ➔</span>
              </button>
            </div>
          </section>
        )}
        </div>
      )}

      {/* TAB 2: MAIN RUN MATRIX & DATA ENTRY */}
      {activeTab === 2 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-navy-950">Experimental Trial Run Matrix ({runs.length} Runs Generated)</h2>
              <p className="text-xs text-slate-500">Enter measured experimental response data or click below to populate synthetic demonstration data.</p>
            </div>
            <div className="flex items-center gap-2">
              <ExportButton
                title="Experimental Trial Run Matrix"
                fileName="DOE_Trial_Run_Matrix"
                tableData={{
                  headers: [
                    "Run #",
                    "Type",
                    ...(family === "mixture" ? components : factors).map((f) => f.name),
                    ...responseNames,
                  ],
                  rows: runs.map((r) => [
                    `Run ${r.run_id}`,
                    r.point_type ?? "Trial",
                    ...(family === "mixture" ? components : factors).map((f) => r.actual[f.name] ?? ""),
                    ...responseNames.map((resp) => responseValues[r.run_id]?.[resp] ?? ""),
                  ]),
                }}
              />
              <button
                type="button"
                onClick={handleFillSampleData}
                className="flex items-center gap-1 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-900 hover:bg-cyan-100 transition shadow-sm"
              >
                <Sparkles size={14} /> Auto-Fill Demo Response Data
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3">Run #</th>
                  <th className="p-3">Type</th>
                  {(family === "mixture" ? components : factors).map((f) => (
                    <th key={f.name} className="p-3 font-bold text-slate-900">
                      {f.name}
                    </th>
                  ))}
                  {responseNames.map((resp) => (
                    <th key={resp} className="p-3 font-bold text-cyan-800">
                      {resp}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.run_id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-slate-600">Run {r.run_id}</td>
                    <td className="p-3">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${r.point_type === "Center" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
                        {r.point_type ?? "Trial"}
                      </span>
                    </td>
                    {(family === "mixture" ? components : factors).map((f) => (
                      <td key={f.name} className="p-3 font-mono">
                        {r.actual[f.name]}
                      </td>
                    ))}
                    {responseNames.map((resp) => (
                      <td key={resp} className="p-2">
                        <input
                          type="number"
                          step="any"
                          value={responseValues[r.run_id]?.[resp] ?? ""}
                          onChange={(e) =>
                            setResponseValues((v) => ({
                              ...v,
                              [r.run_id]: {
                                ...(v[r.run_id] ?? {}),
                                [resp]: e.target.value === "" ? "" : Number(e.target.value),
                              },
                            }))
                          }
                          placeholder="Measure..."
                          className="w-32 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono font-bold text-cyan-900 focus:border-cyan-600 focus:outline-none"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Bar: Go back to Tab 1 or Perform Analysis & Go to Tab 3 */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab(1)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            >
              ← Back to Tab 1 (Input Setup)
            </button>
            <button
              type="button"
              onClick={() => {
                handleRunAnalysis();
                setActiveTab(3);
              }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-800 hover:to-blue-800 px-6 py-3.5 text-xs font-bold text-white shadow-lg transition cursor-pointer"
            >
              <span>🧮 Perform Statistical Analysis & Open Region Graphs (Tab 3) ➔</span>
            </button>
          </div>
        </section>
      )}

      {/* TAB 3: STATISTICAL ANALYSIS & REGION GRAPHS */}
      {activeTab === 3 && (
        <div className="space-y-6">
          {/* Statistical Regression & ANOVA Diagnostics */}
          {Object.keys(regressionResults).length > 0 ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-navy-950">Statistical Regression & ANOVA Diagnostics</h2>
                    <ExportButton
                      title="Complete DoE Executive Statistical Report"
                      fileName="Complete_DOE_Executive_Report"
                      getHtmlContent={() => {
                        let html = `<h2>DoE Executive Statistical Report</h2>`;
                        html += `<p><strong>Family:</strong> ${family.toUpperCase()} | <strong>Model:</strong> ${designType} | <strong>Order:</strong> ${modelOrder}</p>`;
                        Object.entries(regressionResults).forEach(([rName, reg]) => {
                          html += `<h3>Response: ${rName} (R² = ${reg.fit_stats.r_squared}, Adj R² = ${reg.fit_stats.adj_r_squared})</h3>`;
                          html += `<h4>Analysis of Variance (ANOVA)</h4><table><thead><tr><th>Source</th><th>SS</th><th>df</th><th>MS</th><th>F-Value</th><th>p-Value</th></tr></thead><tbody>`;
                          reg.anova.forEach((row) => {
                            html += `<tr><td>${row.source}</td><td>${row.ss}</td><td>${row.df}</td><td>${row.ms ?? "—"}</td><td>${row.f_value ?? "—"}</td><td>${row.p_value ?? "—"}</td></tr>`;
                          });
                          html += `</tbody></table>`;
                          html += `<h4>Model Coefficients & VIF</h4><table><thead><tr><th>Term</th><th>Estimate</th><th>Std Error</th><th>t-Value</th><th>p-Value</th><th>VIF</th></tr></thead><tbody>`;
                          reg.coefficients.forEach((c) => {
                            html += `<tr><td>${c.term}</td><td>${c.estimate}</td><td>${c.std_error}</td><td>${c.t_value}</td><td>${c.p_value}</td><td>${c.vif}</td></tr>`;
                          });
                          html += `</tbody></table>`;
                        });
                        return html;
                      }}
                    />
                  </div>
                  <Field label="Polynomial Model Order">
                    <select value={modelOrder} onChange={(e) => setModelOrder(e.target.value as ModelOrder)} className={fieldClass}>
                      <option value="linear">Linear</option>
                      <option value="2fi">Two-Factor Interaction (2FI)</option>
                      <option value="quadratic" disabled={!isQuadraticLegal}>
                        Quadratic (Full RSM) {!isQuadraticLegal ? "(Requires 3+ Levels)" : ""}
                      </option>
                    </select>
                  </Field>
                </div>

                {Object.entries(regressionResults).map(([respName, reg]) => (
                  <div key={respName} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-2">
                      <h4 className="font-bold text-navy-950 text-sm">Response: {respName}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                        <span className="rounded bg-white px-2 py-1 border border-slate-200 shadow-xs">R² = <strong>{reg.fit_stats.r_squared}</strong></span>
                        <span className="rounded bg-white px-2 py-1 border border-slate-200 shadow-xs">Adj R² = <strong>{reg.fit_stats.adj_r_squared}</strong></span>
                        <span className="rounded bg-white px-2 py-1 border border-slate-200 shadow-xs">Pred R² = <strong>{reg.fit_stats.pred_r_squared}</strong></span>
                        <span className={`rounded px-2 py-1 border shadow-xs font-bold ${reg.fit_stats.adequate_precision >= 4.0 ? "bg-emerald-50 text-emerald-900 border-emerald-300" : "bg-amber-50 text-amber-900 border-amber-300"}`}>
                          Adeq Precision = <strong>{reg.fit_stats.adequate_precision}</strong> {reg.fit_stats.adequate_precision >= 4.0 ? "✓" : "⚠️"}
                        </span>
                        <span className="rounded bg-white px-2 py-1 border border-slate-200 shadow-xs text-slate-700">Std Dev = <strong>{reg.fit_stats.std_dev}</strong></span>
                        <span className="rounded bg-white px-2 py-1 border border-slate-200 shadow-xs text-slate-700">C.V. % = <strong>{reg.fit_stats.cv_percent}%</strong></span>
                        <span className="rounded bg-white px-2 py-1 border border-slate-200 shadow-xs text-slate-700">PRESS = <strong>{reg.fit_stats.press}</strong></span>
                      </div>
                    </div>

                    {/* ANOVA Table */}
                    <div>
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-navy-950 text-[11px] uppercase tracking-wide">Analysis of Variance (ANOVA)</h5>
                        <ExportButton
                          title={`ANOVA Table - ${respName}`}
                          fileName={`ANOVA_Table_${respName.replace(/[^a-zA-Z0-9]/g, "_")}`}
                          tableData={{
                            headers: ["Source", "Sum of Squares", "df", "Mean Square", "F-Value", "p-Value"],
                            rows: reg.anova.map((row) => [
                              row.source,
                              row.ss,
                              row.df,
                              row.ms ?? "—",
                              row.f_value ?? "—",
                              row.p_value !== undefined ? (row.p_value < 0.0001 ? "< 0.0001" : row.p_value) : "—",
                            ]),
                          }}
                        />
                      </div>
                      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="min-w-full text-left text-xs">
                          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase">
                            <tr>
                              <th className="p-2.5">Source</th>
                              <th className="p-2.5">Sum of Squares</th>
                              <th className="p-2.5">df</th>
                              <th className="p-2.5">Mean Square</th>
                              <th className="p-2.5">F-Value</th>
                              <th className="p-2.5">p-Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reg.anova.map((row) => (
                              <tr key={row.source} className="border-b border-slate-100">
                                <td className="p-2.5 font-semibold text-navy-950">{row.source}</td>
                                <td className="p-2.5 font-mono">{row.ss}</td>
                                <td className="p-2.5 font-mono">{row.df}</td>
                                <td className="p-2.5 font-mono">{row.ms ?? "—"}</td>
                                <td className="p-2.5 font-mono">{row.f_value ?? "—"}</td>
                                <td className="p-2.5 font-mono font-bold text-cyan-700">{row.p_value !== undefined ? (row.p_value < 0.0001 ? "< 0.0001" : row.p_value) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Model Coefficients */}
                    <div>
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-navy-950 text-[11px] uppercase tracking-wide">Model Coefficients & VIF</h5>
                        <ExportButton
                          title={`Model Coefficients - ${respName}`}
                          fileName={`Coefficients_${respName.replace(/[^a-zA-Z0-9]/g, "_")}`}
                          tableData={{
                            headers: ["Term", "Estimate (b)", "Std Error", "t-Value", "p-Value", "VIF"],
                            rows: reg.coefficients.map((c) => [
                              c.term,
                              c.estimate,
                              c.std_error,
                              c.t_value,
                              c.p_value < 0.0001 ? "< 0.0001" : c.p_value,
                              c.vif,
                            ]),
                          }}
                        />
                      </div>
                      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="min-w-full text-left text-xs">
                          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase">
                            <tr>
                              <th className="p-2.5">Term</th>
                              <th className="p-2.5">Estimate (b)</th>
                              <th className="p-2.5">Std Error</th>
                              <th className="p-2.5">t-Value</th>
                              <th className="p-2.5">p-Value</th>
                              <th className="p-2.5">VIF</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reg.coefficients.map((c) => (
                              <tr key={c.term} className="border-b border-slate-100">
                                <td className="p-2.5 font-semibold text-navy-950">{c.term}</td>
                                <td className="p-2.5 font-mono">{c.estimate}</td>
                                <td className="p-2.5 font-mono">{c.std_error}</td>
                                <td className="p-2.5 font-mono">{c.t_value}</td>
                                <td className="p-2.5 font-mono font-bold text-cyan-700">{c.p_value < 0.0001 ? "< 0.0001" : c.p_value}</td>
                                <td className="p-2.5 font-mono">{c.vif}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* QbD Region Graphs Section (Knowledge Space, MODR, Control Space) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-lg font-bold text-navy-950 flex items-center gap-2">
                    <Sparkles className="text-cyan-700" size={18} />
                    <span>QbD Multi-Region Surface Graphs & Design Space</span>
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">Visualizing Knowledge Space, Method Operable Design Region (MODR), and Control Space (PAR).</p>
                </div>

                {/* 3 Region Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Knowledge Space */}
                  <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-sky-200">
                      <span className="font-bold text-sky-950">1. Knowledge Space</span>
                      <span className="rounded bg-sky-200 px-2 py-0.5 text-[10px] font-bold text-sky-900">Exploration Region</span>
                    </div>
                    <p className="text-[11px] text-slate-600">Total factor range searched during trial generation:</p>
                    <ul className="space-y-1 font-mono text-[11px]">
                      {(family === "mixture" ? components : factors).map((f) => (
                        <li key={f.name} className="flex justify-between border-b border-sky-100 py-1">
                          <span>{f.name}:</span>
                          <span className="font-bold text-sky-900">{"low" in f ? `${f.low} to ${f.high} ${f.unit || ""}` : `${(f.min * 100).toFixed(0)}% to ${(f.max * 100).toFixed(0)}%`}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Design Space / MODR */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                      <span className="font-bold text-emerald-950">2. Design Space (MODR)</span>
                      <span className="rounded bg-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-900">Quality Zone</span>
                    </div>
                    <p className="text-[11px] text-slate-600">Multi-response region meeting quality criteria (D ≥ {(desirabilityThreshold * 100).toFixed(0)}%):</p>
                    <ul className="space-y-1 font-mono text-[11px]">
                      {goals.map((g) => (
                        <li key={g.response_name} className="flex justify-between border-b border-emerald-100 py-1">
                          <span className="truncate max-w-[130px]">{g.response_name}:</span>
                          <span className="font-bold text-emerald-900">{g.direction === "maximize" ? `≥ ${g.target}` : g.direction === "minimize" ? `≤ ${g.target}` : `Target ${g.target}`}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Control Space / PAR */}
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-indigo-200">
                      <span className="font-bold text-indigo-950">3. Control Space (PAR)</span>
                      <span className="rounded bg-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-900">Manufacturing</span>
                    </div>
                    <p className="text-[11px] text-slate-600">Proven Acceptable Ranges for routine manufacturing:</p>
                    <ul className="space-y-1 font-mono text-[11px]">
                      {(family === "mixture" ? components : factors).map((f) => {
                        const mid = "low" in f ? (f.low + f.high) / 2 : (f.min + f.max) / 2;
                        const parLow = "low" in f ? (mid - (f.high - f.low) * 0.15).toFixed(1) : ((mid - (f.max - f.min) * 0.15) * 100).toFixed(1);
                        const parHigh = "low" in f ? (mid + (f.high - f.low) * 0.15).toFixed(1) : ((mid + (f.max - f.min) * 0.15) * 100).toFixed(1);
                        return (
                          <li key={f.name} className="flex justify-between border-b border-indigo-100 py-1">
                            <span>{f.name}:</span>
                            <span className="font-bold text-indigo-900">{parLow} – {parHigh} {"unit" in f ? f.unit : "%"}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                {/* Interactive Contour / Ternary Canvas */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="font-bold text-navy-950 text-sm">
                      {family === "mixture" ? "Interactive Ternary Mixture Surface" : "2D Response Surface & Sweet Spot Control Region"}
                    </h4>
                    <Field label="Desirability Control Region Cutoff (D)">
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={desirabilityThreshold}
                        onChange={(e) => setDesirabilityThreshold(Number(e.target.value))}
                        className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono font-bold text-cyan-900 text-xs"
                      />
                    </Field>
                  </div>

                  {family === "mixture" ? (
                    <TernaryCanvas components={components} runs={runs} regressionResults={regressionResults} />
                  ) : (
                    <ContourCanvas factors={factors} runs={runs} regressionResults={regressionResults} goals={goals} desirabilityThreshold={desirabilityThreshold} />
                  )}
                </div>
              </div>

              {/* Derringer Desirability Optimization Rankings */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <h3 className="text-lg font-bold text-navy-950">Optimized Formulation Conditions (Derringer–Suich Ranking)</h3>
                  <ExportButton
                    title="Optimized Formulation Conditions & Derringer Rankings"
                    fileName="Derringer_Optimization_Rankings"
                    tableData={{
                      headers: [
                        "Rank",
                        "Run #",
                        ...(family === "mixture" ? components : factors).map((f) => f.name),
                        ...goals.map((g) => `d(${g.response_name})`),
                        "Composite Desirability (D)",
                      ],
                      rows: rankedTrials.map((row, idx) => [
                        `#${idx + 1}`,
                        `Run ${row.run_id}`,
                        ...(family === "mixture" ? components : factors).map((f) => row.actual[f.name] ?? ""),
                        ...goals.map((g) => row.individual_d[g.response_name] ?? "—"),
                        `${(row.desirability_score * 100).toFixed(1)}% (${row.desirability_score.toFixed(3)})`,
                      ]),
                    }}
                  />
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase">
                      <tr>
                        <th className="p-3">Rank</th>
                        <th className="p-3">Run #</th>
                        {(family === "mixture" ? components : factors).map((f) => (
                          <th key={f.name} className="p-3">{f.name}</th>
                        ))}
                        {goals.map((g) => (
                          <th key={g.response_name} className="p-3">d({g.response_name})</th>
                        ))}
                        <th className="p-3 text-emerald-700">Composite Desirability (D)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedTrials.map((row, idx) => (
                        <tr key={row.run_id} className={`border-b border-slate-100 ${idx === 0 ? "bg-emerald-50/80 font-bold" : ""}`}>
                          <td className="p-3 font-mono text-slate-500">#{idx + 1}</td>
                          <td className="p-3 font-mono">Run {row.run_id}</td>
                          {(family === "mixture" ? components : factors).map((f) => (
                            <td key={f.name} className="p-3 font-mono">{row.actual[f.name]}</td>
                          ))}
                          {goals.map((g) => (
                            <td key={g.response_name} className="p-3 font-mono text-slate-700">{row.individual_d[g.response_name] ?? "—"}</td>
                          ))}
                          <td className="p-3 font-mono text-emerald-700 font-bold">
                            {(row.desirability_score * 100).toFixed(1)}% ({row.desirability_score.toFixed(3)})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-center text-xs text-amber-900 space-y-2">
              <span className="text-2xl">⚠️</span>
              <p className="font-bold text-sm">No Statistical Analysis Run Yet</p>
              <p>Please enter response data in Tab 2 and click <strong>"Perform Statistical Analysis"</strong> to view regression statistics and region graphs.</p>
              <button
                type="button"
                onClick={() => setActiveTab(2)}
                className="mt-3 inline-flex items-center gap-1 rounded-xl bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 transition"
              >
                Go to Tab 2 (Run Matrix)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

const fieldClass = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600 shadow-sm";

function LearnDoeModal({
  isOpen,
  onClose,
  activeMaterial,
  setActiveMaterial,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeMaterial: string;
  setActiveMaterial: (id: string) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-700/60 p-2 text-cyan-300">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold">Learn DoE Educational Knowledge Hub</h2>
              <p className="text-xs text-slate-300">Master experimental design principles, factor rules, and level selection theory.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            ✕ Close Hub
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar Menu */}
          <div className="w-72 border-r border-slate-200 bg-slate-50/80 p-4 space-y-3 shrink-0 overflow-y-auto">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">Learning Materials</h3>

            <button
              type="button"
              onClick={() => setActiveMaterial("model_factor_matrix")}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-xs font-bold transition ${
                activeMaterial === "model_factor_matrix"
                  ? "bg-cyan-700 text-white shadow-md"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Sparkles size={16} className={activeMaterial === "model_factor_matrix" ? "text-cyan-200 shrink-0" : "text-cyan-700 shrink-0"} />
              <span className="leading-snug">DOE Model vs. Factor & Level Requirements</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMaterial("statistical_acceptance")}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-xs font-bold transition ${
                activeMaterial === "statistical_acceptance"
                  ? "bg-cyan-700 text-white shadow-md"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <BookOpen size={16} className={activeMaterial === "statistical_acceptance" ? "text-cyan-200 shrink-0" : "text-cyan-700 shrink-0"} />
              <span className="leading-snug">Statistical Model Acceptance Theories & Rules</span>
            </button>

            <div className="pt-4 border-t border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">Additional Materials</span>
              <button
                type="button"
                disabled
                className="mt-2 flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-100/60 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-400 cursor-not-allowed"
              >
                <span>+ Add Future Material</span>
                <span className="text-[10px] font-mono bg-slate-200 px-1.5 py-0.5 rounded text-slate-500">Coming Soon</span>
              </button>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
            {activeMaterial === "model_factor_matrix" && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-extrabold text-navy-950">DOE Model vs. Factor & Level Requirements Reference Manual</h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Comprehensive statistical reference manual outlining factor count boundaries ($k$), required level configurations, mathematical run formulas ($N$), and practical R&D use cases across all 3 design families.
                  </p>
                </div>

                {/* Table 1: Factorial & Screening Designs */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h4 className="font-bold text-navy-950 text-xs uppercase tracking-wide flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-800">1</span>
                    Factorial & Screening Designs (Early-Stage R&D)
                  </h4>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 font-bold text-slate-600 uppercase">
                          <th className="py-2 pr-3">Model Name</th>
                          <th className="py-2 pr-3">Min Factors (k)</th>
                          <th className="py-2 pr-3">Max Factors (k)</th>
                          <th className="py-2 pr-3">Levels Required</th>
                          <th className="py-2 pr-3">Run Count Formula (N)</th>
                          <th className="py-2">Best R&D Use Case</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 font-mono text-slate-800">
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">Full Factorial (2^k)</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">2</td>
                          <td className="py-2.5 pr-3">5</td>
                          <td className="py-2.5 pr-3">2 Levels (-1, +1)</td>
                          <td className="py-2.5 pr-3 text-cyan-800">N = 2^k + N_C</td>
                          <td className="py-2.5 font-sans text-slate-700">Small screening (2 to 4 factors) with all main & high-order interaction effects.</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">Fractional Factorial (2^(k-p))</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">3</td>
                          <td className="py-2.5 pr-3">7</td>
                          <td className="py-2.5 pr-3">2 Levels (-1, +1)</td>
                          <td className="py-2.5 pr-3 text-cyan-800">N = 2^(k-p) + N_C</td>
                          <td className="py-2.5 font-sans text-slate-700">Screening many factors in half/quarter runs via Resolution III/IV/V aliasing.</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">Plackett–Burman</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">4</td>
                          <td className="py-2.5 pr-3">15+</td>
                          <td className="py-2.5 pr-3">2 Levels (-1, +1)</td>
                          <td className="py-2.5 pr-3 text-cyan-800">N = Multiple of 4 (12, 16, 20)</td>
                          <td className="py-2.5 font-sans text-slate-700">Fast screening: Identifies top 3-4 critical process parameters (CPPs) out of 10+ factors.</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">Taguchi Array</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">3</td>
                          <td className="py-2.5 pr-3">7</td>
                          <td className="py-2.5 pr-3">2 or 3 Levels</td>
                          <td className="py-2.5 pr-3 text-cyan-800">N = L8, L9, L12, L16 Array</td>
                          <td className="py-2.5 font-sans text-slate-700">Robust parameter design and noise factor minimization.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table 2: Response Surface Methodology (RSM) Optimization */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h4 className="font-bold text-navy-950 text-xs uppercase tracking-wide flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-800">2</span>
                    Response Surface Methodology / RSM (Optimization Stage)
                  </h4>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 font-bold text-slate-600 uppercase">
                          <th className="py-2 pr-3">Model Name</th>
                          <th className="py-2 pr-3">Min Factors (k)</th>
                          <th className="py-2 pr-3">Max Factors (k)</th>
                          <th className="py-2 pr-3">Levels Required</th>
                          <th className="py-2 pr-3">Run Count Formula (N)</th>
                          <th className="py-2">Best R&D Use Case</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 font-mono text-slate-800">
                        <tr className="bg-sky-50/60">
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">CCD Circumscribed (Rotatable α)</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">2</td>
                          <td className="py-2.5 pr-3">6</td>
                          <td className="py-2.5 pr-3">5 Levels (-α, -1, 0, +1, +α)</td>
                          <td className="py-2.5 pr-3 text-cyan-800">N = 2^k + 2k + N_C (α=(2^k)^0.25)</td>
                          <td className="py-2.5 font-sans text-slate-700">🏆 <strong>#1 Industry Standard</strong> for quadratic surface optimization. Equal prediction precision in all directions.</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">CCD Face-Centered (CCF)</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">2</td>
                          <td className="py-2.5 pr-3">6</td>
                          <td className="py-2.5 pr-3">3 Levels (-1, 0, +1)</td>
                          <td className="py-2.5 pr-3 text-cyan-800">N = 2^k + 2k + N_C (α=1.0)</td>
                          <td className="py-2.5 font-sans text-slate-700">Used when factor settings <strong>cannot physically exceed</strong> Low/High bounds.</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">CCD Inscribed (CCI)</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">2</td>
                          <td className="py-2.5 pr-3">6</td>
                          <td className="py-2.5 pr-3">5 Levels (Inward scaled)</td>
                          <td className="py-2.5 pr-3 text-cyan-800">N = 2^k + 2k + N_C</td>
                          <td className="py-2.5 font-sans text-slate-700">Used when factor limits are absolute hard boundaries.</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">Box–Behnken Design (BBD)</td>
                          <td className="py-2.5 pr-3 font-bold text-rose-700">3 (No 2-factor!)</td>
                          <td className="py-2.5 pr-3">5</td>
                          <td className="py-2.5 pr-3">3 Levels (-1, 0, +1)</td>
                          <td className="py-2.5 pr-3 text-cyan-800">N = 2k(k-1) + N_C</td>
                          <td className="py-2.5 font-sans text-slate-700"><strong>Avoids Extreme Corners</strong>: Used when high temperature + high pressure combined causes degradation.</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">Three-Level Full Factorial (3^k)</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">2</td>
                          <td className="py-2.5 pr-3">3</td>
                          <td className="py-2.5 pr-3">3 Levels (-1, 0, +1)</td>
                          <td className="py-2.5 pr-3 text-cyan-800">N = 3^k + N_C</td>
                          <td className="py-2.5 font-sans text-slate-700">Simple 2 or 3 factor optimization (3^2 = 9 or 3^3 = 27 runs).</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table 3: Mixture & Formulation Designs */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h4 className="font-bold text-navy-950 text-xs uppercase tracking-wide flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-800">3</span>
                    Mixture & Formulation Designs (Drug Product & Chemical Formulations)
                  </h4>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 font-bold text-slate-600 uppercase">
                          <th className="py-2 pr-3">Model Name</th>
                          <th className="py-2 pr-3">Min Components (k)</th>
                          <th className="py-2 pr-3">Max Components</th>
                          <th className="py-2 pr-3">Levels / Grid Required</th>
                          <th className="py-2 pr-3">Constraint Rule</th>
                          <th className="py-2">Best R&D Use Case</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 font-mono text-slate-800">
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">Simplex Centroid</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">3</td>
                          <td className="py-2.5 pr-3">6</td>
                          <td className="py-2.5 pr-3">Grid (0, 0.5, 1.0)</td>
                          <td className="py-2.5 pr-3 text-cyan-800 font-bold font-mono">Σ Component = 100%</td>
                          <td className="py-2.5 font-sans text-slate-700"><strong>Formulation Optimization</strong>: API, Polymer, Excipient ratios in tablets, creams, solutions.</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">Simplex Lattice {"{q, m}"}</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">3</td>
                          <td className="py-2.5 pr-3">6</td>
                          <td className="py-2.5 pr-3">Grid (m-degree)</td>
                          <td className="py-2.5 pr-3 text-cyan-800 font-bold font-mono">Σ Component = 100%</td>
                          <td className="py-2.5 font-sans text-slate-700">Systematic triangular/tetrahedral grid for complex multi-ingredient blends.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeMaterial === "statistical_acceptance" && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-extrabold text-navy-950">Statistical Model Acceptance Theories & Quality Decision Rules (QbD Standard)</h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Comprehensive academic and professional reference manual detailing the 8 core statistical criteria required to validate, accept, and deploy DoE statistical models for regulatory submission and process optimization.
                  </p>
                </div>

                {/* Acceptance Summary Table */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h4 className="font-bold text-navy-950 text-xs uppercase tracking-wide border-b border-slate-200 pb-2">
                    DoE Model Statistical Acceptance Decision Matrix
                  </h4>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 font-bold text-slate-600 uppercase">
                          <th className="py-2 pr-3">Diagnostic Metric</th>
                          <th className="py-2 pr-3">Underlying Theory</th>
                          <th className="py-2 pr-3">Acceptance Threshold</th>
                          <th className="py-2">R&D Quality Decision Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 font-mono text-slate-800">
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">1. Model F-Value</td>
                          <td className="py-2.5 pr-3 font-sans text-slate-600">ANOVA F-Test Ratio (MS_Model / MS_Residual)</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">Large F-Value (F &gt; 10.0)</td>
                          <td className="py-2.5 font-sans text-slate-700">Proves model factor variance is significantly larger than random experimental noise variance.</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">2. Model p-Value</td>
                          <td className="py-2.5 pr-3 font-sans text-slate-600">Probability of Null Hypothesis H₀ (Odds of Random Luck)</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">p ≤ 0.05 (95% CI)</td>
                          <td className="py-2.5 font-sans text-slate-700">Confirms factor effects are statistically real (&lt; 5% chance of being luck). If p &gt; 0.05, reduce non-significant terms.</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">3. Lack of Fit p-Value</td>
                          <td className="py-2.5 pr-3 font-sans text-slate-600">Pure Error vs. Systematic Deviation (MS_LOF / MS_PureError)</td>
                          <td className="py-2.5 pr-3 font-bold text-emerald-800">p &gt; 0.05 (Not Significant)</td>
                          <td className="py-2.5 font-sans text-slate-700">Confirms model shape is correct. If p ≤ 0.05, switch to higher-order model (Quadratic RSM).</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">4. Coefficient of Determination (R²)</td>
                          <td className="py-2.5 pr-3 font-sans text-slate-600">Total Response Variance Explained (SS_Model / SS_Total)</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">R² ≥ 0.80 (80%+)</td>
                          <td className="py-2.5 font-sans text-slate-700">Explains at least 80% of data variation. If low, check for unmeasured lurking variables.</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">5. Adj R² vs. Pred R² Difference</td>
                          <td className="py-2.5 pr-3 font-sans text-slate-600">Overfitting & PRESS Prediction Residual Error</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">|Adj R² - Pred R²| &lt; 0.20</td>
                          <td className="py-2.5 font-sans text-slate-700">Prevents model overfitting. Ensures reliable predictions on new future batches.</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">6. Adequate Precision</td>
                          <td className="py-2.5 pr-3 font-sans text-slate-600">Signal-to-Noise Ratio (Predicted Range / Average Error)</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">Adeq Precision &gt; 4.0</td>
                          <td className="py-2.5 font-sans text-slate-700">Ratio &gt; 4 proves model signal is much stronger than measurement noise.</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">7. Variance Inflation Factor (VIF)</td>
                          <td className="py-2.5 pr-3 font-sans text-slate-600">Factor Multicollinearity & Term Orthogonality</td>
                          <td className="py-2.5 pr-3 font-bold text-cyan-800">VIF &lt; 5.0 (Ideal = 1.0)</td>
                          <td className="py-2.5 font-sans text-slate-700">VIF &gt; 10 indicates severe term correlation; re-center factors or drop duplicate terms.</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-bold font-sans text-navy-950">8. Derringer Desirability (D)</td>
                          <td className="py-2.5 pr-3 font-sans text-slate-600">Geometric Mean of Individual Desirabilities (d_i)</td>
                          <td className="py-2.5 pr-3 font-bold text-emerald-800">D ≥ 0.70 (MODR Sweet Spot)</td>
                          <td className="py-2.5 font-sans text-slate-700">Defines the Method Operable Design Region (MODR) where all CQA targets are satisfied.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mathematical Theory & Deep Dives */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4 space-y-2 bg-slate-50/50">
                    <h5 className="font-bold text-navy-950 text-xs uppercase tracking-wide">1. Model F-Value (Signal-to-Noise Variance Ratio)</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      F = MS_Model / MS_Residual. Measures how many times larger the variance explained by the model is compared to random experimental residual noise. A larger F-value indicates a stronger physical effect.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 space-y-2 bg-slate-50/50">
                    <h5 className="font-bold text-navy-950 text-xs uppercase tracking-wide">2. Model p-Value (Null Hypothesis Significance)</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Calculated directly from the F-distribution curve. Evaluates H₀: all factor coefficients equal zero. A p-value ≤ 0.05 proves there is less than a 5% probability that the observed effect was caused by random chance.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 space-y-2 bg-slate-50/50">
                    <h5 className="font-bold text-navy-950 text-xs uppercase tracking-wide">3. Lack of Fit & Model Curvature</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Requires replicated center points. It divides residual error into Pure Experimental Error and Lack of Fit. A non-significant Lack of Fit (p &gt; 0.05) proves the selected polynomial order adequately fits the surface without systematic departure.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 space-y-2 bg-slate-50/50">
                    <h5 className="font-bold text-navy-950 text-xs uppercase tracking-wide">4. Overfitting & PRESS Prediction</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Predicted R² uses Prediction Error Sum of Squares (PRESS) calculated by systematically omitting each data point. Keeping |Adj R² - Pred R²| &lt; 0.20 guarantees the model hasn't overfitted random noise.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
