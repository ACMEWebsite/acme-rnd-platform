import { useEffect, useRef, useState } from "react";
import { computeConvexHull, isPointInPolygon } from "../engine/matrixMath";
import { RegressionResult } from "../engine/regressionEngine";
import { DesirabilityGoal, calculateCompositeDesirability } from "../engine/desirabilityEngine";
import { Box, Layers, RotateCw, Sparkles, Sliders, CheckCircle2, HelpCircle } from "lucide-react";
import { ExportButton } from "./ExportButton";

type Props = {
  factors: { name: string; low: number; high: number; unit?: string }[];
  runs: { point_type?: string; coded: Record<string, number>; actual: Record<string, number> }[];
  regressionResults: Record<string, RegressionResult>;
  goals: DesirabilityGoal[];
  desirabilityThreshold: number;
};

// Turbo / Spectral High-Vibrancy Color Map (0.0 to 1.0)
function getTurboColor(t: number, opacity = 1.0): { r: number; g: number; b: number; css: string } {
  const norm = Math.max(0, Math.min(1, t));
  // 5-Color Ramp: Deep Indigo (0.0) -> Royal Blue (0.25) -> Cyan/Teal (0.50) -> Gold (0.75) -> Neon Red (1.00)
  let r = 0, g = 0, b = 0;

  if (norm < 0.25) {
    const localT = norm / 0.25;
    r = Math.floor(15 + localT * (30 - 15));
    g = Math.floor(23 + localT * (144 - 23));
    b = Math.floor(42 + localT * (255 - 42));
  } else if (norm < 0.5) {
    const localT = (norm - 0.25) / 0.25;
    r = Math.floor(30 + localT * (6 - 30));
    g = Math.floor(144 + localT * (212 - 144));
    b = Math.floor(255 + localT * (212 - 255));
  } else if (norm < 0.75) {
    const localT = (norm - 0.5) / 0.25;
    r = Math.floor(6 + localT * (245 - 6));
    g = Math.floor(212 + localT * (158 - 212));
    b = Math.floor(212 + localT * (11 - 212));
  } else {
    const localT = (norm - 0.75) / 0.25;
    r = Math.floor(245 + localT * (239 - 245));
    g = Math.floor(158 + localT * (68 - 158));
    b = Math.floor(11 + localT * (68 - 11));
  }

  return {
    r,
    g,
    b,
    css: `rgba(${r}, ${g}, ${b}, ${opacity})`,
  };
}

