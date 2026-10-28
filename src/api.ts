const API_URL = (
  import.meta.env.VITE_API_URL ??
  `http://${window.location.hostname || 'localhost'}:8080/api/v1`
).replace(/\/$/, '');

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
    let message = typeof body.message === 'string' ? body.message : 'The request could not be completed.';
    const details = body.details;
    if (details && typeof details === 'object' && !Array.isArray(details)) {
      const fieldErrors = (details as RecordData).fieldErrors;
      if (fieldErrors && typeof fieldErrors === 'object' && !Array.isArray(fieldErrors)) {
        const messages = Object.entries(fieldErrors as Record<string, unknown>)
          .flatMap(([field, errors]) => Array.isArray(errors)
            ? errors.filter((error): error is string => typeof error === 'string').map((error) => `${field}: ${error}`)
            : []);
        if (messages.length) message = messages.join(' ');
      }
    }
    throw new ApiError(response.status, String(body.error ?? 'request_failed'), message);
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

export function saveLineupBatch(
  token: string,
  value: {
    matchId: string;
    teamId: string;
    formation: string;
    published: boolean;
    players: Array<{
      playerId: string;
      position: string;
      shirtNumber: number | null;
      isStarting: boolean;
    }>;
  },
): Promise<{ data: RecordData }> {
  return request('/admin/lineups/batch', token, {
    method: 'POST',
    body: JSON.stringify(value),
  });
}

async function uploadImage(token: string, file: File, kind: 'venue' | 'player'): Promise<string> {
  const encoded = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('The venue image could not be read.'));
        return;
      }
      const separator = reader.result.indexOf(',');
      if (separator < 0) {
        reject(new Error('The venue image data is invalid.'));
        return;
      }
      resolve(reader.result.slice(separator + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('The venue image could not be read.'));
    reader.readAsDataURL(file);
  });
  const response = await request<{ data: { url: string } }>(`/admin/${kind}-images`, token, {
    method: 'POST',
    body: JSON.stringify({ mimeType: file.type, data: encoded }),
  });
  return response.data.url;
}

export function uploadVenueImage(token: string, file: File): Promise<string> {
  return uploadImage(token, file, 'venue');
}

export function uploadPlayerImage(token: string, file: File): Promise<string> {
  return uploadImage(token, file, 'player');
}

export function deleteRecord(token: string, resource: AdminResource, id: string): Promise<void> {
  return request(`/admin/${resource}/${encodeURIComponent(id)}`, token, { method: 'DELETE' });
}
