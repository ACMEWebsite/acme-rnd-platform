export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) { super(message); }
}

export const AUTH_TOKEN_REJECTED_EVENT = "acme:auth-token-rejected";

function handleRejectedToken(response: Response, token: string | null) {
  if (response.status !== 401 || !token) return;
  sessionStorage.removeItem("acme_token");
  window.dispatchEvent(new Event(AUTH_TOKEN_REJECTED_EVENT));
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem("acme_token");
  const isFormData = options.body instanceof FormData;
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(!isFormData ? {"Content-Type": "application/json"} : {}),
      ...(token ? {Authorization: `Token ${token}`} : {}),
      ...options.headers,
    },
  });
  handleRejectedToken(response, token);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.detail === "string" ? body.detail : "The request could not be completed.";
    throw new ApiError(message, response.status, body);
  }
  return body as T;
}

export const api = {
  login: (username: string, password: string) => request<{token: string}>("/api/v1/auth/token/", {method: "POST", body: JSON.stringify({username, password})}),
  simulateDissolution: <T>(payload: unknown) => request<T>("/api/v1/dissolution/simulate/", {method: "POST", body: JSON.stringify(payload)}),
  predictPharmacokinetics: <T>(payload: unknown) => request<T>("/api/v1/pharmacokinetics/predict/", {method: "POST", body: JSON.stringify(payload)}),
  searchPsg: <T>(query: string) => request<T>(`/api/v1/pharmacokinetics/psg/search/?q=${encodeURIComponent(query)}`),
  fetchPsgDocument: async (id: number | null, pdfUrl: string) => {
    const token = sessionStorage.getItem("acme_token");
    const path = id
      ? `/api/v1/pharmacokinetics/psg/${id}/document/`
      : `/api/v1/pharmacokinetics/psg/document/?url=${encodeURIComponent(pdfUrl)}`;
    const response = await fetch(path, {
      headers: token ? {Authorization: `Token ${token}`} : {},
    });
    handleRejectedToken(response, token);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ApiError(body?.detail ?? "The guidance document could not be loaded.", response.status, body);
    }
    return response.blob();
  },
  analyzeLiterature: <T>(files: File[]) => {
    const body = new FormData();
    files.forEach((file) => body.append("files", file));
    return request<T>("/api/v1/literature/documents/analyze/", {
      method: "POST",
      body,
    });
  },
  askLiterature: <T>(payload: unknown) =>
    request<T>("/api/v1/literature/chat/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteLiteratureWorkspace: (workspaceId: number) =>
    request<void>(`/api/v1/literature/workspaces/${workspaceId}/`, {
      method: "DELETE",
    }),
  characterizationCatalog: <T>() => request<T>("/api/v1/characterization/catalog/"),
  searchCharacterization: <T>(query: string) => request<T>(`/api/v1/characterization/search/?query=${encodeURIComponent(query)}`),
  runCharacterization: <T>(payload: unknown) => request<T>("/api/v1/characterization/runs/", {method: "POST", body: JSON.stringify(payload)}),
  excipientCatalog: <T>() => request<T>("/api/v1/preformulation/excipients/"),
  runCompatibility: <T>(payload: unknown) => request<T>("/api/v1/preformulation/compatibility/runs/", {method: "POST", body: JSON.stringify(payload)}),
  orangeBook: <T>(query: string) => request<T>(`/api/v1/registries/orange-book/?query=${encodeURIComponent(query)}`),
  inactiveIngredients: <T>(query: string) => request<T>(`/api/v1/registries/iid/?query=${encodeURIComponent(query)}`),
  dailyMed: <T>(query: string) => request<T>(`/api/v1/registries/dailymed/?query=${encodeURIComponent(query)}`),
  dailyMedDetails: <T>(setid: string) => request<T>(`/api/v1/registries/dailymed/${encodeURIComponent(setid)}/`),
  mhra: <T>(query: string, documentTypes: string[]) => request<T>(`/api/v1/registries/mhra/?query=${encodeURIComponent(query)}&${documentTypes.map(t=>`document_types=${encodeURIComponent(t)}`).join("&")}`),
  fetchRegistryDocument: async (documentUrl: string) => {
    const token = sessionStorage.getItem("acme_token");
    const paths = [
      `/api/v1/registries/document/?url=${encodeURIComponent(documentUrl)}`,
      `/dev-registry-document/?url=${encodeURIComponent(documentUrl)}`,
    ];

    let lastStatus = 502;
    for (const path of paths) {
      const response = await fetch(path, {
        headers: path.startsWith("/api/") && token ? {Authorization: `Token ${token}`} : {},
      });
      if (path.startsWith("/api/")) handleRejectedToken(response, token);
      lastStatus = response.status;
      if (response.ok && response.headers.get("content-type")?.toLowerCase().includes("application/pdf")) {
        return response.blob();
      }
    }

    throw new ApiError("The registry document could not be loaded.", lastStatus);
  },
  analyzeStability: <T>(payload: unknown) => request<T>("/api/v1/doe/stability/analyze/", {method:"POST",body:JSON.stringify(payload)}),
  generateDoe: <T>(payload: unknown) => request<T>("/api/v1/doe/designs/", {method:"POST",body:JSON.stringify(payload)}),
  rankDoe: <T>(payload: unknown) => request<T>("/api/v1/doe/rank/", {method:"POST",body:JSON.stringify(payload)}),
};
