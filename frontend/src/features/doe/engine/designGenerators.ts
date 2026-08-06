/**
 * Pure TypeScript DoE Design Generators Module
 * Generates run matrices for Factorial, RSM, and Mixture design families with coded/actual unit mappings.
 */

export type FactorSpec = {
  name: string;
  low: number;
  high: number;
  lowLabel?: string;
  highLabel?: string;
  unit?: string;
  type?: "continuous" | "categorical";
};

export type ComponentSpec = {
  name: string;
  min: number; // default 0
  max: number; // default 1
};

export type DesignFamily = "factorial" | "rsm" | "mixture";

export type DesignType =
  | "full_factorial"
  | "fractional_factorial"
  | "plackett_burman"
  | "taguchi"
  | "ccd_circumscribed"
  | "ccd_inscribed"
  | "ccd_face_centered"
  | "box_behnken"
  | "three_level_factorial"
  | "simplex_lattice"
  | "simplex_centroid";

export type GeneratedRun = {
  run_id: number;
  point_type: "Factorial" | "Fractional" | "Axial" | "Center" | "Vertex" | "Centroid" | "Edge";
  coded: Record<string, number>;
  actual: Record<string, number>;
};

export type FractionalGeneratorInfo = {
  code: string;
  design: string;
  resolution: string;
  generators: string[];
  aliases: string[];
};

/**
 * Standard Fractional Factorial Generators for k=3..7
 */
export const FRACTIONAL_CATALOG: Record<string, FractionalGeneratorInfo> = {
  "2_3_minus_1": {
    code: "2^(3-1)",
    design: "2^(3-1) (Half Fraction, 4 runs)",
    resolution: "Res III",
    generators: ["C = AB"],
    aliases: ["Main effect A = BC", "Main effect B = AC", "Main effect C = AB"],
  },
  "2_4_minus_1": {
    code: "2^(4-1)",
    design: "2^(4-1) (Half Fraction, 8 runs)",
    resolution: "Res IV",
    generators: ["D = ABC"],
    aliases: ["Main effects aliased with 3-factor interactions", "AB = CD, AC = BD, AD = BC"],
  },
  "2_5_minus_1": {
    code: "2^(5-1)",
    design: "2^(5-1) (Half Fraction, 16 runs)",
    resolution: "Res V",
    generators: ["E = ABCD"],
    aliases: ["Main effects clear of 2FIs", "2FIs aliased with 3FIs"],
  },
  "2_5_minus_2": {
    code: "2^(5-2)",
    design: "2^(5-2) (Quarter Fraction, 8 runs)",
    resolution: "Res III",
    generators: ["D = AB", "E = AC"],
    aliases: ["A = BD = CE", "B = AD", "C = AE"],
  },
};

export function generateRunMatrix(
  family: DesignFamily,
  type: DesignType,
  factors: FactorSpec[],
  components: ComponentSpec[],
  options: { centerPoints?: number; alphaType?: "circumscribed" | "inscribed" | "face_centered"; latticeDegree?: number; customAlpha?: number } = {}
): { runs: GeneratedRun[]; info?: FractionalGeneratorInfo } {
  const centerPoints = options.centerPoints ?? 3;

  if (family === "mixture") {
    return { runs: generateMixtureDesign(type, components, options.latticeDegree ?? 2) };
  }

  const k = factors.length;
  if (k < 2) {
    throw new Error("Design generation requires at least 2 factors.");
  }

  let runs: GeneratedRun[] = [];
  let info: FractionalGeneratorInfo | undefined;

  switch (type) {
    case "full_factorial":
      runs = generateFullFactorial(factors, centerPoints);
      break;
    case "fractional_factorial":
      const frac = generateFractionalFactorial(factors, centerPoints);
      runs = frac.runs;
      info = frac.info;
      break;
    case "ccd_circumscribed":
    case "ccd_inscribed":
    case "ccd_face_centered":
      const alphaMode = type.replace("ccd_", "") as "circumscribed" | "inscribed" | "face_centered";
      runs = generateCCD(factors, alphaMode, centerPoints, options.customAlpha);
      break;
    case "box_behnken":
      if (k < 3) throw new Error("Box-Behnken design requires at least 3 factors.");
      runs = generateBoxBehnken(factors, centerPoints);
      break;
    case "three_level_factorial":
      if (k > 3) throw new Error("3-level full factorial is practical for up to 3 factors.");
      runs = generateThreeLevelFactorial(factors);
      break;
    case "plackett_burman":
      runs = generatePlackettBurman(factors);
      break;
    case "taguchi":
      runs = generateTaguchi(factors);
      break;
    default:
      runs = generateFullFactorial(factors, centerPoints);
  }

  return { runs, info };
}

