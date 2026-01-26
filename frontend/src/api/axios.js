// Lightweight fetch-based API client to avoid depending on axios (helps Jest tests)
// Provides a minimal subset of axios-like methods used across the app: get/post/put/delete

const configuredBase = process.env.REACT_APP_API_BASE_URL;
let BASE = '/api';
if (configuredBase) {
  // avoid regex escapes to satisfy ESLint no-useless-escape
  const baseClean = configuredBase.endsWith('/') ? configuredBase.slice(0, -1) : configuredBase;
  BASE = baseClean.endsWith('/api') ? baseClean : baseClean + '/api';
} else if (process.env.NODE_ENV === 'development') {
  // In development use relative `/api` and rely on the CRA dev-server proxy
  // (set to http://localhost:5000 in package.json) to forward requests to
  // the backend. This avoids brittle hostname/port detection and cross-origin
  // connection-refused errors when the frontend and backend are started in
  // different orders or on different local hostnames.
  BASE = '/api';
}

const buildUrl = (path, params) => {
  // normalize BASE without regex
  const baseNoSlash = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  // normalize path by trimming leading slashes without regex
  let p = String(path || '');
  while (p.startsWith('/')) p = p.slice(1);
  let url = path.startsWith('http') ? path : (baseNoSlash + '/' + p);
  if (params && typeof params === 'object') {
    const qp = new URLSearchParams();
    Object.keys(params).forEach(k => {
      const v = params[k];
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) v.forEach(x => qp.append(k, x));
      else qp.append(k, String(v));
    });
    const qs = qp.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  return url;
};

const defaultHeaders = (headers = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const base = { 'Content-Type': 'application/json' };
  if (token) base['Authorization'] = `Bearer ${token}`;
  return { ...base, ...(headers || {}) };
};

const handleResponse = async (resp) => {
  const contentType = resp.headers && resp.headers.get ? resp.headers.get('content-type') : '';
  if (!resp.ok) {
    // Normalize error to mimic axios-like shape: Error with `response` and `response.data`
    const url = resp.url || '';
    if (resp.status === 401) {
      if (!url.includes('/auth/login') && !url.includes('/auth/sessions/logout-others')) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          if (window.location.pathname !== '/login') window.location.href = '/login';
        }
      }
    }
    if (resp.status === 503) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/maintenance') window.location.href = '/maintenance';
    }
    const txt = await resp.text().catch(() => '');
    let parsed = null;
    try { parsed = txt ? JSON.parse(txt) : null; } catch (e) { parsed = null; }
    const err = new Error((parsed && (parsed.message || parsed.error)) || txt || `HTTP ${resp.status}`);
    err.response = { status: resp.status, data: parsed || (txt ? { message: txt } : null), headers: resp.headers };
    return Promise.reject(err);
  }

  if (contentType && contentType.includes('application/json')) {
    return { data: await resp.json(), status: resp.status, headers: resp.headers };
  }
  // blob/arraybuffer
  const blob = await resp.blob();
  return { data: blob, status: resp.status, headers: resp.headers };
};

const client = {
  get: (path, opts = {}) => {
    const url = buildUrl(path, opts.params);
    const headers = defaultHeaders(opts.headers);
    return fetch(url, { method: 'GET', headers, credentials: 'include' }).then(handleResponse);
  },
  post: (path, body, opts = {}) => {
    const url = buildUrl(path, opts.params);
    const isForm = body instanceof FormData;
    const headers = defaultHeaders(isForm ? opts.headers : opts.headers);
    const init = { method: 'POST', headers, credentials: 'include' };
    if (isForm) { init.body = body; delete init.headers['Content-Type']; }
    else init.body = body !== undefined ? (typeof body === 'object' ? JSON.stringify(body) : String(body)) : undefined;
    return fetch(url, init).then(handleResponse);
  },
  put: (path, body, opts = {}) => {
    const url = buildUrl(path, opts.params);
    const isForm = body instanceof FormData;
    const headers = defaultHeaders(isForm ? opts.headers : opts.headers);
    const init = { method: 'PUT', headers, credentials: 'include' };
    if (isForm) { init.body = body; delete init.headers['Content-Type']; }
    else init.body = body !== undefined ? (typeof body === 'object' ? JSON.stringify(body) : String(body)) : undefined;
    return fetch(url, init).then(handleResponse);
  },
  patch: (path, body, opts = {}) => {
    const url = buildUrl(path, opts.params);
    const isForm = body instanceof FormData;
    const headers = defaultHeaders(isForm ? opts.headers : opts.headers);
    const init = { method: 'PATCH', headers, credentials: 'include' };
    if (isForm) { init.body = body; delete init.headers['Content-Type']; }
    else init.body = body !== undefined ? (typeof body === 'object' ? JSON.stringify(body) : String(body)) : undefined;
    return fetch(url, init).then(handleResponse);
  },
  delete: (path, opts = {}) => {
    const url = buildUrl(path, opts.params);
    const data = opts.data;
    // If a body is provided, include it in the DELETE request
    if (data !== undefined) {
      const isForm = data instanceof FormData;
      const headers = defaultHeaders(isForm ? opts.headers : opts.headers);
      const init = { method: 'DELETE', headers, credentials: 'include' };
      if (isForm) { init.body = data; delete init.headers['Content-Type']; }
      else init.body = typeof data === 'object' ? JSON.stringify(data) : String(data);
      return fetch(url, init).then(handleResponse);
    }
    const headers = defaultHeaders(opts.headers);
    return fetch(url, { method: 'DELETE', headers, credentials: 'include' }).then(handleResponse);
  }
};

