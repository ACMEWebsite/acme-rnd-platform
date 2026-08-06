import { ReactNode } from "react";
import { BarChart3, Beaker, BookOpen, Database, FlaskConical, Gauge, House, LineChart, LogOut, Microscope } from "lucide-react";

const modules = [
  ["overview", "Home", House, true],
  ["registries", "Drug Reference & Approval Registries", Database, true],
  ["characterization", "API Characterization", Beaker, true],
  ["literature", "Literature Review", BookOpen, true],
  ["preformulation", "Drug–Excipient Compatibility", FlaskConical, true],
  ["pharmacokinetics", "Pharmacokinetics", Gauge, true],
  ["dissolution", "Dissolution Behavior Prediction", Microscope, true],
  ["stability", "Stability Data Extrapolation", LineChart, true],
  ["doe", "DOE Optimization", BarChart3, true],
] as const;

export type DashboardPage = "overview" | "registries" | "characterization" | "literature" | "preformulation" | "pharmacokinetics" | "dissolution" | "stability" | "doe";

export function DashboardLayout({children, authenticated, onLogin, onLogout, activePage, onNavigate}: {
  children: ReactNode;
  authenticated: boolean;
  onLogin: () => void;
  onLogout: () => void;
  activePage: DashboardPage;
  onNavigate: (page: DashboardPage) => void;
}) {
  return <div className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/95 shadow-sm backdrop-blur">
      <div className="h-1.5 bg-gradient-to-r from-[#0b2344] via-[#123f76] to-[#0b6692]" />
      <div className="mx-auto flex max-w-[1800px] items-start gap-3 px-4 py-3 sm:px-6">
        <nav aria-label="Platform modules" className="flex min-w-0 flex-1 items-start gap-2">
          <button onClick={() => onNavigate("overview")} className={`flex min-h-12 w-28 shrink-0 items-center justify-center gap-2.5 rounded-xl px-3 py-3 text-[15px] font-semibold transition sm:w-32 ${activePage === "overview" ? "bg-gradient-to-r from-[#123f76] to-[#0b6692] text-white shadow-md shadow-blue-950/20" : "border border-transparent text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-[#123f76]"}`}><House className="shrink-0" size={20}/><span>Home</span></button>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">{modules.slice(1).map(([id, label, Icon, enabled]) => {
            const selected = id === activePage;
            return <button key={id} disabled={!enabled} onClick={() => enabled && onNavigate(id as DashboardPage)} title={!enabled ? "Scheduled for migration" : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] font-semibold leading-5 transition ${selected ? "bg-gradient-to-r from-[#123f76] to-[#0b6692] text-white shadow-md shadow-blue-950/20" : enabled ? "border border-transparent text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-[#123f76]" : "text-slate-300"}`}><Icon className="shrink-0" size={20}/><span>{label}</span></button>;
          })}</div>
        </nav>
        <button onClick={authenticated ? onLogout : onLogin} className="flex min-h-12 shrink-0 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-[#123f76] transition hover:border-sky-300 hover:bg-sky-100"><LogOut size={18}/> <span className="hidden sm:inline">{authenticated ? "Sign out" : "Sign in"}</span></button>
      </div>
    </header>
    <main className="min-w-0">{children}</main>
  </div>;
}
