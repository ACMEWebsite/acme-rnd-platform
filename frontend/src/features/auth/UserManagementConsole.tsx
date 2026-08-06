import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { UserProfileData, api } from "../../api/client";
import { ModuleBanner } from "../../components/ModuleBanner";

export function UserManagementConsole({
  currentUser,
  onRequireLogin,
}: {
  currentUser?: UserProfileData | null;
  onRequireLogin?: () => void;
}) {
  const [users, setUsers] = useState<UserProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Create Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "SCIENTIST">("SCIENTIST");
  const [creating, setCreating] = useState(false);

  // Reset Password State
  const [resetTargetUser, setResetTargetUser] = useState<UserProfileData | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  // Delete User State
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserProfileData | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (currentUser?.role !== "SCIENTIST") {
      void loadUsers();
    }
  }, [currentUser]);

  if (currentUser && currentUser.role === "SCIENTIST") {
    return (
      <div className="min-h-[80vh] bg-slate-50 p-6 flex items-center justify-center">
        <div className="max-w-md text-center bg-white p-8 rounded-2xl border border-slate-200 shadow-xl space-y-4">
          <ShieldAlert size={48} className="mx-auto text-amber-500" />
          <h3 className="text-xl font-bold text-navy-950">Scientist Portal — Access Restricted</h3>
          <p className="text-xs text-slate-500 leading-5">
            User Management &amp; Account Control is reserved exclusively for System Administrators. As a Scientist, you have full access to all R&amp;D research modules (Literature, Stability, DOE, PK, Registries).
          </p>
        </div>
      </div>
    );
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await api.adminListUsers();
      setUsers(data);
      setError("");
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) {
        setError("Admin session expired or unauthenticated. Please sign in as an Administrator.");
      } else {
        setError(err.message || "Failed to load platform users.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSuccessMsg("");

    try {
      const created = await api.adminCreateUser({
        username,
        password,
        full_name: fullName,
        email,
        role,
      });
      setSuccessMsg(`User '${created.username}' created successfully!`);
      setUsername("");
      setPassword("");
      setFullName("");
      setEmail("");
      setShowCreateForm(false);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to create user.");
      await loadUsers();
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleStatus(user: UserProfileData) {
    try {
      const targetId = user.user_id || user.id;
      const updated = await api.adminToggleUserStatus(targetId);
      setUsers(users.map((u) => (u.id === updated.id || u.user_id === updated.user_id ? updated : u)));
      setSuccessMsg(`Status for '${updated.username}' updated.`);
    } catch (err: any) {
      setError(err.message || "Failed to toggle user status.");
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTargetUser) return;
    setResetting(true);
    setError("");
    setSuccessMsg("");

    try {
      const targetId = resetTargetUser.user_id || resetTargetUser.id;
      const res = await api.adminResetPassword(targetId, newPassword);
      setSuccessMsg(res.detail);
      setResetTargetUser(null);
      setNewPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setResetting(false);
    }
  }

  async function handleDeleteUser(user: UserProfileData) {
    setDeleting(true);
    setError("");
    setSuccessMsg("");

    try {
      const targetId = user.user_id || user.id;
      const res = await api.adminDeleteUser(targetId);
      setSuccessMsg(res.detail || `User account '${user.username}' deleted permanently.`);
      setDeleteTargetUser(null);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to delete user.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <ModuleBanner
          icon={Users}
          eyebrow="System Administration"
          title="User & Access Control Console"
          description="Manage scientist & admin accounts, assign roles, create user credentials, and control access permissions across the ACME R&D Platform."
        />

        {/* Notifications */}
        {error && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900 shadow-xs">
            <div className="flex items-center gap-3">
              <ShieldAlert size={22} className="text-amber-600 shrink-0" />
              <span>{error}</span>
            </div>
            {onRequireLogin && (
              <button
                onClick={onRequireLogin}
                className="shrink-0 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:brightness-110 transition flex items-center gap-2"
              >
                <LockKeyhole size={16} />
                Sign in as Administrator
              </button>
            )}
          </div>
        )}
        {successMsg && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <CheckCircle2 size={18} />
            {successMsg}
          </div>
        )}

        {/* Control Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
          <div>
            <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
              <ShieldCheck size={20} className="text-cyan-700" />
              Registered Accounts ({users.length})
            </h3>
            <p className="text-xs text-slate-500 font-medium">Manage user credentials and role authorizations</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void loadUsers()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh List
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-800 shadow-md transition"
            >
              <UserPlus size={15} />
              {showCreateForm ? "Close Create Form" : "Create New User"}
            </button>
          </div>
        </div>

        {/* Create User Form Section */}
        {showCreateForm && (
          <form
            onSubmit={handleCreateUser}
            className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-6 shadow-panel space-y-4"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-cyan-950 border-b border-cyan-200 pb-3">
              <UserPlus size={18} className="text-cyan-700" />
              Create New Platform User
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. dr_smith"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">
                  Initial Password *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Jane Smith"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. jsmith@acme.com"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">
                  User Role *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "ADMIN" | "SCIENTIST")}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-cyan-500"
                >
                  <option value="SCIENTIST">Scientist (Standard R&amp;D User)</option>
                  <option value="ADMIN">Admin (Full System Administrator)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2 text-xs font-bold text-white hover:bg-cyan-800 disabled:opacity-50"
              >
                {creating ? <LoaderCircle className="animate-spin" size={15} /> : <UserPlus size={15} />}
                Submit &amp; Register User
              </button>
            </div>
          </form>
        )}

        {/* Users Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-lg border border-slate-200">
                          {user.avatar_url || (user.role === "ADMIN" ? "🛡️" : "👨‍🔬")}
                        </span>
                        <div>
                          <p className="font-bold text-navy-950 text-sm">{user.full_name || user.username}</p>
                          <p className="text-[11px] text-slate-400">{user.email || "No email"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-700">{user.username}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          user.role === "ADMIN"
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : "bg-cyan-100 text-cyan-800 border border-cyan-200"
                        }`}
                      >
                        <Shield size={12} />
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          user.is_active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {user.is_active ? <UserCheck size={12} /> : <UserX size={12} />}
                        {user.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(user.date_joined).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setResetTargetUser(user)}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                          title="Reset User Password"
                        >
                          <KeyRound size={13} />
                          Reset Password
                        </button>
                        <button
                          onClick={() => void handleToggleStatus(user)}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                            user.is_active
                              ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
                        </button>

                        {user.username !== currentUser?.username && user.username !== "admin" && (
                          <button
                            onClick={() => setDeleteTargetUser(user)}
                            className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100 transition shadow-2xs"
                            title="Permanently Delete User Account"
                          >
                            <Trash2 size={13} />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reset Password Modal */}
        {resetTargetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
                <KeyRound size={18} className="text-cyan-700" />
                Reset Password for '{resetTargetUser.username}'
              </h3>
              <p className="mt-1 text-xs text-slate-500">Enter a new temporary password for this user account.</p>

              <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-cyan-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetTargetUser(null)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetting}
                    className="flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2 text-xs font-bold text-white hover:bg-cyan-800 disabled:opacity-50"
                  >
                    {resetting ? <LoaderCircle className="animate-spin" size={15} /> : <KeyRound size={15} />}
                    Reset Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTargetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-red-700">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700">
                  <Trash2 size={22} />
                </span>
                <h4 className="text-lg font-bold text-navy-950">Delete User Account</h4>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete user account{" "}
                <strong className="text-slate-900 font-mono">{deleteTargetUser.username}</strong> ({deleteTargetUser.full_name || deleteTargetUser.email || "Scientist"})?
              </p>
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <span>Warning: This action will permanently remove the user credentials from the system.</span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetUser(null)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleDeleteUser(deleteTargetUser)}
                  className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 shadow-xs"
                >
                  {deleting ? <LoaderCircle className="animate-spin" size={15} /> : <Trash2 size={15} />}
                  Permanently Delete User
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
