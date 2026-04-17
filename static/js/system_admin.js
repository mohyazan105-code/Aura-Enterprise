/**
 * Action Aura — System Admin Dashboard (Master Override)
 * Handles: Command Center (analytics), Project Log (full session history)
 */
window.SystemAdmin = {
    charts: {},
    pollInterval: null,
    currentView: 'dashboard',

    // ─── Entry point ──────────────────────────────────────────────────────────
    init: async function () {
        this.currentView = 'dashboard';
        this._setNavActive('dashboard');
        this.renderSkeleton();
        await this.fetchData();
        this.startPolling();
    },

    // ─── View switching (dashboard ↔ project log) ──────────────────────────
    showView: function (view) {
        this.currentView = view;
        this._setNavActive(view);

        const dash = document.getElementById('sys-admin-content');
        const log  = document.getElementById('sys-admin-log');
        const title = document.getElementById('sa-topbar-title');

        if (view === 'log') {
            if (dash)  dash.style.display  = 'none';
            if (log)   log.style.display   = 'block';
            if (title) title.textContent   = 'Project Log';
            this.renderProjectLog();
        } else {
            if (dash)  dash.style.display  = 'block';
            if (log)   log.style.display   = 'none';
            if (title) title.textContent   = 'Intelligence Dashboard';
            if (!Object.keys(this.charts).length) {
                this.renderSkeleton();
                this.fetchData();
            }
        }
    },

    _setNavActive: function (view) {
        const cmd = document.getElementById('sa-nav-cmd');
        const log = document.getElementById('sa-nav-log');
        if (cmd) cmd.classList.toggle('active', view === 'dashboard');
        if (log) log.classList.toggle('active', view === 'log');
    },

    // ─── Dashboard ────────────────────────────────────────────────────────────
    renderSkeleton: function () {
        document.getElementById('sys-admin-content').innerHTML = `
            <div class="sa-kpi-grid" id="sa-kpis">
                ${Array(5).fill('<div class="sa-kpi"><div class="sa-kpi-label">Loading…</div><div class="sa-kpi-value" style="color:#334155">—</div></div>').join('')}
            </div>
            <div class="sa-charts-row">
                <div class="sa-panel">
                    <div class="sa-panel-title">Global Data Transactions</div>
                    <div class="sa-chart-wrap"><canvas id="sa-chart-line"></canvas></div>
                </div>
                <div class="sa-panel">
                    <div class="sa-panel-title">Users by Domain</div>
                    <div class="sa-chart-wrap"><canvas id="sa-chart-pie"></canvas></div>
                </div>
            </div>
            <div class="sa-charts-bot" style="margin-top:20px;">
                <div class="sa-panel">
                    <div class="sa-panel-title">Subsystem Load Balance</div>
                    <div class="sa-chart-wrap"><canvas id="sa-chart-bar"></canvas></div>
                </div>
                <div class="sa-panel">
                    <div class="sa-panel-title">Live System Events</div>
                    <div class="sa-feed" id="sa-feed">
                        <div class="sa-feed-item"><div class="sa-feed-time">Connecting…</div><div class="sa-feed-msg">Initialising stream…</div></div>
                    </div>
                </div>
            </div>
        `;
    },

    refreshData: async function () {
        await this.fetchData();
    },

    fetchData: async function () {
        try {
            const [kpiRes, actRes] = await Promise.all([
                API.get('/system_admin/kpis'),
                API.get('/system_admin/activity')
            ]);
            this.renderKPIs(kpiRes.kpis);
            this.renderCharts(kpiRes.charts);
            this.renderFeed(actRes.updates);
        } catch (e) {
            console.error('SystemAdmin fetchData error:', e);
        }
    },

    renderKPIs: function (k) {
        const el = document.getElementById('sa-kpis');
        if (!el) return;
        el.innerHTML = `
            <div class="sa-kpi accent"><div class="sa-kpi-label">Total Users (Global)</div><div class="sa-kpi-value">${(k.total_users||0).toLocaleString()}</div></div>
            <div class="sa-kpi"><div class="sa-kpi-label">Active Domains</div><div class="sa-kpi-value">${k.active_domains||0}</div></div>
            <div class="sa-kpi"><div class="sa-kpi-label">Subsystems</div><div class="sa-kpi-value">${k.active_subsystems||0}</div></div>
            <div class="sa-kpi"><div class="sa-kpi-label">AI Actions</div><div class="sa-kpi-value">${(k.ai_actions||0).toLocaleString()}</div></div>
            <div class="sa-kpi green"><div class="sa-kpi-label">Platform Performance</div><div class="sa-kpi-value">${k.system_perf||'—'}</div></div>
        `;
    },

    renderCharts: function (data) {
        if (!window.Chart) return;
        Chart.defaults.color = '#64748b';
        Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
        Chart.defaults.font.size = 11;
        const grid = 'rgba(255,255,255,0.04)';

        this._chart('sa-chart-line', 'line', {
            labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
            datasets: [{ label: 'Transactions', data: data.line, borderColor: '#818cf8', backgroundColor: 'rgba(129,140,248,0.08)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#818cf8' }]
        }, { scales: { x: { grid: { color: grid } }, y: { grid: { color: grid } } } });

        this._chart('sa-chart-pie', 'doughnut', {
            labels: Object.keys(data.pie),
            datasets: [{ data: Object.values(data.pie), backgroundColor: ['#818cf8','#34d399','#fbbf24','#f87171','#c084fc','#38bdf8'], borderWidth: 0, hoverOffset: 6 }]
        }, { plugins: { legend: { position: 'bottom', labels: { padding: 14, boxWidth: 10 } } }, cutout: '62%' });

        this._chart('sa-chart-bar', 'bar', {
            labels: Object.keys(data.bar),
            datasets: [{ label: 'Load %', data: Object.values(data.bar), backgroundColor: 'rgba(52,211,153,0.35)', borderColor: '#34d399', borderWidth: 1, borderRadius: 5 }]
        }, { scales: { x: { grid: { color: grid } }, y: { grid: { color: grid }, min: 70, max: 100 } } });
    },

    _chart: function (id, type, dataCfg, extra = {}) {
        if (this.charts[id]) { this.charts[id].destroy(); delete this.charts[id]; }
        const ctx = document.getElementById(id);
        if (!ctx || !window.Chart) return;
        this.charts[id] = new Chart(ctx, {
            type, data: dataCfg,
            options: { responsive: true, maintainAspectRatio: false, animation: { duration: 600 }, plugins: { legend: { position: 'bottom' } }, ...extra }
        });
    },

    renderFeed: function (updates) {
        const feed = document.getElementById('sa-feed');
        if (!feed) return;
        feed.innerHTML = (updates || []).map(u => `
            <div class="sa-feed-item">
                <div class="sa-feed-time">${u.time}</div>
                <div class="sa-feed-msg">${u.msg}</div>
            </div>
        `).join('');
    },

    startPolling: function () {
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = setInterval(() => {
            if (this.currentView !== 'dashboard') return;
            API.get('/system_admin/activity').then(r => this.renderFeed(r.updates)).catch(() => {});
        }, 4000);
    },

    // ─── Project Log ──────────────────────────────────────────────────────────
    renderProjectLog: async function () {
        const el = document.getElementById('sys-admin-log');
        if (!el) return;
        el.innerHTML = `<div style="color:#64748b; padding:20px; font-size:13px;">Loading project log…</div>`;

        try {
            const [actRes, logRes] = await Promise.all([
                API.get('/system_admin/activity').catch(() => ({updates: []})),
                API.get('/system_admin/project_log').catch(() => ({summary: [], detailed_report: ''}))
            ]);
            el.innerHTML = this._buildLogHTML(logRes, actRes.updates || []);
        } catch (e) {
            el.innerHTML = `<div class="sa-log-section" style="color:#f87171;">Error loading log: ${e.message}</div>`;
        }
    },

    _buildLogHTML: function (logData, updates) {
        const projectSummary = logData.summary || [];
        const detailsData = logData.detailed_report || '';

        const summaryHtml = projectSummary.map(section => `
            <div class="sa-log-section">
                <h3>${section.cat}</h3>
                ${section.items.map(item => `
                    <div class="sa-log-entry">
                        <div class="sa-log-dot ${section.dot || 'accent'}"></div>
                        <div class="sa-log-txt">${item}</div>
                    </div>
                `).join('')}
            </div>
        `).join('');

        const detailsHtml = `
            <div style="margin: 24px 0; display:flex;">
                <button onclick="document.getElementById('sa-details-modal').style.display='flex'" style="background:var(--domain-color); color:#fff; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px; display:inline-flex; align-items:center; gap:8px;">
                    <span>📄</span> View System Details Report
                </button>
            </div>
            
            <div id="sa-details-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); z-index:9999; align-items:center; justify-content:center; padding:40px;">
                <div style="background:var(--bg-panel); border:1px solid var(--glass-border); border-radius:12px; width:100%; max-width:900px; height:80vh; display:flex; flex-direction:column; box-shadow:0 10px 40px rgba(0,0,0,0.5);">
                    <div style="padding:20px 24px; border-bottom:1px solid var(--glass-border); display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02);">
                        <h3 style="margin:0; font-size:18px; color:var(--text-color);">Detailed Project Architecture Report</h3>
                        <button onclick="document.getElementById('sa-details-modal').style.display='none'" style="background:transparent; border:none; color:#94a3b8; font-size:24px; cursor:pointer; line-height:1;">&times;</button>
                    </div>
                    <div style="padding:30px; overflow-y:auto; flex:1; font-size:14px;">
                        ${detailsData}
                    </div>
                </div>
            </div>
        `;

        // ─── Live Antigravity action feed ─────────────────────────────────
        const liveHtml = updates.length ? `
            <div class="sa-log-section">
                <h3>Live Session Activity (Antigravity AI)</h3>
                <p style="font-size:11px; color:#475569; margin:-8px 0 16px;">System stream capturing real-time terminal executions and active operations.</p>
                ${updates.map(u => `
                    <div class="sa-log-entry">
                        <div class="sa-log-dot"></div>
                        <div class="sa-log-txt">
                            <strong>${u.msg}</strong>
                            <em> — ${u.time}</em>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : '';

        return `<div class="sa-log-wrap">${summaryHtml}${detailsHtml}${liveHtml}</div>`;
    },

    // ─── Cleanup ──────────────────────────────────────────────────────────────
    destroy: function () {
        if (this.pollInterval) clearInterval(this.pollInterval);
        Object.values(this.charts).forEach(c => c.destroy());
        this.charts = {};
    }
};
