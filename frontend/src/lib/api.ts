const API_BASE = "/api/v1";

function getAccessToken(): string | null {
  if (typeof window !== "undefined") return localStorage.getItem("harbor_access_token");
  return null;
}

function getRefreshToken(): string | null {
  if (typeof window !== "undefined") return localStorage.getItem("harbor_refresh_token");
  return null;
}

export function setTokens(access: string, refresh: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("harbor_access_token", access);
    localStorage.setItem("harbor_refresh_token", refresh);
  }
}

export function getStoredRefreshToken(): string | null {
  return getRefreshToken();
}

export function clearTokens() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("harbor_access_token");
    localStorage.removeItem("harbor_refresh_token");
  }
}

async function refreshAccessToken(refreshToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
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

  const accessToken = getAccessToken();
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res = await fetch(url, { ...options, headers });

  // If 401, try refresh
  if (res.status === 401) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        headers["Authorization"] = `Bearer ${getAccessToken()}`;
        res = await fetch(url, { ...options, headers });
      }
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
  const accessToken = getAccessToken();
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  const res = await fetch(url, { method: "POST", headers, body: formData });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
};