function codedToActual(val: number, low: number, high: number): number {
  const mid = (low + high) / 2.0;
  const halfRange = (high - low) / 2.0;
  return Number((mid + val * halfRange).toFixed(4));
}

function generateFullFactorial(factors: FactorSpec[], centerPoints: number): GeneratedRun[] {
  const k = factors.length;
  const numFactorial = Math.pow(2, k);
  const runs: GeneratedRun[] = [];

  for (let i = 0; i < numFactorial; i++) {
    const coded: Record<string, number> = {};
    const actual: Record<string, number> = {};

    for (let j = 0; j < k; j++) {
      const bit = (i >> (k - 1 - j)) & 1;
      const cVal = bit === 1 ? 1 : -1;
      coded[factors[j].name] = cVal;
      actual[factors[j].name] = codedToActual(cVal, factors[j].low, factors[j].high);
    }

    runs.push({
      run_id: i + 1,
      point_type: "Factorial",
      coded,
      actual,
    });
  }

  // Add Center Points
  for (let c = 0; c < centerPoints; c++) {
    const coded: Record<string, number> = {};
    const actual: Record<string, number> = {};

    for (let j = 0; j < k; j++) {
      coded[factors[j].name] = 0;
      actual[factors[j].name] = codedToActual(0, factors[j].low, factors[j].high);
    }

    runs.push({
      run_id: runs.length + 1,
      point_type: "Center",
      coded,
      actual,
    });
  }

  return runs;
}

function generateFractionalFactorial(factors: FactorSpec[], centerPoints: number): { runs: GeneratedRun[]; info: FractionalGeneratorInfo } {
  const k = factors.length;
  const key = k === 3 ? "2_3_minus_1" : k === 4 ? "2_4_minus_1" : "2_5_minus_1";
  const info = FRACTIONAL_CATALOG[key] ?? FRACTIONAL_CATALOG["2_3_minus_1"];

  const baseK = k - 1; // 2^(k-1) base design
  const numBase = Math.pow(2, baseK);
  const runs: GeneratedRun[] = [];

  for (let i = 0; i < numBase; i++) {
    const coded: Record<string, number> = {};
    const actual: Record<string, number> = {};

    for (let j = 0; j < baseK; j++) {
      const bit = (i >> (baseK - 1 - j)) & 1;
      const cVal = bit === 1 ? 1 : -1;
      coded[factors[j].name] = cVal;
    }

    // Generated last factor = product of previous factors
    let genVal = 1;
    for (let j = 0; j < baseK; j++) {
      genVal *= coded[factors[j].name];
    }
    coded[factors[k - 1].name] = genVal;

    for (let j = 0; j < k; j++) {
      actual[factors[j].name] = codedToActual(coded[factors[j].name], factors[j].low, factors[j].high);
    }

    runs.push({
      run_id: i + 1,
      point_type: "Fractional",
      coded,
      actual,
    });
  }

  for (let c = 0; c < centerPoints; c++) {
    const coded: Record<string, number> = {};
    const actual: Record<string, number> = {};
    for (let j = 0; j < k; j++) {
      coded[factors[j].name] = 0;
      actual[factors[j].name] = codedToActual(0, factors[j].low, factors[j].high);
    }
    runs.push({ run_id: runs.length + 1, point_type: "Center", coded, actual });
  }

  return { runs, info };
}

