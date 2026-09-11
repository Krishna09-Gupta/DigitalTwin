const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  if(response.status===401){
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
    return;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }

  return data;
}

export const api = {
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
      }),
    }),

  logout: () =>
    request('/auth/logout', {
      method: 'POST',
    }),

  recoveryQuestion: (username) =>
    request('/auth/recovery/question', {
      method: 'POST',
      body: JSON.stringify({
        username,
      }),
    }),

  recoveryReset: (body) =>
    request('/auth/recovery/reset', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  changePassword: (body) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  stations: () =>
    request('/stations'),

  metrics: (stationId) =>
    request(
      `/metrics${
        stationId ? `?station_id=${stationId}` : ''
      }`
    ),

  logistics: (stationId) =>
    request(
      `/logistics${
        stationId ? `?station_id=${stationId}` : ''
      }`
    ),

  emergencyAlerts: () =>
    request('/emergency/active-alerts'),

  override: (body) =>
    request('/admin/override', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  release: (body) =>
    request('/admin/release', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  emergency: (body) =>
    request('/emergency/override', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  rollbackEmergency: (body) =>
    request('/admin/emergency/rollback', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  propose: (body) =>
    request('/scientist/request-change', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  
  myRequests:()=> 
    request('/scientist/my-requests'),

  pending: () =>
    request('/admin/pending-requests'),

  resolve: (body) =>
    request('/admin/resolve-request', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  users: () =>
    request('/admin/users'),

  createScientist: (body) =>
    request('/admin/scientists', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  resetUser: (body) =>
    request('/admin/users/reset-credentials', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  userStatus: (body) =>
    request('/admin/users/status', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  createStation: (body) =>
    request('/admin/stations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  audit: () =>
    request('/admin/audit-logs'),
};

export const WS_URL =
  import.meta.env.VITE_WS_URL ||
  'ws://localhost:3000/ws/telemetry';