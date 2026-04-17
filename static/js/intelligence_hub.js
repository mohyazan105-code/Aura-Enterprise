/**
 * AURA Enterprise Intelligence Hub
 * Autonomous AI Platform — All 9 intelligence pillars
 * Autopilot • Anomaly • Audit • OKR • Org Optimizer • Digital Twin • Notifications • XAI • Workflow
 */
const IntelligenceHub = (() => {
  // ── State ──────────────────────────────────────────────────────────────────
  let _domain = 'banking';
  let _dept   = 'finance';
  let _activeTab = 'autopilot';
  let _twinScene = null;
  let _scanInterval = null;
  let _automationEnabled = false;
  let _loaded = {};

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  function open(domain, dept) {
    _domain = domain || (typeof App !== 'undefined' && App.currentDomain) || 'banking';
    _dept   = dept   || (typeof App !== 'undefined' && App.currentDept) || 'finance';
    _injectOverlay();
    _setTab(_activeTab);
    _loadNotificationBadge();
  }

  function close() {
    const el = document.getElementById('ih-overlay');
    if (el) { el.classList.add('ih-closing'); setTimeout(() => el.remove(), 400); }
    if (_twinScene) { _twinScene.renderer.dispose(); _twinScene = null; }
  }

  function setDomain(d) {
    _domain = d; _loaded = {};
    _setTab(_activeTab);
  }

  // ── Shell Injection ────────────────────────────────────────────────────────
  function _injectOverlay() {
    document.getElementById('ih-overlay')?.remove();
    const domains = ['banking','healthcare','education','manufacturing'];
    const domainOpts = domains.map(d =>
      `<option value="${d}" ${d===_domain?'selected':''}>${_domainLabel(d)}</option>`).join('');

    const tabs = [
      { id: 'autopilot', icon: '🤖', label: 'AI Autopilot' },
      { id: 'anomaly',   icon: '🧠', label: 'Anomaly Monitor' },
      { id: 'audit',     icon: '🔐', label: 'Audit Trail' },
      { id: 'okr',       icon: '🎯', label: 'OKR Tracker' },
      { id: 'org',       icon: '🧬', label: 'Org Optimizer' },
      { id: 'twin',      icon: '🧪', label: 'Digital Twin' },
      { id: 'notify',    icon: '📣', label: 'Notifications' },
    ];

    const el = document.createElement('div');
    el.id = 'ih-overlay';
    el.className = 'ih-overlay';
    el.innerHTML = `
<div class="ih-panel">
  <!-- Header -->
  <div class="ih-header">
    <div class="ih-header-left">
      <div class="ih-header-icon">⚡</div>
      <div>
        <div class="ih-title">Enterprise Intelligence Hub</div>
        <div class="ih-subtitle">Autonomous AI · Real-time Analysis · Full Transparency</div>
      </div>
    </div>
    <div class="ih-header-right">
      <select id="ih-domain-sel" onchange="IntelligenceHub.setDomain(this.value)">${domainOpts}</select>
      <button class="ih-scan-btn" id="ih-scan-btn" onclick="IntelligenceHub.triggerScan()">
        <span id="ih-scan-icon">⚡</span> Run AI Scan
      </button>
      <div class="ih-auto-toggle">
        <span>Auto</span>
        <label class="ih-toggle-switch">
          <input type="checkbox" id="ih-auto-chk" onchange="IntelligenceHub.toggleAutomation(this.checked)">
          <span class="ih-toggle-knob"></span>
        </label>
      </div>
      <button class="ih-close-btn" onclick="IntelligenceHub.close()">✕</button>
    </div>
  </div>

  <!-- Tab Bar -->
  <div class="ih-tabs">
    ${tabs.map(t => `
      <button class="ih-tab ${t.id===_activeTab?'ih-tab-active':''}"
              id="ih-tab-${t.id}" onclick="IntelligenceHub._setTab('${t.id}')">
        <span class="ih-tab-icon">${t.icon}</span>
        <span class="ih-tab-label">${t.label}</span>
        <span class="ih-tab-badge hidden" id="ih-badge-${t.id}">0</span>
      </button>`).join('')}
  </div>

  <!-- Content -->
  <div class="ih-body" id="ih-body">
    <div class="ih-loading"><div class="ih-spinner"></div><p>Loading intelligence data...</p></div>
  </div>
</div>`;
    document.body.appendChild(el);
    _styleHub();
    setTimeout(() => el.classList.add('ih-visible'), 10);
  }

  // ── Tab Router ─────────────────────────────────────────────────────────────
  function _setTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('.ih-tab').forEach(t =>
      t.classList.toggle('ih-tab-active', t.id === `ih-tab-${tab}`));
    const body = document.getElementById('ih-body');
    if (!body) return;
    body.innerHTML = '<div class="ih-loading"><div class="ih-spinner"></div><p>Loading...</p></div>';
    const fn = { autopilot: _renderAutopilot, anomaly: _renderAnomaly, audit: _renderAudit,
                 okr: _renderOKR, org: _renderOrg, twin: _renderTwin, notify: _renderNotify }[tab];
    if (fn) fn();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 🤖 AI AUTOPILOT
  // ══════════════════════════════════════════════════════════════════════════
  async function _renderAutopilot() {
    const body = document.getElementById('ih-body');
    body.innerHTML = '<div class="ih-loading"><div class="ih-spinner"></div></div>';
    try {
      const r = await fetch(`/api/autopilot/actions?domain=${_domain}`);
      const d = await r.json();
      const actions = d.actions || [];
      const pending = actions.filter(a => a.status === 'pending');
      _setBadge('autopilot', pending.length);

      body.innerHTML = `
<div class="ih-section-header">
  <div>
    <h2 class="ih-section-title">🤖 AI Autopilot</h2>
    <p class="ih-section-desc">Review and approve AI-generated recommendations. Each action includes full reasoning and impact analysis.</p>
  </div>
  <div class="ih-header-stats">
    <div class="ih-stat-pill ih-stat-pending">${pending.length} Pending</div>
    <div class="ih-stat-pill ih-stat-all">${actions.length} Total</div>
  </div>
</div>

<div class="ih-filter-bar">
  <button class="ih-filter-btn ih-filter-active" onclick="IntelligenceHub._filterActions('all',this)">All (${actions.length})</button>
  <button class="ih-filter-btn" onclick="IntelligenceHub._filterActions('pending',this)">Pending (${pending.length})</button>
  <button class="ih-filter-btn" onclick="IntelligenceHub._filterActions('executed',this)">Executed</button>
  <button class="ih-filter-btn" onclick="IntelligenceHub._filterActions('rejected',this)">Rejected</button>
</div>

${actions.length === 0 ? _emptyState('🤖', 'No AI actions yet', 'Run an AI scan to generate recommendations') : ''}
<div class="ih-actions-grid" id="ih-actions-grid">
  ${actions.map(a => _actionCard(a)).join('')}
</div>`;
    } catch(e) {
      body.innerHTML = _errorState(e);
    }
  }

  function _actionCard(a) {
    const riskColor = { low: '#00e676', medium: '#ffa726', high: '#f44336' }[a.risk_level] || '#ccc';
    const statusColor = { pending: '#ffa726', executed: '#00e676', rejected: '#f44336', failed: '#e53935' }[a.status] || '#888';
    const typeIcon = { campaign_adjust: '📣', employee_reassign: '👥', kpi_recalibrate: '🎯',
                       workflow_optimize: '⏱️', budget_review: '💰' }[a.action_type] || '⚡';
    const pts = Array.isArray(a.data_points_json) ? a.data_points_json : [];

    return `<div class="ih-action-card" data-status="${a.status}" id="ih-action-${a.id}">
  <div class="ih-action-header">
    <div class="ih-action-type-icon">${typeIcon}</div>
    <div class="ih-action-meta">
      <div class="ih-action-title">${_esc(a.title)}</div>
      <div class="ih-action-dept">${(a.department || '').toUpperCase()} · ${a.action_type}</div>
    </div>
    <div class="ih-action-badges">
      <span class="ih-risk-badge" style="background:${riskColor}20;color:${riskColor};border:1px solid ${riskColor}40">${a.risk_level?.toUpperCase()} RISK</span>
      <span class="ih-status-badge" style="color:${statusColor}">${a.status}</span>
    </div>
  </div>

  <p class="ih-action-desc">${_esc(a.description || '')}</p>

  <div class="ih-xai-box">
    <div class="ih-xai-label">🔍 AI Reasoning</div>
    <p class="ih-xai-text">${_esc(a.reasoning || '')}</p>
    ${pts.length ? `<div class="ih-data-points">${pts.map(p=>`<span class="ih-dp">${_esc(p)}</span>`).join('')}</div>` : ''}
  </div>

  <div class="ih-action-metrics">
    <div class="ih-metric-item">
      <div class="ih-metric-val" style="color:#00e676">+${a.impact_pct || 0}%</div>
      <div class="ih-metric-label">Expected Impact</div>
    </div>
    <div class="ih-metric-item">
      <div class="ih-metric-val">${a.risk_level || 'low'}</div>
      <div class="ih-metric-label">Risk Level</div>
    </div>
    <div class="ih-metric-item">
      <div class="ih-metric-val ih-outcome-val">${_esc((a.expected_outcome || '').substring(0, 40))}${(a.expected_outcome||'').length > 40 ? '…' : ''}</div>
      <div class="ih-metric-label">Expected Outcome</div>
    </div>
  </div>

  ${a.status === 'pending' ? `
  <div class="ih-action-btns">
    <button class="ih-btn-approve" onclick="IntelligenceHub.approveAction(${a.id})">
      ✅ Approve & Execute
    </button>
    <button class="ih-btn-reject" onclick="IntelligenceHub.rejectAction(${a.id})">
      ❌ Reject
    </button>
  </div>` : `<div class="ih-action-done">Action ${a.status} ${a.executed_at ? `at ${a.executed_at.substring(0,16)}` : ''}</div>`}
</div>`;
  }

  function _filterActions(status, btn) {
    document.querySelectorAll('.ih-filter-btn').forEach(b => b.classList.remove('ih-filter-active'));
    btn.classList.add('ih-filter-active');
    document.querySelectorAll('.ih-action-card').forEach(c => {
      c.style.display = (status === 'all' || c.dataset.status === status) ? '' : 'none';
    });
  }

  async function approveAction(id) {
    if (!confirm('Execute this AI action? The system will automatically apply the recommended change.')) return;
    const btn = document.querySelector(`#ih-action-${id} .ih-btn-approve`);
    if (btn) { btn.textContent = '⏳ Executing…'; btn.disabled = true; }
    try {
      const r = await fetch(`/api/autopilot/actions/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: _domain })
      });
      const d = await r.json();
      if (d.status === 'executed') {
        _flashSuccess(`✅ Action executed: ${d.result?.message || 'Success'}`);
        setTimeout(() => _renderAutopilot(), 800);
      } else {
        _flashError(`Action failed: ${d.result?.message || d.error}`);
        if (btn) { btn.textContent = '✅ Approve'; btn.disabled = false; }
      }
    } catch(e) {
      _flashError('Network error: ' + e.message);
      if (btn) { btn.textContent = '✅ Approve'; btn.disabled = false; }
    }
  }

  async function rejectAction(id) {
    const reason = prompt('Reason for rejection (optional):') ?? '';
    try {
      await fetch(`/api/autopilot/actions/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: _domain, reason })
      });
      _flashSuccess('Action rejected.');
      setTimeout(() => _renderAutopilot(), 500);
    } catch(e) { _flashError(e.message); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 🧠 ANOMALY MONITOR
  // ══════════════════════════════════════════════════════════════════════════
  async function _renderAnomaly() {
    const body = document.getElementById('ih-body');
    body.innerHTML = '<div class="ih-loading"><div class="ih-spinner"></div></div>';
    try {
      const r = await fetch(`/api/autopilot/anomalies?domain=${_domain}&status=open`);
      const d = await r.json();
      const anomalies = d.anomalies || [];
      const critCount = d.critical_count || 0;
      _setBadge('anomaly', critCount);

      const bySev = { critical: [], high: [], medium: [], low: [] };
      anomalies.forEach(a => (bySev[a.severity] || bySev.medium).push(a));

      body.innerHTML = `
<div class="ih-section-header">
  <div>
    <h2 class="ih-section-title">🧠 Anomaly Detection Monitor</h2>
    <p class="ih-section-desc">Real-time anomaly detection across transactions, employees, inventory, and workflows.</p>
  </div>
  <div class="ih-header-stats">
    ${[['critical','#f44336'],['high','#ff7043'],['medium','#ffa726'],['low','#66bb6a']].map(([s,c])=>
      `<div class="ih-stat-pill" style="background:${c}20;color:${c};border:1px solid ${c}40">
         ${bySev[s].length} ${s.charAt(0).toUpperCase()+s.slice(1)}</div>`).join('')}
  </div>
</div>

${anomalies.length === 0 ? _emptyState('🎉', 'No anomalies detected', 'All systems operating within normal parameters. Run a scan to check.') : `
<div class="ih-anomaly-grid">
  ${anomalies.map(a => _anomalyCard(a)).join('')}
</div>`}`;
    } catch(e) {
      body.innerHTML = _errorState(e);
    }
  }

  function _anomalyCard(a) {
    const sevColor = { critical: '#f44336', high: '#ff7043', medium: '#ffa726', low: '#66bb6a' }[a.severity] || '#888';
    const srcIcon  = { transactions: '💳', employees: '👤', inventory: '📦', workflows: '🔄', campaigns: '📣' }[a.source] || '⚠️';
    const z = a.z_score ? Math.abs(a.z_score).toFixed(1) : 'N/A';
    return `<div class="ih-anomaly-card" style="border-left:4px solid ${sevColor}">
  <div class="ih-anomaly-header">
    <div class="ih-acon-left">
      <span class="ih-src-icon">${srcIcon}</span>
      <div>
        <div class="ih-anomaly-type" style="color:${sevColor}">${(a.severity||'').toUpperCase()} · ${a.anomaly_type || ''}</div>
        <div class="ih-anomaly-src">${a.source} · ${a.department || 'all'}</div>
      </div>
    </div>
    <div class="ih-zscore-badge" style="background:${sevColor}20;color:${sevColor}">z=${z}σ</div>
  </div>
  <p class="ih-anomaly-desc">${_esc(a.description || '')}</p>
  <div class="ih-baseline-cmp">
    <div><span>Detected Value</span><strong style="color:${sevColor}">${(a.value||0).toLocaleString()}</strong></div>
    <div><span>Baseline Avg</span><strong>${(a.baseline_value||0).toLocaleString()}</strong></div>
    <div><span>Deviation</span><strong style="color:${sevColor}">
      ${a.baseline_value ? (((a.value - a.baseline_value)/a.baseline_value)*100).toFixed(0) : '?'}%</strong></div>
  </div>
  <div class="ih-action-suggest">💡 ${_esc(a.suggested_action || 'Review this anomaly')}</div>
  <div class="ih-anomaly-btns">
    <button class="ih-btn-sm ih-btn-resolve" onclick="IntelligenceHub.resolveAnomaly(${a.id})">✔ Resolve</button>
    <button class="ih-btn-sm ih-btn-fp" onclick="IntelligenceHub.resolveAnomaly(${a.id},'false_positive')">✗ False Positive</button>
  </div>
</div>`;
  }

  async function resolveAnomaly(id, resolution = 'resolved') {
    try {
      await fetch(`/api/autopilot/anomalies/${id}/resolve`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ domain: _domain, resolution })
      });
      document.querySelector(`#ih-body .ih-anomaly-card:has([onclick*="${id}"])`).style.opacity = '0.3';
      setTimeout(() => _renderAnomaly(), 800);
    } catch(e) { _flashError(e.message); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 🔐 AUDIT TRAIL
  // ══════════════════════════════════════════════════════════════════════════
  async function _renderAudit() {
    const body = document.getElementById('ih-body');
    body.innerHTML = '<div class="ih-loading"><div class="ih-spinner"></div></div>';
    try {
      const [logR, statsR] = await Promise.all([
        fetch(`/api/audit/log?domain=${_domain}&limit=50`),
        fetch(`/api/audit/stats?domain=${_domain}`)
      ]);
      const logD = await logR.json();
      const stats = await statsR.json();
      const logs = logD.logs || [];

      body.innerHTML = `
<div class="ih-section-header">
  <div>
    <h2 class="ih-section-title">🔐 Audit Trail</h2>
    <p class="ih-section-desc">Bank-grade transparency. Every action, AI decision, and data change is permanently recorded.</p>
  </div>
  <div class="ih-header-stats">
    <div class="ih-stat-pill">${(stats.total||0).toLocaleString()} Total Events</div>
    <div class="ih-stat-pill" style="color:#a78bfa">${stats.ai_actions||0} AI Actions</div>
  </div>
</div>

<div class="ih-audit-meta-row">
  ${(stats.by_type||[]).slice(0,5).map(t=>`
    <div class="ih-audit-type-chip">
      <span class="ih-audit-action-icon">${_actionTypeIcon(t.type)}</span>
      <div><div class="ih-atype">${t.type}</div><div class="ih-acount">${t.count}</div></div>
    </div>`).join('')}
</div>

<div class="ih-audit-search-bar">
  <input type="text" id="ih-audit-search" placeholder="🔍 Search by user, action, entity..." 
         oninput="IntelligenceHub._searchAudit(this.value)" class="ih-search-input"/>
  <select id="ih-audit-type-filter" onchange="IntelligenceHub._filterAudit()" class="ih-sel">
    <option value="">All Actions</option>
    ${(stats.by_type||[]).map(t=>`<option value="${t.type}">${t.type}</option>`).join('')}
  </select>
  <button class="ih-export-btn" onclick="window.open('/api/audit/export?domain=${_domain}')">📥 Export CSV</button>
</div>

<div class="ih-timeline" id="ih-timeline">
  ${logs.map(l => _auditEntry(l)).join('')}
  ${logs.length === 0 ? _emptyState('📋', 'No audit logs found', 'Events will appear here as actions are taken') : ''}
</div>`;
    } catch(e) {
      body.innerHTML = _errorState(e);
    }
  }

  function _auditEntry(l) {
    const isAI = l.is_ai_action;
    const color = isAI ? '#a78bfa' : { CREATE: '#00e676', UPDATE: '#ffa726', DELETE: '#f44336',
      LOGIN: '#29b6f6', AI_ACTION: '#a78bfa', APPROVE: '#00e676', REJECT: '#f44336' }[l.action_type] || '#888';
    const before = l.before_json && typeof l.before_json === 'object' ? JSON.stringify(l.before_json, null, 2) : l.before_json || '';
    const after  = l.after_json  && typeof l.after_json  === 'object' ? JSON.stringify(l.after_json,  null, 2) : l.after_json  || '';
    return `<div class="ih-audit-entry">
  <div class="ih-audit-dot" style="background:${color}"></div>
  <div class="ih-audit-content">
    <div class="ih-audit-row-top">
      <div class="ih-audit-action" style="color:${color}">
        ${isAI ? '🤖 ' : ''}${l.action_type}
      </div>
      <div class="ih-audit-entity">${l.entity_type || 'system'}${l.entity_id ? ` #${l.entity_id}` : ''}</div>
      <div class="ih-audit-time">${l.created_at?.substring(0,16).replace('T',' ') || ''}</div>
    </div>
    <div class="ih-audit-row-meta">
      <span class="ih-audit-user">👤 ${_esc(l.user_name||'System')}</span>
      <span class="ih-audit-role">[${l.user_role||'system'}]</span>
      ${l.description ? `<span class="ih-audit-desc">${_esc(l.description)}</span>` : ''}
    </div>
    ${(before || after) ? `
    <details class="ih-diff-details">
      <summary>View Changes</summary>
      <div class="ih-diff-grid">
        ${before ? `<div class="ih-diff-before"><h5>Before</h5><pre>${_esc(before.substring(0,300))}</pre></div>` : ''}
        ${after  ? `<div class="ih-diff-after"><h5>After</h5><pre>${_esc(after.substring(0,300))}</pre></div>`  : ''}
      </div>
    </details>` : ''}
  </div>
</div>`;
  }

  async function _searchAudit(q) {
    const r = await fetch(`/api/audit/log?domain=${_domain}&search=${encodeURIComponent(q)}&limit=50`);
    const d = await r.json();
    const tl = document.getElementById('ih-timeline');
    if (tl) tl.innerHTML = (d.logs||[]).map(_auditEntry).join('') ||
      _emptyState('📋', 'No results', 'Try different search terms');
  }

  async function _filterAudit() {
    const type = document.getElementById('ih-audit-type-filter')?.value || '';
    const r = await fetch(`/api/audit/log?domain=${_domain}&action_type=${type}&limit=50`);
    const d = await r.json();
    const tl = document.getElementById('ih-timeline');
    if (tl) tl.innerHTML = (d.logs||[]).map(_auditEntry).join('');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 🎯 OKR TRACKER
  // ══════════════════════════════════════════════════════════════════════════
  async function _renderOKR() {
    const body = document.getElementById('ih-body');
    body.innerHTML = '<div class="ih-loading"><div class="ih-spinner"></div></div>';
    try {
      const [objR, sumR] = await Promise.all([
        fetch(`/api/okr/objectives?domain=${_domain}&department=${_dept}`),
        fetch(`/api/okr/summary?domain=${_domain}&department=${_dept}`)
      ]);
      const objD = await objR.json();
      const sumD = await sumR.json();
      const objectives = objD.objectives || [];
      const stats = sumD.stats || {};
      const atRisk = objectives.filter(o => (o.key_results||[]).some(k => k.status === 'at_risk')).length;
      _setBadge('okr', atRisk);

      body.innerHTML = `
<div class="ih-section-header">
  <div>
    <h2 class="ih-section-title">🎯 OKR Tracker</h2>
    <p class="ih-section-desc">Objectives & Key Results — track department goals linked to live KPI data.</p>
  </div>
  <button class="ih-btn-create" onclick="IntelligenceHub._showCreateOKR()">+ New Objective</button>
</div>

<div class="ih-okr-summary-row">
  ${[
    ['Objectives', stats.total || 0, '#a78bfa'],
    ['Completed',  stats.completed || 0, '#00e676'],
    ['Active',     stats.active || 0, '#2196f3'],
    ['Avg Progress', `${(stats.avg_progress||0).toFixed(0)}%`, '#ffa726']
  ].map(([l,v,c]) => `<div class="ih-okr-sum-card">
      <div class="ih-okr-sum-val" style="color:${c}">${v}</div>
      <div class="ih-okr-sum-label">${l}</div>
    </div>`).join('')}
</div>

<div class="ih-okr-grid">
  ${objectives.map(o => _objectiveCard(o)).join('')}
  ${objectives.length === 0 ? _emptyState('🎯', 'No objectives yet', 'Create your first OKR to track department goals') : ''}
</div>`;
    } catch(e) {
      body.innerHTML = _errorState(e);
    }
  }

  function _objectiveCard(o) {
    const krs = o.key_results || [];
    const prog = o.progress_pct || 0;
    const progColor = prog >= 80 ? '#00e676' : prog >= 50 ? '#ffa726' : '#f44336';
    return `<div class="ih-obj-card">
  <div class="ih-obj-header">
    <div class="ih-obj-meta">
      <div class="ih-obj-title">${_esc(o.title)}</div>
      <div class="ih-obj-sub">${o.department?.toUpperCase()} · ${o.period || ''} · ${o.owner || ''}</div>
    </div>
    <div class="ih-radial-prog" title="${prog.toFixed(0)}% complete">
      <svg viewBox="0 0 44 44" class="ih-radial-svg">
        <circle cx="22" cy="22" r="18" class="ih-radial-bg"/>
        <circle cx="22" cy="22" r="18" class="ih-radial-fg" style="
          stroke:${progColor};
          stroke-dasharray:${(prog/100*113.1).toFixed(1)} 113.1"/>
      </svg>
      <span class="ih-radial-text" style="color:${progColor}">${prog.toFixed(0)}%</span>
    </div>
  </div>
  ${o.description ? `<p class="ih-obj-desc">${_esc(o.description)}</p>` : ''}
  <div class="ih-kr-list">
    ${krs.map(k => _krRow(k)).join('')}
    ${krs.length === 0 ? '<p class="ih-kr-empty">No key results yet</p>' : ''}
  </div>
  <button class="ih-btn-sm ih-btn-add-kr" onclick="IntelligenceHub._showAddKR(${o.id})">+ Add Key Result</button>
</div>`;
  }

  function _krRow(k) {
    const sColor = { achieved: '#00e676', on_track: '#2196f3', at_risk: '#f44336' }[k.status] || '#888';
    const prog = k.progress_pct || 0;
    return `<div class="ih-kr-row">
  <div class="ih-kr-info">
    <div class="ih-kr-title">${_esc(k.title)}</div>
    <div class="ih-kr-vals">${k.current_value || 0} / ${k.target_value || 100} ${k.unit || '%'}</div>
  </div>
  <div class="ih-kr-bar-wrap">
    <div class="ih-kr-bar" style="width:${prog}%;background:${sColor}"></div>
  </div>
  <div class="ih-kr-pct" style="color:${sColor}">${prog.toFixed(0)}%</div>
  <span class="ih-kr-status" style="color:${sColor}">${k.status}</span>
</div>`;
  }

  function _showCreateOKR() {
    _modal('New Objective', `
<div class="ih-form">
  <label>Title *</label>
  <input type="text" id="okr-title" placeholder="e.g. Improve Customer Retention" class="ih-input"/>
  <label>Description</label>
  <textarea id="okr-desc" placeholder="What are we trying to achieve?" class="ih-textarea" rows="2"></textarea>
  <label>Owner</label>
  <input type="text" id="okr-owner" placeholder="Team or person name" class="ih-input"/>
</div>`, async () => {
      const title = document.getElementById('okr-title')?.value;
      if (!title) return;
      await fetch('/api/okr/objectives', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: _domain, department: _dept,
          title, description: document.getElementById('okr-desc')?.value,
          owner: document.getElementById('okr-owner')?.value })
      });
      _closeModal(); setTimeout(() => _renderOKR(), 300);
    }, 'Create Objective');
  }

  function _showAddKR(objId) {
    _modal('Add Key Result', `
<div class="ih-form">
  <label>Key Result Title *</label>
  <input type="text" id="kr-title" placeholder="e.g. Achieve 95% retention rate" class="ih-input"/>
  <label>Target Value</label>
  <input type="number" id="kr-target" placeholder="100" class="ih-input"/>
  <label>Current Value</label>
  <input type="number" id="kr-current" placeholder="0" class="ih-input"/>
  <label>Unit</label>
  <input type="text" id="kr-unit" placeholder="% or count or score" class="ih-input"/>
</div>`, async () => {
      const title = document.getElementById('kr-title')?.value;
      if (!title) return;
      await fetch(`/api/okr/objectives/${objId}/key-results`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: _domain, title,
          target_value: parseFloat(document.getElementById('kr-target')?.value||100),
          current_value: parseFloat(document.getElementById('kr-current')?.value||0),
          unit: document.getElementById('kr-unit')?.value || '%' })
      });
      _closeModal(); setTimeout(() => _renderOKR(), 300);
    }, 'Add Key Result');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 🧬 ORG OPTIMIZER
  // ══════════════════════════════════════════════════════════════════════════
  async function _renderOrg() {
    const body = document.getElementById('ih-body');
    body.innerHTML = '<div class="ih-loading"><div class="ih-spinner"></div></div>';
    try {
      const r = await fetch(`/api/autopilot/org?domain=${_domain}`);
      const d = await r.json();
      const emps = d.employees || [];
      const suggs = d.suggestions || [];
      const summ = d.summary || {};
      const depts = d.department_stats || {};

      body.innerHTML = `
<div class="ih-section-header">
  <div>
    <h2 class="ih-section-title">🧬 Organizational Optimizer</h2>
    <p class="ih-section-desc">AI-driven employee clustering, performance analysis, and smart redistribution recommendations.</p>
  </div>
</div>

<div class="ih-org-summary">
  ${[
    ['Total Staff', summ.total||0, '#2196f3'],
    ['High Performers', summ.high_performers||0, '#00e676'],
    ['Core Team', summ.core_team||0, '#ffa726'],
    ['Needs Support', summ.needs_support||0, '#f44336'],
    ['Avg Score', (summ.avg_score||0).toFixed(1)+'/100', '#a78bfa']
  ].map(([l,v,c]) => `<div class="ih-org-sum-chip" style="border-color:${c}40">
      <div style="color:${c};font-size:20px;font-weight:700">${v}</div>
      <div style="color:rgba(255,255,255,.6);font-size:11px">${l}</div>
    </div>`).join('')}
</div>

<div class="ih-org-layout">
  <!-- Cluster Scatter Plot -->
  <div class="ih-cluster-panel">
    <h3 class="ih-sub-title">Employee Performance Clusters</h3>
    <canvas id="ih-org-chart" height="300"></canvas>
    <div class="ih-cluster-legend">
      <span style="color:#00e676">● High Performer</span>
      <span style="color:#2196f3">● Core Team</span>
      <span style="color:#f44336">● Needs Support</span>
    </div>
  </div>

  <!-- Department Table -->
  <div class="ih-dept-panel">
    <h3 class="ih-sub-title">Department Performance</h3>
    <table class="ih-mini-table">
      <thead><tr><th>Department</th><th>Staff</th><th>Avg Score</th></tr></thead>
      <tbody>
        ${Object.entries(depts).sort((a,b) => b[1].avg_score - a[1].avg_score).map(([d, s]) => `
          <tr>
            <td>${d.toUpperCase()}</td>
            <td>${s.count}</td>
            <td><div class="ih-score-bar-wrap">
              <div class="ih-score-bar" style="width:${s.avg_score}%;background:${s.avg_score>=80?'#00e676':s.avg_score>=60?'#ffa726':'#f44336'}"></div>
              <span>${s.avg_score.toFixed(0)}</span>
            </div></td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>

${suggs.length > 0 ? `
<h3 class="ih-sub-title" style="margin-top:24px">💡 AI Redistribution Suggestions</h3>
<div class="ih-sugg-cards">
  ${suggs.map(s => `<div class="ih-sugg-card">
    <div class="ih-sugg-header">
      <span class="ih-sugg-name">👤 ${_esc(s.employee)}</span>
      <span class="ih-sugg-type">${s.type}</span>
    </div>
    <div class="ih-sugg-move">${s.from_dept.toUpperCase()} → ${s.to_dept.toUpperCase()}</div>
    <p class="ih-sugg-reasoning">${_esc(s.reasoning)}</p>
    <div class="ih-sugg-impact">📈 ${_esc(s.impact)}</div>
    <button class="ih-btn-sm ih-btn-apply-sugg"
            onclick="IntelligenceHub._applyOrgSuggestion(${s.employee_id},'${s.to_dept}')">
      Apply Suggestion
    </button>
  </div>`).join('')}
</div>` : ''}`;

      // Render scatter chart
      _renderOrgChart(emps);
    } catch(e) {
      body.innerHTML = _errorState(e);
    }
  }

  function _renderOrgChart(emps) {
    const canvas = document.getElementById('ih-org-chart');
    if (!canvas || !window.Chart) return;
    const clusterColors = { 'High Performer': '#00e676', 'Core Team': '#2196f3', 'Needs Support': '#f44336' };
    const datasets = {};
    emps.forEach(e => {
      const cl = e.label || 'Core Team';
      if (!datasets[cl]) datasets[cl] = { label: cl, data: [], backgroundColor: clusterColors[cl] || '#888', borderColor: 'transparent', pointRadius: 7 };
      datasets[cl].data.push({ x: e.salary ? e.salary / 1000 : 50, y: e.score || 70, label: e.name });
    });
    new Chart(canvas, {
      type: 'scatter',
      data: { datasets: Object.values(datasets) },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => `${ctx.raw.label}: Score ${ctx.raw.y}` }
        }},
        scales: {
          x: { title: { display: true, text: 'Salary (K)', color: '#888' }, grid: { color: '#333' }, ticks: { color: '#888' } },
          y: { title: { display: true, text: 'Performance Score', color: '#888' }, grid: { color: '#333' }, ticks: { color: '#888' }, min: 0, max: 100 }
        }
      }
    });
  }

  async function _applyOrgSuggestion(empId, newDept) {
    if (!confirm(`Reassign this employee to ${newDept.toUpperCase()}? This will be logged in the audit trail.`)) return;
    // Create autopilot action and auto-approve
    _flashSuccess('Generating AI action for this reassignment…');
    await triggerScan();
    setTimeout(() => _renderOrg(), 1000);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 🧪 DIGITAL TWIN (3D Three.js)
  // ══════════════════════════════════════════════════════════════════════════
  async function _renderTwin() {
    const body = document.getElementById('ih-body');
    body.innerHTML = `
<div class="ih-section-header">
  <div>
    <h2 class="ih-section-title">🧪 Digital Twin Simulation</h2>
    <p class="ih-section-desc">3D virtual model of your organization. Simulate changes before applying them.</p>
  </div>
  <button class="ih-scan-btn" onclick="IntelligenceHub._takeSnapshot()">📸 Snapshot</button>
</div>

<div class="ih-twin-layout">
  <div class="ih-twin-3d-panel">
    <div id="ih-3d-container" style="width:100%;height:420px;border-radius:12px;overflow:hidden;position:relative;
         border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.5)">
      <div id="ih-3d-loading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#888">
        <div class="ih-spinner"></div>
      </div>
    </div>
    <p class="ih-twin-hint">🖱 Drag to rotate · Scroll to zoom · Hover nodes for details</p>
  </div>

  <div class="ih-twin-controls">
    <h3 class="ih-sub-title">What-If Simulator</h3>
    <div class="ih-form">
      <label>Change Type</label>
      <select id="twin-change-type" class="ih-sel">
        <option value="increase_headcount">Increase Headcount</option>
        <option value="reduce_budget">Reduce Budget</option>
        <option value="automate_workflow">Automate Workflow</option>
      </select>
      <label>Department</label>
      <select id="twin-dept" class="ih-sel">
        <option value="hr">HR</option>
        <option value="finance">Finance</option>
        <option value="marketing">Marketing</option>
        <option value="operations">Operations</option>
        <option value="logistics">Logistics</option>
      </select>
      <label>Value / Percentage</label>
      <input type="number" id="twin-val" value="15" class="ih-input" placeholder="e.g. 15 (%)"/>
      <button class="ih-btn-simulate" onclick="IntelligenceHub._runSimulation()">▶ Run Simulation</button>
    </div>

    <div id="twin-sim-results" class="ih-sim-results hidden">
      <h4>Simulation Results</h4>
      <div id="twin-predictions"></div>
    </div>

    <div id="twin-snapshots-list" class="ih-snapshots-list">
      <h4>Saved Snapshots</h4>
      <div id="twin-snaps-items"><div class="ih-loading-sm">Loading…</div></div>
    </div>
  </div>
</div>`;

    // Load snapshots list
    _loadSnapshots();
    // Build 3D scene
    setTimeout(() => _build3DScene(), 100);
  }

  async function _build3DScene() {
    if (!window.THREE) { console.warn('Three.js not loaded'); return; }
    const container = document.getElementById('ih-3d-container');
    if (!container) return;
    document.getElementById('ih-3d-loading')?.remove();

    // Fetch org data
    let orgData = {};
    try {
      const r = await fetch(`/api/autopilot/org?domain=${_domain}`);
      orgData = await r.json();
    } catch(e) {}

    const depts = Object.keys(orgData.department_stats || {
      hr: {}, finance: {}, marketing: {}, operations: {}, logistics: {}
    });
    const deptStats = orgData.department_stats || {};

    // Scene setup
    const w = container.offsetWidth, h = 420;
    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(60, w/h, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    camera.position.set(0, 5, 18);

    _twinScene = { renderer, scene, camera };

    // Lighting
    scene.add(new THREE.AmbientLight(0x334466, 0.8));
    const dLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dLight.position.set(5, 10, 7);
    scene.add(dLight);

    // Center "Core" node
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x00d2ff, emissive: 0x005588, emissiveIntensity: 0.5 });
    const coreGeo = new THREE.SphereGeometry(1, 32, 32);
    const coreNode = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreNode);

    // Dept colors
    const deptColors = [0xe91e8c, 0x00e676, 0xffa726, 0x2196f3, 0xa78bfa, 0xf44336, 0xff7043, 0x26c6da];

    // Department nodes
    const deptNodes = [];
    depts.forEach((dept, i) => {
      const angle = (i / depts.length) * Math.PI * 2;
      const radius = 5.5;
      const stats = deptStats[dept] || {};
      const perfScore = (stats.avg_score || 70) / 100;
      const size = 0.5 + perfScore * 0.8;
      const color = deptColors[i % deptColors.length];

      const mat = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.2, roughness: 0.4, metalness: 0.3
      });
      const geo = new THREE.SphereGeometry(size, 24, 24);
      const node = new THREE.Mesh(geo, mat);
      node.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      node.userData = { dept, stats };
      scene.add(node);
      deptNodes.push(node);

      // Connection line to core
      const pts = [new THREE.Vector3(0,0,0), node.position.clone()];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({ color, opacity: 0.3, transparent: true });
      scene.add(new THREE.Line(lineGeo, lineMat));

      // Employee sub-nodes
      const empCount = Math.min(stats.count || 3, 6);
      for (let j = 0; j < empCount; j++) {
        const angle2 = (j / empCount) * Math.PI * 2;
        const subSize = 0.15;
        const subMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.1 });
        const subGeo = new THREE.SphereGeometry(subSize, 12, 12);
        const subNode = new THREE.Mesh(subGeo, subMat);
        const subR = size + 0.8;
        subNode.position.set(
          node.position.x + Math.cos(angle2) * subR * 0.5,
          Math.sin(angle2) * 0.4,
          node.position.z + Math.sin(angle2) * subR * 0.5
        );
        scene.add(subNode);
      }
    });

    // Grid helper
    const grid = new THREE.GridHelper(30, 20, 0x334455, 0x223344);
    grid.position.y = -2;
    scene.add(grid);

    // Orbit controls (manual)
    let isDragging = false, prevMouse = {x:0,y:0};
    let theta = 0, phi = 0.3, sphereR = 18;

    renderer.domElement.addEventListener('mousedown', e => { isDragging = true; prevMouse = {x:e.clientX,y:e.clientY}; });
    renderer.domElement.addEventListener('mousemove', e => {
      if (!isDragging) return;
      theta -= (e.clientX - prevMouse.x) * 0.01;
      phi = Math.max(-1, Math.min(1, phi - (e.clientY - prevMouse.y) * 0.005));
      prevMouse = {x:e.clientX, y:e.clientY};
      camera.position.set(
        sphereR * Math.sin(theta) * Math.cos(phi),
        sphereR * Math.sin(phi) + 2,
        sphereR * Math.cos(theta) * Math.cos(phi)
      );
      camera.lookAt(0, 0, 0);
    });
    renderer.domElement.addEventListener('mouseup', () => isDragging = false);
    renderer.domElement.addEventListener('wheel', e => {
      sphereR = Math.max(8, Math.min(40, sphereR + e.deltaY * 0.02));
    });

    // Animation loop
    let t = 0;
    function animate() {
      if (!document.getElementById('ih-3d-container')) return;
      requestAnimationFrame(animate);
      t += 0.01;
      // Pulse core
      coreNode.scale.setScalar(1 + Math.sin(t) * 0.05);
      // Gentle auto-rotate when not dragging
      if (!isDragging) {
        theta += 0.002;
        camera.position.set(
          sphereR * Math.sin(theta) * Math.cos(phi),
          sphereR * Math.sin(phi) + 2,
          sphereR * Math.cos(theta) * Math.cos(phi)
        );
        camera.lookAt(0, 0, 0);
      }
      deptNodes.forEach((n, i) => {
        n.rotation.y += 0.01;
        n.position.y = Math.sin(t + i) * 0.3;
      });
      renderer.render(scene, camera);
    }
    animate();
  }

  async function _runSimulation() {
    const changeType = document.getElementById('twin-change-type')?.value;
    const dept = document.getElementById('twin-dept')?.value;
    const val  = parseFloat(document.getElementById('twin-val')?.value || 15);

    const r = await fetch('/api/autopilot/digital-twin/simulate', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ domain: _domain, change_type: changeType,
        params: { department: dept, count: val, pct: val }})
    });
    const d = await r.json();
    const preds = d.predictions || [];
    const container = document.getElementById('twin-sim-results');
    const predsDiv  = document.getElementById('twin-predictions');
    if (!container || !predsDiv) return;
    container.classList.remove('hidden');
    predsDiv.innerHTML = preds.map(p => `
      <div class="ih-pred-row">
        <div class="ih-pred-metric">${p.metric}</div>
        <div class="ih-pred-vals">
          <span class="ih-pred-before">${p.before}</span>
          <span>→</span>
          <span class="ih-pred-after ${p.change.includes('-')||p.change==='decrease'?'ih-pred-bad':'ih-pred-good'}">${p.after}</span>
        </div>
      </div>`).join('');
  }

  async function _takeSnapshot() {
    const r = await fetch('/api/autopilot/digital-twin/snapshot', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ domain: _domain })
    });
    const d = await r.json();
    _flashSuccess(`📸 Snapshot saved: ${d.name}`);
    _loadSnapshots();
  }

  async function _loadSnapshots() {
    const el = document.getElementById('twin-snaps-items');
    if (!el) return;
    try {
      const r = await fetch(`/api/autopilot/digital-twin/snapshots?domain=${_domain}`);
      const d = await r.json();
      const snaps = d.snapshots || [];
      el.innerHTML = snaps.length === 0 ? '<p class="ih-empty-sm">No snapshots yet</p>' :
        snaps.map(s => `<div class="ih-snap-item">
          <span class="ih-snap-icon">📸</span>
          <div><div class="ih-snap-name">${_esc(s.name)}</div>
               <div class="ih-snap-time">${s.created_at?.substring(0,16).replace('T',' ')}</div></div>
        </div>`).join('');
    } catch(e) { el.innerHTML = '<p class="ih-empty-sm">Could not load snapshots</p>'; }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 📣 SMART NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════════════════
  async function _renderNotify() {
    const body = document.getElementById('ih-body');
    body.innerHTML = '<div class="ih-loading"><div class="ih-spinner"></div></div>';
    try {
      const r = await fetch(`/api/notifications/smart?domain=${_domain}`);
      const d = await r.json();
      const notifs = d.notifications || [];
      const unread = d.unread_count || 0;
      _setBadge('notify', unread);

      const byPriority = { critical: [], warning: [], info: [] };
      notifs.forEach(n => (byPriority[n.priority] || byPriority.info).push(n));

      body.innerHTML = `
<div class="ih-section-header">
  <div>
    <h2 class="ih-section-title">📣 Smart Notification Center</h2>
    <p class="ih-section-desc">Role-based, priority-classified intelligent alerts from across the platform.</p>
  </div>
  <div style="display:flex;gap:8px;align-items:center">
    <div class="ih-stat-pill" style="color:#f44336">${byPriority.critical.length} Critical</div>
    <div class="ih-stat-pill" style="color:#ffa726">${byPriority.warning.length} Warning</div>
    <button class="ih-btn-sm" onclick="IntelligenceHub._markAllRead()" style="margin-left:8px">✔ Mark All Read</button>
  </div>
</div>

${['critical','warning','info'].map(p => byPriority[p].length === 0 ? '' : `
<div class="ih-notif-group">
  <div class="ih-notif-group-header" style="color:${{critical:'#f44336',warning:'#ffa726',info:'#2196f3'}[p]}">
    ${{'critical':'🔴','warning':'🟡','info':'🔵'}[p]} ${p.toUpperCase()} (${byPriority[p].length})
  </div>
  ${byPriority[p].map(n => _notifCard(n, p)).join('')}
</div>`).join('')}
${notifs.length === 0 ? _emptyState('📭', 'All clear', 'No notifications at this time') : ''}`;
    } catch(e) {
      body.innerHTML = _errorState(e);
    }
  }

  function _notifCard(n, p) {
    const bgColor = { critical: 'rgba(244,67,54,.1)', warning: 'rgba(255,167,38,.1)', info: 'rgba(33,150,243,.1)' }[p] || '';
    const borderColor = { critical: '#f44336', warning: '#ffa726', info: '#2196f3' }[p] || '#555';
    const catIcon = { anomaly: '🧠', autopilot: '🤖', okr: '🎯', audit: '🔐', system: '⚙️', campaign: '📣' }[n.category] || '🔔';
    return `<div class="ih-notif-card ${n.is_read ? 'ih-notif-read' : ''}"
         style="background:${bgColor};border-left:3px solid ${borderColor}">
  <div class="ih-notif-icon">${catIcon}</div>
  <div class="ih-notif-body">
    <div class="ih-notif-title">${_esc(n.title)}</div>
    <div class="ih-notif-msg">${_esc(n.message || '')}</div>
    <div class="ih-notif-meta">${n.category} · ${n.created_at?.substring(0,16).replace('T',' ')}</div>
  </div>
  ${!n.is_read ? `<button class="ih-notif-read-btn" onclick="IntelligenceHub._markRead(${n.id})">✔</button>` : ''}
</div>`;
  }

  async function _markRead(id) {
    await fetch(`/api/notifications/smart/${id}/read`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ domain: _domain })
    });
    setTimeout(() => _renderNotify(), 200);
  }

  async function _markAllRead() {
    await fetch('/api/notifications/smart/read-all', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ domain: _domain })
    });
    setTimeout(() => _renderNotify(), 300);
  }

  async function _loadNotificationBadge() {
    try {
      const r = await fetch(`/api/notifications/smart?domain=${_domain}&unread_only=true`);
      const d = await r.json();
      const cnt = d.unread_count || 0;
      _setBadge('notify', cnt);
      // Also update main header bell
      const dot = document.querySelector('.notif-dot');
      if (dot) dot.classList.toggle('hidden', cnt === 0);
    } catch(e) {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SCAN TRIGGER
  // ═══════════════════════════════════════════════════════════════════════
  async function triggerScan() {
    const btn  = document.getElementById('ih-scan-btn');
    const icon = document.getElementById('ih-scan-icon');
    if (btn) { btn.disabled = true; if (icon) icon.textContent = '⏳'; }
    try {
      const r = await fetch('/api/autopilot/scan', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ domain: _domain })
      });
      const d = await r.json();
      const results = d.scan_results || {};
      const totalAnomalies = Object.values(results).reduce((s, r) => s + (r.anomalies||0), 0);
      const totalActions   = Object.values(results).reduce((s, r) => s + (r.actions_generated||0), 0);
      _flashSuccess(`✅ Scan complete: ${totalAnomalies} anomalies, ${totalActions} AI actions generated`);
      // Refresh current tab
      _setTab(_activeTab);
      _loadNotificationBadge();
    } catch(e) {
      _flashError('Scan failed: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; if (icon) icon.textContent = '⚡'; }
    }
  }

  async function toggleAutomation(enabled) {
    _automationEnabled = enabled;
    if (enabled) {
      _flashSuccess('🤖 Automated AI scanning enabled — running every 5 minutes');
      _scanInterval = setInterval(() => triggerScan(), 5 * 60 * 1000);
    } else {
      if (_scanInterval) { clearInterval(_scanInterval); _scanInterval = null; }
      _flashSuccess('Automated scanning paused');
    }
    await fetch('/api/autopilot/automation/toggle', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ enabled, interval_minutes: 5 })
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ════════════════════════════════════════════════════════════════════════
  function _setBadge(tab, count) {
    const el = document.getElementById(`ih-badge-${tab}`);
    if (!el) return;
    if (count > 0) { el.textContent = count; el.classList.remove('hidden'); }
    else { el.classList.add('hidden'); }
  }

  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _domainLabel(d) {
    return { banking: '🏦 Banking', healthcare: '🏥 Healthcare',
             education: '🎓 Education', manufacturing: '🏭 Manufacturing' }[d] || d;
  }

  function _actionTypeIcon(t) {
    return { CREATE:'➕', UPDATE:'✏️', DELETE:'🗑️', LOGIN:'🔑', LOGOUT:'🚪',
             AI_ACTION:'🤖', APPROVE:'✅', REJECT:'❌', MANUAL:'📝' }[t] || '📋';
  }

  function _emptyState(icon, title, desc) {
    return `<div class="ih-empty-state"><div class="ih-empty-icon">${icon}</div>
      <h3>${title}</h3><p>${desc}</p></div>`;
  }

  function _errorState(e) {
    return `<div class="ih-empty-state" style="color:#f44336">
      <div class="ih-empty-icon">⚠️</div><h3>Load Error</h3><p>${e.message || String(e)}</p>
      <button class="ih-btn-sm" onclick="IntelligenceHub._setTab(IntelligenceHub._activeTab)">Retry</button>
    </div>`;
  }

  function _flashSuccess(msg) {
    _flash(msg, '#00e676');
  }
  function _flashError(msg) {
    _flash(msg, '#f44336');
  }
  function _flash(msg, color) {
    const el = document.createElement('div');
    el.className = 'ih-flash';
    el.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);
      background:${color};color:#000;padding:10px 20px;border-radius:8px;font-weight:600;
      z-index:99999;animation:ihFlashIn .3s ease;pointer-events:none`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function _modal(title, content, onConfirm, confirmLabel = 'Confirm') {
    document.getElementById('ih-modal')?.remove();
    const m = document.createElement('div');
    m.id = 'ih-modal';
    m.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;
      display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)`;
    m.innerHTML = `<div class="ih-modal-box">
      <div class="ih-modal-header"><h3>${title}</h3>
        <button onclick="document.getElementById('ih-modal')?.remove()">✕</button></div>
      <div class="ih-modal-body">${content}</div>
      <div class="ih-modal-footer">
        <button class="ih-btn-cancel" onclick="document.getElementById('ih-modal')?.remove()">Cancel</button>
        <button class="ih-btn-confirm" id="ih-modal-confirm">${confirmLabel}</button>
      </div></div>`;
    document.body.appendChild(m);
    document.getElementById('ih-modal-confirm').onclick = onConfirm;
  }

  function _closeModal() {
    document.getElementById('ih-modal')?.remove();
  }

  // ════════════════════════════════════════════════════════════════════════
  // STYLES
  // ════════════════════════════════════════════════════════════════════════
  function _styleHub() {
    if (document.getElementById('ih-styles')) return;
    const style = document.createElement('style');
    style.id = 'ih-styles';
    style.textContent = `
@keyframes ihIn { from { opacity:0; transform:scale(.97) } to { opacity:1; transform:scale(1) } }
@keyframes ihFlashIn { from { opacity:0; transform:translateX(-50%) translateY(-10px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }
@keyframes spin { to { transform:rotate(360deg) } }
@keyframes ihClose { to { opacity:0; transform:scale(.97) } }

.ih-overlay {
  position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,.75);backdrop-filter:blur(12px);opacity:0;transition:opacity .3s ease;
}
.ih-overlay.ih-visible { opacity:1; }
.ih-overlay.ih-closing { animation:ihClose .4s ease forwards; }
.ih-panel {
  width:96vw;max-width:1340px;height:90vh;background:linear-gradient(145deg,#0d1117,#161b22);
  border:1px solid rgba(255,255,255,.1);border-radius:20px;display:flex;flex-direction:column;
  overflow:hidden;animation:ihIn .3s ease;box-shadow:0 25px 80px rgba(0,0,0,.7);
}
.ih-header {
  display:flex;align-items:center;justify-content:space-between;padding:16px 24px;
  border-bottom:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02);flex-shrink:0;
}
.ih-header-icon { font-size:28px;margin-right:14px;filter:drop-shadow(0 0 10px #00d2ff); }
.ih-title { font-size:18px;font-weight:700;color:#fff;letter-spacing:.3px; }
.ih-subtitle { font-size:11px;color:rgba(255,255,255,.4);margin-top:2px; }
.ih-header-right { display:flex;align-items:center;gap:10px; }
.ih-header-left { display:flex;align-items:center; }

.ih-domain-sel, .ih-sel {
  background:#1e2433;border:1px solid rgba(255,255,255,.15);color:#fff;
  border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;
}
.ih-scan-btn {
  background:linear-gradient(135deg,#00d2ff,#0090b8);color:#000;border:none;
  border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;
  transition:all .2s;display:flex;align-items:center;gap:5px;
}
.ih-scan-btn:hover { transform:translateY(-1px);box-shadow:0 4px 15px rgba(0,210,255,.3); }
.ih-scan-btn:disabled { opacity:.5;transform:none; }
.ih-close-btn {
  background:rgba(255,255,255,.08);border:none;color:#fff;width:34px;height:34px;
  border-radius:8px;cursor:pointer;font-size:16px;transition:background .2s;
}
.ih-close-btn:hover { background:rgba(255,255,255,.15); }

.ih-auto-toggle { display:flex;align-items:center;gap:6px;font-size:11px;color:rgba(255,255,255,.5); }
.ih-toggle-switch { position:relative;width:36px;height:20px;cursor:pointer; }
.ih-toggle-switch input { opacity:0;width:0;height:0; }
.ih-toggle-knob {
  position:absolute;inset:0;background:#333;border-radius:20px;transition:.3s;
}
.ih-toggle-knob::before {
  content:'';position:absolute;width:14px;height:14px;background:#fff;
  border-radius:50%;left:3px;bottom:3px;transition:.3s;
}
.ih-toggle-switch input:checked + .ih-toggle-knob { background:#00d2ff; }
.ih-toggle-switch input:checked + .ih-toggle-knob::before { transform:translateX(16px); }

.ih-tabs {
  display:flex;gap:2px;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.07);
  flex-shrink:0;overflow-x:auto;scrollbar-width:none;
}
.ih-tabs::-webkit-scrollbar { display:none; }
.ih-tab {
  display:flex;align-items:center;gap:6px;padding:7px 14px;border:none;
  background:transparent;color:rgba(255,255,255,.45);border-radius:8px;
  cursor:pointer;font-size:12px;font-weight:500;transition:all .2s;white-space:nowrap;position:relative;
}
.ih-tab:hover { background:rgba(255,255,255,.06);color:rgba(255,255,255,.8); }
.ih-tab-active { background:rgba(0,210,255,.12);color:#00d2ff;font-weight:600; }
.ih-tab-icon { font-size:14px; }
.ih-tab-badge {
  position:absolute;top:4px;right:4px;background:#f44336;color:#fff;
  font-size:9px;font-weight:700;border-radius:8px;padding:1px 4px;min-width:14px;text-align:center;
}

.ih-body { flex:1;overflow-y:auto;padding:20px 24px;scrollbar-width:thin;
  scrollbar-color:rgba(255,255,255,.1) transparent; }
.ih-loading { display:flex;flex-direction:column;align-items:center;justify-content:center;
  height:200px;color:rgba(255,255,255,.4);gap:12px; }
.ih-spinner { width:36px;height:36px;border:3px solid rgba(255,255,255,.1);
  border-top-color:#00d2ff;border-radius:50%;animation:spin .8s linear infinite; }

.ih-section-header { display:flex;justify-content:space-between;align-items:flex-start;
  margin-bottom:20px; }
.ih-section-title { font-size:20px;font-weight:700;color:#fff;margin-bottom:4px; }
.ih-section-desc { font-size:12px;color:rgba(255,255,255,.45); }
.ih-header-stats { display:flex;gap:8px;flex-wrap:wrap;align-items:center; }
.ih-stat-pill {
  padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;
  background:rgba(255,255,255,.08);color:rgba(255,255,255,.7);
}
.ih-stat-pending { background:rgba(255,167,38,.15);color:#ffa726; }

.ih-filter-bar { display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap; }
.ih-filter-btn { border:1px solid rgba(255,255,255,.12);background:transparent;color:rgba(255,255,255,.5);
  border-radius:6px;padding:4px 12px;font-size:11px;cursor:pointer;transition:all .2s; }
.ih-filter-btn:hover,.ih-filter-active {background:rgba(0,210,255,.1);color:#00d2ff;border-color:#00d2ff40; }

.ih-actions-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px; }
.ih-action-card {
  background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;
  padding:18px;transition:all .2s;
}
.ih-action-card:hover { border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.05); }
.ih-action-header { display:flex;align-items:flex-start;gap:12px;margin-bottom:10px; }
.ih-action-type-icon { font-size:24px;flex-shrink:0; }
.ih-action-meta { flex:1; }
.ih-action-title { font-size:14px;font-weight:600;color:#fff; }
.ih-action-dept { font-size:11px;color:rgba(255,255,255,.4);margin-top:2px; }
.ih-action-badges { display:flex;gap:6px;flex-direction:column;align-items:flex-end; }
.ih-risk-badge { font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px; }
.ih-status-badge { font-size:10px;font-weight:600;text-transform:capitalize; }
.ih-action-desc { font-size:12px;color:rgba(255,255,255,.55);margin-bottom:12px;line-height:1.5; }

.ih-xai-box { background:rgba(167,139,250,.06);border:1px solid rgba(167,139,250,.2);
  border-radius:10px;padding:12px;margin-bottom:12px; }
.ih-xai-label { font-size:10px;font-weight:700;color:#a78bfa;text-transform:uppercase;
  letter-spacing:.5px;margin-bottom:6px; }
.ih-xai-text { font-size:11px;color:rgba(255,255,255,.6);line-height:1.5;margin-bottom:8px; }
.ih-data-points { display:flex;flex-wrap:wrap;gap:4px; }
.ih-dp { background:rgba(167,139,250,.12);color:#c4b5fd;font-size:10px;
  padding:2px 8px;border-radius:20px;font-family:monospace; }

.ih-action-metrics { display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px; }
.ih-metric-item { text-align:center;background:rgba(255,255,255,.03);border-radius:8px;padding:8px; }
.ih-metric-val { font-size:14px;font-weight:700;color:#fff;margin-bottom:3px;word-break:break-word; }
.ih-metric-label { font-size:9px;color:rgba(255,255,255,.35);text-transform:uppercase; }
.ih-outcome-val { font-size:10px; }

.ih-action-btns { display:flex;gap:10px; }
.ih-btn-approve,.ih-btn-reject,.ih-btn-create,.ih-btn-simulate {
  border:none;border-radius:8px;padding:9px 16px;font-size:12px;font-weight:600;
  cursor:pointer;transition:all .2s;flex:1;
}
.ih-btn-approve { background:linear-gradient(135deg,#00e676,#00b248);color:#000; }
.ih-btn-approve:hover { transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,230,118,.3); }
.ih-btn-reject { background:rgba(244,67,54,.15);color:#f44336;border:1px solid rgba(244,67,54,.3); }
.ih-btn-reject:hover { background:rgba(244,67,54,.25); }
.ih-action-done { text-align:center;font-size:11px;color:rgba(255,255,255,.3);padding:8px; }

.ih-btn-sm {
  border:1px solid rgba(255,255,255,.15);background:transparent;color:rgba(255,255,255,.6);
  border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;transition:all .2s;
}
.ih-btn-sm:hover { background:rgba(255,255,255,.1); }
.ih-btn-resolve { color:#00e676;border-color:rgba(0,230,118,.3); }
.ih-btn-fp { color:#ffa726;border-color:rgba(255,167,38,.3); }
.ih-btn-apply-sugg { color:#00d2ff;border-color:rgba(0,210,255,.3);display:block;margin-top:10px; }
.ih-btn-create {
  background:linear-gradient(135deg,#a78bfa,#7c3aed);color:#fff;
  border:none;border-radius:8px;padding:8px 16px;font-size:12px;cursor:pointer;
}
.ih-btn-simulate {
  background:linear-gradient(135deg,#00d2ff,#0090b8);color:#000;width:100%;margin-top:8px;
}

.ih-anomaly-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px; }
.ih-anomaly-card { background:rgba(255,255,255,.03);border-radius:12px;padding:16px; }
.ih-anomaly-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px; }
.ih-acon-left { display:flex;gap:10px;align-items:flex-start; }
.ih-src-icon { font-size:22px; }
.ih-anomaly-type { font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px; }
.ih-anomaly-src { font-size:10px;color:rgba(255,255,255,.35);margin-top:2px; }
.ih-zscore-badge { font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap; }
.ih-anomaly-desc { font-size:12px;color:rgba(255,255,255,.6);margin-bottom:10px;line-height:1.5; }
.ih-baseline-cmp { display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px; }
.ih-baseline-cmp > div { background:rgba(255,255,255,.03);border-radius:8px;padding:6px 8px;text-align:center; }
.ih-baseline-cmp span { display:block;font-size:9px;color:rgba(255,255,255,.35);margin-bottom:3px; }
.ih-baseline-cmp strong { font-size:13px;font-weight:700;color:#fff; }
.ih-action-suggest { font-size:11px;color:rgba(255,255,255,.5);background:rgba(255,255,255,.04);
  border-radius:8px;padding:8px;margin-bottom:10px;line-height:1.4; }
.ih-anomaly-btns { display:flex;gap:8px; }

.ih-audit-meta-row { display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap; }
.ih-audit-type-chip { display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 14px; }
.ih-audit-action-icon { font-size:20px; }
.ih-atype { font-size:10px;font-weight:700;color:rgba(255,255,255,.6);text-transform:uppercase; }
.ih-acount { font-size:16px;font-weight:700;color:#fff; }
.ih-audit-search-bar { display:flex;gap:8px;margin-bottom:16px;align-items:center; }
.ih-search-input {
  flex:1;background:#1e2433;border:1px solid rgba(255,255,255,.12);color:#fff;
  border-radius:8px;padding:8px 12px;font-size:12px;
}
.ih-export-btn { background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
  color:rgba(255,255,255,.7);border-radius:8px;padding:7px 14px;font-size:11px;cursor:pointer; }
.ih-export-btn:hover { background:rgba(255,255,255,.12); }

.ih-timeline { display:flex;flex-direction:column;gap:0; }
.ih-audit-entry { display:flex;gap:14px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.05);
  position:relative; }
.ih-audit-dot { width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:5px; }
.ih-audit-content { flex:1; }
.ih-audit-row-top { display:flex;gap:12px;align-items:center;margin-bottom:4px;flex-wrap:wrap; }
.ih-audit-action { font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px; }
.ih-audit-entity { font-size:11px;color:rgba(255,255,255,.5); }
.ih-audit-time { font-size:10px;color:rgba(255,255,255,.3);margin-left:auto; }
.ih-audit-row-meta { display:flex;gap:10px;flex-wrap:wrap;align-items:center; }
.ih-audit-user { font-size:11px;color:rgba(255,255,255,.6); }
.ih-audit-role { font-size:10px;color:rgba(255,255,255,.3); }
.ih-audit-desc { font-size:11px;color:rgba(255,255,255,.4);font-style:italic; }
.ih-diff-details { margin-top:8px; }
.ih-diff-details summary { font-size:10px;color:rgba(255,255,255,.35);cursor:pointer; }
.ih-diff-grid { display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px; }
.ih-diff-before,.ih-diff-after { background:rgba(255,255,255,.03);border-radius:8px;padding:10px; }
.ih-diff-before h5 { color:#f44336;font-size:10px;margin-bottom:6px; }
.ih-diff-after  h5 { color:#00e676;font-size:10px;margin-bottom:6px; }
.ih-diff-before pre,.ih-diff-after pre { font-size:10px;color:rgba(255,255,255,.5);
  font-family:monospace;white-space:pre-wrap;word-break:break-all; }

.ih-okr-summary-row { display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px; }
.ih-okr-sum-card { background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
  border-radius:12px;padding:16px;text-align:center; }
.ih-okr-sum-val { font-size:24px;font-weight:700;margin-bottom:4px; }
.ih-okr-sum-label { font-size:11px;color:rgba(255,255,255,.4); }
.ih-okr-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:16px; }
.ih-obj-card { background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
  border-radius:14px;padding:18px;transition:all .2s; }
.ih-obj-card:hover { border-color:rgba(255,255,255,.15); }
.ih-obj-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px; }
.ih-obj-meta { flex:1;padding-right:12px; }
.ih-obj-title { font-size:14px;font-weight:600;color:#fff; }
.ih-obj-sub { font-size:11px;color:rgba(255,255,255,.4);margin-top:2px; }
.ih-obj-desc { font-size:12px;color:rgba(255,255,255,.45);margin-bottom:12px; }
.ih-radial-prog { position:relative;width:50px;height:50px;flex-shrink:0; }
.ih-radial-svg { transform:rotate(-90deg);width:100%;height:100%; }
.ih-radial-bg { fill:none;stroke:rgba(255,255,255,.08);stroke-width:4; }
.ih-radial-fg { fill:none;stroke-width:4;stroke-linecap:round;transition:stroke-dasharray .6s ease; }
.ih-radial-text { position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:700; }
.ih-kr-list { display:flex;flex-direction:column;gap:8px;margin-bottom:10px; }
.ih-kr-row { display:flex;align-items:center;gap:8px; }
.ih-kr-info { flex:1; }
.ih-kr-title { font-size:11px;color:rgba(255,255,255,.7); }
.ih-kr-vals { font-size:10px;color:rgba(255,255,255,.35); }
.ih-kr-bar-wrap { width:80px;height:4px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden; }
.ih-kr-bar { height:100%;border-radius:2px;transition:width .6s ease; }
.ih-kr-pct { font-size:11px;font-weight:600;width:30px;text-align:right; }
.ih-kr-status { font-size:9px;text-transform:uppercase;width:60px; }
.ih-kr-empty { font-size:11px;color:rgba(255,255,255,.25);text-align:center;padding:8px; }
.ih-btn-add-kr { display:block;width:100%;text-align:center;padding:6px; }

.ih-org-summary { display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px; }
.ih-org-sum-chip { background:rgba(255,255,255,.04);border-radius:10px;padding:12px 18px;
  text-align:center;border:1px solid transparent; }
.ih-org-layout { display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:20px; }
.ih-cluster-panel,.ih-dept-panel { background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);
  border-radius:14px;padding:18px; }
.ih-sub-title { font-size:13px;font-weight:600;color:rgba(255,255,255,.7);margin-bottom:12px; }
.ih-cluster-legend { display:flex;gap:16px;font-size:11px;color:rgba(255,255,255,.5);margin-top:8px; }
.ih-mini-table { width:100%;border-collapse:collapse;font-size:11px; }
.ih-mini-table th { color:rgba(255,255,255,.3);font-size:10px;text-transform:uppercase;
  padding:6px 0;text-align:left;border-bottom:1px solid rgba(255,255,255,.06); }
.ih-mini-table td { padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);
  color:rgba(255,255,255,.7); }
.ih-score-bar-wrap { display:flex;align-items:center;gap:6px; }
.ih-score-bar { height:6px;border-radius:3px;transition:width .6s; }
.ih-sugg-cards { display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;
  margin-top:12px; }
.ih-sugg-card { background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
  border-radius:12px;padding:14px; }
.ih-sugg-header { display:flex;justify-content:space-between;margin-bottom:6px; }
.ih-sugg-name { font-size:13px;font-weight:600;color:#fff; }
.ih-sugg-type { font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase; }
.ih-sugg-move { font-size:13px;font-weight:700;color:#00d2ff;margin-bottom:8px; }
.ih-sugg-reasoning { font-size:11px;color:rgba(255,255,255,.5);line-height:1.5;margin-bottom:6px; }
.ih-sugg-impact { font-size:11px;color:#00e676;margin-bottom:8px; }

.ih-twin-layout { display:grid;grid-template-columns:2fr 1fr;gap:16px;height:500px;overflow:hidden; }
.ih-twin-3d-panel { display:flex;flex-direction:column;gap:8px; }
.ih-twin-hint { font-size:10px;color:rgba(255,255,255,.3);text-align:center; }
.ih-twin-controls { overflow-y:auto;display:flex;flex-direction:column;gap:12px; }
.ih-form { display:flex;flex-direction:column;gap:8px; }
.ih-form label { font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.3px; }
.ih-input { background:#1e2433;border:1px solid rgba(255,255,255,.12);color:#fff;
  border-radius:8px;padding:8px 12px;font-size:12px;width:100%; }
.ih-textarea { background:#1e2433;border:1px solid rgba(255,255,255,.12);color:#fff;
  border-radius:8px;padding:8px 12px;font-size:12px;width:100%;resize:none; }
.ih-sim-results { background:rgba(0,210,255,.05);border:1px solid rgba(0,210,255,.2);
  border-radius:10px;padding:14px; }
.ih-sim-results h4,.ih-snapshots-list h4 { font-size:12px;color:rgba(255,255,255,.6);margin-bottom:10px; }
.ih-pred-row { display:flex;justify-content:space-between;align-items:center;
  padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:12px; }
.ih-pred-metric { color:rgba(255,255,255,.7); }
.ih-pred-vals { display:flex;gap:8px;align-items:center; }
.ih-pred-before { color:rgba(255,255,255,.35); }
.ih-pred-good { color:#00e676;font-weight:600; }
.ih-pred-bad  { color:#f44336;font-weight:600; }
.ih-snap-item { display:flex;gap:10px;align-items:center;padding:8px 0;
  border-bottom:1px solid rgba(255,255,255,.05); }
.ih-snap-icon { font-size:18px; }
.ih-snap-name { font-size:12px;color:rgba(255,255,255,.7); }
.ih-snap-time { font-size:10px;color:rgba(255,255,255,.35); }
.ih-snapshots-list { border-top:1px solid rgba(255,255,255,.06);padding-top:12px;margin-top:4px; }
.ih-empty-sm { font-size:11px;color:rgba(255,255,255,.3);padding:8px 0; }
.ih-loading-sm { font-size:11px;color:rgba(255,255,255,.3);padding:4px 0; }

.ih-notif-group { margin-bottom:16px; }
.ih-notif-group-header { font-size:11px;font-weight:700;letter-spacing:.5px;
  margin-bottom:8px;text-transform:uppercase;padding-bottom:6px;
  border-bottom:1px solid rgba(255,255,255,.06); }
.ih-notif-card { display:flex;align-items:flex-start;gap:12px;padding:12px;
  border-radius:10px;margin-bottom:8px;transition:opacity .2s; }
.ih-notif-read { opacity:.45; }
.ih-notif-icon { font-size:20px;flex-shrink:0; }
.ih-notif-body { flex:1; }
.ih-notif-title { font-size:13px;font-weight:600;color:#fff;margin-bottom:3px; }
.ih-notif-msg { font-size:11px;color:rgba(255,255,255,.55);margin-bottom:4px;line-height:1.4; }
.ih-notif-meta { font-size:10px;color:rgba(255,255,255,.3); }
.ih-notif-read-btn { background:rgba(255,255,255,.08);border:none;color:rgba(255,255,255,.5);
  width:28px;height:28px;border-radius:6px;cursor:pointer;flex-shrink:0;transition:all .2s; }
.ih-notif-read-btn:hover { background:rgba(255,255,255,.15);color:#fff; }

.ih-empty-state { display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:60px 20px;color:rgba(255,255,255,.3);text-align:center; }
.ih-empty-icon { font-size:48px;margin-bottom:12px; }
.ih-empty-state h3 { font-size:16px;margin-bottom:6px;color:rgba(255,255,255,.5); }
.ih-empty-state p { font-size:13px; }

.ih-modal-box { background:#161b22;border:1px solid rgba(255,255,255,.12);border-radius:16px;
  width:480px;max-width:95vw;overflow:hidden; }
.ih-modal-header { display:flex;justify-content:space-between;align-items:center;
  padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08); }
.ih-modal-header h3 { font-size:15px;font-weight:600;color:#fff; }
.ih-modal-header button { background:none;border:none;color:rgba(255,255,255,.5);
  cursor:pointer;font-size:18px; }
.ih-modal-body { padding:20px; }
.ih-modal-footer { display:flex;justify-content:flex-end;gap:10px;
  padding:16px 20px;border-top:1px solid rgba(255,255,255,.08); }
.ih-btn-cancel { background:rgba(255,255,255,.06);border:none;color:rgba(255,255,255,.6);
  border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px; }
.ih-btn-confirm { background:linear-gradient(135deg,#a78bfa,#7c3aed);border:none;
  color:#fff;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600; }
`;
    document.head.appendChild(style);
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    open, close, setDomain, triggerScan, toggleAutomation,
    approveAction, rejectAction, resolveAnomaly,
    _setTab, _filterActions, _filterAudit, _searchAudit,
    _showCreateOKR, _showAddKR,
    _runSimulation, _takeSnapshot,
    _applyOrgSuggestion,
    _markRead, _markAllRead
  };
})();
