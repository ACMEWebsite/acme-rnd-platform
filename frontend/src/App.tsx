import { useEffect, useState } from "react";
import { AUTH_TOKEN_REJECTED_EVENT, UserProfileData, api } from "./api/client";
import { LoginPage } from "./features/auth/LoginPage";
import { UserManagementConsole } from "./features/auth/UserManagementConsole";
import { UserSettingsModal } from "./features/auth/UserSettingsModal";
import { CharacterizationPage } from "./features/characterization/CharacterizationPage";
import { DissolutionPage } from "./features/dissolution/DissolutionPage";
import { DoePage } from "./features/doe/DoePage";
import { HomePage } from "./features/home/HomePage";
import { LiteraturePage } from "./features/literature/LiteraturePage";
import { PharmacokineticsPage } from "./features/pharmacokinetics/PharmacokineticsPage";
import { CompatibilityPage } from "./features/preformulation/CompatibilityPage";
import { RegistriesPage } from "./features/registries/RegistriesPage";
import { StabilityPage } from "./features/stability/StabilityPage";
import { DashboardLayout, DashboardPage } from "./layout/DashboardLayout";

export default function App() {
  const DEV_DISABLE_AUTH = false;
  const [token, setToken] = useState<string | null>(
    () => sessionStorage.getItem("acme_token") || (DEV_DISABLE_AUTH ? "dev_bypass_token" : null),
  );
  const [currentUser, setCurrentUser] = useState<UserProfileData | null>(null);
  const [page, setPage] = useState<DashboardPage>("overview");
  const [loginRequired, setLoginRequired] = useState(false);
  const [requestedPage, setRequestedPage] = useState<DashboardPage | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    if (token && !DEV_DISABLE_AUTH) {
      void api
        .fetchCurrentUser()
        .then(setCurrentUser)
        .catch(() => {
          setToken(null);
          setCurrentUser(null);
        });
    }
  }, [token]);

  useEffect(() => {
    function requireFreshLogin() {
      if (DEV_DISABLE_AUTH) return;
      setToken(null);
      setCurrentUser(null);
      setRequestedPage(page);
      setLoginRequired(true);
    }
    window.addEventListener(AUTH_TOKEN_REJECTED_EVENT, requireFreshLogin);
    return () => window.removeEventListener(AUTH_TOKEN_REJECTED_EVENT, requireFreshLogin);
  }, [page]);

  function navigate(nextPage: DashboardPage) {
    if (DEV_DISABLE_AUTH || nextPage === "overview" || token) {
      setPage(nextPage);
      setLoginRequired(false);
      setRequestedPage(null);
      return;
    }
    setRequestedPage(nextPage);
    setLoginRequired(true);
  }

  function authenticated(value: string, user?: UserProfileData) {
    sessionStorage.setItem("acme_token", value);
    setToken(value);
    if (user) {
      setCurrentUser(user);
      setPage(requestedPage ?? "overview");
      setRequestedPage(null);
      setLoginRequired(false);
    } else {
      void api
        .fetchCurrentUser()
        .then((fetched) => {
          setCurrentUser(fetched);
          setPage(requestedPage ?? "overview");
          setRequestedPage(null);
          setLoginRequired(false);
        })
        .catch(() => {
          setPage(requestedPage ?? "overview");
          setRequestedPage(null);
          setLoginRequired(false);
        });
    }
  }

  function logout() {
    sessionStorage.removeItem("acme_token");
    setToken(DEV_DISABLE_AUTH ? "dev_bypass_token" : null);
    setCurrentUser(null);
    setPage("overview");
    setRequestedPage(null);
    setLoginRequired(false);
  }

  return (
    <>
      <DashboardLayout
        authenticated={DEV_DISABLE_AUTH || Boolean(token)}
        currentUser={currentUser}
        onLogin={() => {
          if (!DEV_DISABLE_AUTH) setLoginRequired(true);
        }}
        onLogout={logout}
        onOpenSettings={() => setShowSettingsModal(true)}
        activePage={page}
        onNavigate={navigate}
      >
        {!DEV_DISABLE_AUTH && loginRequired && !token ? (
          <LoginPage
            onAuthenticated={authenticated}
            onCancel={() => {
              setLoginRequired(false);
              setRequestedPage(null);
              setPage("overview");
            }}
          />
        ) : page === "overview" ? (
          <HomePage onNavigate={navigate} />
        ) : page === "registries" ? (
          <RegistriesPage />
        ) : page === "stability" ? (
          <StabilityPage />
        ) : page === "doe" ? (
          <DoePage />
        ) : page === "characterization" ? (
          <CharacterizationPage />
        ) : page === "preformulation" ? (
          <CompatibilityPage />
        ) : page === "literature" ? (
          <LiteraturePage />
        ) : page === "pharmacokinetics" ? (
          <PharmacokineticsPage />
        ) : page === "admin_users" ? (
          <UserManagementConsole
            currentUser={currentUser}
            onRequireLogin={() => {
              setRequestedPage("admin_users");
              setLoginRequired(true);
            }}
          />
        ) : (
          <DissolutionPage />
        )}
      </DashboardLayout>

      <UserSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currentUser={currentUser}
        onProfileUpdated={(updated) => setCurrentUser(updated)}
      />
    </>
  );
}
