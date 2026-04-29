import { API_BASE } from '../constants/api';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const method = options?.method ?? 'GET';
  const body = options?.body;

  // ── Request log
  console.log(`\n[API] ▶ ${method} ${url}`);
  if (body) {
    try {
      console.log('[API]   Body:', JSON.stringify(JSON.parse(body as string), null, 2));
    } catch {
      console.log('[API]   Body:', body);
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (networkErr: any) {
    // Network-level failure (no connection, wrong IP, server down)
    console.error(`[API] ✖ NETWORK ERROR on ${method} ${url}`);
    console.error('[API]   Cause:', networkErr?.message ?? networkErr);
    throw new ApiError(`Network error: ${networkErr?.message ?? 'unreachable'}`, 0);
  }

  let json: any;
  try {
    json = await res.json();
  } catch (parseErr) {
    console.error(`[API] ✖ Could not parse JSON from ${url} (status ${res.status})`);
    throw new ApiError('Invalid JSON response from server', res.status);
  }

  // ── Response log
  console.log(`[API] ◀ ${res.status} ${url}`);
  console.log('[API]   Response:', JSON.stringify(json, null, 2));

  if (!res.ok) {
    const msg = json?.error ?? json?.message ?? 'Request failed';
    console.error(`[API] ✖ Error ${res.status}: ${msg}`);
    throw new ApiError(msg, res.status);
  }

  return (json as { data: T }).data;
}

// ── Types

export type User = { id: string; name: string; created_at: string };

export type Notification = {
  id: string;
  user_id: string;
  content: string;
  type: string;
  created_at: string;
};

export type WeeklySummaryResponse = {
  data: { id: string; user_id: string; summary: string; created_at: string } | null;
  message?: string;
};

// ── Endpoints

export const api = {
  createUser: (name: string) =>
    request<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  seedIdentity: (payload: {
    user_id: string;
    core_traits: Record<string, string>;
    fulfillment_sources: Record<string, string>;
    frustrations: Record<string, string>;
    current_phase: Record<string, string>;
    anti_patterns: Record<string, string>;
    preferred_identity: string;
  }) =>
    request('/api/seed', { method: 'POST', body: JSON.stringify(payload) }),

  setUserContext: (payload: {
    user_id: string;
    context_json: {
      domains: Record<string, string>;
      current_focus: string;
      constraints: string[];
      values: string[];
      signals_of_progress: string[];
    };
  }) =>
    request('/api/user-context', { method: 'POST', body: JSON.stringify(payload) }),

  registerDeviceToken: (userId: string, token: string) =>
    request('/api/device-token', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, token, platform: 'expo' }),
    }),

  generateNotification: (userId: string, timeOfDay?: string) =>
    request<Notification>('/api/generate-notification', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, time_of_day: timeOfDay }),
    }),

  sendResponse: (userId: string, notificationId: string, responseText: string) =>
    request('/api/respond', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        notification_id: notificationId,
        response_text: responseText,
      }),
    }),

  getWeeklySummary: async (userId: string): Promise<WeeklySummaryResponse> => {
    const url = `${API_BASE}/api/weekly-summary?user_id=${userId}`;
    console.log(`\n[API] ▶ GET ${url}`);
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    const json = await res.json();
    console.log(`[API] ◀ ${res.status} ${url}`);
    console.log('[API]   Response:', JSON.stringify(json, null, 2));
    if (!res.ok) throw new ApiError(json.error ?? 'Request failed', res.status);
    return json as WeeklySummaryResponse;
  },
};

// ── Helpers

export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
