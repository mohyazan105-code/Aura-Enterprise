const API = {
  baseUrl: '/api',
  // ✅ In-flight request deduplication: if the same GET is already pending,
  // re-use its promise instead of firing a second network request
  _inflight: {},

  request: async (endpoint, options = {}) => {
    options.credentials = 'include';
    options.cache = 'no-store';
    options.headers = options.headers || {};
    if (options.body && typeof options.body !== 'string' && !(options.body instanceof FormData)) {
      options.body = JSON.stringify(options.body);
      options.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`${API.baseUrl}${endpoint}`, options);
    if (!res.ok) {
      if (res.status === 401 && !endpoint.startsWith('/auth/')) {
        const error = await res.json().catch(() => ({}));
        if (error.error === 'Authentication required' || error.error === 'Inactive session') {
          if (typeof Auth !== 'undefined') Auth.user = null;
          const mod = document.getElementById('session-modal');
          if (mod) {
              mod.classList.remove('hidden');
          } else if (window.App) {
              window.App.showLogin();
          }
          throw new Error('Session Expired');
        }
      }
      const err = await res.json().catch(() => ({ error: 'An API error occurred' }));
      throw new Error(err.error || `HTTP error! status: ${res.status}`);
    }
    return res.json();
  },

  get: (endpoint) => {
    // Deduplicate in-flight GET requests
    if (API._inflight[endpoint]) return API._inflight[endpoint];
    const promise = API.request(endpoint).finally(() => {
      delete API._inflight[endpoint];
    });
    API._inflight[endpoint] = promise;
    return promise;
  },

  post: (endpoint, body) => API.request(endpoint, { method: 'POST', body }),
  put:  (endpoint, body) => API.request(endpoint, { method: 'PUT',  body }),
  del:  (endpoint)       => API.request(endpoint, { method: 'DELETE' }),
};

const UI = {
  showToast: (msg, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%) scale(0.8)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },
  formatCurrency: (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num || 0),
  formatDate: (str) => {
    if (!str) return '';
    const d = new Date(str);
    return isNaN(d) ? str : d.toLocaleDateString();
  },
  applyDomainTheme: (domainObj) => {
    document.documentElement.style.setProperty('--domain-color', domainObj.color);
    document.documentElement.style.setProperty('--domain-accent', domainObj.accent);
    document.documentElement.style.setProperty('--domain-gradient', domainObj.gradient);

    // Set body data-domain for CSS accent token selectors
    document.body.dataset.domain = domainObj.id || domainObj.name.toLowerCase();

    // Inject a customized radial glow based on the domain's accent color into the dark background
    const hexToRgb = hex => {
      if (!hex || typeof hex !== 'string' || hex.length < 7) return '13, 71, 161'; // safe fallback
      const clean = hex.replace('#', '');
      if (clean.length < 6) return '13, 71, 161';
      let r = parseInt(clean.slice(0, 2), 16);
      let g = parseInt(clean.slice(2, 4), 16);
      let b = parseInt(clean.slice(4, 6), 16);
      if (isNaN(r) || isNaN(g) || isNaN(b)) return '13, 71, 161';
      return `${r}, ${g}, ${b}`;
    };
    const rgbAccent = hexToRgb(domainObj.accent || '#0d47a1');
    document.documentElement.style.setProperty('--bg-dark', `radial-gradient(circle at 10% 10%, rgba(${rgbAccent}, 0.15) 0%, #0f111a 60%)`);

    // Update sb-domain-name safely
    const sbd = document.getElementById('sb-domain-name');
    if (sbd) sbd.innerText = domainObj.name;

    // Update header avatar with user initial if available
    const hdrAvatar = document.getElementById('header-avatar');
    if (hdrAvatar && typeof Auth !== 'undefined' && Auth.user?.name) {
      hdrAvatar.innerText = Auth.user.name.charAt(0).toUpperCase();
    }

    const ldb = document.getElementById('login-domain-badge');
    if (ldb) {
      ldb.innerHTML = `<span id="login-domain-icon">${domainObj.icon}</span> <span id="login-domain-name" data-id="${domainObj.id || domainObj.name.toLowerCase()}">${domainObj.name}</span>`;
    }
    const hcb = document.getElementById('header-domain-chip');
    if (hcb) {
      hcb.innerHTML = `<span id="hdr-domain-icon">${domainObj.icon}</span> <span id="hdr-domain-name">${domainObj.name}</span>`;
    }
  }
};

class ModalController {
  constructor() {
    this.el = document.getElementById('record-modal');
    this.title = document.getElementById('modal-title');
    this.body = document.getElementById('modal-body');
    this.saveBtn = document.getElementById('modal-save-btn');
    this.table = null;
    this.recordId = null;
    this.schema = null;
    this._schemaCache = {};  // Cache schema per table to avoid redundant API calls
  }
  
