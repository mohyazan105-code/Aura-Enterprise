class RPABuilder {
  constructor() {
    this.el = document.getElementById('rpa-panel');
    this.listEl = document.getElementById('rpa-list');
    this.contentEl = document.getElementById('rpa-content');
    this.automations = [];
    this.currentAuto = null;
  }

  async open() {
    this.el.classList.remove('hidden');
    await this.loadAutomations();
  }

  close() {
    this.el.classList.add('hidden');
  }

  async loadAutomations() {
    this.listEl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px">Loading...</div>';
    try {
      const res = await API.get('/rpa/automations');
      this.automations = res.automations;
      this.renderList();
    } catch (e) {
      this.listEl.innerHTML = `<div style="color:var(--accent-danger);padding:20px">${e.message}</div>`;
    }
  }

  renderList() {
    if (!this.automations.length) {
      this.listEl.innerHTML = '<div style="color:var(--text-muted);padding:20px;text-align:center">No automations found.</div>';
      return;
    }
    this.listEl.innerHTML = this.automations.map(a => `
      <div class="rpa-item" onclick="RPA.select(${a.id})">
        <div class="rpa-item-head">
          <span class="rpa-item-name">${a.name}</span>
          <span class="rpa-status ${a.status === 'active' ? 'active' : ''}">${a.status}</span>
        </div>
        <div class="rpa-desc">${a.description}</div>
        <div class="rpa-stats">
          <span>Runs: ${a.run_count}</span>
          <span>Success: ${a.run_count ? Math.round(a.success_count/a.run_count*100) : 0}%</span>
        </div>
      </div>
    `).join('');
  }

  select(id) {
    this.currentAuto = this.automations.find(a => a.id === id);
    if (!this.currentAuto) return;
    this.renderCanvas();
  }

  create() {
    const name = prompt("Enter automation name:");
    if (!name) return;
    const desc = prompt("Enter description:");
    const steps = [
      { action: 'extract', target: 'invoice_data' },
      { action: 'validate', target: 'vendor_db' },
      { action: 'update', target: 'finance_records' }
    ];
    
    API.post('/rpa/automations', { name, description: desc, steps: steps }).then(() => {
      UI.showToast("Automation created", "success");
      this.loadAutomations();
    }).catch(e => UI.showToast(e.message, "error"));
  }

  renderCanvas() {
    if (!this.currentAuto) return;
    let steps = [];
    try { steps = typeof this.currentAuto.steps === 'string' ? JSON.parse(this.currentAuto.steps) : this.currentAuto.steps; } catch(e){}
    
    let html = `
      <div class="rpa-actions-bar">
        <h2>${this.currentAuto.name} <span class="rpa-status active">${this.currentAuto.status}</span></h2>
        <div>
          <button class="btn-secondary" onclick="RPA.viewLogs()">Logs</button>
          <button class="btn-primary" onclick="RPA.run()"><span style="color:#00e5ff">▶</span> Run Now</button>
        </div>
      </div>
      <div class="rpa-builder-canvas">
    `;

    steps.forEach((s, idx) => {
      html += `
        <div class="rpa-step">
          <div class="rpa-step-info">
            <div class="rpa-step-num">${idx + 1}</div>
            <div>
              <div style="font-weight:600">${s.action.toUpperCase()}</div>
              <div style="font-size:12px;color:var(--text-muted)">Target: ${s.target}</div>
            </div>
          </div>
          <button class="btn-icon">⚙️</button>
        </div>
      `;
      if (idx < steps.length - 1) {
        html += `<div class="rpa-connector" style="top:${20 + idx * 80}px; height:80px"></div>`;
      }
    });
    
    html += `
        <div class="rpa-step" style="border-style:dashed; cursor:pointer; opacity:0.7">
          <div style="text-align:center; width:100%">+ Add Step</div>
        </div>
      </div>
    `;

    this.contentEl.innerHTML = html;
  }

  async run() {
    if (!this.currentAuto) return;
    UI.showToast("Initiating automation sequence...", "info");
    
    try {
      const res = await API.post(`/rpa/automations/${this.currentAuto.id}/run`);
      if (res.success) {
        UI.showToast(`Success in ${res.duration_ms}ms`, "success");
      } else {
        UI.showToast(`Failed in ${res.duration_ms}ms: ${res.result}`, "error");
      }
      this.loadAutomations();
      setTimeout(() => this.select(this.currentAuto.id), 500);
    } catch(e) {
      UI.showToast(e.message, "error");
    }
  }

  async viewLogs() {
    if (!this.currentAuto) return;
    try {
      const res = await API.get(`/rpa/automations/${this.currentAuto.id}/logs`);
      const logs = res.logs.map(l => `${l.run_at} | [${l.status.toUpperCase()}] | ${l.duration_ms}ms<br/>${l.result}`).join('<hr style="border-color:var(--glass-border); margin:10px 0"/>');
      document.getElementById('modal-title').innerText = 'Execution Logs';
      document.getElementById('modal-body').innerHTML = logs || '<div style="color:var(--text-muted)">No logs available.</div>';
      document.getElementById('modal-save-btn').style.display = 'none';
      document.getElementById('record-modal').classList.remove('hidden');
    } catch(e) {
      UI.showToast("Could not load logs", "error");
    }
  }
}

window.RPA = new RPABuilder();
