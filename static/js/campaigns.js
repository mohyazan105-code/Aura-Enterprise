/* ══════════════════════════════════════════════════════════════
   campaigns.js  –  Reward Campaign Hub  (Bank Domain UI)
   ══════════════════════════════════════════════════════════════ */

class CampaignsController {
    constructor() {
        this.container = null;
        this.activeTab  = 'dashboard';
        this._modalsInjected = false;
    }

    // ─── Modal Injection ─────────────────────────────────────────────────────
    _injectModals() {
        if (this._modalsInjected) return;
        this._modalsInjected = true;

        // ── New Campaign Modal ─────────────────────────────────────────────
        const cm = document.createElement('div');
        cm.id = 'camp-create-modal';
        cm.className = 'modal hidden';
        cm.innerHTML = `
          <div class="modal-backdrop" onclick="Campaigns.closeCreateModal()"></div>
          <div class="modal-box" style="max-width:520px;">
            <div class="modal-header">
              <div>
                <span style="font-size:11px;color:var(--domain-color);text-transform:uppercase;letter-spacing:1px;font-weight:700;">New Campaign</span>
                <h3 style="margin:4px 0 0;">Create Reward Campaign</h3>
              </div>
              <button class="modal-close" onclick="Campaigns.closeCreateModal()">✕</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:16px;">
              <div class="form-group">
                <label>Campaign Name</label>
                <input type="text" id="cc-name" placeholder="e.g. Summer Cash Bonus ☀️" />
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                <div class="form-group">
                  <label>Reward Amount ($)</label>
                  <input type="number" id="cc-reward" value="100" min="10" step="10" />
                </div>
                <div class="form-group">
                  <label>Minimum Balance ($)</label>
                  <input type="number" id="cc-bal" value="1000" min="0" step="500" />
                </div>
                <div class="form-group">
                  <label>Min Transaction Volume ($)</label>
                  <input type="number" id="cc-vol" value="10000" min="0" step="1000" />
                </div>
                <div class="form-group">
                  <label>Target Audience</label>
                  <select id="cc-audience">
                    <option>All Customers</option>
                    <option>Premium Tier</option>
                    <option>Digital-Only</option>
                    <option>New Accounts (&lt;6 months)</option>
                  </select>
                </div>
              </div>
              <div id="cc-error" class="ml-error hidden"></div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" onclick="Campaigns.closeCreateModal()">Cancel</button>
              <button class="btn-primary" id="cc-submit-btn" onclick="Campaigns.submitCreate()">
                Create Campaign →
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(cm);

        // ── Review Participant Modal ────────────────────────────────────────
        const rm = document.createElement('div');
        rm.id = 'camp-review-modal';
        rm.className = 'modal hidden';
        rm.innerHTML = `
          <div class="modal-backdrop" onclick="Campaigns.closeReviewModal()"></div>
          <div class="modal-box" style="max-width:460px;">
            <div class="modal-header">
              <div>
                <span style="font-size:11px;color:var(--domain-color);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Participant Review</span>
                <h3 id="rv-modal-title" style="margin:4px 0 0;">Review Application</h3>
              </div>
              <button class="modal-close" onclick="Campaigns.closeReviewModal()">✕</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;">
              <div id="rv-info-block" style="background:rgba(255,255,255,0.04);padding:14px;border-radius:10px;border:1px solid var(--glass-border);display:flex;flex-direction:column;gap:6px;font-size:13px;"></div>
              <div id="rv-risk-block" style="display:none;padding:12px;border-radius:8px;font-size:13px;"></div>
              <div style="display:flex;gap:10px;margin-top:6px;">
                <button class="btn-primary" id="rv-approve-btn" style="flex:1;background:var(--accent-success);" onclick="Campaigns._doReview('approve')">
                  ✓ Approve &amp; Reward
                </button>
                <button class="btn-primary" id="rv-reject-btn" style="flex:1;background:var(--accent-danger);" onclick="Campaigns._doReview('reject')">
                  ✗ Reject
                </button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(rm);
    }

