import {
  ArrowRight,
  BarChart3,
  Beaker,
  BookOpen,
  CircleCheckBig,
  Database,
  Droplets,
  FlaskConical,
  Gauge,
  LineChart,
  Microscope,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { DashboardPage } from "../../layout/DashboardLayout";

type Module = {
  page: DashboardPage;
  title: string;
  description: string;
  icon: typeof Database;
  surface: string;
  iconTone: string;
  buttonTone: string;
};

const modules: Module[] = [
  {
    page: "registries",
    title: "Drug Reference & Approval Registries",
    description: "Collect reference listed drug and regulatory information for development decisions.",
    icon: Database,
    surface: "border-violet-200 bg-gradient-to-br from-violet-50 via-white to-violet-100/70",
    iconTone: "bg-violet-700",
    buttonTone: "bg-violet-700 hover:bg-violet-800",
  },
  {
    page: "characterization",
    title: "API Characterization",
    description: "Search API physicochemical properties from trusted source records.",
    icon: Beaker,
    surface: "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-sky-100/70",
    iconTone: "bg-sky-700",
    buttonTone: "bg-sky-700 hover:bg-sky-800",
  },
  {
    page: "literature",
    title: "Literature Review",
    description: "Review uploaded publications with local extraction and page-cited evidence.",
    icon: BookOpen,
    surface: "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70",
    iconTone: "bg-emerald-700",
    buttonTone: "bg-emerald-700 hover:bg-emerald-800",
  },
  {
    page: "pharmacokinetics",
    title: "Pharmacokinetics",
    description: "Predict pharmacokinetic and toxicity profiles for early development decisions.",
    icon: Gauge,
    surface: "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-100/70",
    iconTone: "bg-amber-500 text-navy-950",
    buttonTone: "bg-amber-400 text-navy-950 hover:bg-amber-500",
  },
  {
    page: "preformulation",
    title: "Drug–Excipient Compatibility",
    description: "Assess API–excipient interactions and identify formulation compatibility risks.",
    icon: FlaskConical,
    surface: "border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-fuchsia-100/70",
    iconTone: "bg-fuchsia-700",
    buttonTone: "bg-fuchsia-700 hover:bg-fuchsia-800",
  },
  {
    page: "stability",
    title: "Stability Data Extrapolation",
    description: "Estimate shelf life and extrapolate future quality responses from stability study data.",
    icon: LineChart,
    surface: "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-100/70",
    iconTone: "bg-blue-800",
    buttonTone: "bg-blue-800 hover:bg-blue-900",
  },
  {
    page: "doe",
    title: "DOE Optimization",
    description: "Build factorial designs, evaluate experimental responses, and rank optimized formulation conditions.",
    icon: BarChart3,
    surface: "border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-indigo-100/70",
    iconTone: "bg-indigo-700",
    buttonTone: "bg-indigo-700 hover:bg-indigo-800",
  },
  {
    page: "dissolution",
    title: "Dissolution Behavior Prediction",
    description: "Simulate dissolution profiles and compare reference dissolution behaviour.",
    icon: Droplets,
    surface: "border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-cyan-100/70",
    iconTone: "bg-cyan-700",
    buttonTone: "bg-cyan-700 hover:bg-cyan-800",
  },
];

const values = [
  { title: "Quality", subtitle: "Our Commitment", icon: ShieldCheck },
  { title: "Innovation", subtitle: "Driven by Science", icon: Microscope },
  { title: "Collaboration", subtitle: "Stronger Together", icon: Users },
  { title: "Excellence", subtitle: "In Everything We Do", icon: CircleCheckBig },
];

export function HomePage({ onNavigate }: { onNavigate: (page: DashboardPage) => void }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="relative overflow-hidden rounded-2xl border border-blue-950/40 bg-gradient-to-br from-[#0b2344] via-[#123f76] to-[#0b6692] px-7 py-9 shadow-panel sm:px-10">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-sky-300/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 right-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-3 rounded-xl border border-cyan-200/25 bg-white/10 px-4 py-3 shadow-sm">
              <Sparkles className="text-cyan-200" size={22} />
              <div className="text-xl font-extrabold uppercase tracking-[.12em] text-white sm:text-2xl lg:text-3xl">
                ACME R&amp;D <span className="text-cyan-200">Intelligence</span>
              </div>
            </div>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
              Advancing Health
              <br />
              Through <span className="text-cyan-300">Research &amp; Innovation</span>
            </h1>
            <p className="mt-5 max-w-4xl text-sm leading-7 text-sky-100/90">
              ACME Laboratories Ltd. delivers high-quality pharmaceutical solutions through science, collaboration,
              innovation, and engineering excellence.
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <article
                key={module.page}
                className="flex min-h-64 flex-col rounded-2xl border border-sky-200 bg-gradient-to-br from-white via-sky-50/80 to-blue-100/70 p-6 shadow-panel transition hover:-translate-y-1 hover:border-sky-300 hover:shadow-lg"
              >
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#123f76] to-[#0b6692] text-white shadow-sm">
                  <Icon size={27} />
                </span>
                <h2 className="mt-5 text-lg font-bold text-navy-900">{module.title}</h2>
                <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{module.description}</p>
                <button
                  onClick={() => onNavigate(module.page)}
                  className="home-module-action mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#123f76] to-[#0b6692] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-[#0b2f5a] hover:to-[#085477]"
                >
                  Open module <ArrowRight size={17} />
                </button>
              </article>
            );
          })}
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl bg-gradient-to-r from-[#0b2344] via-[#123f76] to-[#0b6692] px-5 py-7 shadow-panel">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <div
                  key={value.title}
                  className={`flex items-center justify-center gap-4 px-4 text-left ${
                    index > 0 ? "lg:border-l lg:border-cyan-300/30" : ""
                  }`}
                >
                  <Icon className="shrink-0 text-white" size={34} />
                  <div>
                    <strong className="block text-sm text-white">{value.title}</strong>
                    <span className="text-xs text-cyan-100">{value.subtitle}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="py-6 text-center text-xs text-slate-500">
          © 2026 ACME Laboratories Ltd. — Research &amp; Development Division.
        </footer>
      </div>
    </div>
  );
}
