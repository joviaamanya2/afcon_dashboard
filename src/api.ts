const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1').replace(/\/$/, '');

export type AdminResource = 'competitions' | 'matches' | 'teams' | 'players' | 'standings' | 'venues' | 'news' | 'events' | 'media' | 'match-events' | 'match-statistics' | 'lineups' | 'community-posts' | 'community-comments' | 'community-reports';
export type RecordData = Record<string, unknown>;

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({})) as RecordData;
  if (!response.ok) {
    throw new ApiError(response.status, String(body.error ?? 'request_failed'), String(body.message ?? 'The request could not be completed.'));
  }
  return body as T;
}

export async function health(): Promise<boolean> {
  try {
    const base = API_URL.replace(/\/api\/v1$/, '');
    const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

export function getOverview(token: string): Promise<{ data: Record<string, number> }> {
  return request('/admin/overview', token);
}

export function getResource(token: string, resource: AdminResource): Promise<{ data: RecordData[] }> {
  return request(`/admin/${resource}?limit=150`, token);
}

export function saveRecord(token: string, resource: AdminResource, value: RecordData, id?: string): Promise<{ data: RecordData }> {
  return request(`/admin/${resource}${id ? `/${encodeURIComponent(id)}` : ''}`, token, {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(value),
  });
}

export function deleteRecord(token: string, resource: AdminResource, id: string): Promise<void> {
  return request(`/admin/${resource}/${encodeURIComponent(id)}`, token, { method: 'DELETE' });
}
