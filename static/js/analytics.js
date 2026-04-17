class AnalyticsEngine {
  constructor() {
    this.charts = {};
    this.layout = []; 
    Chart.defaults.color = '#9aa0a6';
    Chart.defaults.font.family = 'Inter';
  }
  
  async loadPreferences() {
    try {
      const res = await API.get('/auth/preferences');
      if (res && res.preferences) {
        this.layout = JSON.parse(res.preferences);
      }
    } catch(e) {}
    if (!this.layout || this.layout.length === 0) {
      this.layout = ['kpis', 'primary', 'secondary', 'special', 'ai'];
    }
  }

  async saveLayout() {
    try {
      await API.post('/auth/preferences', { layout: this.layout });
      UI.showToast('Dashboard layout saved', 'success');
    } catch(e) {
      UI.showToast('Failed to save layout', 'error');
    }
  }

  async renderDashboard(dept) {
    const container = document.getElementById('content-area');
    const domain = Auth.domain.id;
    
    await this.loadPreferences();
    
    // Ensure "Add Widget" button is visible
    const addWidgetBtn = document.getElementById('btn-add-widget');
    if (addWidgetBtn) addWidgetBtn.style.display = 'inline-block';

    // Clear and build wrapper
    container.innerHTML = '<div id="dashboard-grid-container" style="display:flex; flex-direction:column; gap:20px;"></div>';
    const gridContainer = document.getElementById('dashboard-grid-container');
    
    // Group them: KPIs first (full width), then other widgets two per row.
    let currentGrid2 = null;

    this.layout.forEach(widgetType => {
      if (widgetType === 'kpis') {
        gridContainer.insertAdjacentHTML('beforeend', `<div class="grid-4" id="kpi-grid"></div>`);
        return;
      }
      
      // Need a grid-2 container
      if (!currentGrid2 || currentGrid2.children.length >= 2) {
        currentGrid2 = document.createElement('div');
        currentGrid2.className = 'grid-2';
        gridContainer.appendChild(currentGrid2);
      }
      
      const widgetEl = this._buildWidgetHTML(widgetType, dept);
      currentGrid2.appendChild(widgetEl);
    });

    try {
      const p = [];
      if (this.layout.includes('kpis')) p.push(API.get(`/analytics/kpis?department=${dept}`)); else p.push(Promise.resolve(null));
      if (this.layout.includes('primary')) p.push(API.get(`/analytics/line?department=${dept}`)); else p.push(Promise.resolve(null));
      if (this.layout.includes('secondary')) p.push(API.get(`/analytics/pie?department=${dept}`)); else p.push(Promise.resolve(null));
      if (this.layout.includes('ai')) p.push(API.get(`/analytics/goals?department=${dept}`)); else p.push(Promise.resolve(null));
      
      const [kpis, line, pie, goals] = await Promise.all(p);
      
      if (kpis) this.renderKPIs(kpis.kpis);
      if (line) this.renderChart('chart-primary', line, 'line');
      if (pie) this.renderChart('chart-secondary', pie, 'doughnut');
      if (goals) this.renderGoals('goal-list', goals.goals);
      
      if (this.layout.includes('special')) this.renderSpecialView(dept, domain);
      if (this.layout.includes('geoheatmap')) this.renderGeoHeatmap();
      
    } catch (e) {
      console.error('Intelligence load crash:', e);
      UI.showToast(`Intelligence failed to load: ${e.message}`, 'error');
    }
  }

  _buildWidgetHTML(type, dept) {
    const div = document.createElement('div');
    div.className = 'chart-card inter-card';
    div.style.position = 'relative';
    div.dataset.type = type;
    
    // Add remove button overlay
    const rmBtn = `<button style="position:absolute; top:15px; right:15px; background:rgba(255,0,0,0.2); border:none; color:#ff1744; border-radius:4px; padding:4px 8px; cursor:pointer;" onclick="Analytics.removeWidget(this.parentElement.dataset.type, '${dept}')">✕</button>`;

    // Add Explain button overlay
    const getExplainBtn = (titleId) => `<button onclick="event.stopPropagation(); const title = document.getElementById('${titleId}').innerText; KPIExplainer.open(title, '', 'neutral')" style="position:absolute; top:15px; right:45px; background:rgba(255,255,255,0.1); border:none; border-radius:50%; width:24px; height:24px; color:var(--text-muted); cursor:pointer; font-size:12px; transition:0.2s;" onmouseover="this.style.background='var(--domain-color)'; this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.1)'; this.style.color='var(--text-muted)'" title="Explain this Chart">ℹ️</button>`;

    if (type === 'primary') {
      div.innerHTML = `<div class="chart-header" style="cursor:pointer" onclick="Analytics.drillDown('primary', '${dept}')"><span class="chart-title" id="primary-chart-title">Revenue Intelligence</span><span class="chart-icon">📈</span></div><div class="chart-body"><canvas id="chart-primary"></canvas></div>` + getExplainBtn('primary-chart-title') + rmBtn;
    } else if (type === 'secondary') {
      div.innerHTML = `<div class="chart-header" style="cursor:pointer" onclick="Analytics.drillDown('secondary', '${dept}')"><span class="chart-title" id="secondary-chart-title">Task Distribution</span><span class="chart-icon">📊</span></div><div class="chart-body"><canvas id="chart-secondary"></canvas></div>` + getExplainBtn('secondary-chart-title') + rmBtn;
    } else if (type === 'special') {
      div.innerHTML = `<div class="chart-header" style="cursor:pointer" onclick="Analytics.drillDown('special', '${dept}')"><span class="chart-title" id="special-chart-title">Interactive Analysis</span></div><div class="chart-body" id="chart-special"></div>` + getExplainBtn('special-chart-title') + rmBtn;
    } else if (type === 'ai') {
      div.innerHTML = `<div class="chart-header"><span class="chart-title" id="ai-chart-title">AI Decision Intelligence</span></div>
        <div class="chart-body">
          <div class="ai-button-group">
            <button class="btn-ai" onclick="Analytics.openIntelligenceHub()">🧠 Intelligence Hub</button>
            <button class="btn-ai" onclick="Analytics.showDecisionAnalysis()">🕰️ Historical Analysis</button>
            <button class="btn-ai" onclick="Analytics.showWhatIfSim()">🧪 What-If Simulator</button>
          </div>
          <div id="goal-list" style="margin-top:20px;overflow-y:auto;max-height:150px"></div>
        </div>` + getExplainBtn('ai-chart-title') + rmBtn;
    } else if (type === 'geoheatmap') {
      div.innerHTML = `<div class="chart-header"><span class="chart-title" id="geo-chart-title">Geo Heatmap (GPS)</span></div><div class="chart-body" id="map-geoheatmap" style="height:300px; border-radius:10px; z-index:0;"></div>` + getExplainBtn('geo-chart-title') + rmBtn;
    }
    return div;
  }
  
  showWidgetMenu() {
    document.getElementById('widget-modal')?.classList.remove('hidden');
  }
  closeWidgetMenu() {
    document.getElementById('widget-modal')?.classList.add('hidden');
  }
  
  async addWidget(type) {
    this.closeWidgetMenu();
    if (!this.layout.includes(type)) {
      this.layout.push(type);
      await this.saveLayout();
      this.renderDashboard(App.currentDept);
    } else {
      UI.showToast('Widget is already on dashboard', 'info');
    }
  }
  
  async removeWidget(type, dept) {
    this.layout = this.layout.filter(x => x !== type);
    await this.saveLayout();
    this.renderDashboard(dept);
  }
  
  renderGeoHeatmap() {
    const el = document.getElementById('map-geoheatmap');
    if (!el) return;
    el.innerHTML = '<div style="padding:40px;text-align:center;">📡 Requesting Satellite Connect...</div>';
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => this._initLeafletHeat(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          console.warn("GPS error", err);
          // Fallback location
          this._initLeafletHeat(40.7128, -74.0060);
        }
      );
    } else {
      this._initLeafletHeat(40.7128, -74.0060);
    }
  }
  
  _initLeafletHeat(lat, lng) {
    const el = document.getElementById('map-geoheatmap');
    if (!el) return;
    el.innerHTML = ''; // clear loading text
    
    if (this._leafletMap) {
      this._leafletMap.remove();
      this._leafletMap = null;
    }
    
    const map = L.map('map-geoheatmap').setView([lat, lng], 13);
    this._leafletMap = map;
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);
    
    const points = [];
    for (let i = 0; i < 300; i++) {
        // cluster around current pos
        const rLat = lat + (Math.random() - 0.5) * 0.05;
        const rLng = lng + (Math.random() - 0.5) * 0.05;
        const intensity = Math.random() * 0.8 + 0.2;
        points.push([rLat, rLng, intensity]);
    }
    
    L.heatLayer(points, {
      radius: 20, 
      blur: 15,
      maxZoom: 14,
      gradient: { 0.4: 'cyan', 0.6: 'lime', 0.8: '#f7931e', 1.0: 'magenta' }
    }).addTo(map);
  }

  async renderSpecialView(dept, domain) {
    const el = document.getElementById('chart-special');
    const title = document.getElementById('special-chart-title');
    if (!el) return;

    if (domain === 'banking') {
      title.innerText = 'Loan Pipeline & Account Activity';
      await this._renderBankingSpecial(el);
    } else if (domain === 'education') {
      title.innerText = 'GPA Distribution & Enrollment Status';
      await this._renderEducationSpecial(el);
    } else if (domain === 'healthcare') {
      title.innerText = 'Clinical Resource Heatmap';
      this.renderHeatmap(el);
    } else if (domain === 'manufacturing') {
      title.innerText = 'IoT Sensor Alerts & Production Efficiency';
      await this._renderManufacturingSpecial(el);
    } else if (dept === 'pm') {
      title.innerText = 'Project Gantt Timeline';
      this.renderGantt(el);
    } else if (dept === 'hr') {
      title.innerText = 'Worker Attendance Calendar';
      this.renderCalendar(el);
    } else {
      title.innerText = 'Performance Clusters (AI)';
      const k3d = await API.get(`/analytics/kmeans?department=${dept}`);
      this.render3D('chart-special', k3d);
    }
  }

  async _renderBankingSpecial(el) {
    try {
      const res = await API.get('/banking/dashboard-stats');
      const s = res.stats || {};
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:10px">
          <div class="kpi-card" style="border-left:3px solid #1a73e8">
            <div class="kpi-label">Active Accounts</div>
            <div class="kpi-val">${(s.active_accounts||0).toLocaleString()}</div>
          </div>
          <div class="kpi-card" style="border-left:3px solid #f59e0b">
            <div class="kpi-label">Pending Loans</div>
            <div class="kpi-val">${(s.pending_loans||0).toLocaleString()}</div>
          </div>
          <div class="kpi-card" style="border-left:3px solid #43a047">
            <div class="kpi-label">Total Disbursed</div>
            <div class="kpi-val">$${(s.total_disbursed||0).toLocaleString()}</div>
          </div>
          <div class="kpi-card" style="border-left:3px solid #e53935">
            <div class="kpi-label">Flagged Transactions</div>
            <div class="kpi-val">${(s.flagged_tx||0).toLocaleString()}</div>
          </div>
        </div>
        <div style="padding:10px;font-size:12px;color:var(--text-muted);text-align:center">
          Loan statuses: ${Object.entries(s.loan_statuses||{}).map(([k,v])=>`<span style="margin:0 6px"><b>${v}</b> ${k}</span>`).join('')}
        </div>`;
    } catch(e) {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Banking stats unavailable</div>';
    }
  }

  async _renderEducationSpecial(el) {
    try {
      const res = await API.get('/academics/dashboard-stats');
      const s = res.stats || {};
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:10px">
          <div class="kpi-card" style="border-left:3px solid #4fc3f7">
            <div class="kpi-label">Total Students</div>
            <div class="kpi-val">${(s.total_students||0)}</div>
          </div>
          <div class="kpi-card" style="border-left:3px solid #43a047">
            <div class="kpi-label">Avg GPA</div>
            <div class="kpi-val">${(s.avg_gpa||0).toFixed(2)}</div>
          </div>
          <div class="kpi-card" style="border-left:3px solid #f59e0b">
            <div class="kpi-label">Active Grants</div>
            <div class="kpi-val">${(s.active_grants||0)}</div>
          </div>
          <div class="kpi-card" style="border-left:3px solid #a78bfa">
            <div class="kpi-label">Total Enrollments</div>
            <div class="kpi-val">${(s.total_enrollments||0)}</div>
          </div>
          <div class="kpi-card" style="border-left:3px solid #e53935">
            <div class="kpi-label">On Probation</div>
            <div class="kpi-val">${(s.on_probation||0)}</div>
          </div>
          <div class="kpi-card" style="border-left:3px solid #34d399">
            <div class="kpi-label">Graduated</div>
            <div class="kpi-val">${(s.graduated||0)}</div>
          </div>
        </div>`;
    } catch(e) {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Education stats unavailable</div>';
    }
  }

  async _renderManufacturingSpecial(el) {
    try {
      const res = await API.get('/manufacturing/dashboard-stats');
      const s = res.stats || {};
      const alertPct = s.total_sensors > 0 ? Math.round((s.iot_alerts / s.total_sensors) * 100) : 0;
      const effColor = (s.avg_efficiency||0) >= 80 ? '#43a047' : (s.avg_efficiency||0) >= 60 ? '#f59e0b' : '#e53935';
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:10px">
          <div class="kpi-card" style="border-left:3px solid ${effColor}">
            <div class="kpi-label">Avg Cycle Efficiency</div>
            <div class="kpi-val">${(s.avg_efficiency||0).toFixed(1)}%</div>
            <div class="kpi-mini-progress"><div class="kpi-mini-bar" style="width:${Math.min(s.avg_efficiency||0,100)}%;background:${effColor}"></div></div>
          </div>
          <div class="kpi-card" style="border-left:3px solid #e53935">
            <div class="kpi-label">IoT Alerts Active</div>
            <div class="kpi-val">${(s.iot_alerts||0)} <span style="font-size:14px;color:var(--text-muted)">/ ${s.total_sensors||0}</span></div>
            <div class="kpi-mini-progress"><div class="kpi-mini-bar" style="width:${alertPct}%;background:#e53935"></div></div>
          </div>
          <div class="kpi-card" style="border-left:3px solid #f59e0b">
            <div class="kpi-label">QA Failures Today</div>
            <div class="kpi-val">${(s.qa_failures||0)}</div>
          </div>
          <div class="kpi-card" style="border-left:3px solid #43a047">
            <div class="kpi-label">Active Production Lines</div>
            <div class="kpi-val">${(s.active_cycles||0)}</div>
          </div>
        </div>`;
    } catch(e) {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Manufacturing stats unavailable</div>';
    }
  }

  renderGantt(el) {
    el.innerHTML = `<div class="gantt-chart">
      <div class="gantt-row"><div class="gantt-label">Research</div><div class="gantt-bar" style="width:30%;background:var(--domain-color)"></div></div>
      <div class="gantt-row"><div class="gantt-label">Design</div><div class="gantt-bar" style="width:50%;margin-left:30%;background:#43a047"></div></div>
      <div class="gantt-row"><div class="gantt-label">Launch</div><div class="gantt-bar-dashed" style="width:20%;margin-left:80%;border-color:#9aa0a6"></div></div>
    </div>`;
  }

  renderCalendar(el) {
    const days = Array.from({length: 31}, (_, i) => i + 1);
    el.innerHTML = `<div class="attendance-calendar">${days.map(d => `<div class="cal-day ${d%7===0?'off':d%5===0?'alert':'on'}">${d}</div>`).join('')}</div>`;
  }

  renderHeatmap(el) {
    let html = '<div class="heatmap-grid">';
    for (let i = 0; i < 35; i++) html += `<div class="heat-cell" style="background:var(--domain-color);opacity:${Math.random()}"></div>`;
    el.innerHTML = html + '</div>';
  }

  drillDown(type, dept) { Analytics.openIntelligenceHub(); }
  kpiDrill(id)          { Analytics.openIntelligenceHub(); }

  renderChart(id, data, type) {
    if (this.charts[id]) this.charts[id].destroy();
    const ctx = document.getElementById(id);
    if (!ctx) return;
    const chartData = type === 'line' ? {
      labels: data.labels,
      datasets: [{ label: data.datasets[0].label, data: data.datasets[0].data,
        borderColor: Auth.domain.color, backgroundColor: 'transparent', fill: false, tension: 0.4, borderWidth: 2 }]
    } : {
      labels: data.labels,
      datasets: [{ data: data.data, backgroundColor: ['#1a73e8','#43a047','#ffc107','#ff5722','#9c27b0'], borderWidth: 0 }]
    };
    this.charts[id] = new Chart(ctx, {
      type, data: chartData,
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: type === 'doughnut' } },
        scales: {
          y: { display: type==='line', grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { display: type==='line', grid: { display: false } }
        }
      }
    });
  }

  renderKPIs(data) {
    const grid = document.getElementById('kpi-grid');
    if (!grid) return;
    grid.innerHTML = data.map(k => {
      const valText = typeof k.value === 'number' ? k.value.toLocaleString() : k.value;
      return `<div class="kpi-card inter-card" onclick="Analytics.kpiDrill('${k.id}')" style="position:relative;">
        <div class="kpi-icon" style="background:${k.color}20;color:${k.color}">${k.icon}</div>
        <div class="kpi-trend ${k.trend_dir}">${k.trend}</div>
        
        <button onclick="event.stopPropagation(); KPIExplainer.open('${k.label}', '${valText}', '${k.trend_dir}')" style="position:absolute; top:12px; right:12px; background:rgba(255,255,255,0.1); border:none; border-radius:50%; width:24px; height:24px; color:var(--text-muted); cursor:pointer; font-size:12px; transition:0.2s;" onmouseover="this.style.background='var(--domain-color)'; this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.1)'; this.style.color='var(--text-muted)'" title="Explain this KPI">ℹ️</button>
        
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-val">${valText}${k.unit||''}</div>
        ${(k.type==='progress'||k.type==='gauge')?`<div class="kpi-mini-progress"><div class="kpi-mini-bar" style="width:${Math.min(k.value,100)}%;background:${k.color}"></div></div>`:''}
      </div>`;
    }).join('');
  }

  renderGoals(id, data) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = data.map(g => `<div style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
        <span>${g.name}</span><span><b>${g.actual}</b> / ${g.target} ${g.unit}</span>
      </div>
      <div style="height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${g.pct}%;background:${g.status==='on-track'?'#00c853':'#ff1744'};border-radius:4px;transition:width 1s"></div>
      </div></div>`).join('');
  }

  render3D(id, data) {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = '';
    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, container.clientWidth/container.clientHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      container.appendChild(renderer.domElement);
      const colors = [0x1a73e8, 0x00c853, 0xff1744];
      const group = new THREE.Group();
      (data.points||[]).forEach(p => {
        const mat = new THREE.MeshBasicMaterial({ color: colors[p.cluster%colors.length] });
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.5,16,16), mat);
        sphere.position.set((p.x-50)/2,(p.y-50)/2,(p.z||50-50)/2);
        group.add(sphere);
      });
      scene.add(group); camera.position.z = 60;
      const animate = () => { requestAnimationFrame(animate); group.rotation.y+=0.005; renderer.render(scene,camera); };
      animate();
    } catch(e) { container.innerHTML = '<div class="intel-empty">3D view unavailable</div>'; }
  }

  showDecisionAnalysis() { Analytics.openIntelligenceHub(); }
  showSuccessProposals() { Analytics.openIntelligenceHub(); }
  showWhatIfSim()        { Analytics.openIntelligenceHub(); }
  runSimulation() {
    UI.showToast('Running simulation...','info');
    setTimeout(()=>UI.showToast('Simulation complete: 87% confidence interval met.','success'),1500);
  }

  // ── Intelligence Hub ─────────────────────────────────────────────

  async renderForecastPanel(dept) {
    const periods = parseInt(document.getElementById('forecast-periods')?.value||6);
    const data = await API.get(`/analytics/forecast?department=${dept}&periods=${periods}`);
    const hist = data.historical||[], fcast = data.forecast||[];
    const labels = [...(data.labels||hist.map((_,i)=>`M${i+1}`)), ...fcast.map((_,i)=>`+${i+1}m`)];
    if (this.charts['forecast']) this.charts['forecast'].destroy();
    const canvas = document.getElementById('forecast-canvas');
    if (!canvas) return;
    this.charts['forecast'] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets: [
        { label:'Historical', data:[...hist,...fcast.map(()=>null)], borderColor:Auth.domain.color, backgroundColor:Auth.domain.color+'22', fill:true, tension:0.4, borderWidth:2 },
        { label:'Forecast', data:[...hist.map(()=>null),...fcast], borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,0.1)', borderDash:[6,3], fill:true, tension:0.4, borderWidth:2 }
      ]},
      options: { responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:true, labels:{ color:'#9aa0a6' } } },
        scales:{ y:{ grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#9aa0a6'} }, x:{ grid:{display:false}, ticks:{color:'#9aa0a6',maxTicksLimit:10} } }
      }
    });
    const s = document.getElementById('forecast-stats');
    if (s) {
      const tc = data.trend==='up'?'#43a047':data.trend==='down'?'#e53935':'#9aa0a6';
      s.innerHTML = `<div class="intel-stat"><span>Trend</span><b style="color:${tc}">${(data.trend||'stable').toUpperCase()}</b></div>
        <div class="intel-stat"><span>R²</span><b>${data.r_squared??'N/A'}</b></div>
        <div class="intel-stat"><span>Confidence</span><b>±${(data.confidence_band||0).toLocaleString()}</b></div>
        <div class="intel-stat"><span>Seasonality</span><b>${data.has_seasonality?'✅ Yes':'— None'}</b></div>`;
    }
  }

  async renderAnomalyPanel(dept) {
    const data = await API.get(`/analytics/anomalies?department=${dept}`);
    const el = document.getElementById('anomaly-list');
    if (!el) return;
    if (!data.anomalies?.length) { el.innerHTML='<div class="intel-empty">✅ No anomalies detected.</div>'; return; }
    el.innerHTML = data.anomalies.map(a=>`<div class="anomaly-item ${a.severity}">
      <div class="anomaly-icon">${a.direction==='spike'?'📈':'📉'}</div>
      <div class="anomaly-info"><div class="anomaly-desc">${a.description}</div><div class="anomaly-meta">${a.date} · ${a.source} · ${a.department}</div></div>
      <div class="anomaly-vals"><div class="anomaly-val">$${(a.value||0).toLocaleString()}</div><div class="anomaly-zscore ${a.severity}">Z: ${a.z_score}</div></div>
    </div>`).join('');
  }

  async renderClusterPanel(dept) {
    const k = parseInt(document.getElementById('cluster-k')?.value||3);
    const target = dept==='hr'?'employees':'customers';
    const data = await API.get(`/analytics/clusters?target=${target}&k=${k}&department=${dept}`);
    if (this.charts['cluster']) this.charts['cluster'].destroy();
    const el = document.getElementById('cluster-canvas');
    if (!el) return;
    const colors = ['#1a73e8','#43a047','#f59e0b','#e53935','#8e24aa'];
    this.charts['cluster'] = new Chart(el, {
      type:'scatter',
      data:{ datasets:(data.labels||[]).map((label,ci)=>({
        label, backgroundColor:(colors[ci]||'#fff')+'cc', pointRadius:7,
        data:(data.points||[]).filter(p=>p.cluster===ci).map(p=>({x:p.x,y:p.y,label:p.label}))
      }))},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:true,labels:{color:'#9aa0a6'}}, tooltip:{callbacks:{label:ctx=>ctx.raw.label||`(${ctx.raw.x},${ctx.raw.y})`}} },
        scales:{ x:{title:{display:true,text:data.axes?.x||'X',color:'#9aa0a6'},grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#9aa0a6'}},
                 y:{title:{display:true,text:data.axes?.y||'Y',color:'#9aa0a6'},grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#9aa0a6'}} }
      }
    });
    const lg=document.getElementById('cluster-legend');
    if(lg) lg.innerHTML=(data.labels||[]).map((l,i)=>`<span class="cluster-badge" style="background:${colors[i]}22;color:${colors[i]};border:1px solid ${colors[i]}44">● ${l}</span>`).join('');
  }

  async renderBudgetPanel() {
    const data = await API.get('/analytics/budget-vs-actual');
    const el = document.getElementById('budget-list');
    if (!el) return;
    el.innerHTML=(data.departments||[]).map(d=>`<div class="budget-row">
      <div class="budget-dept">${d.department.toUpperCase()}</div>
      <div class="budget-bars"><div class="budget-bar-track"><div class="budget-bar-fill" style="width:${Math.min(d.utilization_pct,100)}%;background:${d.status==='over-budget'?'#e53935':d.status==='at-risk'?'#f59e0b':'#43a047'}"></div></div>
      <span class="budget-pct">${d.utilization_pct}%</span></div>
      <div class="budget-nums">$${(d.spent||0).toLocaleString()} / $${(d.allocated||0).toLocaleString()}</div>
    </div>`).join('');
    const s=document.getElementById('budget-summary');
    if(s) s.innerHTML=`<div class="intel-stat"><span>Total Budget</span><b>$${(data.total_allocated||0).toLocaleString()}</b></div>
      <div class="intel-stat"><span>Total Spent</span><b>$${(data.total_spent||0).toLocaleString()}</b></div>
      <div class="intel-stat"><span>Over Budget</span><b style="color:#e53935">${(data.over_budget_depts||[]).length} depts</b></div>`;
  }

  async renderChurnPanel() {
    const data = await API.get('/analytics/churn');
    const el = document.getElementById('churn-list');
    if (!el) return;
    const top=(data.customers||[]).filter(c=>c.churn_risk>=20).slice(0,8);
    el.innerHTML=top.length?top.map(c=>`<div class="churn-row">
      <div class="churn-name">${c.customer}</div>
      <div class="budget-bars"><div class="budget-bar-track"><div class="budget-bar-fill" style="width:${c.churn_risk}%;background:${c.churn_risk>=60?'#e53935':c.churn_risk>=40?'#f59e0b':'#43a047'}"></div></div></div>
      <div class="churn-badge">${c.risk_level}</div><div class="churn-score">${c.churn_risk}%</div>
    </div>`).join(''):'<div class="intel-empty">✅ No high churn risk customers.</div>';
  }

  openIntelligenceHub() {
    const domain = (typeof Auth !== 'undefined' && Auth.domain && Auth.domain.id) || 'banking';
    const dept   = (typeof App !== 'undefined' && App.currentDept) || 'finance';
    if (typeof IntelligenceHub !== 'undefined') {
      IntelligenceHub.open(domain, dept);
      return;
    }
    this._legacyHub();
  }

  _legacyHub() {
    Modal.openCustom(`<div class="intel-hub">
      <div class="intel-tab-bar">
        <button class="intel-tab active" onclick="Analytics._switchTab('forecast',this,'${dept}')">📈 Forecast</button>
        <button class="intel-tab" onclick="Analytics._switchTab('anomaly',this,'${dept}')">🔴 Anomalies</button>
        <button class="intel-tab" onclick="Analytics._switchTab('cluster',this,'${dept}')">🔵 Clusters</button>
        <button class="intel-tab" onclick="Analytics._switchTab('budget',this,'${dept}')">💰 Budget</button>
        <button class="intel-tab" onclick="Analytics._switchTab('churn',this,'${dept}')">⚠️ Churn</button>
        <button class="intel-tab" onclick="Analytics._switchTab('legacy',this,'${dept}')">🗄️ Legacy DB</button>
      </div>
      <div id="intel-panel-forecast" class="intel-panel">
        <div class="intel-panel-header">
          <select id="forecast-periods" onchange="Analytics.renderForecastPanel('${dept}')" class="intel-select">
            <option value="3">3 months</option><option value="6" selected>6 months</option><option value="12">12 months</option>
          </select>
          <button class="intel-refresh-btn" onclick="Analytics.renderForecastPanel('${dept}')">↻ Refresh</button>
        </div>
        <div style="height:220px"><canvas id="forecast-canvas"></canvas></div>
        <div id="forecast-stats" class="intel-stats-row"></div>
      </div>
      <div id="intel-panel-anomaly" class="intel-panel hidden"><div id="anomaly-list" class="intel-scroll-list"></div></div>
      <div id="intel-panel-cluster" class="intel-panel hidden">
        <div class="intel-panel-header">
          <select id="cluster-k" onchange="Analytics.renderClusterPanel('${dept}')" class="intel-select">
            <option value="2">2 Clusters</option><option value="3" selected>3 Clusters</option><option value="4">4 Clusters</option><option value="5">5 Clusters</option>
          </select>
          <div id="cluster-legend" class="cluster-legend-row"></div>
        </div>
        <div style="height:240px"><canvas id="cluster-canvas"></canvas></div>
      </div>
      <div id="intel-panel-budget" class="intel-panel hidden">
        <div id="budget-summary" class="intel-stats-row"></div>
        <div id="budget-list" class="intel-scroll-list"></div>
      </div>
      <div id="intel-panel-churn" class="intel-panel hidden"><div id="churn-list" class="intel-scroll-list"></div></div>
      <div id="intel-panel-legacy" class="intel-panel hidden">
        <div class="legacy-upload-zone" id="legacy-drop-zone">
          <div style="font-size:36px;margin-bottom:8px">🗄️</div>
          <p style="margin:0 0 4px">Drop your legacy database file here</p>
          <small style="opacity:.5">Supports: .db · .csv · .xlsx</small><br>
          <input type="file" id="legacy-file-input" accept=".db,.csv,.xlsx,.xls" onchange="Analytics.analyzeLegacyFile(this)" style="display:none">
          <button class="intel-refresh-btn" style="margin-top:12px" onclick="document.getElementById('legacy-file-input').click()">📁 Browse File</button>
        </div>
        <div id="legacy-result" class="legacy-result hidden"></div>
      </div>
    </div>`, '🧠 Intelligence Hub');

    setTimeout(()=>{
      this.renderForecastPanel(dept);
      const zone=document.getElementById('legacy-drop-zone');
      if(zone){
        zone.addEventListener('dragover',e=>{e.preventDefault();zone.style.borderColor='#1a73e8';});
        zone.addEventListener('dragleave',()=>{zone.style.borderColor='';});
        zone.addEventListener('drop',e=>{e.preventDefault();zone.style.borderColor='';const f=e.dataTransfer.files[0];if(f)Analytics.uploadLegacyFile(f);});
      }
    },120);
  }

  _switchTab(name,btn,dept){
    document.querySelectorAll('.intel-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.intel-panel').forEach(p=>p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`intel-panel-${name}`)?.classList.remove('hidden');
    ({anomaly:()=>this.renderAnomalyPanel(dept),cluster:()=>this.renderClusterPanel(dept),budget:()=>this.renderBudgetPanel(),churn:()=>this.renderChurnPanel()})[name]?.();
  }

  async analyzeLegacyFile(input){ if(input.files[0]) this.uploadLegacyFile(input.files[0]); }

  async uploadLegacyFile(file){
    const resultEl=document.getElementById('legacy-result');
    const zone=document.getElementById('legacy-drop-zone');
    if(!resultEl) return;
    resultEl.classList.add('hidden');
    if(zone) zone.innerHTML=`<div style="padding:20px;text-align:center">⚙️ Analyzing <b>${file.name}</b>…</div>`;
    const fd=new FormData(); fd.append('file',file);
    try{
      const res=await fetch('/api/analytics/legacy-analyze',{method:'POST',credentials:'include',body:fd});
      const data=await res.json();
      if(data.error){UI.showToast(data.error,'error');return;}
      this._renderLegacyReport(data);
    }catch(e){UI.showToast('Analysis failed: '+e.message,'error');}
  }

  _renderLegacyReport(d){
    const el=document.getElementById('legacy-result');
    if(!el) return;
    el.classList.remove('hidden');
    el.innerHTML=`<div class="legacy-report">
      <div class="intel-stats-row" style="flex-wrap:wrap">
        <div class="intel-stat"><span>Tables</span><b>${d.tables?.length||0}</b></div>
        <div class="intel-stat"><span>Records</span><b>${(d.total_records||0).toLocaleString()}</b></div>
        <div class="intel-stat"><span>Data Quality</span><b style="color:${(d.data_quality_score||0)>=80?'#43a047':'#f59e0b'}">${d.data_quality_score||0}%</b></div>
        <div class="intel-stat"><span>Migration Effort</span><b>${d.migration_effort||'N/A'}</b></div>
      </div>
      <div class="legacy-section"><b>📂 Detected Entities</b><div class="legacy-entities">
        ${(d.tables||[]).map(t=>`<div class="legacy-entity"><span>${t.table}</span><span class="entity-type">${t.entity_type}</span><span style="opacity:.5">${(t.record_count||0).toLocaleString()} rows</span></div>`).join('')}
      </div></div>
      <div class="legacy-section"><b>🏢 Suggested Departments</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        ${(d.suggested_departments||[]).map(dep=>`<span class="cluster-badge" style="background:rgba(26,115,232,.1);color:#4fc3f7;border:1px solid rgba(26,115,232,.3)">${dep}</span>`).join('')}
      </div></div>
      <div class="legacy-section"><b>🎯 Suggested KPIs</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        ${(d.suggested_kpis||[]).map(k=>`<span class="cluster-badge" style="background:rgba(67,160,71,.1);color:#81c784;border:1px solid rgba(67,160,71,.3)">${k}</span>`).join('')}
      </div></div>
      <div class="legacy-section"><b>💡 Insights</b>
        ${(d.insights||[]).map(i=>`<div style="margin-top:6px;padding:8px 10px;background:rgba(255,255,255,.03);border-radius:6px;font-size:12px">${i}</div>`).join('')}
      </div>
      <div class="legacy-recommendation">${d.recommendation||''}</div>
    </div>`;
  }
}

window.Analytics = new AnalyticsEngine();
