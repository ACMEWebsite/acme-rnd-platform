/**
 * Pure TypeScript Matrix & Linear Algebra Operations for DoE OLS Engine
 * Provides matrix transpose, multiplication, vector operations, and Gauss-Jordan inversion with partial pivoting.
 */

export type Matrix = number[][];
export type Vector = number[];

export function transpose(A: Matrix): Matrix {
  const rows = A.length;
  const cols = A[0].length;
  const result: Matrix = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = A[i][j];
    }
  }
  return result;
}

export function matMul(A: Matrix, B: Matrix): Matrix {
  const rowsA = A.length;
  const colsA = A[0].length;
  const rowsB = B.length;
  const colsB = B[0].length;

  if (colsA !== rowsB) {
    throw new Error(`Matrix multiplication dimension mismatch: (${rowsA}x${colsA}) * (${rowsB}x${colsB})`);
  }

  const result: Matrix = Array.from({ length: rowsA }, () => Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++) {
    for (let k = 0; k < colsA; k++) {
      const aVal = A[i][k];
      for (let j = 0; j < colsB; j++) {
        result[i][j] += aVal * B[k][j];
      }
    }
  }
  return result;
}

export function matVecMul(A: Matrix, v: Vector): Vector {
  const rows = A.length;
  const cols = A[0].length;
  if (cols !== v.length) {
    throw new Error(`Matrix-vector dimension mismatch: (${rows}x${cols}) * (${v.length})`);
  }
  const result: Vector = Array(rows).fill(0);
  for (let i = 0; i < rows; i++) {
    let sum = 0;
    for (let j = 0; j < cols; j++) {
      sum += A[i][j] * v[j];
    }
    result[i] = sum;
  }
  return result;
}

/**
 * Invert a square matrix A using Gauss-Jordan elimination with partial pivoting.
 * Throws a descriptive error if the matrix is singular or near-singular.
 */
export function invertMatrix(A: Matrix): Matrix {
  const n = A.length;
  if (n === 0 || A[0].length !== n) {
    throw new Error("Matrix inversion requires a non-empty square matrix.");
  }

  // Create augmented matrix [A | I]
  const aug: Matrix = Array.from({ length: n }, (_, i) => [
    ...A[i],
    ...Array.from({ length: n }, (_, j) => (i === j ? 1.0 : 0.0)),
  ]);

  for (let i = 0; i < n; i++) {
    // Partial pivoting: find maximum row in column i
    let maxRow = i;
    let maxVal = Math.abs(aug[i][i]);
    for (let k = i + 1; k < n; k++) {
      const val = Math.abs(aug[k][i]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = k;
      }
    }

    if (maxVal < 1e-12) {
      throw new Error(
        "Matrix is singular or near-singular (XᵀX cannot be inverted). The chosen model has too many terms for the available distinct design points/runs."
      );
    }

    // Swap pivot row
    if (maxRow !== i) {
      const temp = aug[i];
      aug[i] = aug[maxRow];
      aug[maxRow] = temp;
    }

    // Scale pivot row so pivot element = 1
    const pivot = aug[i][i];
    for (let j = 0; j < 2 * n; j++) {
      aug[i][j] /= pivot;
    }

    // Eliminate column elements in all other rows
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = aug[k][i];
        for (let j = 0; j < 2 * n; j++) {
          aug[k][j] -= factor * aug[i][j];
        }
      }
    }
  }

  // Extract inverted matrix from right half
  const inverse: Matrix = Array.from({ length: n }, (_, i) => aug[i].slice(n));
  return inverse;
}

/**
 * Computes Andrew's Monotone Chain 2D Convex Hull for a set of points [[x1, y1], [x2, y2], ...]
 */
export function computeConvexHull(points: [number, number][]): [number, number][] {
  if (points.length <= 3) return points;

  const sorted = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));

  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: [number, number][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Checks if point (x, y) lies inside a 2D convex polygon using ray-casting/cross-product
 */
export function isPointInPolygon(point: [number, number], vs: [number, number][]): boolean {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