// Helpers for export requests: POST returning binary blob with filename parsing
const sanitizeFilename = (name) => {
  if (!name) return 'export.bin';
  // remove path-like parts, control chars, quotes
  let s = String(name).replace(/\0/g, '');
  // remove ../ and backslashes
  s = s.replace(/\.\.\//g, '');
  s = s.replace(/\\\\/g, '');
  // replace control chars and dangerous filename characters with underscore
  // avoid using control-character regex sequences which ESLint may flag
  s = s.split('').map(ch => {
    const code = ch.charCodeAt(0);
    if (code <= 31 || code === 127) return '_';
    if ('"<>:/\\|?*'.includes(ch)) return '_';
    return ch;
  }).join('');
  s = s.replace(/\s+/g, '_');
  // trim and limit length
  s = s.trim().slice(0, 200);
  if (!s) return 'export.bin';
  return s;
};

const parseContentDisposition = (cd) => {
  if (!cd) return null;
  // filename*=UTF-8''encoded or filename="name"
  const mStar = cd.match(/filename\*=(?:UTF-8'')?([^;\n]+)/i);
  if (mStar && mStar[1]) return decodeURIComponent(mStar[1].replace(/\x22/g, '').trim());
  const m = cd.match(/filename="?([^;\n"]+)"?/i);
  if (m && m[1]) return m[1].replace(/\x22/g, '').trim();
  return null;
};

// Minimal toast fallback: inject DOM toast if no app-level toast system exists
const showToast = (msg, type = 'error') => {
  try {
    const id = 'app-export-toast';
    let container = document.getElementById(id);
    if (!container) {
      container = document.createElement('div');
      container.id = id;
      container.style.position = 'fixed';
      container.style.right = '20px';
      container.style.bottom = '20px';
      container.style.zIndex = 99999;
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.background = type === 'error' ? '#ef4444' : '#10b981';
    el.style.color = '#fff';
    el.style.padding = '10px 14px';
    el.style.marginTop = '8px';
    el.style.borderRadius = '6px';
    el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 5000);
  } catch (e) {
    // fallback
    try { alert(msg); } catch (e2) { /* ignore */ }
  }
};

client.exportPost = async (path, body, opts = {}) => {
  const url = buildUrl(path, opts.params);
  const headers = defaultHeaders(opts.headers);
  const init = { method: 'POST', headers, credentials: 'include' };
  if (body !== undefined) init.body = typeof body === 'object' ? JSON.stringify(body) : String(body);
  const resp = await fetch(url, init);
  // handle non-OK responses with JSON error if possible
  if (!resp.ok) {
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const js = await resp.json().catch(() => null);
      const msg = (js && (js.message || js.error || js.msg)) ? (js.message || js.error || js.msg) : `Lỗi khi xuất file (${resp.status})`;
      showToast(msg, 'error');
      throw new Error(msg);
    }
    const txt = await resp.text().catch(() => 'Lỗi khi xuất file');
    showToast(txt || `Lỗi khi xuất file (${resp.status})`, 'error');
    throw new Error(txt || `HTTP ${resp.status}`);
  }

  const ct = resp.headers.get('content-type') || '';
  // if server wrongly returned JSON with 200, parse it as JSON error
  if (ct.includes('application/json')) {
    const js = await resp.json().catch(() => null);
    if (js && (js.message || js.error)) {
      const msg = js.message || js.error || 'Lỗi khi xuất file';
      showToast(msg, 'error');
      throw new Error(msg);
    }
    // otherwise return as JSON
    return { data: js, headers: resp.headers };
  }

  // treat as blob
  const blob = await resp.blob();
  // Some servers return JSON error body with 200 and content-type octet-stream; detect JSON
  const textProbe = await blob.text().catch(() => null);
  if (textProbe) {
    try {
      const maybe = JSON.parse(textProbe);
      if (maybe && (maybe.message || maybe.error)) {
        const msg = maybe.message || maybe.error || 'Lỗi khi xuất file';
        showToast(msg, 'error');
        throw new Error(msg);
      }
    } catch (e) {
      // not JSON - proceed
    }
  }

  const cd = resp.headers.get('content-disposition') || resp.headers.get('Content-Disposition') || '';
  const parsed = parseContentDisposition(cd) || '';
  const filename = sanitizeFilename(parsed || opts.filename || 'xanuicam_export.bin');
  return { blob, filename, headers: resp.headers };
};
// expose toast helper
client.showToast = showToast;

export default client;