    // ─── Hub Shell ───────────────────────────────────────────────────────────
    async renderHub() {
        this.container = document.getElementById('content-area');
        this._injectModals();

        const tabs = [
            { id: 'dashboard',    label: '📊  Dashboard'      },
            { id: 'campaigns',    label: '🏆  Campaigns'       },
            { id: 'participants', label: '👥  Participants'     },
            { id: 'alerts',       label: '🚨  Fraud Alerts'    },
        ];

        const tabHtml = tabs.map(t => `
          <button class="camp-tab-btn ${this.activeTab === t.id ? 'camp-tab-active' : ''}"
                  onclick="Campaigns.switchTab('${t.id}')">${t.label}</button>
        `).join('');

        this.container.innerHTML = `
          <style>
            .camp-tab-btn { background: rgba(255,255,255,0.04); border: 1px solid var(--glass-border); color: var(--text-muted); padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all .2s; }
            .camp-tab-btn:hover { border-color: var(--domain-color); color: var(--text-color); }
            .camp-tab-active { background: rgba(var(--domain-color-rgb),0.12) !important; border-color: var(--domain-color) !important; color: var(--domain-color) !important; font-weight: 600; }
            .camp-card { background: var(--bg-card); border: 1px solid var(--glass-border); border-radius: 14px; overflow: hidden; transition: transform .2s, box-shadow .2s; }
            .camp-card:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
            .camp-card-header { padding: 18px 20px 14px; position:relative; }
            .camp-card-body { padding: 14px 20px 18px; border-top: 1px solid var(--glass-border); display:flex; justify-content:space-between; align-items:center; }
            .camp-status-badge { display:inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; }
            .status-active   { background:rgba(0,230,118,.12);  color:#00e676; border:1px solid rgba(0,230,118,.25); }
            .status-draft    { background:rgba(255,255,255,.06); color:var(--text-muted); border:1px solid var(--glass-border); }
            .status-finished { background:rgba(255,255,255,.04); color:#888; border:1px solid var(--glass-border); }
            .risk-badge { display:inline-flex; align-items:center; gap:5px; padding: 3px 9px; border-radius: 12px; font-size: 11px; font-weight: 700; }
            .risk-low    { background:rgba(0,230,118,.1);  color:#00e676; }
            .risk-medium { background:rgba(255,193,7,.1);  color:#ffc107; }
            .risk-high   { background:rgba(255,68,68,.12); color:#ff4444; }
            .risk-critical { background:rgba(255,0,0,.2); color:#ff0000; }
            .participant-row td { vertical-align: middle; }
            .alert-timeline { display:flex; flex-direction:column; gap:12px; }
            .alert-item { display:flex; gap:14px; padding:14px; background:rgba(255,68,68,0.05); border:1px solid rgba(255,68,68,0.15); border-radius:10px; align-items:flex-start; }
            .alert-icon { font-size:22px; flex-shrink:0; }
            .camp-kpi-grid { display:grid; grid-template-columns: repeat(4,1fr); gap:14px; margin-bottom:20px; }
            @media(max-width:900px){ .camp-kpi-grid { grid-template-columns: repeat(2,1fr); } }
            .camp-kpi { background:var(--bg-card); border:1px solid var(--glass-border); border-radius:12px; padding:18px 20px; position:relative; overflow:hidden; }
            .camp-kpi-label { font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.8px; margin-bottom:8px; }
            .camp-kpi-val   { font-size:28px; font-weight:800; line-height:1; }
            .camp-kpi-sub   { font-size:11px; color:var(--text-muted); margin-top:6px; }
            .camp-kpi-bar   { position:absolute; bottom:0; left:0; height:3px; border-radius:0 3px 3px 0; }
            .launch-btn { background:linear-gradient(135deg,var(--domain-color),rgba(var(--domain-color-rgb),.6)); border:none; color:#fff; padding:7px 16px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600; transition:opacity .2s; }
            .launch-btn:hover { opacity:.85; }
            .ai-banner { background:linear-gradient(135deg,rgba(0,230,118,.08),rgba(26,115,232,.08)); border:1px solid rgba(0,230,118,.25); border-radius:12px; padding:16px 20px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; gap:16px; }
            .ai-banner-text h4 { margin:0 0 4px; font-size:14px; color:#00e676; }
            .ai-banner-text p  { margin:0; font-size:13px; color:var(--text-color); }
          </style>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:22px;">
            <div>
              <h1 style="margin:0;font-size:26px;font-weight:800;">Reward Campaigns</h1>
              <p style="margin:4px 0 0;color:var(--text-muted);font-size:13px;">Automated targeting, fraud detection &amp; direct customer rewards</p>
            </div>
            <button class="btn-primary" onclick="Campaigns.openCreateModal()" style="gap:6px;display:flex;align-items:center;">
              <span style="font-size:16px;">＋</span> New Campaign
            </button>
          </div>

          <div style="display:flex;gap:8px;margin-bottom:22px;flex-wrap:wrap;">
            ${tabHtml}
          </div>

          <div id="campaign-content-area"></div>
        `;

        await this.loadTab(this.activeTab);
    }

