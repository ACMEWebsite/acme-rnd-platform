/**
 * Pure TypeScript Derringer–Suich Multi-Response Desirability Optimization Engine
 * Calculates individual desirability scores d_i in [0.0, 1.0] and overall composite desirability D.
 */

export type DesirabilityGoal = {
  response_name: string;
  direction: "maximize" | "minimize" | "target";
  target: number;
  low: number;
  high: number;
  weight: number; // importance weight (1.0 default)
};

/**
 * Calculates individual desirability score d_i in [0, 1] for a single response value
 */
export function calculateIndividualDesirability(val: number, goal: DesirabilityGoal): number {
  const { direction, target, low, high } = goal;

  if (direction === "maximize") {
    if (val <= low) return 0.0;
    if (val >= high) return 1.0;
    return high > low ? (val - low) / (high - low) : 1.0;
  } else if (direction === "minimize") {
    if (val >= high) return 0.0;
    if (val <= low) return 1.0;
    return high > low ? (high - val) / (high - low) : 1.0;
  } else {
    // Target range
    if (val < low || val > high) return 0.0;
    if (val === target) return 1.0;
    if (val < target) {
      return target > low ? (val - low) / (target - low) : 1.0;
    } else {
      return high > target ? (high - val) / (high - target) : 1.0;
    }
  }
}

/**
 * Calculates overall composite desirability D across R responses using geometric mean:
 * D = ( \prod d_i^{w_i} )^{1 / \sum w_i}
 */
export function calculateCompositeDesirability(
  evaluations: { goal: DesirabilityGoal; value: number }[]
): { composite_D: number; individual_d: Record<string, number> } {
  if (evaluations.length === 0) {
    return { composite_D: 0.0, individual_d: {} };
  }

  const individual_d: Record<string, number> = {};
  let totalWeight = 0.0;
  let weightedLogSum = 0.0;
  let anyZero = false;

  for (const item of evaluations) {
    const d_i = calculateIndividualDesirability(item.value, item.goal);
    const weight = Math.max(0.1, item.goal.weight ?? 1.0);
    individual_d[item.goal.response_name] = Number(d_i.toFixed(4));

    if (d_i <= 0) {
      anyZero = true;
    }

    weightedLogSum += weight * Math.log(Math.max(d_i, 1e-8));
    totalWeight += weight;
  }

  if (anyZero || totalWeight === 0) {
    return { composite_D: 0.0, individual_d };
  }

  const composite_D = Math.exp(weightedLogSum / totalWeight);
  return { composite_D: Number(composite_D.toFixed(4)), individual_d };
}
