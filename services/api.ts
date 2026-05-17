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
    console.error(`[API] ✖ NETWORK ERROR on ${method} ${url}`);
    console.error('[API]   Cause:', networkErr?.message ?? networkErr);
    throw new ApiError(`Network error: ${networkErr?.message ?? 'unreachable'}`, 0);
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    console.error(`[API] ✖ Could not parse JSON from ${url} (status ${res.status})`);
    throw new ApiError('Invalid JSON response from server', res.status);
  }

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

export type NotificationHistoryItem = {
  id: string;
  content: string;
  type: string;
  created_at: string;
  responded: boolean;
};

export type JournalTemplate = {
  id: string;
  label: string;
  prompt: string;
};

export type JournalEntry = {
  id: string;
  user_id: string;
  content: string;
  template_id: string | null;
  date: string;
  created_at: string;
};

export type UserStats = {
  current_streak: number;
  longest_streak: number;
  total_responses: number;
  total_notifications: number;
  response_rate: number;
  journal_entries: number;
  badges: Array<{ id: string; label: string; desc: string }>;
};

export type Plan = {
  id: string;
  user_id: string;
  type: 'day' | 'week' | 'month';
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type DailySummary = {
  id: string;
  user_id: string;
  date: string;
  summary: string;
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

  // History — returns server-side list with responded status
  getNotificationHistory: (userId: string) =>
    request<NotificationHistoryItem[]>(`/api/notifications?user_id=${userId}`),

  // Journal
  getJournalTemplates: (userId: string) =>
    request<JournalTemplate[]>(`/api/journal?user_id=${userId}&templates=true`),

  saveJournalEntry: (userId: string, content: string, templateId?: string, date?: string) =>
    request('/api/journal', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        content,
        ...(templateId ? { template_id: templateId } : {}),
        ...(date ? { date } : {}),
      }),
    }),

  getJournalEntries: (userId: string, date: string) =>
    request<JournalEntry[]>(`/api/journal?user_id=${userId}&date=${date}`),

  // Stats & streaks
  getUserStats: (userId: string) =>
    request<UserStats>(`/api/stats?user_id=${userId}`),

  // AI follow-up
  generateFollowUp: (userId: string, notificationId: string) =>
    request<{ follow_up: string }>('/api/generate-follow-up', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, notification_id: notificationId }),
    }),

  // Planning
  getPlan: (userId: string, type: 'day' | 'week' | 'month', date?: string) =>
    request<Plan | null>(`/api/plan?user_id=${userId}&type=${type}${date ? `&date=${date}` : ''}`),

  savePlan: (userId: string, type: 'day' | 'week' | 'month', content: string, date?: string) =>
    request<Plan>('/api/plan', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, type, content, ...(date ? { date } : {}) }),
    }),

  // Daily summary
  getDailySummary: (userId: string) =>
    request<DailySummary | null>(`/api/daily-summary?user_id=${userId}`),

  // Extract intentions from a response
  extractActions: (userId: string, notificationId?: string, responseText?: string) =>
    request<{ actions: string[] }>('/api/extract-actions', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        ...(notificationId ? { notification_id: notificationId } : {}),
        ...(responseText ? { response_text: responseText } : {}),
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

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}