    async switchTab(tab) {
        this.activeTab = tab;
        await this.renderHub();
    }

    async loadTab(tab) {
        const area = document.getElementById('campaign-content-area');
        area.innerHTML = `<div style="text-align:center;padding:50px;color:var(--text-muted);">
          <div class="shimmer-card" style="height:120px;border-radius:12px;margin-bottom:14px;"></div>
          <div class="shimmer-card" style="height:300px;border-radius:12px;"></div>
        </div>`;
        try {
            if (tab === 'dashboard')    await this.renderDashboard(area);
            if (tab === 'campaigns')    await this.renderCampaignList(area);
            if (tab === 'participants') await this.renderParticipants(area);
            if (tab === 'alerts')       await this.renderAlerts(area);
        } catch(e) {
            area.innerHTML = `<div class="glass-panel" style="color:var(--accent-danger);text-align:center;padding:30px;">
              <div style="font-size:32px;margin-bottom:10px;">⚠️</div>
              <strong>Error loading campaign data</strong><br/>
              <small style="color:var(--text-muted)">${e.message}</small>
            </div>`;
        }
    }

    // ─── Dashboard Tab ────────────────────────────────────────────────────────
    async renderDashboard(area) {
        const [stats, list] = await Promise.all([
            API.get('/campaigns/analytics'),
            API.get('/campaigns')
        ]);

        const convColor = stats.conversion_rate >= 50 ? '#00e676' : '#ffc107';
        const totalCampaigns = list.campaigns ? list.campaigns.length : 0;

        let html = `
          <div class="camp-kpi-grid">
            <div class="camp-kpi" style="border-left:3px solid var(--domain-color);">
              <div class="camp-kpi-label">Active Campaigns</div>
              <div class="camp-kpi-val" style="color:var(--domain-color);">${totalCampaigns}</div>
              <div class="camp-kpi-sub">Running reward programs</div>
              <div class="camp-kpi-bar" style="width:80%;background:var(--domain-color);opacity:.4;"></div>
            </div>
            <div class="camp-kpi" style="border-left:3px solid #00e676;">
              <div class="camp-kpi-label">Qualified Participants</div>
              <div class="camp-kpi-val" style="color:#00e676;">${stats.qualified}</div>
              <div class="camp-kpi-sub">${stats.approved} approved &amp; rewarded</div>
              <div class="camp-kpi-bar" style="width:65%;background:#00e676;opacity:.4;"></div>
            </div>
            <div class="camp-kpi" style="border-left:3px solid #a78bfa;">
              <div class="camp-kpi-label">Rewards Distributed</div>
              <div class="camp-kpi-val" style="color:#a78bfa;">${UI.formatCurrency ? UI.formatCurrency(stats.total_rewards) : '$'+stats.total_rewards}</div>
              <div class="camp-kpi-sub">Total value paid out</div>
              <div class="camp-kpi-bar" style="width:55%;background:#a78bfa;opacity:.4;"></div>
            </div>
            <div class="camp-kpi" style="border-left:3px solid ${convColor};">
              <div class="camp-kpi-label">Conversion Rate</div>
              <div class="camp-kpi-val" style="color:${convColor};">${stats.conversion_rate.toFixed(1)}%</div>
              <div class="camp-kpi-sub">${stats.rejected} rejected / flagged</div>
              <div class="camp-kpi-bar" style="width:${stats.conversion_rate}%;background:${convColor};opacity:.4;"></div>
            </div>
          </div>

          <div class="ai-banner">
            <div style="font-size:28px;">🤖</div>
            <div class="ai-banner-text" style="flex:1;">
              <h4>AI Campaign Optimizer</h4>
              <p>${stats.ai_insight}</p>
            </div>
            <div style="background:rgba(0,230,118,.1);border:1px solid rgba(0,230,118,.2);padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;color:#00e676;white-space:nowrap;">LIVE INSIGHT</div>
          </div>

          <div class="glass-panel">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h3 style="margin:0;">Campaign Overview</h3>
              <button class="btn-secondary" style="font-size:12px;padding:5px 12px;" onclick="Campaigns.switchTab('campaigns')">
                View All →
              </button>
            </div>
        `;

        if (!list.campaigns || list.campaigns.length === 0) {
            html += `<div style="text-align:center;padding:40px;color:var(--text-muted);">
              <div style="font-size:40px;margin-bottom:14px;">🏆</div>
              <p>No campaigns yet. Create your first one!</p>
              <button class="btn-primary" onclick="Campaigns.openCreateModal()" style="margin-top:10px;">＋ New Campaign</button>
            </div>`;
        } else {
            html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">`;
            list.campaigns.forEach(c => {
                const statusClass = `status-${c.status}`;
                const gradients  = {
                    active: 'linear-gradient(135deg,rgba(26,115,232,.18),rgba(0,230,118,.08))',
                    draft:  'linear-gradient(135deg,rgba(255,255,255,.04),transparent)',
                    finished: 'linear-gradient(135deg,rgba(255,255,255,.03),transparent)',
                };
                html += `
                  <div class="camp-card">
                    <div class="camp-card-header" style="background:${gradients[c.status]||gradients.draft};">
                      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                        <span class="camp-status-badge ${statusClass}">${c.status}</span>
                        <span style="font-size:11px;color:var(--text-muted);">ID #${c.id}</span>
                      </div>
                      <h3 style="margin:0 0 6px;font-size:16px;">${c.name}</h3>
                      <div style="font-size:28px;font-weight:800;color:var(--domain-color);">$${c.reward_amount.toFixed(0)}</div>
                      <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">reward per participant</div>
                    </div>
                    <div class="camp-card-body" style="flex-wrap:wrap;gap:10px;">
                      <div style="font-size:12px;color:var(--text-muted);">
                        Min Balance: <b style="color:var(--text-color);">$${c.min_balance.toLocaleString()}</b><br/>
                        Min Volume:  <b style="color:var(--text-color);">$${c.min_volume.toLocaleString()}</b>
                      </div>
                      ${c.status === 'draft' ?
                        `<button class="launch-btn" onclick="Campaigns.launch(${c.id})">🚀 Launch</button>` :
                        `<button class="btn-secondary" style="font-size:12px;padding:5px 12px;" onclick="Campaigns.switchTab('participants')">View Participants →</button>`
                      }
                    </div>
                  </div>
                `;
            });
            html += `</div>`;
        }
        html += `</div>`;
        area.innerHTML = html;
    }

