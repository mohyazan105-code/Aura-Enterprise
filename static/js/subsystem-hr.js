/**
 * Action Aura — HR Subsystem UI
 */
const HRSystem = {
  async render(section) {
    switch (section) {
      case 'dashboard':   return this.renderDashboard();
      case 'employees':   return this.renderEmployees();
      case 'attendance':  return this.renderAttendance();
      case 'payroll':     return this.renderPayroll();
      case 'leave':       return this.renderLeave();
      case 'performance': return this.renderPerformance();
      default:            return this.renderDashboard();
    }
  },

  async renderDashboard() {
    const c = document.getElementById('sub-content');
    try {
      const d = await SubsystemApp.apiGet('/api/sub/hr/dashboard');
      const k = d.kpis;
      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">HR Dashboard</h2><p class="sub-section-sub">Real-time workforce intelligence and analytics</p></div>
        </div>

        <div class="sub-kpi-grid">
          ${SubsystemApp.kpiCard('Total Employees', k.total_employees, '👥', '#34d399')}
          ${SubsystemApp.kpiCard('Active Staff', k.active_employees, '✅', '#60a5fa')}
          ${SubsystemApp.kpiCard('On Leave', k.on_leave, '🌴', '#fbbf24')}
          ${SubsystemApp.kpiCard('Attendance Rate', k.attendance_rate + '%', '📅', k.attendance_rate > 93 ? '#34d399' : '#f87171')}
          ${SubsystemApp.kpiCard('Monthly Payroll', SubsystemApp.formatCurrency(k.monthly_payroll), '💰', '#a78bfa')}
          ${SubsystemApp.kpiCard('Avg Performance', k.avg_performance + '/5', '🏆', k.avg_performance >= 4 ? '#34d399' : '#fbbf24', 'Last reviewed')}
          ${SubsystemApp.kpiCard('Pending Leaves', k.pending_leaves, '📋', k.pending_leaves > 0 ? '#f87171' : '#34d399', 'Need approval')}
          ${SubsystemApp.kpiCard('Open Positions', k.open_positions, '🎯', '#fb923c', 'Hiring pipeline')}
        </div>

        <div class="sub-charts-grid">
          <div class="sub-chart-card">
            <div class="sub-chart-title">📈 Headcount Trend</div>
            <div class="sub-chart-wrap"><canvas id="hr-line-chart"></canvas></div>
          </div>
          <div class="sub-chart-card">
            <div class="sub-chart-title">🏢 Employees by Department</div>
            <div class="sub-chart-wrap"><canvas id="hr-dept-chart"></canvas></div>
          </div>
        </div>

        <div class="sub-charts-grid" style="margin-top:20px">
          <div class="sub-chart-card">
            <div class="sub-chart-title">🏆 Performance Distribution</div>
            <div class="sub-chart-wrap"><canvas id="hr-perf-chart"></canvas></div>
          </div>
          <div class="sub-chart-card">
            <div class="sub-chart-title">📅 Attendance Heatmap (Weekly)</div>
            <div style="margin-top:15px;overflow-x:auto">
              ${this._renderHeatmap(d.attendance_heatmap)}
            </div>
          </div>
        </div>`;

      SubsystemApp.renderChart('hr-line-chart', {
        type: 'line',
        data: {
          labels: d.headcount_trend.labels,
          datasets: [{ label: 'Headcount', data: d.headcount_trend.values, borderColor: '#34d399', backgroundColor: '#34d39910', tension: 0.4, fill: true, pointRadius: 4 }]
        },
        options: this._chartOpts()
      });

      SubsystemApp.renderChart('hr-dept-chart', {
        type: 'bar',
        data: {
          labels: d.dept_breakdown.labels,
          datasets: [{ label: 'Employees', data: d.dept_breakdown.values, backgroundColor: '#34d39966', borderColor: '#34d399', borderWidth: 1, borderRadius: 6 }]
        },
        options: this._chartOpts()
      });

      SubsystemApp.renderChart('hr-perf-chart', {
        type: 'doughnut',
        data: {
          labels: d.performance_distribution.labels,
          datasets: [{ data: d.performance_distribution.values, backgroundColor: ['#34d399','#60a5fa','#fbbf24','#fb923c','#f87171'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 } } } } }
      });

    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  _renderHeatmap(data) {
    const cell = (v) => {
      const opacity = (v / 100).toFixed(2);
      return `<div class="sub-heat-cell" style="background:rgba(52,211,153,${opacity})" title="${v}%"></div>`;
    };
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        ${data.days.map(d => `<div style="flex:1;text-align:center;font-size:10px;color:var(--text-muted)">${d}</div>`).join('')}
      </div>
      ${data.data.map((row, i) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          ${row.map(v => cell(v)).join('')}
        </div>
      `).join('')}
      <div style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:11px;color:var(--text-muted)">
        <span>Low</span>
        <div style="width:80px;height:8px;background:linear-gradient(to right,rgba(52,211,153,.1),rgba(52,211,153,1));border-radius:4px"></div>
        <span>High</span>
      </div>`;
  },

  async renderEmployees() {
    const c = document.getElementById('sub-content');
    try {
      const d = await SubsystemApp.apiGet('/api/sub/hr/employees');
      const statusBadge = (s) => SubsystemApp.badge(s, s === 'active' ? 'green' : s === 'on-leave' ? 'yellow' : 'red');

      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">Employee Directory</h2><p class="sub-section-sub">${d.employees.length} employees on record</p></div>
          <button class="sub-btn-primary" onclick="HRSystem.showAddEmployee()">+ Add Employee</button>
        </div>
        <div class="sub-table-card">
          <table class="sub-table">
            <thead><tr><th>ID</th><th>Name</th><th>Department</th><th>Position</th><th>Salary</th><th>Hire Date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${d.employees.map(e => `
                <tr>
                  <td style="font-family:monospace;font-size:11px;color:var(--sub-accent)">${e.employee_id}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px">
                      <div style="width:32px;height:32px;border-radius:50%;background:var(--sub-accent)22;border:1px solid var(--sub-accent);display:flex;align-items:center;justify-content:center;font-size:14px">${e.name.charAt(0)}</div>
                      <div>
                        <div style="font-weight:600">${e.name}</div>
                        <div style="font-size:11px;color:var(--text-muted)">${e.email || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td><span class="sub-tag">${e.department}</span></td>
                  <td>${e.position}</td>
                  <td>${SubsystemApp.formatCurrency(e.salary)}/yr</td>
                  <td>${SubsystemApp.formatDate(e.hire_date)}</td>
                  <td>${statusBadge(e.status)}</td>
                  <td><button class="sub-btn-mini" onclick="HRSystem.editEmployee(${e.id})">Edit</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  async renderAttendance() {
    const c = document.getElementById('sub-content');
    try {
      const today = new Date().toISOString().split('T')[0];
      const d = await SubsystemApp.apiGet(`/api/sub/hr/attendance?date=${today}`);
      const statusColor = { present: 'green', absent: 'red', late: 'yellow', 'half-day': 'orange' };

      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">Attendance Log</h2><p class="sub-section-sub">Daily attendance tracking — ${today}</p></div>
          <button class="sub-btn-primary" onclick="HRSystem.showLogAttendance()">+ Log Attendance</button>
        </div>
        <div class="sub-kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${SubsystemApp.kpiCard('Present', d.attendance.filter(a => a.status === 'present').length, '✅', '#34d399')}
          ${SubsystemApp.kpiCard('Absent', d.attendance.filter(a => a.status === 'absent').length, '❌', '#f87171')}
          ${SubsystemApp.kpiCard('Late', d.attendance.filter(a => a.status === 'late').length, '⏰', '#fbbf24')}
          ${SubsystemApp.kpiCard('Total Logged', d.attendance.length, '📋', '#60a5fa')}
        </div>
        <div class="sub-table-card">
          <table class="sub-table">
            <thead><tr><th>Employee</th><th>Department</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th></tr></thead>
            <tbody>
              ${d.attendance.map(a => `
                <tr>
                  <td><strong>${a.employee_name}</strong></td>
                  <td><span class="sub-tag">${a.department}</span></td>
                  <td style="font-family:monospace">${a.check_in || '—'}</td>
                  <td style="font-family:monospace">${a.check_out || '—'}</td>
                  <td>${a.hours ? a.hours + 'h' : '—'}</td>
                  <td>${SubsystemApp.badge(a.status, statusColor[a.status] || 'gray')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  async renderPayroll() {
    const c = document.getElementById('sub-content');
    try {
      const period = new Date().toISOString().slice(0, 7);
      const d = await SubsystemApp.apiGet(`/api/sub/hr/payroll?period=${period}`);
      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">Payroll — ${period}</h2><p class="sub-section-sub">Total payroll: <strong style="color:var(--sub-accent)">${SubsystemApp.formatCurrency(d.total_payroll)}</strong></p></div>
        </div>
        <div class="sub-table-card">
          <table class="sub-table">
            <thead><tr><th>Employee</th><th>Department</th><th>Base Salary</th><th>Overtime</th><th>Bonuses</th><th>Deductions</th><th>Net Pay</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${d.payroll.map(p => `
                <tr>
                  <td><strong>${p.employee_name}</strong><div style="font-size:11px;color:var(--text-muted)">${p.position}</div></td>
                  <td><span class="sub-tag">${p.department}</span></td>
                  <td>${SubsystemApp.formatCurrency(p.base_salary)}</td>
                  <td style="color:#34d399">+${SubsystemApp.formatCurrency(p.overtime)}</td>
                  <td style="color:#a78bfa">+${SubsystemApp.formatCurrency(p.bonuses)}</td>
                  <td style="color:#f87171">-${SubsystemApp.formatCurrency(p.deductions)}</td>
                  <td style="font-weight:700;color:var(--sub-accent)">${SubsystemApp.formatCurrency(p.net_pay)}</td>
                  <td>${SubsystemApp.badge(p.status, p.status === 'paid' ? 'green' : 'yellow')}</td>
                  <td>${p.status !== 'paid' ? `<button class="sub-btn-mini green" onclick="HRSystem.processPay(${p.id})">Process</button>` : '✓'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  async renderLeave() {
    const c = document.getElementById('sub-content');
    try {
      const d = await SubsystemApp.apiGet('/api/sub/hr/leave');
      const statusColor = { approved: 'green', rejected: 'red', pending: 'yellow' };
      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">Leave Management</h2><p class="sub-section-sub">${d.leaves.filter(l => l.status === 'pending').length} pending requests</p></div>
          <button class="sub-btn-primary" onclick="HRSystem.showRequestLeave()">+ Request Leave</button>
        </div>
        <div class="sub-table-card">
          <table class="sub-table">
            <thead><tr><th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Days</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${d.leaves.map(l => `
                <tr>
                  <td><strong>${l.employee_name}</strong><div style="font-size:11px;color:var(--text-muted)">${l.department}</div></td>
                  <td>${SubsystemApp.badge(l.type, 'blue')}</td>
                  <td>${SubsystemApp.formatDate(l.start_date)}</td>
                  <td>${SubsystemApp.formatDate(l.end_date)}</td>
                  <td style="font-weight:600">${l.days}d</td>
                  <td>${SubsystemApp.badge(l.status, statusColor[l.status] || 'gray')}</td>
                  <td style="display:flex;gap:6px">
                    ${l.status === 'pending' ? `
                      <button class="sub-btn-mini green" onclick="HRSystem.leaveAction(${l.id},'approve')">Approve</button>
                      <button class="sub-btn-mini red" onclick="HRSystem.leaveAction(${l.id},'reject')">Reject</button>
                    ` : '—'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  async renderPerformance() {
    const c = document.getElementById('sub-content');
    try {
      const d = await SubsystemApp.apiGet('/api/sub/hr/performance');
      const stars = (n) => '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0));
      const ratingColor = (r) => r >= 4 ? '#34d399' : r >= 3 ? '#60a5fa' : '#f87171';
      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">Performance Reviews</h2><p class="sub-section-sub">${d.reviews.length} reviews on record</p></div>
        </div>
        <div class="sub-table-card">
          <table class="sub-table">
            <thead><tr><th>Employee</th><th>Department</th><th>Period</th><th>Rating</th><th>Goals Met</th><th>Reviewer</th></tr></thead>
            <tbody>
              ${d.reviews.map(r => `
                <tr>
                  <td><strong>${r.employee_name}</strong><div style="font-size:11px;color:var(--text-muted)">${r.position}</div></td>
                  <td><span class="sub-tag">${r.department}</span></td>
                  <td>${r.period}</td>
                  <td>
                    <div style="color:${ratingColor(r.rating)}">${stars(r.rating)}</div>
                    <div style="font-size:11px;color:var(--text-muted)">${r.rating}/5</div>
                  </td>
                  <td>
                    <div style="display:flex;align-items:center;gap:6px">
                      <div style="width:60px;background:#ffffff10;border-radius:4px;height:5px">
                        <div style="width:${r.goals_met || 0}%;background:var(--sub-accent);height:5px;border-radius:4px"></div>
                      </div>
                      <span style="font-size:11px">${r.goals_met}%</span>
                    </div>
                  </td>
                  <td style="font-size:12px;color:var(--text-muted)">${r.reviewer || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  async showAddEmployee() {
    this._showModal('Add Employee', `
      <div class="sub-form-group"><label>Full Name</label><input id="he-name" class="sub-input" type="text" placeholder="Full Name"/></div>
      <div class="sub-form-group"><label>Email</label><input id="he-email" class="sub-input" type="email" placeholder="employee@company.com"/></div>
      <div class="sub-form-group"><label>Department</label>
        <select id="he-dept" class="sub-input">
          <option>Engineering</option><option>Finance</option><option>Marketing</option>
          <option>Operations</option><option>HR</option><option>Sales</option>
        </select>
      </div>
      <div class="sub-form-group"><label>Position</label><input id="he-pos" class="sub-input" type="text" placeholder="Job title"/></div>
      <div class="sub-form-group"><label>Annual Salary ($)</label><input id="he-sal" class="sub-input" type="number" placeholder="0"/></div>
    `, async () => {
      await SubsystemApp.apiPost('/api/sub/hr/employees', {
        name: document.getElementById('he-name').value,
        email: document.getElementById('he-email').value,
        department: document.getElementById('he-dept').value,
        position: document.getElementById('he-pos').value,
        salary: document.getElementById('he-sal').value
      });
      this._closeModal();
      SubsystemApp.showToast('Employee added', 'success');
      this.renderEmployees();
    });
  },

  async showLogAttendance() {
    const empData = await SubsystemApp.apiGet('/api/sub/hr/employees');
    this._showModal('Log Attendance', `
      <div class="sub-form-group"><label>Employee</label>
        <select id="ha-emp" class="sub-input">
          ${empData.employees.map(e => `<option value="${e.id}">${e.name} (${e.department})</option>`).join('')}
        </select>
      </div>
      <div class="sub-form-group"><label>Date</label><input id="ha-date" class="sub-input" type="date" value="${new Date().toISOString().split('T')[0]}"/></div>
      <div class="sub-form-group"><label>Status</label>
        <select id="ha-status" class="sub-input"><option>present</option><option>absent</option><option>late</option><option>half-day</option></select>
      </div>
      <div class="sub-form-group"><label>Hours Worked</label><input id="ha-hrs" class="sub-input" type="number" step="0.5" placeholder="8.0"/></div>
    `, async () => {
      await SubsystemApp.apiPost('/api/sub/hr/attendance', {
        employee_id: document.getElementById('ha-emp').value,
        date: document.getElementById('ha-date').value,
        status: document.getElementById('ha-status').value,
        hours: document.getElementById('ha-hrs').value
      });
      this._closeModal();
      SubsystemApp.showToast('Attendance logged', 'success');
      this.renderAttendance();
    });
  },

  async showRequestLeave() {
    const empData = await SubsystemApp.apiGet('/api/sub/hr/employees');
    this._showModal('Request Leave', `
      <div class="sub-form-group"><label>Employee</label>
        <select id="hl-emp" class="sub-input">
          ${empData.employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
        </select>
      </div>
      <div class="sub-form-group"><label>Leave Type</label>
        <select id="hl-type" class="sub-input"><option>annual</option><option>sick</option><option>unpaid</option><option>maternity</option></select>
      </div>
      <div class="sub-form-group"><label>Start Date</label><input id="hl-start" class="sub-input" type="date"/></div>
      <div class="sub-form-group"><label>End Date</label><input id="hl-end" class="sub-input" type="date"/></div>
      <div class="sub-form-group"><label>Reason</label><input id="hl-reason" class="sub-input" type="text" placeholder="Brief reason"/></div>
    `, async () => {
      await SubsystemApp.apiPost('/api/sub/hr/leave', {
        employee_id: document.getElementById('hl-emp').value,
        type: document.getElementById('hl-type').value,
        start_date: document.getElementById('hl-start').value,
        end_date: document.getElementById('hl-end').value,
        reason: document.getElementById('hl-reason').value
      });
      this._closeModal();
      SubsystemApp.showToast('Leave requested', 'success');
      this.renderLeave();
    });
  },

  async editEmployee(id) { SubsystemApp.showToast('Edit employee ' + id, 'info'); },

  async processPay(id) {
    if (!confirm('Process this payroll entry?')) return;
    await SubsystemApp.apiPost(`/api/sub/hr/payroll/${id}/process`, {});
    SubsystemApp.showToast('Payroll processed', 'success');
    this.renderPayroll();
  },

  async leaveAction(id, action) {
    await SubsystemApp.apiPost(`/api/sub/hr/leave/${id}/action`, { action });
    SubsystemApp.showToast(`Leave ${action}d`, 'success');
    this.renderLeave();
  },

  _chartOpts() {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
      scales: {
        x: { grid: { color: '#ffffff08' }, ticks: { color: '#64748b' } },
        y: { grid: { color: '#ffffff08' }, ticks: { color: '#64748b' } }
      }
    };
  },

  _showModal(title, bodyHTML, onSave) {
    let m = document.getElementById('sub-form-modal');
    if (!m) { m = document.createElement('div'); m.id = 'sub-form-modal'; m.className = 'sub-modal-overlay'; document.body.appendChild(m); }
    m.innerHTML = `<div class="sub-modal-card">
      <div class="sub-modal-header"><h3>${title}</h3><button onclick="HRSystem._closeModal()" style="background:none;border:none;color:white;font-size:20px;cursor:pointer">✕</button></div>
      <div class="sub-modal-body">${bodyHTML}</div>
      <div class="sub-modal-footer"><button class="sub-btn-secondary" onclick="HRSystem._closeModal()">Cancel</button><button class="sub-btn-primary" id="sub-modal-save">Save</button></div>
    </div>`;
    m.classList.remove('hidden');
    document.getElementById('sub-modal-save').onclick = onSave;
  },
  _closeModal() { const m = document.getElementById('sub-form-modal'); if (m) m.classList.add('hidden'); }
};

window.HRSystem = HRSystem;
