const API_BASE = "https://harbor-api.onrender.com/api/v1";

interface TokenStore {
  accessToken: string | null;
  refreshToken: string | null;
}

const tokens: TokenStore = {
  accessToken: null,
  refreshToken: null,
};

export function setTokens(access: string, refresh: string) {
  tokens.accessToken = access;
  tokens.refreshToken = refresh;
  if (typeof window !== "undefined") {
    localStorage.setItem("harbor_refresh_token", refresh);
  }
}

export function getStoredRefreshToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("harbor_refresh_token");
  }
  return null;
}

export function clearTokens() {
  tokens.accessToken = null;
  tokens.refreshToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("harbor_refresh_token");
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokens.refreshToken || getStoredRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export async function api(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (tokens.accessToken) {
    headers["Authorization"] = `Bearer ${tokens.accessToken}`;
  }

  let res = await fetch(url, { ...options, headers });

  // If 401, try refresh
  if (res.status === 401 && tokens.refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${tokens.accessToken}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  if (res.status === 204) return null;
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return res.json();
  }
  return res;
}

// Convenience methods
export const apiGet = (path: string, params?: Record<string, string>) => {
  const query = params ? "?" + new URLSearchParams(params).toString() : "";
  return api(`${path}${query}`);
};

export const apiPost = (path: string, data?: any) =>
  api(path, {
    method: "POST",
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });

export const apiPut = (path: string, data?: any) =>
  api(path, {
    method: "PUT",
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });

export const apiDelete = (path: string) =>
  api(path, { method: "DELETE" });

export const apiUpload = async (path: string, formData: FormData) => {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {};
  if (tokens.accessToken) {
    headers["Authorization"] = `Bearer ${tokens.accessToken}`;
  }
  const res = await fetch(url, { method: "POST", headers, body: formData });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
};