    // ─── Campaigns List Tab ────────────────────────────────────────────────────
    async renderCampaignList(area) {
        const list = await API.get('/campaigns');

        let html = `
          <div class="glass-panel">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
              <h3 style="margin:0;">All Campaigns</h3>
              <button class="btn-primary" onclick="Campaigns.openCreateModal()" style="font-size:13px;">＋ New Campaign</button>
            </div>
            <table class="aura-table">
              <thead><tr>
                <th>Campaign</th><th>Reward</th><th>Min Balance</th><th>Min Volume</th><th>Status</th><th>Created</th><th>Actions</th>
              </tr></thead>
              <tbody>
        `;

        if (!list.campaigns || list.campaigns.length === 0) {
            html += `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">No campaigns created yet.</td></tr>`;
        } else {
            list.campaigns.forEach(c => {
                const statusClass = `status-${c.status}`;
                html += `
                  <tr>
                    <td><b>${c.name}</b></td>
                    <td><span style="color:#a78bfa;font-weight:700;">$${c.reward_amount}</span></td>
                    <td>$${c.min_balance.toLocaleString()}</td>
                    <td>$${c.min_volume.toLocaleString()}</td>
                    <td><span class="camp-status-badge ${statusClass}">${c.status}</span></td>
                    <td style="color:var(--text-muted);font-size:12px;">${c.created_at ? c.created_at.split('T')[0] : '—'}</td>
                    <td>
                      ${c.status === 'draft' ?
                        `<button class="launch-btn" onclick="Campaigns.launch(${c.id})">🚀 Launch Campaign</button>` :
                        `<button class="btn-secondary" style="font-size:12px;padding:5px 12px;" onclick="Campaigns.switchTab('participants')">Participants →</button>`
                      }
                    </td>
                  </tr>
                `;
            });
        }
        html += `</tbody></table></div>`;
        area.innerHTML = html;
    }

