/**
 * One place for every call to the backend.
 *
 * Pages never call fetch directly -- they call these functions. That keeps
 * the token handling and error handling in a single spot.
 */

import type { DnsRecord, HostedZone, ImportResult, Page, RecordType, User } from "./types";

// Trailing slashes are stripped deliberately. Every path below starts with
// "/", so a base of "https://api.example.com/" would produce a double slash.
// Hosts answer that with a redirect, and a CORS preflight is not allowed to
// follow redirects -- which fails as a confusing CORS error rather than a 404.
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
  /\/+$/,
  "",
);

const TOKEN_KEY = "route53-clone-token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

/** An error carrying the HTTP status plus the message the backend sent. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "Cannot reach the API. Is the backend running?");
  }

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    // FastAPI puts the message in "detail", either as a string or,
    // for schema errors, as a list of problems.
    const detail = body?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg).join(", ")
          : `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }

  return body as T;
}

/** Build a query string, leaving out anything empty. */
function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export type ZoneQuery = {
  search?: string;
  type?: string;
  sort?: string;
  order?: string;
  page?: number;
  page_size?: number;
};

export type RecordQuery = ZoneQuery;

export const api = {
  // --- auth ---
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  me: () => request<User>("/api/auth/me"),

  // --- hosted zones ---
  listZones: (params: ZoneQuery) =>
    request<Page<HostedZone>>(`/api/zones${query(params)}`),

  getZone: (id: string) => request<HostedZone>(`/api/zones/${id}`),

  createZone: (body: { name: string; comment: string; type: string }) =>
    request<HostedZone>("/api/zones", { method: "POST", body: JSON.stringify(body) }),

  updateZone: (id: string, comment: string) =>
    request<HostedZone>(`/api/zones/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ comment }),
    }),

  deleteZone: (id: string) => request<void>(`/api/zones/${id}`, { method: "DELETE" }),

  // --- dns records ---
  listRecords: (zoneId: string, params: RecordQuery) =>
    request<Page<DnsRecord>>(`/api/zones/${zoneId}/records${query(params)}`),

  createRecord: (
    zoneId: string,
    body: { name: string; type: string; ttl: number; value: string; routing_policy: string },
  ) =>
    request<DnsRecord>(`/api/zones/${zoneId}/records`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateRecord: (
    zoneId: string,
    recordId: number,
    body: { ttl: number; value: string; routing_policy: string },
  ) =>
    request<DnsRecord>(`/api/zones/${zoneId}/records/${recordId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteRecord: (zoneId: string, recordId: number) =>
    request<void>(`/api/zones/${zoneId}/records/${recordId}`, { method: "DELETE" }),

  // --- bulk operations ---
  bulkDeleteRecords: (zoneId: string, ids: number[]) =>
    request<{ deleted: number; skipped: string[] }>(
      `/api/zones/${zoneId}/records/bulk-delete`,
      { method: "POST", body: JSON.stringify({ ids }) },
    ),

  // --- import / export ---
  importZoneFile: (zoneId: string, content: string, overwrite: boolean) =>
    request<ImportResult>(`/api/zones/${zoneId}/import`, {
      method: "POST",
      body: JSON.stringify({ content, overwrite }),
    }),

  /**
   * Exports are downloaded rather than parsed, so this bypasses request()
   * and returns the raw text with the filename the browser should use.
   */
  exportZone: async (zoneId: string, format: "bind" | "json") => {
    const token = getToken();
    const response = await fetch(`${BASE}/api/zones/${zoneId}/export?format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new ApiError(response.status, "Could not export this zone.");
    }
    return response.text();
  },

  // --- meta ---
  recordTypes: () => request<RecordType[]>("/api/record-types"),
};