  async open(table, recordId = null) {
    this.table = table;
    this.recordId = recordId;
    this.title.innerText = recordId ? `Edit ${table}` : `New ${table}`;
    this.body.innerHTML = '<div style="text-align:center;padding:20px;">Loading...</div>';
    this.el.classList.remove('hidden');
    
    try {
      // Use cached schema if available — avoids extra round-trip on re-open
      let schemaColumns;
      if (this._schemaCache[table]) {
        schemaColumns = this._schemaCache[table];
      } else {
        const schRes = await API.get(`/schema/${table}`);
        schemaColumns = schRes.columns;
        this._schemaCache[table] = schemaColumns;
      }
      this.schema = schemaColumns;
      let record = {};
      if (recordId) {
        const recRes = await API.get(`/records/${table}/${recordId}`);
        record = recRes.record;
      }
      this.renderForm(record);
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }

  renderForm(data) {
    let html = '<form id="modal-form" class="form-grid-2" onsubmit="event.preventDefault(); window.App.isDirty = false; Modal.save(); return false;" oninput="window.App.isDirty = true;">';
    this.schema.forEach(col => {
      if (['id', 'created_at', 'updated_at'].includes(col.name)) return;
      const val = data[col.name] !== undefined ? data[col.name] : '';
      const type = (col.name.includes('date') || col.name.includes('at')) ? 'date' : 
                   (col.type === 'REAL' || col.type === 'INTEGER') ? 'number' : 'text';
      html += `
        <div class="form-group">
          <label>${col.name.replace(/_/g, ' ').toUpperCase()}</label>
          <input type="${type}" name="${col.name}" class="modal-inp" value="${val}" ${type==='number'?'step="any"':''}/>
        </div>
      `;
    });
    html += '</form>';
    this.body.innerHTML = html;
  }

  async save() {
    const form = document.getElementById('modal-form');
    if (!form) return;
    const formData = new FormData(form);
    const data = {};
    formData.forEach((v, k) => data[k] = v);

    try {
      this.saveBtn.disabled = true;
      if (this.recordId) {
        await API.put(`/records/${this.table}/${this.recordId}`, data);
        UI.showToast('Record updated successfully', 'success');
      } else {
        await API.post(`/records/${this.table}`, data);
        UI.showToast('Record created successfully', 'success');
      }
      this.close();
      if (window.App && window.App.refreshCurrentView) window.App.refreshCurrentView();
    } catch (e) {
      UI.showToast(e.message, 'error');
    } finally {
      this.saveBtn.disabled = false;
    }
  }

  openCustom(html, title = 'Interactive Intelligence') {
    this.title.innerText = title;
    this.body.innerHTML = html;
    this.saveBtn.classList.add('hidden');
    this.el.classList.remove('hidden');
  }

  close() {
    this.el.classList.add('hidden');
    this.saveBtn.classList.remove('hidden');
    this.body.innerHTML = '';
    if (window.App) window.App.isDirty = false;
  }
}
const Modal = new ModalController();
window.Modal = Modal;

// ─── Canvas Animation Removed ───────────────────────────────────
// Replaced with CSS grid natively.

// ─── Welcome Splash Controller ────────────────────────────────────────────────
const WelcomeSplash = {
  _raf: null,
  _particles: [],

  init() {
    const el = document.getElementById('welcome-splash');
    if (!el) return;

    if (localStorage.getItem('splash_dismissed') || (location.hash && location.hash !== '#landing')) {
      el.style.display = 'none';
      return;
    }

    // Live clock
    const clockEl = document.getElementById('ws-clock');
    const tick = () => {
      if (clockEl) clockEl.textContent = new Date().toLocaleTimeString();
    };
    tick();
    setInterval(tick, 1000);

    // Canvas particle burst
    this._initCanvas();
  },

  _initCanvas() {
    // Mount blackhole on splash canvas explicitly on fresh load
    if (window.AuraBlackhole) AuraBlackhole.mountTo('welcome-splash');
  },

  show() {
    const el = document.getElementById('welcome-splash');
    if (!el) return;
    
    // Clear dismissal state
    localStorage.removeItem('splash_dismissed');
    
    // Route app back to landing in the background
    location.hash = 'landing';
    if (window.App && typeof window.App.handleRoute === 'function') {
      window.App.handleRoute('#landing');
    }
    
    // Reset classes and display
    el.classList.remove('ws-dismissed');
    el.style.display = 'flex';
    
    // Remount blackhole on splash canvas
    if (window.AuraBlackhole) AuraBlackhole.mountTo('welcome-splash');
  },

  dismiss() {
    const el = document.getElementById('welcome-splash');
    if (!el) return;

    localStorage.setItem('splash_dismissed', 'true');
    // Stop particle loop
    if (this._raf) cancelAnimationFrame(this._raf);

    // Stop blackhole on splash — it will re-mount to landing page via handleRoute
    if (window.AuraBlackhole) AuraBlackhole.stop();

    // Trigger CSS transition
    el.classList.add('ws-dismissed');

    // Remove from DOM after transition finishes
    setTimeout(() => {
      el.style.display = 'none';
      // Re-mount blackhole on landing page
      if (window.AuraBlackhole) AuraBlackhole.mountTo('page-landing');
    }, 950);
  }
};

// Auto-init on load
document.addEventListener('DOMContentLoaded', () => WelcomeSplash.init());
window.WelcomeSplash = WelcomeSplash;
