import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  Lock,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import React, { useState } from "react";
import { UserProfileData, api } from "../../api/client";

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfileData | null;
  onProfileUpdated: (updated: UserProfileData) => void;
}

const PRESET_AVATARS = [
  "🧪", "🔬", "🧬", "💊", "🧫", "📊", "👨‍🔬", "👩‍🔬", "🛡️", "⭐"
];

export function UserSettingsModal({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
}: UserSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");

  // Profile Form State
  const [fullName, setFullName] = useState(currentUser?.full_name || "");
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || "👨‍🔬");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage(null);

    try {
      const updated = await api.updateProfile({
        full_name: fullName,
        avatar_url: avatarUrl,
      });
      onProfileUpdated(updated);
      setProfileMessage({ type: "success", text: "Profile settings updated successfully!" });
    } catch (err: any) {
      setProfileMessage({ type: "error", text: err.message || "Failed to update profile." });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New password and confirm password do not match." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "New password must be at least 6 characters long." });
      return;
    }

    setPasswordSaving(true);
    setPasswordMessage(null);

    try {
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordMessage({ type: "success", text: "Password changed successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMessage({ type: "error", text: err.message || "Failed to change password." });
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800 font-bold">
              {currentUser?.avatar_url || "👤"}
            </div>
            <div>
              <h3 className="text-base font-bold text-navy-950">User Account Settings</h3>
              <p className="text-xs font-semibold text-slate-500">{currentUser?.username} ({currentUser?.role})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold transition ${
              activeTab === "profile"
                ? "border-cyan-600 text-cyan-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <User size={15} />
            My Profile
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold transition ${
              activeTab === "security"
                ? "border-cyan-600 text-cyan-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <KeyRound size={15} />
            Security &amp; Password
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {activeTab === "profile" ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileMessage && (
                <div
                  className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
                    profileMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {profileMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {profileMessage.text}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. John Doe"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Select Profile Avatar Badge
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_AVATARS.map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => setAvatarUrl(emoji)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition ${
                        avatarUrl === emoji
                          ? "bg-cyan-100 border-2 border-cyan-600 shadow-xs"
                          : "bg-slate-100 border border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2 text-xs font-bold text-white hover:bg-cyan-800 disabled:opacity-50"
                >
                  {profileSaving ? <LoaderCircle className="animate-spin" size={15} /> : <ShieldCheck size={15} />}
                  Save Profile Changes
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordMessage && (
                <div
                  className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
                    passwordMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {passwordMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {passwordMessage.text}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  New Password (min 6 characters)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2 text-xs font-bold text-white hover:bg-cyan-800 disabled:opacity-50"
                >
                  {passwordSaving ? <LoaderCircle className="animate-spin" size={15} /> : <Lock size={15} />}
                  Update Password
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
