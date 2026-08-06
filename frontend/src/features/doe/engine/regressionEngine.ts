/**
 * Pure TypeScript Response Surface & OLS Regression Engine
 * Computes regression coefficients, Hat Matrix leverage, PRESS, ANOVA (Model, Residual, Lack of Fit, Pure Error),
 * R², Adj R², Pred R², VIF, Studentized Residuals, Cook's Distance, Box-Cox transformations, and 95% CI/PI bounds.
 */

import { fDistPValue, tDistPValue } from "./distributions";
import { invertMatrix, matMul, matVecMul, transpose } from "./matrixMath";

export type ModelOrder = "mean" | "linear" | "2fi" | "quadratic" | "special_cubic";

export type AnovaRow = {
  source: string;
  ss: number;
  df: number;
  ms?: number;
  f_value?: number;
  p_value?: number;
};

export type CoefficientRow = {
  term: string;
  estimate: number;
  std_error: number;
  t_value: number;
  p_value: number;
  vif: number;
  significant: boolean;
};

export type FitStatistics = {
  r_squared: number;
  adj_r_squared: number;
  pred_r_squared: number;
  adequate_precision: number;
  std_dev: number;
  cv_percent: number;
  press: number;
  mean_y: number;
  box_cox_lambda: number;
  box_cox_recommendation: string;
};

export type RunDiagnosticRow = {
  run_id: number;
  actual_y: number;
  predicted_y: number;
  residual: number;
  leverage: number; // h_ii
  studentized_residual: number; // r_i
  externally_studentized: number; // t_i
  cooks_distance: number; // D_i
  influential: boolean;
};

export type RegressionResult = {
  response_name: string;
  model_order: ModelOrder;
  coefficients: CoefficientRow[];
  anova: AnovaRow[];
  fit_stats: FitStatistics;
  predicted: number[];
  residuals: number[];
  leverage: number[];
  diagnostics: RunDiagnosticRow[];
  evalModel: (pointCoded: Record<string, number>) => {
    pred: number;
    se_fit: number;
    ci_low: number;
    ci_high: number;
    pi_low: number;
    pi_high: number;
  };
};

/**
 * Computes exact 2-tailed 95% t-critical value for given degrees of freedom using binary search over tDistPValue
 */