    // ─── Participants Tab ─────────────────────────────────────────────────────
    async renderParticipants(area) {
        const res = await API.get('/campaigns/participants');

        let html = `
          <div class="glass-panel">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
              <h3 style="margin:0;">Participants &amp; Verifications</h3>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                ${['all','qualified','pending_verification','completed','rejected'].map(s =>
                  `<button class="camp-tab-btn" style="padding:5px 12px;font-size:11px;" onclick="Campaigns.filterParticipants('${s}')">${s === 'all' ? 'All' : s.replace('_',' ').replace(/\b\w/g,l=>l.toUpperCase())}</button>`
                ).join('')}
              </div>
            </div>
            <table class="aura-table" id="participants-table">
              <thead><tr>
                <th>Customer</th><th>Account</th><th>Campaign</th><th>Fraud Score</th><th>Risk</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody id="participants-tbody">
        `;

        const parts = res.participants || [];
        if (parts.length === 0) {
            html += `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">No participants found. Launch a campaign to start.</td></tr>`;
        } else {
            parts.forEach(p => {
                const statusColors = {
                    completed: 'var(--accent-success)', approved: 'var(--accent-success)',
                    rejected: 'var(--accent-danger)', pending_verification: '#ffc107', qualified: 'var(--text-muted)'
                };
                const sc = statusColors[p.status] || 'var(--text-muted)';
                const fraudBar = p.fraud_score > 0 ? `
                  <div style="display:flex;align-items:center;gap:6px;">
                    <div style="flex:1;height:4px;background:rgba(255,255,255,.1);border-radius:2px;max-width:60px;">
                      <div style="height:100%;width:${Math.min(p.fraud_score,100)}%;background:${p.fraud_score>75?'#ff4444':p.fraud_score>40?'#ffc107':'#00e676'};border-radius:2px;"></div>
                    </div>
                    <span style="font-size:11px;color:${p.fraud_score>75?'#ff4444':p.fraud_score>40?'#ffc107':'var(--text-muted)'};">${p.fraud_score.toFixed(0)}</span>
                  </div>` : `<span style="color:var(--accent-success);font-size:12px;">✓ Clean</span>`;

                html += `
                  <tr class="participant-row" data-status="${p.status}">
                    <td>
                      <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--domain-color),rgba(var(--domain-color-rgb),.4));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">
                          ${(p.customer_name||'?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style="font-weight:600;font-size:13px;">${p.customer_name||'Unknown'}</div>
                          <div style="font-size:11px;color:var(--text-muted);">${p.created_at ? p.created_at.split('T')[0] : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td style="font-family:var(--font-mono);font-size:12px;">${p.account_no}</td>
                    <td style="max-width:160px;font-size:13px;">${p.campaign_name}</td>
                    <td>${fraudBar}</td>
                    <td><span class="risk-badge risk-${p.risk_level||'low'}">${p.risk_level === 'high' ? '⚠ ' : p.risk_level === 'medium' ? '⚡ ' : '✓ '}${(p.risk_level||'low').toUpperCase()}</span></td>
                    <td><span style="color:${sc};font-size:11px;font-weight:700;text-transform:uppercase;">${p.status.replace('_',' ')}</span></td>
                    <td>
                      ${p.status === 'pending_verification' ?
                        `<button class="launch-btn" onclick="Campaigns.openReview(${p.id},'${p.customer_name}','${p.account_no}','${p.campaign_name}',${p.fraud_score},'${p.risk_level}')">Review ↗</button>` :
                        `<span style="color:var(--text-muted);font-size:12px;">—</span>`
                      }
                    </td>
                  </tr>
                `;
            });
        }
        html += `</tbody></table></div>`;
        area.innerHTML = html;
    }

    filterParticipants(status) {
        const rows = document.querySelectorAll('#participants-tbody tr[data-status]');
        rows.forEach(r => {
            r.style.display = (status === 'all' || r.dataset.status === status) ? '' : 'none';
        });
    }

