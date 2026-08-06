import { FormEvent, useState } from "react";
import { ArrowLeft, Loader2, LockKeyhole } from "lucide-react";
import { api } from "../../api/client";

type Props = { onAuthenticated: (token: string, user?: any) => void; onCancel: () => void };

export function LoginPage({onAuthenticated, onCancel}: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try { const result = await api.login(username, password); onAuthenticated(result.token, result.user); }
    catch { setError("Invalid username or password."); } finally { setLoading(false); }
  }
  return <main className="grid min-h-[calc(100vh-9rem)] place-items-center bg-slate-50 p-6">
    <section className="w-full max-w-md">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-panel">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-cyan-50 text-cyan-600"><LockKeyhole /></span>
        <h2 className="mt-6 text-2xl font-bold text-navy-950">Sign in to open this module</h2><p className="mt-2 text-sm text-slate-500">Use the account provided by your platform administrator.</p>
        <label className="mt-7 block text-sm font-semibold text-slate-700">Username<input autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3.5 py-3 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-50" /></label>
        <label className="mt-4 block text-sm font-semibold text-slate-700">Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3.5 py-3 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-50" /></label>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">{loading && <Loader2 className="animate-spin" size={18}/>} Sign in securely</button>
        <button type="button" onClick={onCancel} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"><ArrowLeft size={16}/>Back to Home</button>
      </form>
    </section>
  </main>;
}