function generateCCD(
  factors: FactorSpec[],
  alphaMode: "circumscribed" | "inscribed" | "face_centered",
  centerPoints: number,
  customAlpha?: number
): GeneratedRun[] {
  const k = factors.length;
  const numFactorial = Math.pow(2, k);
  const alphaRotatable = Math.pow(2, k / 4.0);
  const alpha = customAlpha !== undefined && customAlpha > 0 ? customAlpha : (alphaMode === "face_centered" ? 1.0 : alphaRotatable);
  const runs: GeneratedRun[] = [];

  // Factorial Points
  for (let i = 0; i < numFactorial; i++) {
    const coded: Record<string, number> = {};
    const actual: Record<string, number> = {};

    for (let j = 0; j < k; j++) {
      const bit = (i >> (k - 1 - j)) & 1;
      let cVal = bit === 1 ? 1.0 : -1.0;
      if (alphaMode === "inscribed") {
        cVal /= alpha; // Scale factorial points inward
      }
      coded[factors[j].name] = Number(cVal.toFixed(4));
      actual[factors[j].name] = codedToActual(cVal, factors[j].low, factors[j].high);
    }

    runs.push({ run_id: runs.length + 1, point_type: "Factorial", coded, actual });
  }

  // Axial Points (2k points)
  for (let j = 0; j < k; j++) {
    for (const sign of [1.0, -1.0]) {
      const coded: Record<string, number> = {};
      const actual: Record<string, number> = {};

      for (let f = 0; f < k; f++) {
        const cVal = f === j ? (alphaMode === "inscribed" ? sign : sign * alpha) : 0.0;
        coded[factors[f].name] = Number(cVal.toFixed(4));
        actual[factors[f].name] = codedToActual(cVal, factors[f].low, factors[f].high);
      }

      runs.push({ run_id: runs.length + 1, point_type: "Axial", coded, actual });
    }
  }

  // Center Points
  for (let c = 0; c < centerPoints; c++) {
    const coded: Record<string, number> = {};
    const actual: Record<string, number> = {};
    for (let j = 0; j < k; j++) {
      coded[factors[j].name] = 0;
      actual[factors[j].name] = codedToActual(0, factors[j].low, factors[j].high);
    }
    runs.push({ run_id: runs.length + 1, point_type: "Center", coded, actual });
  }

  return runs;
}

function generateBoxBehnken(factors: FactorSpec[], centerPoints: number): GeneratedRun[] {
  const k = factors.length;
  const runs: GeneratedRun[] = [];

  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      for (const s1 of [-1.0, 1.0]) {
        for (const s2 of [-1.0, 1.0]) {
          const coded: Record<string, number> = {};
          const actual: Record<string, number> = {};

          for (let f = 0; f < k; f++) {
            const cVal = f === i ? s1 : f === j ? s2 : 0.0;
            coded[factors[f].name] = cVal;
            actual[factors[f].name] = codedToActual(cVal, factors[f].low, factors[f].high);
          }

          runs.push({ run_id: runs.length + 1, point_type: "Factorial", coded, actual });
        }
      }
    }
  }

  for (let c = 0; c < centerPoints; c++) {
    const coded: Record<string, number> = {};
    const actual: Record<string, number> = {};
    for (let j = 0; j < k; j++) {
      coded[factors[j].name] = 0;
      actual[factors[j].name] = codedToActual(0, factors[j].low, factors[j].high);
    }
    runs.push({ run_id: runs.length + 1, point_type: "Center", coded, actual });
  }

  return runs;
}

function generateThreeLevelFactorial(factors: FactorSpec[]): GeneratedRun[] {
  const k = factors.length;
  const levels = [-1.0, 0.0, 1.0];
  const runs: GeneratedRun[] = [];

  function CartesianProduct(curr: number[], depth: number) {
    if (depth === k) {
      const coded: Record<string, number> = {};
      const actual: Record<string, number> = {};
      let isCenter = true;

      for (let j = 0; j < k; j++) {
        const cVal = curr[j];
        if (cVal !== 0) isCenter = false;
        coded[factors[j].name] = cVal;
        actual[factors[j].name] = codedToActual(cVal, factors[j].low, factors[j].high);
      }

      runs.push({
        run_id: runs.length + 1,
        point_type: isCenter ? "Center" : "Factorial",
        coded,
        actual,
      });
      return;
    }
    for (const lvl of levels) {
      CartesianProduct([...curr, lvl], depth + 1);
    }
  }

  CartesianProduct([], 0);
  return runs;
}