function getTCritical95(df: number): number {
  if (df <= 0) return 1.96;
  let low = 1.0;
  let high = 25.0;
  for (let iter = 0; iter < 30; iter++) {
    const mid = (low + high) / 2;
    const pVal = tDistPValue(mid, df);
    if (pVal > 0.05) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

export function fitModel(
  factorNames: string[],
  runs: { coded: Record<string, number> }[],
  yValues: number[],
  modelOrder: ModelOrder,
  responseName: string = "Response",
  isMixture: boolean = false
): RegressionResult {
  const n = runs.length;
  if (n < 3) {
    throw new Error("At least 3 completed response trials are required to fit a regression model.");
  }
  if (yValues.length !== n) {
    throw new Error("Mismatch between run count and response value count.");
  }

  // 1. Build Model Terms Matrix X
  const termNames: string[] = [];
  const evaluateRow = (coded: Record<string, number>): number[] => {
    const row: number[] = [];

    // Intercept (omitted in Scheffé mixture models)
    if (!isMixture) {
      row.push(1.0);
    }

    // Linear terms
    for (const name of factorNames) {
      row.push(coded[name] ?? 0.0);
    }

    // 2FI (Two-Factor Interaction terms)
    if (modelOrder === "2fi" || modelOrder === "quadratic" || modelOrder === "special_cubic") {
      for (let i = 0; i < factorNames.length; i++) {
        for (let j = i + 1; j < factorNames.length; j++) {
          const v1 = coded[factorNames[i]] ?? 0.0;
          const v2 = coded[factorNames[j]] ?? 0.0;
          row.push(v1 * v2);
        }
      }
    }

    // Quadratic terms (x_i^2)
    if (modelOrder === "quadratic") {
      for (const name of factorNames) {
        const val = coded[name] ?? 0.0;
        row.push(val * val);
      }
    }

    // Special Cubic terms (x_i * x_j * x_k)
    if (modelOrder === "special_cubic") {
      for (let i = 0; i < factorNames.length; i++) {
        for (let j = i + 1; j < factorNames.length; j++) {
          for (let k = j + 1; k < factorNames.length; k++) {
            const v1 = coded[factorNames[i]] ?? 0.0;
            const v2 = coded[factorNames[j]] ?? 0.0;
            const v3 = coded[factorNames[k]] ?? 0.0;
            row.push(v1 * v2 * v3);
          }
        }
      }
    }

    return row;
  };

  // Build term names once
  if (!isMixture) termNames.push("Intercept");
  for (const name of factorNames) termNames.push(name);

  if (modelOrder === "2fi" || modelOrder === "quadratic" || modelOrder === "special_cubic") {
    for (let i = 0; i < factorNames.length; i++) {
      for (let j = i + 1; j < factorNames.length; j++) {
        termNames.push(`${factorNames[i]} × ${factorNames[j]}`);
      }
    }
  }

  if (modelOrder === "quadratic") {
    for (const name of factorNames) {
      termNames.push(`${name}²`);
    }
  }

  if (modelOrder === "special_cubic") {
    for (let i = 0; i < factorNames.length; i++) {
      for (let j = i + 1; j < factorNames.length; j++) {
        for (let k = j + 1; k < factorNames.length; k++) {
          termNames.push(`${factorNames[i]} × ${factorNames[j]} × ${factorNames[k]}`);
        }
      }
    }
  }

  const p = termNames.length;
  if (n <= p) {
    throw new Error(`Insufficient runs (${n}) to fit a ${p}-term ${modelOrder} model. Add more runs or choose a simpler model.`);
  }

  const X: number[][] = runs.map((run) => evaluateRow(run.coded));
  const XT = transpose(X);
  const XTX = matMul(XT, X);

  // Invert X^T X
  let invXTX: number[][];
  try {
    invXTX = invertMatrix(XTX);
  } catch (err) {
    throw new Error(`Cannot fit ${modelOrder} model: design points cannot independently estimate all ${p} terms.`);
  }

  // 2. OLS Coefficients b = (X^T X)^-1 X^T y
  const XTy = matVecMul(XT, yValues);
  const beta = matVecMul(invXTX, XTy);

  // Predicted & Residuals
  const predicted = matVecMul(X, beta);
  const residuals = yValues.map((y, i) => y - predicted[i]);

  // Hat Matrix H = X (X^T X)^-1 X^T -> leverage h_ii
  const leverage: number[] = [];
  for (let i = 0; i < n; i++) {
    const rowI = X[i];
    const temp = matVecMul(invXTX, rowI);
    let h_ii = 0;
    for (let j = 0; j < p; j++) {
      h_ii += rowI[j] * temp[j];
    }
    leverage.push(Math.min(0.9999, Math.max(0.0001, h_ii)));
  }

  // PRESS = sum( (e_i / (1 - h_ii))^2 )
  let press = 0.0;
  for (let i = 0; i < n; i++) {
    const e = residuals[i];
    const h = leverage[i];
    press += Math.pow(e / (1.0 - h), 2);
  }

  // Sum of Squares
  const meanY = yValues.reduce((a, b) => a + b, 0) / n;
  const sst = yValues.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
  const sse = residuals.reduce((sum, e) => sum + Math.pow(e, 2), 0);
  const ssModel = sst - sse;

  const dfTotal = n - 1;
  const dfModel = Math.max(1, p - 1);
  const dfResidual = Math.max(1, n - p);

  const mse = sse / dfResidual;
  const msModel = ssModel / dfModel;
  const fModel = msModel / Math.max(1e-12, mse);
  const pModel = fDistPValue(fModel, dfModel, dfResidual);

  // 3. Compute Variance Inflation Factor (VIF_j) for each term j
  const vifList: number[] = [];
  for (let j = 0; j < p; j++) {
    if (!isMixture && j === 0) {
      vifList.push(1.0); // Intercept VIF is 1.0
      continue;
    }
    // Regress term j on all other terms
    const yJ = X.map((r) => r[j]);
    const xOther = X.map((r) => r.filter((_, idx) => idx !== j));
    try {
      const xOtherT = transpose(xOther);
      const invOther = invertMatrix(matMul(xOtherT, xOther));
      const betaOther = matVecMul(invOther, matVecMul(xOtherT, yJ));
      const predJ = matVecMul(xOther, betaOther);
      const meanJ = yJ.reduce((a, b) => a + b, 0) / n;
      const sstJ = yJ.reduce((s, val) => s + Math.pow(val - meanJ, 2), 0);
      const sseJ = yJ.reduce((s, val, idx) => s + Math.pow(val - predJ[idx], 2), 0);
      const r2J = sstJ > 0 ? (sstJ - sseJ) / sstJ : 0;
      const vifVal = r2J < 0.9999 ? 1.0 / (1.0 - r2J) : 99.0;
      vifList.push(Number(vifVal.toFixed(2)));
    } catch {
      vifList.push(1.0);
    }
  }

  // 4. Studentized Residuals & Cook's Distance
  const diagnostics: RunDiagnosticRow[] = [];
  for (let i = 0; i < n; i++) {
    const e_i = residuals[i];
    const h_ii = leverage[i];

    // Internally Studentized Residual r_i = e_i / sqrt(MSE * (1 - h_ii))
    const se_r = Math.sqrt(Math.max(1e-12, mse * (1.0 - h_ii)));
    const r_i = e_i / se_r;

    // Externally Studentized Residual t_i using closed-form MSE_(-i)
    const mse_minus_i = dfResidual > 1 ? (dfResidual * mse - (e_i * e_i) / (1.0 - h_ii)) / (dfResidual - 1) : mse;
    const se_t = Math.sqrt(Math.max(1e-12, Math.max(1e-12, mse_minus_i) * (1.0 - h_ii)));
    const t_i = e_i / se_t;

    // Cook's Distance D_i = (r_i^2 / p) * (h_ii / (1 - h_ii))
    const cook_d = (Math.pow(r_i, 2) / p) * (h_ii / (1.0 - h_ii));
    const isInfluential = cook_d > 4.0 / n || Math.abs(t_i) > 3.0;

    diagnostics.push({
      run_id: i + 1,
      actual_y: Number(yValues[i].toFixed(4)),
      predicted_y: Number(predicted[i].toFixed(4)),
      residual: Number(e_i.toFixed(4)),
      leverage: Number(h_ii.toFixed(4)),
      studentized_residual: Number(r_i.toFixed(3)),
      externally_studentized: Number(t_i.toFixed(3)),
      cooks_distance: Number(cook_d.toFixed(4)),
      influential: isInfluential,
    });
  }

  // 5. Box-Cox Power Transformation Evaluator
  let bestLambda = 1.0;
  let minSseTransform = Infinity;
  const lambdas = [-2, -1, -0.5, 0, 0.5, 1, 2];

  if (yValues.every((v) => v > 0)) {
    for (const lam of lambdas) {
      const yTrans = yValues.map((v) => (lam === 0 ? Math.log(v) : (Math.pow(v, lam) - 1.0) / lam));
      try {
        const betaT = matVecMul(invXTX, matVecMul(XT, yTrans));
        const predT = matVecMul(X, betaT);
        const sseT = yTrans.reduce((s, val, idx) => s + Math.pow(val - predT[idx], 2), 0);
        if (sseT < minSseTransform) {
          minSseTransform = sseT;
          bestLambda = lam;
        }
      } catch {}
    }
  }

  const boxCoxRec =
    bestLambda === 1.0
      ? "None (λ = 1.0) - Linear scale adequate"
      : bestLambda === 0.0
      ? "Natural Log ln(Y) (λ = 0) - Recommended"
      : bestLambda === 0.5
      ? "Square Root √Y (λ = 0.5) - Recommended"
      : bestLambda === -1.0
      ? "Inverse 1/Y (λ = -1.0) - Recommended"
      : `Power Transformation Y^(${bestLambda})`;

  // Replicate Grouping for Pure Error & Lack of Fit
  const groups: Record<string, number[]> = {};
  for (let i = 0; i < n; i++) {
    const key = factorNames.map((name) => runs[i].coded[name]?.toFixed(3) ?? "0").join("|");
    if (!groups[key]) groups[key] = [];
    groups[key].push(yValues[i]);
  }

  let ssPureError = 0.0;
  let dfPureError = 0;

  for (const key in groups) {
    const grp = groups[key];
    if (grp.length > 1) {
      const grpMean = grp.reduce((a, b) => a + b, 0) / grp.length;
      ssPureError += grp.reduce((sum, val) => sum + Math.pow(val - grpMean, 2), 0);
      dfPureError += grp.length - 1;
    }
  }

  const ssLackOfFit = Math.max(0.0, sse - ssPureError);
  const dfLackOfFit = Math.max(0, dfResidual - dfPureError);

  const msLackOfFit = dfLackOfFit > 0 ? ssLackOfFit / dfLackOfFit : 0;
  const msPureError = dfPureError > 0 ? ssPureError / dfPureError : 0;
  const fLackOfFit = msPureError > 0 ? msLackOfFit / msPureError : undefined;
  const pLackOfFit = fLackOfFit !== undefined && dfLackOfFit > 0 && dfPureError > 0
    ? fDistPValue(fLackOfFit, dfLackOfFit, dfPureError)
    : undefined;

  // Coefficient Statistics
  const stdDev = Math.sqrt(mse);
  const coefficients: CoefficientRow[] = beta.map((bVal, j) => {
    const se = Math.sqrt(Math.max(0.0, mse * invXTX[j][j]));
    const tVal = se > 0 ? bVal / se : 0;
    const pVal = tDistPValue(tVal, dfResidual);
    return {
      term: termNames[j],
      estimate: Number(bVal.toFixed(4)),
      std_error: Number(se.toFixed(4)),
      t_value: Number(tVal.toFixed(3)),
      p_value: Number(pVal.toFixed(4)),
      vif: vifList[j] ?? 1.0,
      significant: pVal < 0.05,
    };
  });

  // Fit Statistics & Adequate Precision (Signal to Noise Ratio)
  const r2 = sst > 0 ? ssModel / sst : 1.0;
  const adjR2 = sst > 0 ? 1.0 - ((1.0 - r2) * (n - 1)) / dfResidual : 1.0;
  const predR2 = sst > 0 ? 1.0 - press / sst : 1.0;
  const cvPercent = meanY !== 0 ? (stdDev / Math.abs(meanY)) * 100.0 : 0.0;

  const predMax = Math.max(...predicted);
  const predMin = Math.min(...predicted);
  const predRange = predMax - predMin;
  const avgPredSe = Math.sqrt((p * mse) / n);
  const adeqPrecision = avgPredSe > 0 ? predRange / avgPredSe : 0.0;

  const fit_stats: FitStatistics = {
    r_squared: Number(r2.toFixed(4)),
    adj_r_squared: Number(adjR2.toFixed(4)),
    pred_r_squared: Number(predR2.toFixed(4)),
    adequate_precision: Number(adeqPrecision.toFixed(2)),
    std_dev: Number(stdDev.toFixed(4)),
    cv_percent: Number(cvPercent.toFixed(2)),
    press: Number(press.toFixed(4)),
    mean_y: Number(meanY.toFixed(4)),
    box_cox_lambda: bestLambda,
    box_cox_recommendation: boxCoxRec,
  };

  // Full ANOVA Table with Individual Term Decompositions
  const anova: AnovaRow[] = [
    {
      source: "Model",
      ss: Number(ssModel.toFixed(4)),
      df: dfModel,
      ms: Number(msModel.toFixed(4)),
      f_value: Number(fModel.toFixed(2)),
      p_value: Number(pModel.toFixed(4)),
    },
  ];

  // Add individual term rows under Model
  coefficients.forEach((c, idx) => {
    if (!isMixture && idx === 0) return; // Skip Intercept
    const termSS = Math.pow(c.t_value, 2) * mse;
    const termF = Math.pow(c.t_value, 2);
    anova.push({
      source: `  ${c.term}`,
      ss: Number(termSS.toFixed(4)),
      df: 1,
      ms: Number(termSS.toFixed(4)),
      f_value: Number(termF.toFixed(2)),
      p_value: c.p_value,
    });
  });

  anova.push({ source: "Residual", ss: Number(sse.toFixed(4)), df: dfResidual, ms: Number(mse.toFixed(4)) });

  if (dfLackOfFit > 0 && dfPureError > 0) {
    anova.push(
      {
        source: "  Lack of Fit",
        ss: Number(ssLackOfFit.toFixed(4)),
        df: dfLackOfFit,
        ms: Number(msLackOfFit.toFixed(4)),
        f_value: fLackOfFit ? Number(fLackOfFit.toFixed(2)) : undefined,
        p_value: pLackOfFit ? Number(pLackOfFit.toFixed(4)) : undefined,
      },
      { source: "  Pure Error", ss: Number(ssPureError.toFixed(4)), df: dfPureError, ms: Number(msPureError.toFixed(4)) }
    );
  }

  anova.push({ source: "Cor Total", ss: Number(sst.toFixed(4)), df: dfTotal });

  // Model Evaluation Function with Exact 95% Confidence & Prediction Intervals
  const tCritical95 = getTCritical95(dfResidual);

  const evalModel = (codedPoint: Record<string, number>) => {
    const row0 = evaluateRow(codedPoint);

    let pred = 0;
    for (let j = 0; j < p; j++) {
      pred += row0[j] * beta[j];
    }

    // Distance x_0^T (X^T X)^-1 x_0
    const temp = matVecMul(invXTX, row0);
    let x0_inv_x0 = 0;
    for (let j = 0; j < p; j++) {
      x0_inv_x0 += row0[j] * temp[j];
    }

    const se_fit = Math.sqrt(Math.max(1e-12, mse * x0_inv_x0));
    const ci_margin = tCritical95 * se_fit;

    const se_pred = Math.sqrt(Math.max(1e-12, mse * (1.0 + x0_inv_x0)));
    const pi_margin = tCritical95 * se_pred;

    return {
      pred: Number(pred.toFixed(2)),
      se_fit: Number(se_fit.toFixed(2)),
      ci_low: Number((pred - ci_margin).toFixed(2)),
      ci_high: Number((pred + ci_margin).toFixed(2)),
      pi_low: Number((pred - pi_margin).toFixed(2)),
      pi_high: Number((pred + pi_margin).toFixed(2)),
    };
  };

  return {
    response_name: responseName,
    model_order: modelOrder,
    coefficients,
    anova,
    fit_stats,
    predicted,
    residuals,
    leverage,
    diagnostics,
    evalModel,
  };
}
