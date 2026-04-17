/**
 * Action Aura — Subsystem Core
 * Shared shell: router, sidebar, header, AI chat panel, and logo system.
 */

// ── Logo System ───────────────────────────────────────────────────────────────
const LogoSystem = {
  _retypeTimers: [],

  init() {
    document.querySelectorAll('.aura-logo').forEach(logo => {
      logo.addEventListener('mouseenter', () => this._startRetype(logo));
      logo.addEventListener('mouseleave', () => this._stopRetype(logo));
      logo.addEventListener('click', () => {
        // Always go to landing
        if (window.SubsystemApp && window.SubsystemApp.active) {
          window.SubsystemApp.exit();
        } else {
          location.hash = 'landing';
          if (window.App) window.App.handleRoute('#landing');
        }
      });
    });
  },

  _stopRetype(logo) {
    this._retypeTimers.forEach(t => clearTimeout(t));
    this._retypeTimers = [];
    const nameEl = logo.querySelector('.logo-name');
    if (nameEl) nameEl.innerHTML = 'Action<strong>Aura</strong>';
  },

  _startRetype(logo) {
    const nameEl = logo.querySelector('.logo-name');
    if (!nameEl) return;
    const text = 'ActionAura';
    let i = 0;
    nameEl.innerHTML = '';
    const type = () => {
      if (i <= text.length) {
        const display = text.slice(0, i);
        const action = display.slice(0, 6);
        const aura = display.slice(6);
        nameEl.innerHTML = `${action}<strong>${aura}</strong><span class="logo-cursor">|</span>`;
        i++;
        this._retypeTimers.push(setTimeout(type, 55));
      } else {
        nameEl.innerHTML = 'Action<strong>Aura</strong>';
      }
    };
    type();
  }
};