function generatePlackettBurman(factors: FactorSpec[]): GeneratedRun[] {
  // Hadamard screening matrix for 8 runs
  const matrix8 = [
    [1, 1, 1, -1, 1, -1, -1],
    [-1, 1, 1, 1, -1, 1, -1],
    [-1, -1, 1, 1, 1, -1, 1],
    [1, -1, -1, 1, 1, 1, -1],
    [-1, 1, -1, -1, 1, 1, 1],
    [1, -1, 1, -1, -1, 1, 1],
    [1, 1, -1, 1, -1, -1, 1],
    [-1, -1, -1, -1, -1, -1, -1],
  ];

  const k = factors.length;
  const runs: GeneratedRun[] = [];

  for (let r = 0; r < matrix8.length; r++) {
    const coded: Record<string, number> = {};
    const actual: Record<string, number> = {};

    for (let j = 0; j < k; j++) {
      const cVal = matrix8[r][j % 7];
      coded[factors[j].name] = cVal;
      actual[factors[j].name] = codedToActual(cVal, factors[j].low, factors[j].high);
    }

    runs.push({ run_id: r + 1, point_type: "Factorial", coded, actual });
  }

  return runs;
}

function generateTaguchi(factors: FactorSpec[]): GeneratedRun[] {
  return generatePlackettBurman(factors); // Taguchi L8 array
}

function generateMixtureDesign(type: DesignType, components: ComponentSpec[], degree: number): GeneratedRun[] {
  const q = components.length;
  if (q < 3) throw new Error("Mixture design requires at least 3 components.");

  const runs: GeneratedRun[] = [];

  if (type === "simplex_centroid") {
    // Vertices (1 component = 1.0)
    for (let i = 0; i < q; i++) {
      const actual: Record<string, number> = {};
      for (let j = 0; j < q; j++) {
        actual[components[j].name] = j === i ? 1.0 : 0.0;
      }
      runs.push({ run_id: runs.length + 1, point_type: "Vertex", coded: { ...actual }, actual });
    }

    // Binary Edges (2 components = 0.5)
    for (let i = 0; i < q; i++) {
      for (let j = i + 1; j < q; j++) {
        const actual: Record<string, number> = {};
        for (let k = 0; k < q; k++) {
          actual[components[k].name] = k === i || k === j ? 0.5 : 0.0;
        }
        runs.push({ run_id: runs.length + 1, point_type: "Edge", coded: { ...actual }, actual });
      }
    }

    // Overall Centroid (all = 1/q)
    const centActual: Record<string, number> = {};
    for (let j = 0; j < q; j++) {
      centActual[components[j].name] = Number((1.0 / q).toFixed(4));
    }
    runs.push({ run_id: runs.length + 1, point_type: "Centroid", coded: { ...centActual }, actual: centActual });

    return runs;
  }

  // Simplex Lattice {q, m}
  const m = Math.max(1, degree);
  function latticePoints(curr: number[], sumRemaining: number, depth: number) {
    if (depth === q - 1) {
      curr.push(sumRemaining);
      const actual: Record<string, number> = {};
      for (let j = 0; j < q; j++) {
        actual[components[j].name] = Number((curr[j] / m).toFixed(4));
      }
      const isCent = curr.every((v) => v > 0);
      const isVert = curr.filter((v) => v === m).length === 1;
      runs.push({
        run_id: runs.length + 1,
        point_type: isVert ? "Vertex" : isCent ? "Centroid" : "Edge",
        coded: { ...actual },
        actual,
      });
      return;
    }

    for (let v = 0; v <= sumRemaining; v++) {
      latticePoints([...curr, v], sumRemaining - v, depth + 1);
    }
  }

  latticePoints([], m, 0);
  return runs;
}