    // ─── Fraud Alerts Tab ─────────────────────────────────────────────────────
    async renderAlerts(area) {
        const res = await API.get('/campaigns/alerts');
        const alerts = res.alerts || [];

        const iconMap = {
            unusual_activity: '🔴', geo_anomaly: '🌍', device_fingerprint_mismatch: '📱',
            velocity_spike: '⚡', mismatched_data: '🔀'
        };
        const sevColors = { critical: '#ff0000', high: '#ff4444', medium: '#ffc107', low: '#888' };

        let html = `
          <div class="glass-panel">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
              <h3 style="margin:0;">🚨 Fraud Alerts <span style="font-size:13px;background:rgba(255,68,68,.15);color:#ff4444;padding:3px 10px;border-radius:10px;margin-left:10px;">${alerts.length}</span></h3>
              <span style="font-size:12px;color:var(--text-muted);">Sorted by newest first</span>
            </div>
        `;

        if (alerts.length === 0) {
            html += `<div style="text-align:center;padding:50px;color:var(--text-muted);">
              <div style="font-size:40px;margin-bottom:12px;">✅</div>
              <p>No fraud alerts detected. All clear.</p>
            </div>`;
        } else {
            html += `<div class="alert-timeline">`;
            alerts.forEach(a => {
                const icon  = iconMap[a.alert_type] || '⚠️';
                const color = sevColors[a.severity] || '#888';
                const timeAgo = a.created_at ? a.created_at.split('T')[0] : '';
                html += `
                  <div class="alert-item" style="border-color:${color}22;">
                    <div class="alert-icon">${icon}</div>
                    <div style="flex:1;">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:6px;">
                        <b style="font-size:13px;">${a.alert_type.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</b>
                        <div style="display:flex;gap:8px;align-items:center;">
                          <span class="camp-status-badge" style="background:${color}20;color:${color};border-color:${color}44;">${a.severity.toUpperCase()}</span>
                          <span style="font-size:11px;color:var(--text-muted);">${timeAgo}</span>
                        </div>
                      </div>
                      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">${a.description}</div>
                      <div style="font-size:12px;">
                        Account: <span style="font-family:var(--font-mono);color:var(--domain-color);">${a.account_no}</span>
                      </div>
                    </div>
                  </div>
                `;
            });
            html += `</div>`;
        }
        html += `</div>`;
        area.innerHTML = html;
    }