// ── Subsystem AI Chat ─────────────────────────────────────────────────────────
const SubAI = {
  active: false,
  subsystem: null,
  history: [],

  open(subsystemId) {
    this.subsystem = subsystemId;
    const panel = document.getElementById('sub-ai-panel');
    if (panel) {
      panel.classList.remove('hidden');
      this.active = true;
      document.getElementById('sub-ai-messages').innerHTML = `
        <div class="ai-msg bot">
          <div class="ai-msg-avatar">🤖</div>
          <div class="ai-msg-bubble">
            <strong>Hello! I'm the ${this._label(subsystemId)} AI Assistant</strong><br/><br/>
            I can analyze your ${this._label(subsystemId).toLowerCase()} data, provide predictions, and support decisions.<br/><br/>
            <em>Try asking me something about your data!</em>
          </div>
        </div>`;
    }
  },

  close() {
    const panel = document.getElementById('sub-ai-panel');
    if (panel) panel.classList.add('hidden');
    this.active = false;
  },

  _label(id) {
    return { accounting: 'Accounting', hr: 'HR System', inventory: 'Inventory' }[id] || id;
  },

  async send() {
    const input = document.getElementById('sub-ai-input');
    const msg = input ? input.value.trim() : '';
    if (!msg) return;
    input.value = '';
    input.style.height = 'auto';

    this._addMessage(msg, 'user');
    this._addTyping();

    try {
      const endpoint = `/api/sub/${this.subsystem}/ai/chat`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      this._removeTyping();
      this._addMessage(data.reply || 'I encountered an issue processing your request.', 'bot');
    } catch (e) {
      this._removeTyping();
      this._addMessage('⚠️ Connection error. Please check the server.', 'bot');
    }
  },

  handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  },

  _addMessage(text, role) {
    const msgs = document.getElementById('sub-ai-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;
    const formatted = this._formatMarkdown(text);
    div.innerHTML = `
      ${role === 'bot' ? '<div class="ai-msg-avatar">🤖</div>' : ''}
      <div class="ai-msg-bubble">${formatted}</div>
      ${role === 'user' ? '<div class="ai-msg-avatar user-avatar-sm">👤</div>' : ''}
    `;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  },

  _formatMarkdown(text) {
    return text
      .replace(/### (.*)/g, '<h4 style="margin:8px 0 6px;font-size:14px;color:var(--sub-accent)">$1</h4>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.1);padding:1px 4px;border-radius:3px;font-family:monospace;font-size:12px">$1</code>')
      .replace(/\|(.*?)\|(.*?)\|(.*?)\|/g, '<div style="display:flex;gap:10px;font-size:12px;padding:2px 0"><span style="flex:1">$1</span><span style="flex:1">$2</span><span style="flex:1">$3</span></div>')
      .replace(/^- (.+)/gm, '<div style="padding:2px 0 2px 10px;border-left:2px solid var(--sub-accent)">$1</div>')
      .replace(/\n/g, '<br/>');
  },

  _addTyping() {
    const msgs = document.getElementById('sub-ai-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = 'ai-msg bot';
    div.id = 'sub-ai-typing';
    div.innerHTML = `<div class="ai-msg-avatar">🤖</div><div class="ai-msg-bubble"><span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  },

  _removeTyping() {
    const t = document.getElementById('sub-ai-typing');
    if (t) t.remove();
  }
};


// ── Subsystem App Shell ────────────────────────────────────────────────────────
const SubsystemApp = {
  active: null,
  currentSection: 'dashboard',

  systems: {
    accounting: {
      name: 'Accounting System',
      icon: '💰',
      accent: '#a78bfa',
      accentRgb: '167,139,250',
      nav: [
        { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
        { id: 'transactions', label: 'Transactions', icon: '💳' },
        { id: 'invoices', label: 'Invoices', icon: '📄' },
        { id: 'budgets', label: 'Budgets', icon: '📊' },
        { id: 'reports', label: 'Reports', icon: '📋' },
      ]
    },
    hr: {
      name: 'HR System',
      icon: '👥',
      accent: '#34d399',
      accentRgb: '52,211,153',
      nav: [
        { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
        { id: 'employees', label: 'Employees', icon: '👤' },
        { id: 'attendance', label: 'Attendance', icon: '📅' },
        { id: 'payroll', label: 'Payroll', icon: '💰' },
        { id: 'leave', label: 'Leave Mgmt', icon: '🌴' },
        { id: 'performance', label: 'Performance', icon: '🏆' },
      ]
    },
    inventory: {
      name: 'Inventory System',
      icon: '📦',
      accent: '#fb923c',
      accentRgb: '251,146,60',
      nav: [
        { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
        { id: 'products', label: 'Products', icon: '🏷️' },
        { id: 'movements', label: 'Stock Movements', icon: '🔄' },
        { id: 'suppliers', label: 'Suppliers', icon: '🤝' },
        { id: 'purchase_orders', label: 'Purchase Orders', icon: '📋' },
        { id: 'alerts', label: 'Alerts', icon: '🚨' },
      ]
    }
  },

  launch(systemId) {
    const sys = this.systems[systemId];
    if (!sys) return;
    this.active = systemId;
    this.currentSection = 'dashboard';

    // Set accent color CSS variable
    document.documentElement.style.setProperty('--sub-accent', sys.accent);
    document.documentElement.style.setProperty('--sub-accent-rgb', sys.accentRgb);

    // Show subsystem page, hide others
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-subsystem');
    if (page) page.classList.add('active');

    this._renderShell(sys, systemId);
    this._navigate('dashboard');
    LogoSystem.init();
  },

  exit() {
    this.active = null;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-subs-menu')?.classList.add('active');
    document.documentElement.style.removeProperty('--sub-accent');
    document.documentElement.style.removeProperty('--sub-accent-rgb');
    SubAI.close();
  },

  _renderShell(sys, systemId) {
    const shell = document.getElementById('subsystem-shell');
    if (!shell) return;

    shell.innerHTML = `
      <!-- Subsystem Sidebar -->
      <aside class="sub-sidebar" id="sub-sidebar">
        <div class="sub-sidebar-brand aura-logo" title="Return to Home">
          <div class="sub-brand-icon">${sys.icon}</div>
          <div class="sub-brand-text">
            <span class="sub-system-name">${sys.name}</span>
            <span class="logo-name" style="font-size:11px;color:var(--text-muted)">Action<strong>Aura</strong></span>
          </div>
        </div>

        <nav class="sub-nav" id="sub-nav">
          ${sys.nav.map(item => `
            <a class="sub-nav-item ${item.id === 'dashboard' ? 'active' : ''}"
               data-section="${item.id}"
               onclick="SubsystemApp._navigate('${item.id}')">
              <span class="sub-nav-icon">${item.icon}</span>
              <span class="sub-nav-label">${item.label}</span>
            </a>
          `).join('')}
        </nav>

        <div class="sub-sidebar-bottom">
          <button class="sub-ai-btn" onclick="SubAI.open('${systemId}')">
            <span>🤖</span> <span>AI Assistant</span>
            <span class="ai-pulse"></span>
          </button>
          <button class="sub-exit-btn" onclick="SubsystemApp.exit()">
            <span>←</span> <span>Back to Menu</span>
          </button>
        </div>
      </aside>

      <!-- Subsystem Main -->
      <div class="sub-main">
        <header class="sub-header">
          <div class="sub-header-left">
            <h2 class="sub-header-title" id="sub-header-title">${sys.name}</h2>
            <span class="sub-header-section" id="sub-header-section">Dashboard</span>
          </div>
          <div class="sub-header-right">
            <div class="sub-header-badge" style="background:rgba(${sys.accentRgb},0.15);border-color:${sys.accent};color:${sys.accent}">
              ${sys.icon} ${sys.name}
            </div>
            <button class="sub-header-btn" onclick="SubAI.open('${systemId}')" title="AI Assistant">🤖</button>
          </div>
        </header>

        <main class="sub-content" id="sub-content">
          <div style="text-align:center;padding:80px;color:var(--text-muted)">Loading...</div>
        </main>
      </div>
    `;
  },

  _navigate(sectionId) {
    this.currentSection = sectionId;

    // Update nav active state
    document.querySelectorAll('.sub-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.section === sectionId);
    });

    // Update header
    const sys = this.systems[this.active];
    const navItem = sys?.nav.find(n => n.id === sectionId);
    document.getElementById('sub-header-section')?.innerText && (
      document.getElementById('sub-header-section').innerText = navItem?.label || sectionId
    );

    // Route to correct subsystem renderer
    const content = document.getElementById('sub-content');
    if (content) content.innerHTML = `<div class="sub-loading"><div class="sub-spinner"></div></div>`;

    setTimeout(() => {
      switch (this.active) {
        case 'accounting': AccountingSystem.render(sectionId); break;
        case 'hr':         HRSystem.render(sectionId); break;
        case 'inventory':  InventorySystem.render(sectionId); break;
      }
    }, 120);
  },

  // ── Shared utility ──────────────────────────────────────────────
  async apiGet(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async apiPost(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  formatCurrency(v) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);
  },

  formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  badge(text, color) {
    const colors = {
      green: '#34d399', red: '#f87171', yellow: '#fbbf24',
      blue: '#60a5fa', purple: '#a78bfa', orange: '#fb923c',
      gray: '#6b7280'
    };
    const c = colors[color] || colors.gray;
    return `<span style="background:${c}22;color:${c};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">${text}</span>`;
  },

  kpiCard(label, value, icon = '📊', color = null, trend = null) {
    const accent = color || 'var(--sub-accent)';
    return `
      <div class="sub-kpi-card" style="border-left-color:${accent}">
        <div class="sub-kpi-icon">${icon}</div>
        <div class="sub-kpi-body">
          <div class="sub-kpi-label">${label}</div>
          <div class="sub-kpi-value" style="color:${accent}">${value}</div>
          ${trend ? `<div class="sub-kpi-trend">${trend}</div>` : ''}
        </div>
      </div>
    `;
  },

  renderChart(canvasId, config) {
    const el = document.getElementById(canvasId);
    if (!el) return;
    // Destroy prior instance if any
    if (el._chartInstance) el._chartInstance.destroy();
    el._chartInstance = new Chart(el.getContext('2d'), config);
  },

  showToast(msg, type = 'info') {
    const colors = { success: '#34d399', error: '#f87171', info: 'var(--sub-accent)' };
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:24px;right:24px;background:#1e1e2e;border:1px solid ${colors[type]};color:white;padding:12px 20px;border-radius:10px;font-size:13px;z-index:99999;animation:slideUp .3s ease;box-shadow:0 8px 25px rgba(0,0,0,.4)`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
};

window.SubsystemApp = SubsystemApp;
window.SubAI = SubAI;
window.LogoSystem = LogoSystem;

document.addEventListener('DOMContentLoaded', () => {
  LogoSystem.init();

  // Hash routing for subsystems
  window.addEventListener('hashchange', () => {
    const h = location.hash;
    if (h === '#subsystem-accounting') SubsystemApp.launch('accounting');
    else if (h === '#subsystem-hr') SubsystemApp.launch('hr');
    else if (h === '#subsystem-inventory') SubsystemApp.launch('inventory');
    else if (h === '#subs-menu') {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-subs-menu')?.classList.add('active');
    }
  });

  // Sub AI input auto-resize
  const subInput = document.getElementById('sub-ai-input');
  if (subInput) {
    subInput.addEventListener('input', () => {
      subInput.style.height = 'auto';
      subInput.style.height = Math.min(subInput.scrollHeight, 120) + 'px';
    });
  }
});
