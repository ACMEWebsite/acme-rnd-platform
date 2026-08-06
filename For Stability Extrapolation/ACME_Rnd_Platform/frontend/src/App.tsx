import { useEffect, useState } from "react";
import { AUTH_TOKEN_REJECTED_EVENT } from "./api/client";
import { LoginPage } from "./features/auth/LoginPage";
import { DissolutionPage } from "./features/dissolution/DissolutionPage";
import { PharmacokineticsPage } from "./features/pharmacokinetics/PharmacokineticsPage";
import { LiteraturePage } from "./features/literature/LiteraturePage";
import { CharacterizationPage } from "./features/characterization/CharacterizationPage";
import { CompatibilityPage } from "./features/preformulation/CompatibilityPage";
import { RegistriesPage } from "./features/registries/RegistriesPage";
import { DoePage, StabilityPage } from "./features/doe/DoePage";
import { HomePage } from "./features/home/HomePage";
import { DashboardLayout, DashboardPage } from "./layout/DashboardLayout";

export default function App(){
  const [token,setToken]=useState(()=>sessionStorage.getItem("acme_token"));
  const [page,setPage]=useState<DashboardPage>("overview");
  const [loginRequired,setLoginRequired]=useState(false);
  const [requestedPage,setRequestedPage]=useState<DashboardPage | null>(null);
  useEffect(() => {
    function requireFreshLogin(){
      setToken(null);
      setRequestedPage(page);
      setLoginRequired(true);
    }
    window.addEventListener(AUTH_TOKEN_REJECTED_EVENT, requireFreshLogin);
    return () => window.removeEventListener(AUTH_TOKEN_REJECTED_EVENT, requireFreshLogin);
  }, [page]);
  function navigate(nextPage:DashboardPage){
    if(nextPage === "overview" || token){setPage(nextPage);setLoginRequired(false);setRequestedPage(null);return;}
    setRequestedPage(nextPage);setLoginRequired(true);
  }
  function authenticated(value:string){sessionStorage.setItem("acme_token",value);setToken(value);setPage(requestedPage ?? "overview");setRequestedPage(null);setLoginRequired(false);}
  function logout(){sessionStorage.removeItem("acme_token");setToken(null);setPage("overview");setRequestedPage(null);setLoginRequired(false);}
  return <DashboardLayout authenticated={Boolean(token)} onLogin={() => setLoginRequired(true)} onLogout={logout} activePage={page} onNavigate={navigate}>
    {loginRequired && !token
      ? <LoginPage onAuthenticated={authenticated} onCancel={() => {setLoginRequired(false);setRequestedPage(null);setPage("overview");}}/>
      : page === "overview"
      ? <HomePage onNavigate={navigate}/>
      : page === "registries"
      ? <RegistriesPage/>
      : page === "stability"
        ? <StabilityPage/>
      : page === "doe"
        ? <DoePage/>
      : page === "characterization"
      ? <CharacterizationPage/>
      : page === "preformulation"
        ? <CompatibilityPage/>
      : page === "literature"
      ? <LiteraturePage/>
      : page === "pharmacokinetics"
        ? <PharmacokineticsPage/>
        : <DissolutionPage/>}
  </DashboardLayout>;
}
