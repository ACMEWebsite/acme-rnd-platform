import { ReactNode } from "react";
import {
  BarChart3,
  Beaker,
  BookOpen,
  Database,
  FlaskConical,
  Gauge,
  House,
  LineChart,
  LogOut,
  Microscope,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { UserProfileData } from "../api/client";

const baseModules = [
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

export type DashboardPage =
  | "overview"
  | "registries"
  | "characterization"
  | "literature"
  | "preformulation"
  | "pharmacokinetics"
  | "dissolution"
  | "stability"
  | "doe"
  | "admin_users";

export function DashboardLayout({
  children,
  authenticated,
  currentUser,
  onLogin,
  onLogout,
  onOpenSettings,
  activePage,
  onNavigate,
}: {
  children: ReactNode;
  authenticated: boolean;
  currentUser?: UserProfileData | null;
  onLogin: () => void;
  onLogout: () => void;
  onOpenSettings?: () => void;
  activePage: DashboardPage;
  onNavigate: (page: DashboardPage) => void;
}) {
  const isAdmin = currentUser?.role === "ADMIN" || currentUser?.username === "admin";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/95 shadow-sm backdrop-blur">
        <div className="h-1.5 bg-gradient-to-r from-[#0b2344] via-[#123f76] to-[#0b6692]" />
        <div className="mx-auto flex max-w-[1800px] items-start gap-3 px-4 py-3 sm:px-6">
          <nav aria-label="Platform modules" className="flex min-w-0 flex-1 items-start gap-2">
            <button
              onClick={() => onNavigate("overview")}
              className={`flex min-h-12 w-24 shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-3 text-[14px] font-semibold transition sm:w-28 ${
                activePage === "overview"
                  ? "bg-gradient-to-r from-[#123f76] to-[#0b6692] text-white shadow-md shadow-blue-950/20"
                  : "border border-transparent text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-[#123f76]"
              }`}
            >
              <House className="shrink-0" size={18} />
              <span>Home</span>
            </button>

            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {baseModules.slice(1).map(([id, label, Icon, enabled]) => {
                const selected = id === activePage;
                return (
                  <button
                    key={id}
                    disabled={!enabled}
                    onClick={() => enabled && onNavigate(id as DashboardPage)}
                    className={`flex min-h-12 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold leading-5 transition ${
                      selected
                        ? "bg-gradient-to-r from-[#123f76] to-[#0b6692] text-white shadow-md shadow-blue-950/20"
                        : "border border-transparent text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-[#123f76]"
                    }`}
                  >
                    <Icon className="shrink-0" size={18} />
                    <span className="line-clamp-2">{label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => onNavigate("admin_users")}
                className={`flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-3.5 py-3 text-[13px] font-bold transition shadow-xs ${
                  activePage === "admin_users"
                    ? "bg-purple-800 text-white shadow-md"
                    : "border border-purple-300 bg-purple-100 text-purple-950 hover:bg-purple-200"
                }`}
                title="Open Admin User Management Console"
              >
                <Users className="shrink-0 text-purple-700" size={18} />
                <span>User Control (Admin)</span>
              </button>
            )}

            {authenticated && (
              <button
                onClick={onOpenSettings}
                className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50 transition shadow-xs"
                title="Open Account Settings"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100 text-lg">
                  {currentUser?.avatar_url || (isAdmin ? "🛡️" : "👨‍🔬")}
                </span>
                <div className="hidden lg:block text-xs">
                  <p className="font-bold text-navy-950 leading-none">{currentUser?.full_name || currentUser?.username || "Scientist"}</p>
                  <span className={`text-[10px] font-extrabold uppercase flex items-center gap-0.5 mt-0.5 ${isAdmin ? "text-purple-800" : "text-emerald-800"}`}>
                    <Shield size={10} />
                    {currentUser?.role || (isAdmin ? "ADMIN" : "SCIENTIST")}
                  </span>
                </div>
                <Settings size={16} className="text-slate-400" />
              </button>
            )}

            <button
              onClick={authenticated ? onLogout : onLogin}
              className="flex min-h-12 shrink-0 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm font-semibold text-[#123f76] transition hover:border-sky-300 hover:bg-sky-100"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">{authenticated ? "Sign out" : "Sign in"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
