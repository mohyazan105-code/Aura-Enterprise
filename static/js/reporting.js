class ReportingEngine {
  constructor() {
    this.templates = [];
    this.assignedReports = [];
    this.currentReport = null;
  }

  async init() {
    const [tRes, aRes] = await Promise.all([
      API.get('/reports/templates'),
      API.get('/reports/assigned')
    ]);
    this.templates = tRes.templates || [];
    this.assignedReports = aRes.reports || [];
  }

  async renderHome() {
    const container = document.getElementById('content-area');
    container.innerHTML = `<div class="skeleton-loader"><div class="sk-bar"></div><div class="sk-table"></div></div>`;
    
    await this.init();
    
    let html = `
      <div class="glass-panel" style="margin-bottom: 25px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h2 class="section-title">Intelligent Reporting Center</h2>
            <p style="color:var(--text-muted);">Dynamic, role-based snapshots powered by Aura AI</p>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn-secondary" onclick="Reporting.renderHome()">🔄 Refresh</button>
            <button class="btn-primary" onclick="Reporting.showGenerator()">+ Generate New Report</button>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="glass-panel">
          <h3 style="margin-bottom:15px; display:flex; align-items:center; gap:8px;">📥 Assigned to Me <span class="badge-count">${this.assignedReports.filter(r => r.status === 'pending').length}</span></h3>
          <div class="report-list">
            ${this.assignedReports.length ? this.assignedReports.map(r => `
              <div class="report-item ${r.status}" onclick="Reporting.viewReport(${r.id})">
                <div class="report-info">
                  <div class="report-name">${r.title}</div>
                  <div class="report-meta">${UI.formatDate(r.created_at)} • ${r.domain.toUpperCase()}</div>
                </div>
                <div class="report-status">${r.status === 'pending' ? '🔵 New' : '🔘 Viewed'}</div>
              </div>
            `).join('') : '<div class="intel-empty">No reports found.</div>'}
          </div>
        </div>

        <div class="glass-panel">
          <h3 style="margin-bottom:15px;">📋 Available Templates</h3>
          <div class="template-grid">
            ${this.templates.map(t => `
              <div class="template-card" onclick="Reporting.showGenerator(${t.id})">
                <div class="template-icon">📄</div>
                <div class="template-name">${t.name}</div>
                <div class="template-desc">${t.description}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    container.innerHTML = html;
  }

  async showGenerator(templateId = null) {
    const body = document.getElementById('report-gen-body');
    const t = templateId ? this.templates.find(x => x.id === templateId) : this.templates[0];
    
    // Fetch departments and employees for assignment
    const usersRes = await API.get('/admin/config'); // Assuming this returns users or depts
    const depts = Object.keys(App.config.departments);
    
    body.innerHTML = `
      <div class="form-group">
        <label>Select Template</label>
        <select id="gen-template-id" class="intel-select" onchange="Reporting.updateTemplateOptions(this.value)">
          ${this.templates.map(tmp => `<option value="${tmp.id}" ${tmp.id === t.id ? 'selected' : ''}>${tmp.name}</option>`).join('')}
        </select>
      </div>
      
      <div id="template-options-area">
        ${this._renderSectionCheckboxes(t)}
      </div>

      <div class="grid-2" style="margin-top:20px;">
        <div class="form-group">
          <label>Assign to Department</label>
          <select id="gen-assign-dept" class="intel-select">
            <option value="">None (Personal)</option>
            ${depts.map(d => `<option value="${d}">${d.toUpperCase()}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Target Employee Code (Internal)</label>
          <input type="text" id="gen-assign-user" class="intel-input" placeholder="e.g. 101">
        </div>
      </div>
    `;
    document.getElementById('report-gen-modal').classList.remove('hidden');
  }

  _renderSectionCheckboxes(template) {
    const sections = template.sections || [];
    return `
      <div class="form-group">
        <label>Customize Report Sections</label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px;">
          ${sections.map(s => `
            <label class="check-label">
              <input type="checkbox" checked class="gen-section-check" value="${s}"> ${s}
            </label>
          `).join('')}
          <label class="check-label"><input type="checkbox" checked class="gen-section-check" value="AI Insights"> AI Insights</label>
          <label class="check-label"><input type="checkbox" checked class="gen-section-check" value="Raw Data Table"> Raw Data Table</label>
        </div>
      </div>
    `;
  }

  updateTemplateOptions(id) {
    const t = this.templates.find(x => x.id == id);
    document.getElementById('template-options-area').innerHTML = this._renderSectionCheckboxes(t);
  }

  async confirmGeneration() {
    const templateId = document.getElementById('gen-template-id').value;
    const assigned_to_dept = document.getElementById('gen-assign-dept').value;
    const assigned_to_user = document.getElementById('gen-assign-user').value;
    const sections = Array.from(document.querySelectorAll('.gen-section-check:checked')).map(cb => cb.value);

    UI.showToast("Generating intelligent snapshot...", "info");
    try {
      const res = await API.post('/reports/generate', { 
        template_id: parseInt(templateId),
        assigned_to_dept,
        assigned_to_user: assigned_to_user ? parseInt(assigned_to_user) : null,
        sections
      });
      if (res.success) {
        document.getElementById('report-gen-modal').classList.add('hidden');
        UI.showToast("Report generated and assigned successfully.", "success");
        this.renderHome();
      }
    } catch(e) {
      UI.showToast(e.message, "error");
    }
  }

  async viewReport(id) {
    const res = await API.get(`/reports/${id}`);
    const r = res.report;
    this.currentReport = r;
    
    const container = document.getElementById('content-area');
    container.innerHTML = `
      <div id="report-view-root" class="glass-panel report-paper">
        <div class="report-actions-float no-print">
          <button class="btn-secondary" onclick="Reporting.renderHome()">← Return</button>
          <button class="btn-primary" onclick="Reporting.downloadPDF()">⬇ Export PDF</button>
        </div>
        
        <header class="report-view-header">
          <div class="report-header-main">
            <div class="report-brand">ActionAura Intelligence</div>
            <h1 class="report-view-title">${r.title}</h1>
            <div class="report-view-sub">
              <span>Domain: <b>${r.domain.toUpperCase()}</b></span>
              <span>Ref ID: <b>#${r.id}</b></span>
              <span>Generated: <b>${UI.formatDate(r.created_at)}</b></span>
            </div>
          </div>
          <div class="report-watermark">CONFIDENTIAL</div>
        </header>

        <section class="report-section">
          <h2 class="report-sec-title">🧠 Executive AI Summary</h2>
          <div class="ai-insight-box">
             <p>${r.ai_insights.summary}</p>
             <div class="insight-grid">
               <div class="insight-col">
                 <h4>Targeted Recommendations</h4>
                 <ul>${r.ai_insights.recommendations.map(re => `<li>${re}</li>`).join('')}</ul>
               </div>
               <div class="insight-col">
                 <h4>Active Risk Indicators</h4>
                 <div class="risk-list">
                    ${r.ai_insights.risk_indicators.map(ri => `<div class="risk-line ${ri.level}">${ri.msg}</div>`).join('')}
                 </div>
               </div>
             </div>
          </div>
        </section>

        <div class="report-layout-grid">
          <section class="report-section">
            <h2 class="report-sec-title">📈 Metric Visuals</h2>
            <div class="report-chart-container">
              <canvas id="report-chart-main"></canvas>
            </div>
          </section>
          
          <section class="report-section">
            <h2 class="report-sec-title">📊 Strategic KPIs</h2>
            <div class="report-kpi-stack">
              ${Object.entries(r.payload.metrics).map(([k, v]) => `
                <div class="report-kpi-row">
                  <span>${k.replace(/_/g, ' ').toUpperCase()}</span>
                  <b>${typeof v === 'number' ? v.toLocaleString() : v}</b>
                </div>
              `).join('')}
            </div>
          </section>
        </div>

        <section class="report-section">
          <h2 class="report-sec-title">📋 Snapshot Constraints</h2>
          <p style="font-size:12px; color:var(--text-muted);">
            This report represents a state-of-time snapshot of the ${r.domain} database. Sections included: ${r.payload.sections.join(', ')}.
          </p>
        </section>

        ${r.payload.raw_data ? `
        <section class="report-section">
          <h2 class="report-sec-title">💾 Raw Evidence Data</h2>
          <div style="overflow-x:auto;">
            <table class="aura-table mini">
              <thead>
                <tr>${Object.keys(r.payload.raw_data[0] || {}).map(k => `<th>${k.toUpperCase()}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${r.payload.raw_data.slice(0, 10).map(row => `
                  <tr>${Object.values(row).map(v => `<td>${v}</td>`).join('')}</tr>
                `).join('')}
              </tbody>
            </table>
            ${r.payload.raw_data.length > 10 ? `<p style="font-size:10px; color:var(--text-muted); margin-top:5px;">+ ${r.payload.raw_data.length - 10} more records truncated for summary view.</p>` : ''}
          </div>
        </section>
        ` : ''}
      </div>
    `;
    
    // Render chart
    setTimeout(() => {
      const ctx = document.getElementById('report-chart-main');
      if (ctx) {
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
            datasets: [{
              label: 'Performance Trend',
              data: [65, 59, 80, 81, 56, 55],
              borderColor: 'var(--domain-color)',
              tension: 0.4,
              fill: true,
              backgroundColor: 'rgba(26, 115, 232, 0.1)'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { grid: { display: false } }, x: { grid: { display: false } } }
          }
        });
      }
    }, 100);
  }

  downloadPDF() {
    const element = document.getElementById('report-view-root');
    const opt = {
      margin:       0.5,
      filename:     `Aura_Report_${this.currentReport.id}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0f172a' },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  }
}

window.Reporting = new ReportingEngine();