export function ContourCanvas({ factors, runs, regressionResults, goals, desirabilityThreshold }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [xAxisFactor, setXAxisFactor] = useState(factors[0]?.name ?? "Factor A");
  const [yAxisFactor, setYAxisFactor] = useState(factors[1]?.name ?? (factors[0]?.name || "Factor B"));
  const [heldFactors, setHeldFactors] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<"3d" | "2d_contour" | "qbd_regions">("3d");
  const [colorMode, setColorMode] = useState<"response" | "desirability">("response");
  const [activeResponse, setActiveResponse] = useState<string>(Object.keys(regressionResults)[0] ?? "");
  
  // 3D Rotation Controls
  const [azimuth, setAzimuth] = useState<number>(45); // Deg (0-360)
  const [elevation, setElevation] = useState<number>(35); // Deg (15-80)
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; azimuth: number; elevation: number }>({ x: 0, y: 0, azimuth: 45, elevation: 35 });

  const [hoverInfo, setHoverInfo] = useState<{
    xActual: number;
    yActual: number;
    xUnit: string;
    yUnit: string;
    intervals: Record<string, { pred: number; ci_low: number; ci_high: number; pi_low: number; pi_high: number }>;
    D: number;
    isControl: boolean;
    isKnowledge: boolean;
  } | null>(null);

  const xFactorSpec = factors.find((f) => f.name === xAxisFactor) ?? factors[0] ?? { name: "X Factor", low: 0, high: 10, unit: "" };
  const yFactorSpec = factors.find((f) => f.name === yAxisFactor) ?? factors[1] ?? { name: "Y Factor", low: 0, high: 10, unit: "" };
  
  const testedCodedPoints: [number, number][] = runs.map((r) => [r.coded[xAxisFactor] ?? 0, r.coded[yAxisFactor] ?? 0]);
  const hullPointsCoded = computeConvexHull(testedCodedPoints);

  // Initialize held factor values to midpoints (0.0 in coded units)
  useEffect(() => {
    const initialHeld: Record<string, number> = {};
    for (const f of factors) {
      if (f.name !== xAxisFactor && f.name !== yAxisFactor) {
        initialHeld[f.name] = 0.0;
      }
    }
    setHeldFactors(initialHeld);
  }, [xAxisFactor, yAxisFactor, factors]);

  useEffect(() => {
    if (!Object.keys(regressionResults).length) return;
    if (!regressionResults[activeResponse]) {
      setActiveResponse(Object.keys(regressionResults)[0]);
    }
  }, [regressionResults, activeResponse]);

  // Main Canvas Render Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const activeReg = regressionResults[activeResponse];
    if (!activeReg) return;

    if (viewMode === "3d") {
      render3DSurface(ctx, width, height);
    } else {
      render2DContour(ctx, width, height);
    }
  }, [viewMode, colorMode, activeResponse, xAxisFactor, yAxisFactor, heldFactors, azimuth, elevation, desirabilityThreshold, regressionResults, goals]);

  // -------------------------------------------------------------
  // 3D ISOMETRIC RESPONSE SURFACE MESH RENDERER
  // -------------------------------------------------------------
  function render3DSurface(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const activeReg = regressionResults[activeResponse];
    if (!activeReg) return;

    const gridRes = 36; // Mesh grid resolution (36x36)
    const radAz = (azimuth * Math.PI) / 180;
    const radEl = (elevation * Math.PI) / 180;

    const cosAz = Math.cos(radAz);
    const sinAz = Math.sin(radAz);
    const cosEl = Math.cos(radEl);
    const sinEl = Math.sin(radEl);

    // Compute Z Min/Max
    let minZ = Infinity, maxZ = -Infinity;
    const zGrid: number[][] = Array.from({ length: gridRes }, () => Array(gridRes).fill(0));
    const dGrid: number[][] = Array.from({ length: gridRes }, () => Array(gridRes).fill(0));

    for (let gy = 0; gy < gridRes; gy++) {
      const cY = 1.0 - (gy / (gridRes - 1)) * 2.0; // +1 to -1
      for (let gx = 0; gx < gridRes; gx++) {
        const cX = -1.0 + (gx / (gridRes - 1)) * 2.0; // -1 to +1

        const pointCoded: Record<string, number> = {
          ...heldFactors,
          [xAxisFactor]: cX,
          [yAxisFactor]: cY,
        };

        const evals = goals.map((g) => {
          const reg = regressionResults[g.response_name];
          const val = reg ? reg.evalModel(pointCoded).pred : 0;
          return { goal: g, value: val };
        });

        const { composite_D } = calculateCompositeDesirability(evals);
        const zVal = activeReg.evalModel(pointCoded).pred;

        zGrid[gy][gx] = zVal;
        dGrid[gy][gx] = composite_D;

        if (zVal < minZ) minZ = zVal;
        if (zVal > maxZ) maxZ = zVal;
      }
    }

    const zRange = maxZ - minZ || 1.0;

    // 3D Point Projection to 2D Screen Canvas
    const scale = Math.min(width, height) * 0.32;
    const centerX = width / 2;
    const centerY = height / 2 + 30;

    function project3D(cX: number, cY: number, cZNorm: number): [number, number] {
      // Rotate around Z axis (Azimuth)
      const xRot = cX * cosAz - cY * sinAz;
      const yRot = cX * sinAz + cY * cosAz;
      const zRot = cZNorm; // Normalized height -1 to +1

      // Project using Elevation tilt angle
      const screenX = centerX + xRot * scale;
      const screenY = centerY - (yRot * sinEl + zRot * cosEl * 0.8) * scale;
      return [screenX, screenY];
    }

    // 1. Draw 3D Base Grid & Axis Box Cage
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;

    // Base Frame Corners (Z = -1)
    const b00 = project3D(-1, -1, -1);
    const b10 = project3D(1, -1, -1);
    const b11 = project3D(1, 1, -1);
    const b01 = project3D(-1, 1, -1);

    // Top Frame Corners (Z = +1)
    const t00 = project3D(-1, -1, 1);
    const t10 = project3D(1, -1, 1);
    const t11 = project3D(1, 1, 1);
    const t01 = project3D(-1, 1, 1);

    // Draw Base Shadow Box Fill
    ctx.beginPath();
    ctx.moveTo(b00[0], b00[1]);
    ctx.lineTo(b10[0], b10[1]);
    ctx.lineTo(b11[0], b11[1]);
    ctx.lineTo(b01[0], b01[1]);
    ctx.closePath();
    ctx.fillStyle = "rgba(241, 245, 249, 0.6)";
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.stroke();

    // Draw Vertical Pillar Lines
    [ [b00, t00], [b10, t10], [b11, t11], [b01, t01] ].forEach(([b, t]) => {
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(t[0], t[1]);
      ctx.strokeStyle = "#cbd5e1";
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // 2. Build 3D Mesh Polygons and Sort Back-to-Front (Painter's Algorithm)
    type Polygon3D = {
      pts: [number, number][];
      avgZNorm: number;
      val: number;
      desirability: number;
      isControl: boolean;
    };

    const polys: Polygon3D[] = [];

    for (let gy = 0; gy < gridRes - 1; gy++) {
      const cY1 = 1.0 - (gy / (gridRes - 1)) * 2.0;
      const cY2 = 1.0 - ((gy + 1) / (gridRes - 1)) * 2.0;

      for (let gx = 0; gx < gridRes - 1; gx++) {
        const cX1 = -1.0 + (gx / (gridRes - 1)) * 2.0;
        const cX2 = -1.0 + ((gx + 1) / (gridRes - 1)) * 2.0;

        const z1 = zGrid[gy][gx];
        const z2 = zGrid[gy][gx + 1];
        const z3 = zGrid[gy + 1][gx + 1];
        const z4 = zGrid[gy + 1][gx];

        const d1 = dGrid[gy][gx];

        const avgZ = (z1 + z2 + z3 + z4) / 4;
        const avgZNorm = ((avgZ - minZ) / zRange) * 2.0 - 1.0; // Scale to [-1, 1]

        const z1Norm = ((z1 - minZ) / zRange) * 2.0 - 1.0;
        const z2Norm = ((z2 - minZ) / zRange) * 2.0 - 1.0;
        const z3Norm = ((z3 - minZ) / zRange) * 2.0 - 1.0;
        const z4Norm = ((z4 - minZ) / zRange) * 2.0 - 1.0;

        const p1 = project3D(cX1, cY1, z1Norm);
        const p2 = project3D(cX2, cY1, z2Norm);
        const p3 = project3D(cX2, cY2, z3Norm);
        const p4 = project3D(cX1, cY2, z4Norm);

        // Sort metric: Depth ordering based on 3D rotation
        const depthVal = cX1 * sinAz + cY1 * cosAz + avgZNorm * sinEl;

        polys.push({
          pts: [p1, p2, p3, p4],
          avgZNorm: depthVal,
          val: avgZ,
          desirability: d1,
          isControl: d1 >= desirabilityThreshold,
        });
      }
    }

    // Sort Polygons by depth (Farthest to Nearest)
    polys.sort((a, b) => a.avgZNorm - b.avgZNorm);

    // Draw Surface Polygons with Dynamic Metallic Lighting
    polys.forEach((poly) => {
      const normVal = (poly.val - minZ) / zRange;
      const colorObj = colorMode === "desirability" 
        ? getTurboColor(poly.desirability, 0.88)
        : getTurboColor(normVal, 0.88);

      ctx.beginPath();
      ctx.moveTo(poly.pts[0][0], poly.pts[0][1]);
      ctx.lineTo(poly.pts[1][0], poly.pts[1][1]);
      ctx.lineTo(poly.pts[2][0], poly.pts[2][1]);
      ctx.lineTo(poly.pts[3][0], poly.pts[3][1]);
      ctx.closePath();

      // Highlight MODR Sweet Spot in Vibrant Emerald Overlay
      if (colorMode === "response" && poly.isControl) {
        ctx.fillStyle = `rgba(16, 185, 129, 0.85)`;
      } else {
        ctx.fillStyle = colorObj.css;
      }
      ctx.fill();

      // Draw Wireframe Mesh Edges
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    });

    // 3. Draw Tested Design Trial Points Floating in 3D Space
    runs.forEach((r) => {
      const cX = r.coded[xAxisFactor] ?? 0;
      const cY = r.coded[yAxisFactor] ?? 0;
      const pointCoded: Record<string, number> = { ...heldFactors, [xAxisFactor]: cX, [yAxisFactor]: cY };
      const predZ = activeReg.evalModel(pointCoded).pred;
      const zNorm = ((predZ - minZ) / zRange) * 2.0 - 1.0;

      const pt3D = project3D(cX, cY, zNorm);
      const base3D = project3D(cX, cY, -1.0);

      // Drop Line to Base Plane
      ctx.beginPath();
      ctx.moveTo(pt3D[0], pt3D[1]);
      ctx.lineTo(base3D[0], base3D[1]);
      ctx.strokeStyle = "rgba(15, 23, 42, 0.5)";
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);

      // 3D Point Sphere
      ctx.beginPath();
      ctx.arc(pt3D[0], pt3D[1], r.point_type === "Center" ? 6 : 7, 0, 2 * Math.PI);
      ctx.fillStyle = r.point_type === "Center" ? "#f59e0b" : "#0f172a";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // 4. Draw 3D Axis Labels & Color Bar Legend
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 11px sans-serif";

    // X Axis Label
    const xLabelPos = project3D(0, -1.2, -1.1);
    ctx.textAlign = "center";
    ctx.fillText(`X: ${xFactorSpec.name} (${xFactorSpec.unit || ""})`, xLabelPos[0], xLabelPos[1]);

    // Y Axis Label
    const yLabelPos = project3D(1.2, 0, -1.1);
    ctx.fillText(`Y: ${yFactorSpec.name} (${yFactorSpec.unit || ""})`, yLabelPos[0], yLabelPos[1]);

    // Z Axis Title & Values
    const zLabelPos = project3D(-1.2, -1.2, 0.5);
    ctx.fillStyle = "#0284c7";
    ctx.fillText(`Z: ${activeResponse} [${minZ.toFixed(1)} – ${maxZ.toFixed(1)}]`, zLabelPos[0], zLabelPos[1]);

    // Draw Vibrant Color Bar Legend (Top Right Corner)
    renderColorBarLegend(ctx, width - 45, 40, 16, 160, minZ, maxZ);
  }

  // -------------------------------------------------------------
  // 2D HIGH-RESOLUTION CONTOUR & REGION MAP RENDERER
  // -------------------------------------------------------------
  function render2DContour(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const activeReg = regressionResults[activeResponse];
    if (!activeReg) return;

    const padLeft = 65, padRight = 75, padTop = 35, padBottom = 55;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const gridSize = 120;
    const imgData = ctx.createImageData(plotW, plotH);
    const gridVal: number[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
    const gridDesirability: number[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));

    let minVal = Infinity, maxVal = -Infinity;

    for (let gy = 0; gy < gridSize; gy++) {
      const cY = 1.0 - (gy / (gridSize - 1)) * 2.0;
      for (let gx = 0; gx < gridSize; gx++) {
        const cX = -1.0 + (gx / (gridSize - 1)) * 2.0;

        const pointCoded: Record<string, number> = {
          ...heldFactors,
          [xAxisFactor]: cX,
          [yAxisFactor]: cY,
        };

        const evals = goals.map((g) => {
          const reg = regressionResults[g.response_name];
          const val = reg ? reg.evalModel(pointCoded).pred : 0;
          return { goal: g, value: val };
        });

        const { composite_D } = calculateCompositeDesirability(evals);
        const respVal = activeReg.evalModel(pointCoded).pred;

        gridVal[gy][gx] = respVal;
        gridDesirability[gy][gx] = composite_D;

        if (respVal < minVal) minVal = respVal;
        if (respVal > maxVal) maxVal = respVal;
      }
    }

    // Render Spectral Heatmap Grid
    for (let py = 0; py < plotH; py++) {
      const gy = Math.floor((py / plotH) * gridSize);
      for (let px = 0; px < plotW; px++) {
        const gx = Math.floor((px / plotW) * gridSize);
        const cX = -1.0 + (gx / (gridSize - 1)) * 2.0;
        const cY = 1.0 - (py / plotH) * 2.0;

        const val = gridVal[gy][gx];
        const des = gridDesirability[gy][gx];
        const isControl = des >= desirabilityThreshold;
        const isKnowledge = isPointInPolygon([cX, cY], hullPointsCoded);

        const normVal = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal || 1)));
        const colorObj = colorMode === "desirability"
          ? getTurboColor(des)
          : getTurboColor(normVal);

        let { r, g, b } = colorObj;

        // Highlight MODR Sweet Spot Region
        if (isControl && viewMode === "qbd_regions") {
          r = Math.min(255, r + 50);
          g = 220;
          b = Math.floor(b * 0.4);
        }

        // Dim Extrapolation area outside Knowledge Space
        if (!isKnowledge) {
          r = Math.floor(r * 0.5 + 80);
          g = Math.floor(g * 0.5 + 80);
          b = Math.floor(b * 0.5 + 80);
        }

        const idx = (py * plotW + px) * 4;
        imgData.data[idx] = r;
        imgData.data[idx + 1] = g;
        imgData.data[idx + 2] = b;
        imgData.data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, padLeft, padTop);

    // Draw Outer Frame
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padLeft, padTop, plotW, plotH);

    // Draw Knowledge Space Convex Hull (Dashed Cyan Boundary)
    if (hullPointsCoded.length >= 3) {
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 2.5;
      for (let i = 0; i < hullPointsCoded.length; i++) {
        const [cX, cY] = hullPointsCoded[i];
        const px = padLeft + ((cX + 1.0) / 2.0) * plotW;
        const py = padTop + ((1.0 - cY) / 2.0) * plotH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Contour Isolines with Labeled Numerical Values
    const contourLevels = 7;
    const stepVal = (maxVal - minVal) / (contourLevels + 1);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1.2;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px monospace";

    for (let lvl = 1; lvl <= contourLevels; lvl++) {
      const targetVal = minVal + lvl * stepVal;

      for (let gy = 0; gy < gridSize - 1; gy += 4) {
        for (let gx = 0; gx < gridSize - 1; gx += 4) {
          const v = gridVal[gy][gx];
          const vRight = gridVal[gy][gx + 1];
          const vDown = gridVal[gy + 1][gx];

          if ((v <= targetVal && vRight >= targetVal) || (v >= targetVal && vRight <= targetVal)) {
            const px = padLeft + (gx / gridSize) * plotW;
            const py = padTop + (gy / gridSize) * plotH;
            ctx.beginPath();
            ctx.arc(px, py, 1.2, 0, 2 * Math.PI);
            ctx.stroke();

            // Label every few points
            if (gx % 16 === 0 && gy % 16 === 0) {
              ctx.fillText(targetVal.toFixed(1), px + 3, py - 3);
            }
          }
        }
      }
    }

    // Draw Tested Trial Points
    runs.forEach((r) => {
      const cX = r.coded[xAxisFactor] ?? 0;
      const cY = r.coded[yAxisFactor] ?? 0;
      const px = padLeft + ((cX + 1.0) / 2.0) * plotW;
      const py = padTop + ((1.0 - cY) / 2.0) * plotH;

      ctx.beginPath();
      ctx.arc(px, py, r.point_type === "Center" ? 6 : 7, 0, 2 * Math.PI);
      ctx.fillStyle = r.point_type === "Center" ? "#f59e0b" : "#0f172a";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw Axis Labels with Physical Range
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `${xFactorSpec.name}: ${xFactorSpec.low} to ${xFactorSpec.high} ${xFactorSpec.unit || ""}`,
      padLeft + plotW / 2,
      height - 15
    );

    ctx.save();
    ctx.translate(18, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(
      `${yFactorSpec.name}: ${yFactorSpec.low} to ${yFactorSpec.high} ${yFactorSpec.unit || ""}`,
      0,
      0
    );
    ctx.restore();

    // Render Color Bar Legend
    renderColorBarLegend(ctx, width - 45, padTop, 16, plotH, minVal, maxVal);
  }

  // Draw Vertical Color Bar Legend with Ticks
  function renderColorBarLegend(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    minV: number,
    maxV: number
  ) {
    const legendSteps = 50;
    const stepH = h / legendSteps;

    for (let i = 0; i < legendSteps; i++) {
      const norm = 1.0 - i / (legendSteps - 1);
      const colorObj = getTurboColor(norm);
      ctx.fillStyle = colorObj.css;
      ctx.fillRect(x, y + i * stepH, w, stepH + 0.5);
    }

    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Ticks & Labels
    ctx.fillStyle = "#334155";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "left";

    const ticks = [1.0, 0.75, 0.5, 0.25, 0.0];
    ticks.forEach((t) => {
      const tickY = y + (1 - t) * h;
      const tickVal = minV + t * (maxV - minV);
      ctx.beginPath();
      ctx.moveTo(x + w, tickY);
      ctx.lineTo(x + w + 4, tickY);
      ctx.stroke();
      ctx.fillText(tickVal.toFixed(1), x + w + 6, tickY + 3);
    });
  }

  // Mouse Interactivity for 3D Drag Rotation & Hover Inspection
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (viewMode !== "3d") return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, azimuth, elevation };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDragging && viewMode === "3d") {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setAzimuth((dragStartRef.current.azimuth + dx * 0.5 + 360) % 360);
      setElevation(Math.max(15, Math.min(80, dragStartRef.current.elevation - dy * 0.5)));
      return;
    }

    // Hover Inspection for 2D Mode
    const rect = canvas.getBoundingClientRect();
    const padLeft = 65, padRight = 75, padTop = 35, padBottom = 55;
    const plotW = canvas.width - padLeft - padRight;
    const plotH = canvas.height - padTop - padBottom;

    const mx = e.clientX - rect.left - padLeft;
    const my = e.clientY - rect.top - padTop;

    if (mx < 0 || mx > plotW || my < 0 || my > plotH) {
      setHoverInfo(null);
      return;
    }

    const cX = -1.0 + (mx / plotW) * 2.0;
    const cY = 1.0 - (my / plotH) * 2.0;

    const xActual = xFactorSpec.low + ((cX + 1) / 2) * (xFactorSpec.high - xFactorSpec.low);
    const yActual = yFactorSpec.low + ((cY + 1) / 2) * (yFactorSpec.high - yFactorSpec.low);

    const pointCoded: Record<string, number> = {
      ...heldFactors,
      [xAxisFactor]: cX,
      [yAxisFactor]: cY,
    };

    const intervals: Record<string, { pred: number; ci_low: number; ci_high: number; pi_low: number; pi_high: number }> = {};
    const evals = goals.map((g) => {
      const reg = regressionResults[g.response_name];
      const res = reg ? reg.evalModel(pointCoded) : { pred: 0, se_fit: 0, ci_low: 0, ci_high: 0, pi_low: 0, pi_high: 0 };
      intervals[g.response_name] = res;
      return { goal: g, value: res.pred };
    });

    const { composite_D } = calculateCompositeDesirability(evals);
    const isControl = composite_D >= desirabilityThreshold;
    const isKnowledge = isPointInPolygon([cX, cY], hullPointsCoded);

    setHoverInfo({
      xActual: Number(xActual.toFixed(2)),
      yActual: Number(yActual.toFixed(2)),
      xUnit: xFactorSpec.unit || "",
      yUnit: yFactorSpec.unit || "",
      intervals,
      D: composite_D,
      isControl,
      isKnowledge,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="space-y-4">
      {/* View Mode Bar: 3D Surface vs 2D Contour vs QbD Regions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* Left: View Mode Selectors */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setViewMode("3d")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 transition cursor-pointer ${
              viewMode === "3d"
                ? "bg-gradient-to-r from-sky-700 to-cyan-700 text-white shadow-md"
                : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Box size={16} />
            <span>🧊 3D Response Surface Mesh</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("2d_contour")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 transition cursor-pointer ${
              viewMode === "2d_contour"
                ? "bg-gradient-to-r from-sky-700 to-cyan-700 text-white shadow-md"
                : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Layers size={16} />
            <span>🗺️ 2D Contour Map & Isolines</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("qbd_regions")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 transition cursor-pointer ${
              viewMode === "qbd_regions"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Sparkles size={16} />
            <span>🎯 QbD MODR Sweet Spot Region</span>
          </button>
        </div>

        {/* Right: Response & Palette Selectors */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
          <label className="flex items-center gap-1.5">
            <span className="text-slate-600">Active Response:</span>
            <select
              value={activeResponse}
              onChange={(e) => setActiveResponse(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-bold text-navy-950 shadow-sm"
            >
              {Object.keys(regressionResults).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setColorMode("response")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                colorMode === "response" ? "bg-white text-cyan-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Spectral Height
            </button>
            <button
              type="button"
              onClick={() => setColorMode("desirability")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                colorMode === "desirability" ? "bg-white text-emerald-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Desirability (D)
            </button>
          </div>

          <ExportButton
            title={`3D Response Surface & Contour Map (${activeResponse})`}
            fileName={`DOE_Response_Surface_${activeResponse.replace(/[^a-zA-Z0-9]/g, "_")}`}
            getCanvas={() => canvasRef.current}
          />
        </div>
      </div>

      {/* Axis Factor Selection & 3D Interactive Rotation Controls */}
      <div className="grid gap-4 md:grid-cols-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs font-semibold text-slate-700">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap font-bold text-navy-950">X-Axis Factor:</span>
          <select
            value={xAxisFactor}
            onChange={(e) => setXAxisFactor(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm"
          >
            {factors.map((f) => (
              <option key={f.name} value={f.name} disabled={f.name === yAxisFactor}>
                {f.name} ({f.low} to {f.high} {f.unit || ""})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap font-bold text-navy-950">Y-Axis Factor:</span>
          <select
            value={yAxisFactor}
            onChange={(e) => setYAxisFactor(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm"
          >
            {factors.map((f) => (
              <option key={f.name} value={f.name} disabled={f.name === xAxisFactor}>
                {f.name} ({f.low} to {f.high} {f.unit || ""})
              </option>
            ))}
          </select>
        </div>

        {/* 3D Rotation Controls */}
        {viewMode === "3d" ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-sky-950">
            <div className="flex items-center gap-2">
              <RotateCw size={14} className="text-sky-700 shrink-0" />
              <span className="font-bold text-[11px]">3D View Angle:</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[11px]">
                <span>Az:</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={azimuth}
                  onChange={(e) => setAzimuth(Number(e.target.value))}
                  className="w-16 accent-sky-700"
                />
              </label>
              <label className="flex items-center gap-1 text-[11px]">
                <span>El:</span>
                <input
                  type="range"
                  min="15"
                  max="80"
                  value={elevation}
                  onChange={(e) => setElevation(Number(e.target.value))}
                  className="w-16 accent-sky-700"
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Sparkles size={14} className="text-cyan-700" />
            <span>Hover cursor over graph to inspect live point values.</span>
          </div>
        )}
      </div>

      {/* Main Graph Canvas Area */}
      <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-panel flex flex-col items-center justify-center">
        <canvas
          ref={canvasRef}
          width={780}
          height={480}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`max-w-full rounded-xl ${viewMode === "3d" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"}`}
        />

        {/* 3D Drag Instruction Tag */}
        {viewMode === "3d" && (
          <div className="absolute top-6 left-6 rounded-lg bg-slate-900/80 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm shadow flex items-center gap-2">
            <RotateCw size={12} className="text-cyan-400 animate-spin" />
            <span>Click & Drag to Rotate 3D Surface Mesh</span>
          </div>
        )}

        {/* Specific Live Point Hover Inspector Card */}
        {hoverInfo && viewMode !== "3d" && (
          <div className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50/90 p-4 backdrop-blur-sm text-xs shadow-md space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-3 font-mono font-bold text-navy-950">
                <span>
                  {xFactorSpec.name}: <strong className="text-cyan-800">{hoverInfo.xActual} {hoverInfo.xUnit}</strong>
                </span>
                <span>|</span>
                <span>
                  {yFactorSpec.name}: <strong className="text-cyan-800">{hoverInfo.yActual} {hoverInfo.yUnit}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2 font-bold">
                {hoverInfo.isControl ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 size={12} /> MODR Sweet Spot (D = {(hoverInfo.D * 100).toFixed(1)}%)
                  </span>
                ) : hoverInfo.isKnowledge ? (
                  <span className="rounded-full bg-sky-100 px-3 py-0.5 text-sky-900 border border-sky-300">
                    Knowledge Region (D = {(hoverInfo.D * 100).toFixed(1)}%)
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-3 py-0.5 text-amber-900 border border-amber-300">
                    ⚠️ Extrapolation Zone
                  </span>
                )}
              </div>
            </div>

            {/* Intervals Table */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(hoverInfo.intervals).map(([rName, res]) => (
                <div key={rName} className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1">
                  <span className="font-bold text-slate-800 text-[11px] truncate block">{rName}</span>
                  <div className="flex justify-between font-mono text-xs text-navy-950 font-extrabold">
                    <span>Pred (ŷ):</span>
                    <span className="text-cyan-700">{res.pred.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px] text-slate-500">
                    <span>95% CI:</span>
                    <span>[{res.ci_low.toFixed(1)}, {res.ci_high.toFixed(1)}]</span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px] text-slate-500">
                    <span>95% PI:</span>
                    <span>[{res.pi_low.toFixed(1)}, {res.pi_high.toFixed(1)}]</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
