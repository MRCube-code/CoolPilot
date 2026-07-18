import type {
  BoundDevice,
  DeviceDiagnostics,
  DiscoveredDevice,
  StatusResponse,
  SystemDiagnostics,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    // Distinguish "backend unreachable" (most common failure while
    // developing — wrong URL, backend not running, CORS misconfigured)
    // from "backend answered with an error", since the UI should say
    // something different for each.
    throw new ApiError(
      `Can't reach the CoolPilot backend at ${API_BASE}. Is it running? (uvicorn app.main:app --reload --port 8000)`,
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // response wasn't JSON — keep statusText
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),

  discoverDevices: () => request<DiscoveredDevice[]>("/api/devices/discover"),

  listBoundDevices: () => request<BoundDevice[]>("/api/devices"),

  bindDevice: (params: { mac: string; ip: string; cipher_mode: string; name?: string }) =>
    request<{ status: string; mac: string }>("/api/devices/bind", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  forgetDevice: (mac: string) =>
    request<{ status: string; mac: string }>(`/api/devices/${mac}`, { method: "DELETE" }),

  getStatus: (mac: string, fresh = false) =>
    request<StatusResponse>(`/api/devices/${mac}/status?fresh=${fresh}`),

  sendCommand: (mac: string, values: Record<string, number>) =>
    request<Record<string, number>>(`/api/devices/${mac}/command`, {
      method: "POST",
      body: JSON.stringify({ values }),
    }),

  systemDiagnostics: () => request<SystemDiagnostics>("/api/diagnostics"),

  deviceDiagnostics: (mac: string) => request<DeviceDiagnostics>(`/api/devices/${mac}/diagnostics`),
};
