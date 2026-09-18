const BASE = '/api';
const TOKEN_KEY = 'sme-auth-token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    // Let the app-level auth state react (redirect to /login) without this
    // module needing to know about React/router - it just announces the fact.
    window.dispatchEvent(new Event('sme:unauthorized'));
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // response wasn't JSON; fall back to statusText
    }
    throw new Error(`${res.status} ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function login(username, password) {
  const result = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  setToken(result.token);
  return result.user;
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' });
  } finally {
    clearToken();
  }
}

export function getMe() {
  return request('/auth/me');
}

export function listUsers() {
  return request('/users');
}

export function createUser(username, password, role) {
  return request('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role }),
  });
}

export function updateUser(id, changes) {
  return request(`/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
}

export function deleteUser(id) {
  return request(`/users/${id}`, { method: 'DELETE' });
}

export function listDocuments() {
  return request('/documents');
}

export function getDocument(id) {
  return request(`/documents/${id}`);
}

export function uploadDocument(file) {
  const form = new FormData();
  form.append('file', file, file.name);
  return request('/documents', { method: 'POST', body: form });
}

export function deleteDocument(id) {
  return request(`/documents/${id}`, { method: 'DELETE' });
}

export function documentImageUrl(id) {
  // Plain <img src> tags can't carry an Authorization header, so the token
  // rides in the query string here specifically - see auth.py's get_current_user.
  const token = getToken();
  return `${BASE}/documents/${id}/image${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

export function detectPreview(blob, domain, signal) {
  const form = new FormData();
  form.append('file', blob, 'frame.jpg');
  return request(`/documents/detect-preview?domain=${encodeURIComponent(domain)}`, {
    method: 'POST',
    body: form,
    signal,
  });
}

export function listInvoices() {
  return request('/invoices');
}

export function processInvoice(file) {
  const form = new FormData();
  form.append('file', file, file.name);
  return request('/invoices/process', { method: 'POST', body: form });
}

export function flagInvoiceField(id, field, confirmed) {
  return request(`/invoices/${id}/flag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, confirmed }),
  });
}

export function getSystemStatus() {
  return request('/system/status');
}

export function getEmailAuthStatus() {
  return request('/emails/auth/status');
}

export function getEmailAuthUrl() {
  return request('/emails/auth/url');
}

export function syncEmails() {
  return request('/emails/sync', { method: 'POST' });
}

export function listEmails() {
  return request('/emails');
}

export function getEmail(id) {
  return request(`/emails/${id}`);
}

export function classifyEmail(id) {
  return request(`/emails/${id}/classify`, { method: 'POST' });
}

export function summarizeEmail(id) {
  return request(`/emails/${id}/summarize`, { method: 'POST' });
}

export function draftEmail(id) {
  return request(`/emails/${id}/draft`, { method: 'POST' });
}

export function sendEmail(id, body) {
  return request(`/emails/${id}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}
