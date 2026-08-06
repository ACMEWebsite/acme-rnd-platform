import { useEffect, useRef, useState } from "react";
import { ComponentSpec } from "../engine/designGenerators";
import { RegressionResult } from "../engine/regressionEngine";

type Props = {
  components: ComponentSpec[];
  runs: { actual: Record<string, number> }[];
  regressionResults: Record<string, RegressionResult>;
};

export function TernaryCanvas({ components, runs, regressionResults }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeResponse = Object.keys(regressionResults)[0] ?? "";
  const regResult = regressionResults[activeResponse];

  const q = components.length;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || q !== 3) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const pad = 40;
    const triH = (height - 2 * pad);
    const triW = (2 / Math.sqrt(3)) * triH;
    const cX = width / 2;
    const cY = pad + triH / 2;

    // Triangle Vertices (Barycentric)
    const p1: [number, number] = [cX, pad]; // Top: Component 1 = 1.0
    const p2: [number, number] = [cX - triW / 2, height - pad]; // Left: Component 2 = 1.0
    const p3: [number, number] = [cX + triW / 2, height - pad]; // Right: Component 3 = 1.0

    ctx.clearRect(0, 0, width, height);

    // Barycentric (x1, x2, x3) to 2D Screen (px, py)
    const toScreen = (x1: number, x2: number, x3: number): [number, number] => {
      const sum = x1 + x2 + x3 || 1.0;
      const n1 = x1 / sum, n2 = x2 / sum, n3 = x3 / sum;
      const px = n1 * p1[0] + n2 * p2[0] + n3 * p3[0];
      const py = n1 * p1[1] + n2 * p2[1] + n3 * p3[1];
      return [px, py];
    };

    // Draw Triangle Outline
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.fill();

    // Draw Grid Lines (10% increments)
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 0.8;
    for (let step = 1; step < 10; step++) {
      const frac = step / 10.0;
      // Parallel to base 2-3
      const pt1 = toScreen(frac, 1 - frac, 0);
      const pt2 = toScreen(frac, 0, 1 - frac);
      ctx.beginPath(); ctx.moveTo(pt1[0], pt1[1]); ctx.lineTo(pt2[0], pt2[1]); ctx.stroke();
    }

    // Draw Tested Runs Points
    runs.forEach((r) => {
      const c1 = r.actual[components[0].name] ?? 0;
      const c2 = r.actual[components[1].name] ?? 0;
      const c3 = r.actual[components[2].name] ?? 0;
      const [px, py] = toScreen(c1, c2, c3);

      ctx.beginPath();
      ctx.arc(px, py, 6, 0, 2 * Math.PI);
      ctx.fillStyle = "#0284c7";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Vertex Labels
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${components[0].name} (100%)`, p1[0], p1[1] - 12);
    ctx.textAlign = "right";
    ctx.fillText(`${components[1].name} (100%)`, p2[0] - 10, p2[1] + 10);
    ctx.textAlign = "left";
    ctx.fillText(`${components[2].name} (100%)`, p3[0] + 10, p3[1] + 10);
  }, [components, runs, regressionResults, q]);

  if (q > 3) {
    // Cox Effect (Trace) Plot Fallback for > 3 components
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
        <h3 className="font-bold text-navy-950">Cox Response Trace Sensitivity Plot ({q} Components)</h3>
        <p className="mt-1 text-xs text-slate-500">Shows response variation as each component proportion varies while others adjust proportionally.</p>
        <div className="mt-6 flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500">
          Cox Sensitivity Trace Active ({components.map((c) => c.name).join(", ")})
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-navy-950">Simplex Ternary Contour Plot</h3>
          <p className="mt-1 text-xs text-slate-500">Barycentric coordinate space (Σ Component = 100%)</p>
        </div>
      </div>
      <div className="mt-4 flex justify-center">
        <canvas ref={canvasRef} width={640} height={420} className="max-w-full" />
      </div>
    </div>
  );
}
