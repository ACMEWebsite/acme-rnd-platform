type Point = {time_min: number; dissolved_percent: number};

export function ProfileChart({data}: {data: Point[]}) {
  if (!data.length) return <div className="grid h-72 place-items-center text-sm text-slate-400">Run a simulation to generate the profile.</div>;
  const width = 760, height = 280, left = 52, top = 18, right = 18, bottom = 38;
  const innerW = width-left-right, innerH = height-top-bottom;
  const maxX = Math.max(...data.map(d=>d.time_min), 1);
  const x = (v:number) => left + (v/maxX)*innerW;
  const y = (v:number) => top + (1-v/100)*innerH;
  const path = data.map((d,i)=>`${i ? "L" : "M"} ${x(d.time_min).toFixed(2)} ${y(d.dissolved_percent).toFixed(2)}`).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Dissolution profile" className="h-auto w-full">
    {[0,25,50,75,100].map(t=><g key={t}><line x1={left} x2={width-right} y1={y(t)} y2={y(t)} stroke="#e2e8f0"/><text x={left-10} y={y(t)+4} textAnchor="end" fontSize="11" fill="#64748b">{t}%</text></g>)}
    <line x1={left} x2={width-right} y1={height-bottom} y2={height-bottom} stroke="#94a3b8"/>
    <path d={path} fill="none" stroke="#0891b2" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
    {data.filter((_,i)=>i % Math.max(1,Math.floor(data.length/10))===0).map((d,i)=><circle key={i} cx={x(d.time_min)} cy={y(d.dissolved_percent)} r="3" fill="#fff" stroke="#0891b2" strokeWidth="2"/>)}
    <text x={left+innerW/2} y={height-8} textAnchor="middle" fontSize="12" fill="#64748b">Time (minutes)</text>
  </svg>;
}
