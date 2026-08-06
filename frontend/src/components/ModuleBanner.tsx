import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function ModuleBanner({
  icon: Icon,
  eyebrow,
  title,
  description,
  aside,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-blue-950/30 bg-gradient-to-br from-[#0b2344] via-[#123f76] to-[#0b6692] px-7 py-8 shadow-panel sm:px-9">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-1/3 h-48 w-48 rounded-full bg-cyan-200/15 blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 text-cyan-200">
            <Icon size={18} />
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">{eyebrow}</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-100">{description}</p>
        </div>
        {aside}
      </div>
    </section>
  );
}
