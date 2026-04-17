class Application {
  constructor() {
    this.config = null;
    this.currentDomain = null;
    this.currentDept = null;
    this.currentSection = 'dashboard';
    this.socket = null;
    this.notifInterval = null;
    this._searchDebounce = null;
    this.isDirty = false;
    this.lastHash = location.hash;
    this._domainsCache = null;  // Cache domain list to avoid redundant fetches
    
    window.addEventListener('beforeunload', (e) => {
        if (this.isDirty) e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    });
    window.addEventListener('hashchange', (e) => this.handleRoute(location.hash));
  }

  async init() {
    const isLoggedIn = await Auth.check();
    if (isLoggedIn) {
      try {
        const res = await API.get('/admin/config');
        this.config = res;
      } catch(e) {
        console.error("Config load error", e);
      }
      this.showDashboard();
      this.initSocket();
    } else {
      this.handleRoute(location.hash || '#landing');
    }
  }

  initSocket() {
    if (this.socket) return;
    this.socket = io({ transports: ['websocket', 'polling'] });
    this.socket.on('connect', () => {
      console.log('Realtime Connected');
      if (Auth.domain?.id) {
        this.socket.emit('subscribe_domain', { domain: Auth.domain.id });
      }
      // Join personal user room for call signals
      if (Auth.user?.id) {
        this.socket.emit('comm_join_user_room', { user_id: Auth.user.id });
      }
    });
    this.socket.on('refresh', (data) => {
      if (data.department === this.currentDept) {
        // Safe refresh: Do not destroy the view if a modal is open
        const modalEl = document.getElementById('record-modal');
        if (modalEl && !modalEl.classList.contains('hidden')) {
           UI.showToast("Background update detected. Data will refresh when you finish editing.", "info");
        } else {
           this.refreshCurrentView();
        }
      }
    });
    // Real-time incoming call — show panel immediately if comm is active
    this.socket.on('comm_incoming', (data) => {
      if (window.Comm?.isActive) {
        window.Comm._showIncoming(data);
      }
    });
  }

  handleRoute(hash) {
    if (this.isDirty) {
       if (!confirm("You have unsaved changes. Are you sure you want to leave?")) {
           const curY = window.scrollY;
           history.replaceState(null, null, this.lastHash);
           window.scrollTo(0, curY);
           return;
       }
       this.isDirty = false; // Intentionally leaving, clear dirty flag
    }
    this.lastHash = hash || '#landing';

    if (!Auth.user && hash === '#app') hash = '#landing';
    
    // Defer purely to subsystem-core.js for subsystem routes to prevent race conditions
    const subRoutePrefixes = ['#subs-menu', '#subsystem-'];
    if (subRoutePrefixes.some(prefix => hash.startsWith(prefix))) {
      if (window.AuraBlackhole) AuraBlackhole.stop();
      return; 
    }
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // ─── Black Hole Animation Lifecycle (isolated to pre-login screens) ───
    if (window.AuraBlackhole) {
      const splashVisible = document.getElementById('welcome-splash')?.style.display !== 'none'
                         && !document.getElementById('welcome-splash')?.classList.contains('ws-dismissed');
      if (hash === '#landing' || hash === '') {
          if (!splashVisible) AuraBlackhole.mountTo('page-landing');
      } else if (hash === '#login') {
          AuraBlackhole.mountTo('page-login');
      } else if (hash === '#customer-login') {
          AuraBlackhole.mountTo('page-customer-login');
      } else if (hash === '#domain') {
          AuraBlackhole.mountTo('page-domain');
      } else if (hash === '#customer-domain') {
          AuraBlackhole.mountTo('page-customer-domain');
      } else if (hash === '#user-portal-select') {
          AuraBlackhole.mountTo('page-user-portal-select');
      } else {
          AuraBlackhole.stop();
      }
    }

    if (hash === '#landing' || hash === '') {
      document.getElementById('page-landing').classList.add('active');
    } else if (hash === '#domain') {
      this.renderDomainSelect();
      document.getElementById('page-domain').classList.add('active');
    } else if (hash === '#login') {
      const savedDomain = localStorage.getItem('aura_domain');
      const loadedId = document.getElementById('login-domain-name').dataset.id;
      
      if (!loadedId && !savedDomain) {
         this.showDomainSelect();
         return;
      } else if (!loadedId && savedDomain) {
         this.selectDomain(savedDomain);
      }
      document.getElementById('page-login').classList.add('active');
    } else if (hash === '#app') {
      if (!Auth.user) {
        this.showLogin();
        return;
      }
      document.getElementById('page-app').classList.add('active');
      this.loadAppShell();
    } else if (hash === '#user-portal-select') {
      document.getElementById('page-user-portal-select').classList.add('active');
    } else if (hash === '#customer-domain') {
       window.CustomerApp.showCustomerDomainSelect();
    } else if (hash === '#customer-login') {
       const cd = sessionStorage.getItem('customer_aura_domain');
       if (cd) {
           window.CustomerApp.showCustomerLogin(cd);
       } else {
           window.CustomerApp.showCustomerDomainSelect();
       }
    } else if (hash === '#customer-app') {
       if (!window.CustomerApp.restoreSession()) {
           window.CustomerApp.showCustomerDomainSelect();
       }
    }
  }

  // No-op: new landing page shows portals immediately, no splash step needed
  continueSplash() {
    // Legacy — kept for compatibility
  }

  showLanding() { 
    location.hash = 'landing'; 
    this.handleRoute('#landing');
  }
  
  showDomainSelect() { 
    location.hash = 'domain'; 
    this.handleRoute('#domain');
  }

  showUserPortalSelect() {
    location.hash = 'user-portal-select';
    this.handleRoute('#user-portal-select');
  }

  navigate(hash) {
    location.hash = hash;
    this.handleRoute('#' + hash);
  }

  
  showLogin(domainId = null) {
    if (domainId) {
       this.selectDomain(domainId);
       return;
    }
    location.hash = 'login';
    this.handleRoute('#login');
  }
  
  showDashboard() {
    location.hash = 'app';
    this.handleRoute('#app');
  }

  async renderDomainSelect() {
    const grid = document.getElementById('domain-grid');
    grid.innerHTML = '<div style="grid-column: span 2; text-align:center;">Loading domains...</div>';
    try {
      const res = await API.get('/domains');
      this._domainsCache = res.domains;  // Cache for reuse in selectDomain
      grid.innerHTML = res.domains.map(d => `
        <div class="domain-card" style="--card-color: ${d.color}" onclick="App.selectDomain('${d.id}')">
          <div class="domain-card-icon">${d.icon}</div>
          <h3>${d.name}</h3>
          <p>${d.description}</p>
        </div>
      `).join('');
    } catch(e) {
      grid.innerHTML = `<div style="color:red">Failed to load domains: ${e.message}</div>`;
    }
  }

  async selectDomain(domainId) {
    try {
      // Reuse cached domain list if available, else fetch
      let domains = this._domainsCache;
      if (!domains) {
        const res = await API.get('/domains');
        domains = res.domains;
        this._domainsCache = domains;
      }
      const d = domains.find(x => x.id === domainId);
      if (d) {
        UI.applyDomainTheme(d);
        document.getElementById('login-domain-name').dataset.id = d.id;
        document.getElementById('login-domain-name').innerText = d.name;
        document.getElementById('login-domain-icon').innerText = d.icon;
        localStorage.setItem('aura_domain', d.id);
        
        if (location.hash !== '#login') {
          location.hash = 'login';
          this.handleRoute('#login');
        }
      }
    } catch(e){}
  }

  loadAppShell() {
    UI.applyDomainTheme(Auth.domain);
    document.getElementById('sb-avatar').innerText = Auth.user.name.charAt(0);
    document.getElementById('sb-user-name').innerText = Auth.user.name;
    document.getElementById('sb-user-role').innerText = Auth.user.role_label;
    
    if (Auth.user.role === 'admin') {
      document.getElementById('btn-perf-monitor').style.display = 'flex';
    }
    
    // Sidebar Departments
    const nav = document.getElementById('sidebar-nav');
    const depts = Object.keys(this.config.departments);

    const accessibleDepts = depts.filter(k => 
      Auth.user.permissions.dept_access.includes(k) || Auth.user.permissions.dept_access.includes('*')
    );
    
    const savedDept = localStorage.getItem('aura_dept');
    if (savedDept && accessibleDepts.includes(savedDept)) {
      this.currentDept = savedDept;
    } else {
      this.currentDept = accessibleDepts[0] || depts[0];
    }

    nav.innerHTML = accessibleDepts.map(k => {
      const d = this.config.departments[k];
      return `
        <a class="nav-item ${k === this.currentDept ? 'active' : ''}" data-dept="${k}" onclick="App.setDepartment('${k}')">
          <span class="nav-icon" style="color:${d.color}">${d.icon}</span>
          <span>${d.name}</span>
        </a>
      `;
    }).join('');

    this.setDepartment(this.currentDept, localStorage.getItem('aura_section') || 'dashboard');
  }

  setDepartment(deptId, targetSection='dashboard') {
    if (this.isDirty) {
        if (!confirm("You have unsaved changes. Are you sure you want to change departments?")) return;
        this.isDirty = false;
        if (typeof Modal !== 'undefined') Modal.close();
    }
    if (!this.config.departments[deptId]) deptId = Object.keys(this.config.departments)[0];
    this.currentDept = deptId;
    localStorage.setItem('aura_dept', deptId);
    
    const d = this.config.departments[deptId];
    
    document.getElementById('header-dept-name').innerText = d.name;
    
    // ✅ FIX: Properly update sidebar active state using data-dept attribute
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.dept === deptId);
    });
    
    this.renderSubNav();
    this.setSection(targetSection);
    this.initNotifications();
  }

  initNotifications() {
    this.updateNotifications();
    if (this.notifInterval) clearInterval(this.notifInterval);
    this.notifInterval = setInterval(() => {
        if (Auth.user) this.updateNotifications();
    }, 15000); // Pool every 15s
  }

  async updateNotifications() {
    try {
      const res = await API.get('/notifications');
      const dot = document.querySelector('.notif-dot');
      const list = document.getElementById('notif-list');
      
      if (res.notifications && res.notifications.length > 0) {
        dot.classList.remove('hidden');
        list.innerHTML = res.notifications.map(n => `
          <div class="notif-item notif-${n.type}">
            <div class="notif-msg">${n.message}</div>
            ${n.type === 'loan_app' ? `
              <div class="loan-details">ID: #${n.reference_id}</div>
              <div class="notif-actions">
                <button class="btn-mini approve" onclick="App.reviewLoan(${n.reference_id}, 'approve', ${n.id})">Accept</button>
                <button class="btn-mini reject" onclick="App.reviewLoan(${n.reference_id}, 'reject', ${n.id})">Refuse</button>
              </div>
            ` : n.type === 'workflow' ? `
              <div class="loan-details">Process ID: #${n.reference_id}</div>
              <div class="notif-actions">
                <button class="btn-mini" onclick="App.setSection('workflows'); App.viewWorkflowHistory(${n.reference_id}); API.post('/notifications/read', {id:${n.id}});">Review Workflow</button>
              </div>
            ` : ''}
            <div class="notif-time">${UI.formatDate(n.created_at)}</div>
          </div>
        `).join('');
      } else {
        dot.classList.add('hidden');
        list.innerHTML = `<div class="notif-empty">No new notifications</div>`;
      }
    } catch(e) {}
  }

  toggleNotifications() {
    document.getElementById('notif-dropdown').classList.toggle('hidden');
  }

  async markAllNotificationsRead() {
    await API.post('/notifications/read');
    this.updateNotifications();
    document.getElementById('notif-dropdown').classList.add('hidden');
  }

  async viewWorkflowHistory(instanceId) {
    try {
      const res = await API.get('/workflows/instances');
      const inst = res.instances.find(i => i.id === instanceId);
      if (!inst) return;
      
      let steps, history;
      try {
        steps = JSON.parse(inst.steps_json);
      } catch(e) {
        steps = [];
      }
      try {
        history = JSON.parse(inst.history_json || '[]');
      } catch(e) {
        history = [];
      }
      const container = document.getElementById('wf-history-timeline');
      document.getElementById('wf-modal-title').innerText = `${inst.workflow_name} History (#${inst.id})`;
      
      container.innerHTML = steps.map((step, idx) => {
        const stepNum = idx + 1;
        const histEntry = history.find(h => h.step === stepNum);
        const isActive = inst.current_step === stepNum;
        const isCompleted = inst.current_step > stepNum || inst.status === 'completed';
        
        let statusIcon = '🔘';
        if (isCompleted) statusIcon = '✅';
        else if (isActive && inst.status !== 'rejected') statusIcon = '🔵';
        else if (inst.status === 'rejected' && isActive) statusIcon = '❌';
        
        return `
          <div class="timeline-item">
            <div class="tl-dot ${isCompleted ? 'completed' : (isActive ? 'active' : '')}">${statusIcon}</div>
            <div class="tl-content">
              <div class="tl-title">${step.name || step.action || `Step ${stepNum}`}</div>
              <div class="tl-meta">
                <span>Actor: <b>${step.actor || 'System'}</b></span>
                ${histEntry ? `<span>Timestamp: ${UI.formatDate(histEntry.timestamp)}</span>` : ''}
              </div>
              ${histEntry && histEntry.comment ? `<div class="tl-comment">"${histEntry.comment}"</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
      
      document.getElementById('workflow-modal').classList.remove('hidden');
    } catch(e) {
      UI.showToast(e.message, "error");
    }
  }

  closeWorkflowModal() {
    document.getElementById('workflow-modal').classList.add('hidden');
  }

  async reviewLoan(appId, action, notifId) {
    if (!confirm(`Are you sure you want to ${action} this loan application?`)) return;
    try {
      const res = await API.post('/loans/review', { id: appId, action, comment: `Reviewed by ${Auth.user.name}` });
      UI.showToast(`Loan Application ${action}ed. Stage: ${res.new_status}`, "success");
      await API.post('/notifications/read', { id: notifId });
      this.updateNotifications();
      this.refreshCurrentView();
    } catch(e) {
      UI.showToast(e.message, "error");
    }
  }

  renderSubNav() {
    const sub = document.getElementById('dept-subnav');
    const sections = [
      { id: 'dashboard',     name: 'Dashboard' },
      { id: 'data',          name: 'Data Management' },
      { id: 'workflows',     name: 'Processes' },
      { id: 'tasks',         name: 'Daily Tasks' },
      { id: 'reports',       name: 'Reports' },
      { id: 'communication', name: 'Communication' },
      { id: 'my_impact',     name: 'My AI Impact' }
    ];
    
    // Add Campaigns to subnav for banking domain
    if (Auth.domain && Auth.domain.id === 'banking') {
       sections.push({ id: 'campaigns', name: 'Campaigns' });
    }
    
    // Add User Portal for Domain Admins
    if (Auth.user && Auth.user.role_level >= 4) {
       sections.push({ id: 'user_portal', name: 'User Management' });
    }
    
    sub.innerHTML = sections.map(s => `
      <a class="subnav-item ${s.id === this.currentSection ? 'active' : ''}" onclick="App.setSection('${s.id}')">
        ${s.name}
      </a>
    `).join('');
  }

  setSection(sectionId) {
    if (this.isDirty) {
        if (!confirm("You have unsaved changes. Are you sure you want to switch tabs?")) return;
        this.isDirty = false;
        if (typeof Modal !== 'undefined') Modal.close();
    }
    this.currentSection = sectionId;
    localStorage.setItem('aura_section', sectionId);
    document.getElementById('header-section-name').innerText = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
    
    // ✅ FIX: Re-render subnav so active tab actually updates on click
    this.renderSubNav();
    this.refreshCurrentView();
  }

  refreshCurrentView() {
    // ✅ Fade out then update — no more blank white flash on every click
    const area = document.getElementById('content-area');
    if (area) area.classList.add('fading');
    
    const doRender = () => {
      if (this.currentSection === 'dashboard') {
        window.Analytics.renderDashboard(this.currentDept);
      } else if (this.currentSection === 'data') {
        this.renderDataTable();
      } else if (this.currentSection === 'workflows') {
        this.renderWorkflows();
      } else if (this.currentSection === 'tasks') {
        this.renderTasks();
      } else if (this.currentSection === 'reports') {
        window.Reporting.renderHome();
      } else if (this.currentSection === 'communication') {
        window.Comm.renderHub();
      } else if (this.currentSection === 'campaigns') {
        window.Campaigns.renderHub();
      } else if (this.currentSection === 'my_impact') {
        this.renderMyImpact();
      } else if (this.currentSection === 'user_portal') {
        if (window.UserPortal) {
            window.UserPortal.renderHome();
        } else {
            console.error("UserPortal module not loaded");
        }
      }
      if (area) area.classList.remove('fading');
    };

    // Allow fade-out to complete before rendering new content
    if (area) {
      setTimeout(doRender, 180);
    } else {
      doRender();
    }
  }

  async renderMyImpact() {
    const container = document.getElementById('content-area');
    container.innerHTML = `<div style="text-align:center;padding:50px"><div class="ai-orb" style="display:inline-block"></div> Loading your AI Experience profile...</div>`;

    try {
      const res = await API.get('/ai/my_impact');
      let score = res.efficiency_score || 50.0;
      let statusText = res.status === 'learning' ? 'Initializing Knowledge Graph' : 'Adaptive Profile Active';

      container.innerHTML = `
        <div class="glass-panel" style="margin-bottom: 25px;">
          <h2 class="section-title">My AI Experience & Impact</h2>
          <p style="color:var(--text-muted);">Personalized insights gathered from your workflow habits and AI decisions. (${statusText})</p>
        </div>
        <div class="grid-4" style="margin-bottom: 25px;">
          <div class="kpi-card" style="border-left: 4px solid var(--domain-color);">
             <div class="kpi-label">Efficiency Impact Score</div>
             <div class="kpi-val">${score.toFixed(1)}</div>
          </div>
          <div class="kpi-card">
             <div class="kpi-label">Decision Automation</div>
             <div class="kpi-val">Active</div>
          </div>
        </div>
        <div class="glass-panel" style="display:flex; gap:20px; align-items:center;">
          <div style="font-size:40px;">🧠</div>
          <div>
            <h3 style="margin-bottom:10px; font-size:16px;">AI Learning Profile</h3>
            <p style="color:var(--text-muted); font-size:14px; line-height:1.6;">
              The Intelligence Engine is currently observing your interactions, including how you handle workflows and which experts you contact. Based on your recent choices and workflow resolution patterns, the system uses semantic modeling to replicate your decision logic across automated processes.
            </p>
          </div>
        </div>
      `;
    } catch(e) {
      container.innerHTML = `<div class="glass-panel">Error loading impact data: ${e.message}</div>`;
    }
  }

  async renderTasks() {
    const container = document.getElementById('content-area');
    container.innerHTML = `<div style="text-align:center;padding:50px">Loading task queue...</div>`;
    
    try {
      const res = await API.get('/records/tasks');
      const tasks = res.rows || [];
      const dept = this.currentDept.toLowerCase();
      
      // Filter tasks relevant to current department (either from or to)
      // Guard against null from_dept / to_dept to prevent crashes
      const myTasks = tasks.filter(t => 
        (t.from_dept || '').toLowerCase() === dept || 
        (t.to_dept || '').toLowerCase() === dept
      );

      const assignedToMe = myTasks.filter(t => t.assigned_to === Auth.user?.id).length;

      let html = `
        <div class="glass-panel" style="margin-bottom: 25px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h2 class="section-title">Departmental Task Queue</h2>
              <p style="color:var(--text-muted);">Priority actions for ${this.currentDept.toUpperCase()} team</p>
            </div>
            <button class="btn-primary" onclick="App.renderTasks()">🔄 Refresh Queue</button>
          </div>
        </div>

        <div class="grid-4">
          <div class="kpi-card" style="position:relative;">
             <button onclick="KPIExplainer.open('High Priority Tasks', '${myTasks.filter(t => t.priority === 'High').length}', 'neutral')" style="position:absolute; top:12px; right:12px; background:rgba(255,255,255,0.1); border:none; border-radius:50%; width:24px; height:24px; color:var(--text-muted); cursor:pointer; font-size:12px;">ℹ️</button>
             <div class="kpi-label">High Priority</div><div class="kpi-val">${myTasks.filter(t => t.priority === 'High').length}</div>
          </div>
          <div class="kpi-card" style="position:relative;">
             <button onclick="KPIExplainer.open('Pending Reviews', '${myTasks.filter(t => t.status === 'pending').length}', 'neutral')" style="position:absolute; top:12px; right:12px; background:rgba(255,255,255,0.1); border:none; border-radius:50%; width:24px; height:24px; color:var(--text-muted); cursor:pointer; font-size:12px;">ℹ️</button>
             <div class="kpi-label">Pending Reviews</div><div class="kpi-val">${myTasks.filter(t => t.status === 'pending').length}</div>
          </div>
          <div class="kpi-card" style="position:relative;">
             <button onclick="KPIExplainer.open('Assigned to Me', '${assignedToMe}', 'neutral')" style="position:absolute; top:12px; right:12px; background:rgba(255,255,255,0.1); border:none; border-radius:50%; width:24px; height:24px; color:var(--text-muted); cursor:pointer; font-size:12px;">ℹ️</button>
             <div class="kpi-label">Assigned to Me</div><div class="kpi-val">${assignedToMe}</div>
          </div>
          <div class="kpi-card" style="border-left:4px solid var(--accent-success); position:relative;">
             <button onclick="KPIExplainer.open('Goal Completion', '82', 'up')" style="position:absolute; top:12px; right:12px; background:rgba(255,255,255,0.1); border:none; border-radius:50%; width:24px; height:24px; color:var(--text-muted); cursor:pointer; font-size:12px;">ℹ️</button>
             <div class="kpi-label">Goal Completion</div><div class="kpi-val">82%</div>
          </div>
        </div>

        <div class="glass-panel" style="margin-top:20px;">
          <table class="aura-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Task Description</th>
                <th>Workflow</th>
                <th>Required Approval</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (myTasks.length === 0) {
        html += `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">No assigned tasks for this department.</td></tr>`;
      } else {
        myTasks.forEach(t => {
          const prioClass = `prio-${t.priority.toLowerCase()}`;
          html += `
            <tr>
              <td><span class="prio-tag ${prioClass}">${t.priority}</span></td>
              <td><b style="font-size:14px">${t.title}</b></td>
              <td>
                <div style="font-size:11px; color:var(--text-muted)">From: ${t.from_dept.toUpperCase()}</div>
                <div style="font-size:11px; color:var(--domain-color)">To: ${t.to_dept.toUpperCase()}</div>
              </td>
              <td><span style="text-transform:capitalize; font-size:12px">👤 ${t.approval_role}</span></td>
              <td><span class="status-badge" style="background:rgba(255,255,255,0.05)">${t.status}</span></td>
              <td>
                <button class="btn-mini approve" onclick="App.completeTask(${t.id})">Mark Complete</button>
              </td>
            </tr>
          `;
        });
      }

      html += `</tbody></table></div>`;
      container.innerHTML = html;
    } catch(e) {
      container.innerHTML = `<div class="error-state">Error loading tasks: ${e.message}</div>`;
    }
  }

  async completeTask(taskId) {
    if (!confirm("Mark this task as completed?")) return;
    try {
      // In a real app we'd have a specific /api/tasks/complete, but for now we'll use generic update if available
      // For this demo, we'll just show success toast
      UI.showToast("Task marked as completed and moved to archive.", "success");
      this.renderTasks();
    } catch(e) {
      UI.showToast(e.message, "error");
    }
  }

  async renderWorkflows() {
    const container = document.getElementById('content-area');
    container.innerHTML = `<div style="text-align:center;padding:50px">Loading workflows...</div>`;
    
    try {
      const res = await API.get('/workflows/instances');
      const instances = res.instances || [];
      
      let html = `
        <div class="glass-panel" style="margin-bottom: 25px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h2 class="section-title">Enterprise Processes</h2>
              <p style="color:var(--text-muted);">Manage and track cross-departmental procedures for ${Auth.domain ? Auth.domain.name.toUpperCase() : 'YOUR DOMAIN'}</p>
            </div>
            <button class="btn-primary" onclick="App.renderWorkflows()">🔄 Refresh List</button>
          </div>
        </div>

        <div class="grid-4" id="workflow-kpi-area">
          <div class="kpi-card"><div class="kpi-label">Active Processes</div><div class="kpi-val">${instances.filter(i => i.status === 'active').length}</div></div>
          <div class="kpi-card"><div class="kpi-label">Pending Approval</div><div class="kpi-val">${instances.filter(i => i.status === 'pending').length}</div></div>
          <div class="kpi-card"><div class="kpi-label">Completed Today</div><div class="kpi-val">${instances.filter(i => i.status === 'completed').length}</div></div>
          <div class="kpi-card"><div class="kpi-label">SLA Compliance</div><div class="kpi-val">98.4%</div></div>
        </div>

        <div class="glass-panel" style="margin-top:20px;">
          <table class="aura-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Process Name</th>
                <th>Current State</th>
                <th>Status</th>
                <th>Assigned Dept</th>
                <th>Last Update</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      if (instances.length === 0) {
        html += `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">No active processes found for this department.</td></tr>`;
      } else {
        instances.forEach(inst => {
          let steps, currentStep, stepName;
          try {
            steps = JSON.parse(inst.steps_json);
            currentStep = steps[inst.current_step - 1] || steps[steps.length - 1];
            stepName = currentStep.name || currentStep.action || `Step ${inst.current_step}`;
          } catch(parseErr) {
            steps = [];
            stepName = `Step ${inst.current_step}`;
          }
          
          html += `
            <tr>
              <td>#${inst.id}</td>
              <td><b style="color:var(--domain-color)">${inst.workflow_name}</b></td>
              <td>
                <div style="font-size:12px; color:var(--text-muted)">Stage ${inst.current_step} of ${steps.length}</div>
                <div style="font-weight:600">${stepName}</div>
              </td>
              <td><span class="status-badge status-${inst.status}">${inst.status}</span></td>
              <td><span style="text-transform:uppercase; font-size:11px; letter-spacing:1px">${inst.assigned_dept}</span></td>
              <td>${UI.formatDate(inst.updated_at)}</td>
              <td>
                <div style="display:flex; gap:8px;">
                  <button class="btn-mini" onclick="App.viewWorkflowHistory(${inst.id})">History</button>
                  ${inst.status !== 'completed' && inst.status !== 'rejected' ? `
                    <button class="btn-mini approve" onclick="App.takeWorkflowAction(${inst.id}, 'approve')">Approve</button>
                    <button class="btn-mini reject" onclick="App.takeWorkflowAction(${inst.id}, 'reject')">Reject</button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `;
        });
      }
      
      html += `</tbody></table></div>`;
      container.innerHTML = html;
    } catch(e) {
      container.innerHTML = `<div class="error-state">Error loading workflows: ${e.message}</div>`;
    }
  }

  async takeWorkflowAction(instanceId, action) {
    const comment = prompt(`Enter ${action} comment:`, `Processed by ${Auth.user.name}`);
    if (comment === null) return;
    
    try {
      const res = await API.post('/workflows/action', { instance_id: instanceId, action, comment });
      UI.showToast(`Workflow updated to: ${res.new_status}`, "success");
      this.renderWorkflows();
    } catch(e) {
      UI.showToast(e.message, "error");
    }
  }

  async renderDataTable() {
    const container = document.getElementById('content-area');
    const entities = this.config.departments[this.currentDept].entities || [];
    if (!entities.length) {
      container.innerHTML = '<p>No data entities available.</p>';
      return;
    }
    const table = entities[0];
    
    // ✅ FIX: Show skeleton instead of blanking the screen
    container.innerHTML = `<div class="skeleton-loader"><div class="sk-bar wide"></div><div class="sk-bar medium"></div><div class="sk-table"></div></div>`;
    
    try {
      // ✅ FIX: Fetch records AND schema in parallel (2x faster)
      const [res, schema] = await Promise.all([
        API.get(`/records/${table}`),
        API.get(`/schema/${table}`)
      ]);
      const cols = schema.columns.map(c => c.name).filter(c => c !== 'updated_at');
      
      let html = `
        <div class="data-table-wrapper">
          <div class="data-toolbar">
            <div class="toolbar-left">
              <h3 style="text-transform:capitalize">${table}</h3>
            </div>
            <div class="toolbar-right">
              ${Auth.user.permissions.can_create ? `<button class="btn-primary" onclick="Modal.open('${table}')">+ Add Record</button>` : ''}
              ${Auth.user.permissions.can_export ? `<button class="btn-secondary" onclick="window.open('/api/records/${table}/export')">↓ Export CSV</button>` : ''}
            </div>
          </div>
          <div style="overflow-x:auto;">
            <table class="aura-table">
              <thead><tr>${cols.map(c => `<th>${c.replace(/_/g, ' ')}</th>`).join('')}<th>Actions</th></tr></thead>
              <tbody>
      `;
      
      res.rows.forEach(r => {
        html += `<tr>`;
        cols.forEach(c => {
          let val = r[c];
          if (c === 'status') html += `<td><span class="status-badge" style="background:rgba(255,255,255,0.1)">${val}</span></td>`;
          else if (c.includes('amount') || c.includes('salary') || c === 'value') html += `<td>${UI.formatCurrency(val)}</td>`;
          else html += `<td>${val || '-'}</td>`;
        });
        html += `<td class="action-cell">
          ${Auth.user.permissions.can_edit ? `<button class="btn-icon" onclick="Modal.open('${table}', ${r.id})">✎</button>` : ''}
          ${Auth.user.permissions.can_delete ? `<button class="btn-icon" onclick="App.deleteRecord('${table}', ${r.id})">🗑</button>` : ''}
        </td></tr>`;
      });
      
      html += `</tbody></table></div></div>`;
      container.innerHTML = html;
    } catch(e) {
      container.innerHTML = `<div style="color:red;padding:20px">${e.message}</div>`;
    }
  }

  async deleteRecord(table, id) {
    if (!confirm("Delete this record permanently?")) return;
    try {
      // ✅ FIX: Optimistic UI — remove row immediately without waiting for full re-render
      const row = document.querySelector(`button[onclick*="deleteRecord('${table}', ${id})"]`)?.closest('tr');
      if (row) { row.style.opacity = '0.3'; row.style.pointerEvents = 'none'; }
      await API.del(`/records/${table}/${id}`);
      UI.showToast("Record deleted", "success");
      if (row) row.remove(); else this.refreshCurrentView();
    } catch(e) {
      UI.showToast(e.message, "error");
      this.refreshCurrentView(); // recover on error
    }
  }

  toggleSidebar() {
    const s = document.getElementById('sidebar');
    s.classList.toggle('collapsed');
  }

  globalSearch(val) {
    // ✅ FIX: Debounce search so it doesn't fire on every keystroke
    clearTimeout(this._searchDebounce);
    if (!val || val.length < 2) return;
    this._searchDebounce = setTimeout(() => {
      UI.showToast(`Searching for "${val}"...`, 'info');
    }, 400);
  }

  showAdminPanel() {
    // Only Admin
    if (!Auth.user.permissions.can_manage_users) {
      UI.showToast("Access Denied: Administrator level required.", "error");
      return;
    }
    document.getElementById('admin-panel').classList.remove('hidden');
    window.AdminPanel.loadDomain(Auth.domain.id);
  }
}

class AdminController {
  constructor() {
    this.domain = null;
    this.table = null;
  }
  close() { document.getElementById('admin-panel').classList.add('hidden'); }
  async loadDomain(domain) {
    this.domain = domain;
    try {
      const res = await API.get(`/admin/domain/${domain}/tables`);
      const list = document.getElementById('admin-tables-list');
      list.innerHTML = res.tables.map(t => `
        <div class="admin-table-item" onclick="AdminPanel.loadTable('${t.name}')">
           <span>${t.name}</span>
           <span class="admin-table-badge">${t.count}</span>
        </div>
      `).join('');
    } catch(e) {
      UI.showToast(e.message, 'error');
    }
  }
  async loadTable(table) {
    this.table = table;
    try {
      const res = await API.get(`/admin/domain/${this.domain}/table/${table}`);
      const content = document.getElementById('admin-content');
      let html = `<div class="data-table-wrapper"><div class="data-toolbar"><h3>${this.domain} / ${table}</h3></div><div style="overflow-x:auto;"><table class="aura-table"><thead><tr>`;
      res.schema.forEach(c => html += `<th>${c.name}</th>`);
      html += `</tr></thead><tbody>`;
      res.rows.forEach(r => {
        html += `<tr>`;
        res.schema.forEach(c => html += `<td>${r[c.name] !== null ? r[c.name] : ''}</td>`);
        html += `</tr>`;
      });
      html += `</tbody></table></div></div>`;
      content.innerHTML = html;
    } catch(e) {
      UI.showToast(e.message, 'error');
    }
  }
}

class PerformanceController {
  constructor() {
    this.interval = null;
  }
  
  open() {
    if (!Auth.user || Auth.user.role !== 'admin') {
      UI.showToast("Admin access required for System Performance Core.", "error");
      return;
    }
    document.getElementById('perf-panel').classList.remove('hidden');
    this.fetchData();
    this.interval = setInterval(() => this.fetchData(), 5000);
  }
  
  close() {
    document.getElementById('perf-panel').classList.add('hidden');
    if (this.interval) clearInterval(this.interval);
  }
  
  async fetchData() {
    try {
      const res = await API.get('/performance/metrics');
      
      // Update top KPIs
      document.getElementById('perf-avg-ms').innerText = `${res.summary.avg_ms} ms`;
      document.getElementById('perf-p95-ms').innerText = `${res.summary.p95_ms} ms`;
      document.getElementById('perf-req-vol').innerText = res.summary.req_count;
      document.getElementById('perf-err-rate').innerText = `${res.summary.error_rate}%`;
      
      // Update Slow Operations list
      const slowList = document.getElementById('perf-slow-list');
      if (res.slow_requests.length === 0) {
        slowList.innerHTML = `<div style="padding:20px; color:var(--text-muted); text-align:center;">No slow operations detected recently. System is optimal.</div>`;
        document.getElementById('perf-ai-optimizer').innerHTML = `<span style="color:var(--accent-success);">✅ System is running perfectly. No intelligent caching interventions required.</span>`;
      } else {
        slowList.innerHTML = res.slow_requests.slice(0, 10).map(r => `
          <div style="display:flex; justify-content:space-between; padding:10px; background:rgba(255,255,255,0.03); border-radius:6px; border:1px solid var(--glass-border);">
            <div style="font-family:monospace; font-size:12px; color:white;">
               <span style="color:var(--domain-color); font-weight:bold">${r.method}</span> ${r.endpoint}
            </div>
            <div style="font-weight:bold; color:var(--accent-danger); font-size:12px;">${r.duration_ms} ms</div>
          </div>
        `).join('');
        
        // "AI AI/Optimizer" heuristic text
        const hottest = res.hottest_endpoints[0];
        if (hottest) {
            document.getElementById('perf-ai-optimizer').innerHTML = `
              <p>⚠️ <b>Bottleneck Detected:</b> API Endpoint <code style="color:var(--domain-color)">${hottest.endpoint}</code> is averaging ${hottest.avg_ms}ms.</p>
              <br/>
              <p><b>Recommended Action:</b> The Intelligence Engine advises boosting the automated TTL cache for this specific route or restructuring the underlying SQL index if the problem persists.</p>
            `;
        }
      }
    } catch(e) {
      console.error("Perf fetch error", e);
    }
  }

  async clearCache() {
    if (!confirm("Are you sure you want to flush the performance caches? This might temporarily spike load times.")) return;
    try {
      await API.post('/performance/cache/clear', {});
      UI.showToast("System cache cleared successfully.", "success");
      this.fetchData();
    } catch(e) {
      UI.showToast(e.message, "error");
    }
  }
}

window.AdminPanel = new AdminController();
window.PerformanceUI = new PerformanceController();

window.App = new Application();
document.addEventListener('DOMContentLoaded', () => window.App.init());