    // ─── Create Campaign Modal ────────────────────────────────────────────────
    openCreateModal() {
        this._injectModals();
        document.getElementById('cc-name').value    = '';
        document.getElementById('cc-reward').value  = '100';
        document.getElementById('cc-bal').value     = '1000';
        document.getElementById('cc-vol').value     = '10000';
        document.getElementById('cc-error').classList.add('hidden');
        document.getElementById('camp-create-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('cc-name').focus(), 100);
    }

    closeCreateModal() {
        document.getElementById('camp-create-modal').classList.add('hidden');
    }

    async submitCreate() {
        const name   = document.getElementById('cc-name').value.trim();
        const reward = parseFloat(document.getElementById('cc-reward').value);
        const bal    = parseFloat(document.getElementById('cc-bal').value);
        const vol    = parseFloat(document.getElementById('cc-vol').value);
        const errEl  = document.getElementById('cc-error');

        errEl.classList.add('hidden');

        if (!name) { errEl.innerText = 'Please enter a campaign name.'; errEl.classList.remove('hidden'); return; }
        if (reward < 10) { errEl.innerText = 'Reward must be at least $10.'; errEl.classList.remove('hidden'); return; }

        const btn = document.getElementById('cc-submit-btn');
        btn.disabled = true;
        btn.innerText = 'Creating…';

        try {
            await API.post('/campaigns', { name, reward_amount: reward, min_balance: bal, min_volume: vol });
            this.closeCreateModal();
            UI.showToast(`Campaign "${name}" created as draft. Launch it to activate!`, 'success');
            this.renderHub();
        } catch(e) {
            errEl.innerText = e.message;
            errEl.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.innerText = 'Create Campaign →';
        }
    }

    // ─── Launch Campaign ──────────────────────────────────────────────────────
    async launch(id) {
        const confirmed = await this._confirm(
            '🚀 Launch Campaign',
            'The AI engine will scan all bank accounts for eligible customers and enroll them as Qualified participants. Continue?',
            'Launch Now', 'Cancel'
        );
        if (!confirmed) return;
        try {
            UI.showToast('Scanning accounts…', 'info');
            const res = await API.post(`/campaigns/${id}/launch`);
            UI.showToast(`Campaign launched! ${res.qualified_count} participants enrolled.`, 'success');
            this.renderHub();
        } catch(e) {
            UI.showToast(e.message, 'error');
        }
    }

    // ─── Review Participant Modal ─────────────────────────────────────────────
    openReview(pid, name, acct, campName, fraudScore, riskLevel) {
        this._injectModals();
        this._currentReviewPid = pid;

        document.getElementById('rv-modal-title').innerText = `Review: ${name}`;
        const info = document.getElementById('rv-info-block');
        info.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div><span style="color:var(--text-muted);font-size:11px;">CUSTOMER</span><br/><b>${name}</b></div>
            <div><span style="color:var(--text-muted);font-size:11px;">ACCOUNT</span><br/><b style="font-family:var(--font-mono)">${acct}</b></div>
            <div><span style="color:var(--text-muted);font-size:11px;">CAMPAIGN</span><br/><b>${campName}</b></div>
            <div><span style="color:var(--text-muted);font-size:11px;">FRAUD SCORE</span><br/><b style="color:${fraudScore>75?'#ff4444':fraudScore>40?'#ffc107':'#00e676'}">${fraudScore.toFixed(1)}</b></div>
          </div>
        `;

        const riskBlock = document.getElementById('rv-risk-block');
        if (riskLevel === 'high' || riskLevel === 'medium') {
            riskBlock.style.display = 'block';
            riskBlock.style.background = riskLevel==='high' ? 'rgba(255,68,68,.1)' : 'rgba(255,193,7,.08)';
            riskBlock.style.border     = `1px solid ${riskLevel==='high'?'rgba(255,68,68,.25)':'rgba(255,193,7,.25)'}`;
            riskBlock.innerHTML = `<b style="color:${riskLevel==='high'?'#ff4444':'#ffc107'};">${riskLevel==='high'?'⚠ High Risk':'⚡ Medium Risk'}:</b> Review the fraud score carefully before approving this participant.`;
        } else {
            riskBlock.style.display = 'none';
        }

        document.getElementById('camp-review-modal').classList.remove('hidden');
    }

    closeReviewModal() {
        document.getElementById('camp-review-modal').classList.add('hidden');
        this._currentReviewPid = null;
    }

    async _doReview(action) {
        const pid = this._currentReviewPid;
        if (!pid) return;
        const approveBtn = document.getElementById('rv-approve-btn');
        const rejectBtn  = document.getElementById('rv-reject-btn');
        approveBtn.disabled = rejectBtn.disabled = true;
        approveBtn.innerText = action === 'approve' ? 'Processing…' : 'Approve & Reward';
        rejectBtn.innerText  = action === 'reject'  ? 'Processing…' : 'Reject';
        try {
            await API.post(`/campaigns/participants/${pid}/review`, { action });
            this.closeReviewModal();
            const msg = action === 'approve' ? '✅ Participant approved — reward credited to account!' : '❌ Participant rejected.';
            UI.showToast(msg, action === 'approve' ? 'success' : 'error');
            this.renderHub();
        } catch(e) {
            UI.showToast(e.message, 'error');
            approveBtn.disabled = rejectBtn.disabled = false;
        }
    }

    // ─── Inline Confirm Helper ────────────────────────────────────────────────
    _confirm(title, message, okLabel = 'Yes', cancelLabel = 'No') {
        return new Promise(resolve => {
            const id = 'camp-confirm-overlay';
            let old = document.getElementById(id);
            if (old) old.remove();
            const el = document.createElement('div');
            el.id = id;
            el.className = 'modal-overlay';
            el.style.cssText = 'z-index:9995;';
            el.innerHTML = `
              <div class="modal-card" style="max-width:420px;text-align:center;">
                <div style="font-size:32px;margin-bottom:12px;">⚡</div>
                <h3 style="margin:0 0 10px;">${title}</h3>
                <p style="color:var(--text-muted);font-size:14px;line-height:1.5;margin-bottom:22px;">${message}</p>
                <div style="display:flex;gap:10px;">
                  <button class="btn-secondary" style="flex:1;" id="cco-cancel">${cancelLabel}</button>
                  <button class="btn-primary" style="flex:1;" id="cco-ok">${okLabel}</button>
                </div>
              </div>`;
            document.body.appendChild(el);
            document.getElementById('cco-ok').onclick     = () => { el.remove(); resolve(true);  };
            document.getElementById('cco-cancel').onclick = () => { el.remove(); resolve(false); };
        });
    }
}

window.Campaigns = new CampaignsController();
