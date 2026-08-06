/**
 * Pure TypeScript Statistical Distributions Engine
 * Implements Log-Gamma, Regularized Incomplete Beta function (continued fraction),
 * F-distribution upper-tail cumulative probability, and Student's t-distribution p-values.
 */

export function logGamma(x: number): number {
  if (x <= 0) return 0;
  const c = [
    57.1562356658629235, -59.5979603554754912, 14.1360979747417471,
    -0.491913816097620199, 0.339946499848118887e-4, 0.465236289270485756e-4,
    -0.983744753048795646e-4, 0.158084709778570192e-3, -0.210264441724104883e-3,
    0.217439618115212643e-3, -0.16431810653676389e-3, 0.844182239838527433e-4,
    -0.261908384015814087e-4, 0.368991826595316227e-5
  ];
  let y = x;
  let tmp = x + 5.2421875;
  tmp = (x + 0.5) * Math.log(tmp) - tmp;
  let ser = 0.999999999999997091;
  for (let j = 0; j < c.length; j++) {
    y += 1;
    ser += c[j] / y;
  }
  return tmp + Math.log(2.5066282746310005 * ser / x);
}

/**
 * Regularized Incomplete Beta Function I_x(a, b) using continued fractions
 */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use symmetry transformation if needed
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(1 - x, b, a);
  }

  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logGamma(a) - logGamma(b) + logGamma(a + b)) / a;

  // Continued fraction (Lentz method)
  const MAX_ITER = 200;
  const EPS = 1e-12;
  let f = 1.0;
  let c = 1.0;
  let d = 0.0;

  for (let i = 0; i <= MAX_ITER; i++) {
    const m = Math.floor(i / 2);
    let numerator: number;

    if (i === 0) {
      numerator = 1.0;
    } else if (i % 2 === 0) {
      numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    } else {
      numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    }

    d = 1.0 + numerator * d;
    if (Math.abs(d) < EPS) d = EPS;

    c = 1.0 + numerator / c;
    if (Math.abs(c) < EPS) c = EPS;

    d = 1.0 / d;
    const delta = d * c;
    f *= delta;

    if (Math.abs(delta - 1.0) < EPS) break;
  }

  return front * (f - 1.0);
}

/**
 * Calculates F-distribution upper-tail p-value: P(F > f | df1, df2)
 */
export function fDistPValue(f: number, df1: number, df2: number): number {
  if (f <= 0 || df1 <= 0 || df2 <= 0 || !Number.isFinite(f)) return 1.0;
  const x = df2 / (df2 + df1 * f);
  return incompleteBeta(x, df2 / 2, df1 / 2);
}

/**
 * Calculates Student's t-distribution 2-tailed p-value: P(|T| > t | df)
 */
export function tDistPValue(t: number, df: number): number {
  if (df <= 0 || !Number.isFinite(t)) return 1.0;
  const absT = Math.abs(t);
  const x = df / (df + absT * absT);
  return incompleteBeta(x, df / 2, 0.5);
}
