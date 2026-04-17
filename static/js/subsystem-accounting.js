/**
 * Action Aura — Accounting Subsystem UI
 */
const AccountingSystem = {
  async render(section) {
    switch (section) {
      case 'dashboard':     return this.renderDashboard();
      case 'transactions':  return this.renderTransactions();
      case 'invoices':      return this.renderInvoices();
      case 'budgets':       return this.renderBudgets();
      case 'reports':       return this.renderReports();
      default:              return this.renderDashboard();
    }
  },

  async renderDashboard() {
    const c = document.getElementById('sub-content');
    try {
      const d = await SubsystemApp.apiGet('/api/sub/accounting/dashboard');
      const k = d.kpis;

      c.innerHTML = `
        <div class="sub-section-header">
          <div>
            <h2 class="sub-section-title">Financial Dashboard</h2>
            <p class="sub-section-sub">Real-time accounting overview and financial health metrics</p>
          </div>
        </div>

        <div class="sub-kpi-grid">
          ${SubsystemApp.kpiCard('Total Revenue', SubsystemApp.formatCurrency(k.total_revenue), '💰', '#34d399', '↑ YTD')}
          ${SubsystemApp.kpiCard('Total Expenses', SubsystemApp.formatCurrency(k.total_expense), '💸', '#f87171', '↓ Budget')}
          ${SubsystemApp.kpiCard('Net Profit', SubsystemApp.formatCurrency(k.net_profit), '📈', k.net_profit >= 0 ? '#34d399' : '#f87171', k.profit_margin + '% margin')}
          ${SubsystemApp.kpiCard('Cash Flow', SubsystemApp.formatCurrency(k.cash_flow), '🌊', '#60a5fa', 'Operating')}
          ${SubsystemApp.kpiCard('Outstanding AR', SubsystemApp.formatCurrency(k.outstanding_ar), '📋', '#fbbf24', k.pending_invoices + ' pending')}
          ${SubsystemApp.kpiCard('Overdue Invoices', k.overdue_invoices, '⚠️', '#f87171', 'Requires follow-up')}
        </div>

        <div class="sub-charts-grid">
          <div class="sub-chart-card">
            <div class="sub-chart-title">📈 Revenue vs Expenses (6 Months)</div>
            <div class="sub-chart-wrap"><canvas id="acc-line-chart"></canvas></div>
          </div>
          <div class="sub-chart-card">
            <div class="sub-chart-title">🍕 Expense Category Breakdown</div>
            <div class="sub-chart-wrap"><canvas id="acc-pie-chart"></canvas></div>
          </div>
        </div>

        <div class="sub-chart-card" style="margin-top:20px">
          <div class="sub-chart-title">💼 Budget Health by Category</div>
          <div style="display:flex;flex-direction:column;gap:12px;margin-top:10px">
            ${d.budget_health.map(b => `
              <div class="sub-budget-bar">
                <div class="sub-budget-label">
                  <span>${b.category}</span>
                  <span style="color:${b.status === 'over' ? '#f87171' : b.status === 'warning' ? '#fbbf24' : '#34d399'}">${b.pct}%</span>
                </div>
                <div class="sub-budget-track">
                  <div class="sub-budget-fill" style="width:${Math.min(b.pct, 100)}%;background:${b.status === 'over' ? '#f87171' : b.status === 'warning' ? '#fbbf24' : 'var(--sub-accent)'}"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:2px">
                  <span>Spent: ${SubsystemApp.formatCurrency(b.spent)}</span>
                  <span>Budget: ${SubsystemApp.formatCurrency(b.allocated)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // Line chart
      const accent = '#a78bfa';
      SubsystemApp.renderChart('acc-line-chart', {
        type: 'line',
        data: {
          labels: d.monthly_chart.labels,
          datasets: [
            { label: 'Revenue', data: d.monthly_chart.revenue, borderColor: '#34d399', backgroundColor: '#34d39915', tension: 0.4, fill: true, pointRadius: 4 },
            { label: 'Expenses', data: d.monthly_chart.expenses, borderColor: '#f87171', backgroundColor: '#f8717115', tension: 0.4, fill: true, pointRadius: 4 }
          ]
        },
        options: this._chartOptions()
      });

      SubsystemApp.renderChart('acc-pie-chart', {
        type: 'doughnut',
        data: {
          labels: d.expense_breakdown.labels,
          datasets: [{ data: d.expense_breakdown.values, backgroundColor: ['#a78bfa','#34d399','#60a5fa','#fbbf24','#f87171','#fb923c'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 } } } } }
      });

    } catch (e) {
      c.innerHTML = `<div class="sub-error">Failed to load dashboard: ${e.message}</div>`;
    }
  },

  async renderTransactions() {
    const c = document.getElementById('sub-content');
    try {
      const d = await SubsystemApp.apiGet('/api/sub/accounting/transactions?limit=50');
      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">Transaction Ledger</h2><p class="sub-section-sub">All posted financial transactions</p></div>
          <button class="sub-btn-primary" onclick="AccountingSystem.showAddTransaction()">+ Add Transaction</button>
        </div>
        <div class="sub-table-card">
          <table class="sub-table">
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              ${d.transactions.map(t => `
                <tr>
                  <td>${SubsystemApp.formatDate(t.date)}</td>
                  <td>${t.description}</td>
                  <td><span class="sub-tag">${t.category || '—'}</span></td>
                  <td>${SubsystemApp.badge(t.type, t.type === 'income' ? 'green' : 'red')}</td>
                  <td style="color:${t.type === 'income' ? '#34d399' : '#f87171'};font-weight:600">
                    ${t.type === 'income' ? '+' : '-'}${SubsystemApp.formatCurrency(t.amount)}
                  </td>
                  <td>${SubsystemApp.badge(t.status || 'posted', 'blue')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  async renderInvoices() {
    const c = document.getElementById('sub-content');
    try {
      const d = await SubsystemApp.apiGet('/api/sub/accounting/invoices');
      const statusColor = { paid: 'green', sent: 'blue', overdue: 'red', draft: 'gray', cancelled: 'gray' };
      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">Invoice Manager</h2><p class="sub-section-sub">Track all client invoices and payments</p></div>
          <button class="sub-btn-primary" onclick="AccountingSystem.showAddInvoice()">+ Create Invoice</button>
        </div>
        <div class="sub-table-card">
          <table class="sub-table">
            <thead><tr><th>Invoice #</th><th>Client</th><th>Amount</th><th>Total</th><th>Status</th><th>Due Date</th><th>Actions</th></tr></thead>
            <tbody>
              ${d.invoices.map(inv => `
                <tr>
                  <td style="font-family:monospace;font-size:12px;color:var(--sub-accent)">${inv.invoice_number}</td>
                  <td><strong>${inv.client_name}</strong>${inv.client_email ? `<div style="font-size:11px;color:var(--text-muted)">${inv.client_email}</div>` : ''}</td>
                  <td>${SubsystemApp.formatCurrency(inv.amount)}</td>
                  <td style="font-weight:600">${SubsystemApp.formatCurrency(inv.total)}</td>
                  <td>${SubsystemApp.badge(inv.status, statusColor[inv.status] || 'gray')}</td>
                  <td style="color:${inv.status === 'overdue' ? '#f87171' : 'inherit'}">${SubsystemApp.formatDate(inv.due_date)}</td>
                  <td>
                    ${inv.status !== 'paid' ? `<button class="sub-btn-mini green" onclick="AccountingSystem.markPaid(${inv.id})">Mark Paid</button>` : '✓ Paid'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  async renderBudgets() {
    const c = document.getElementById('sub-content');
    try {
      const d = await SubsystemApp.apiGet('/api/sub/accounting/budgets');
      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">Budget Management</h2><p class="sub-section-sub">Monitor and control departmental budgets</p></div>
          <button class="sub-btn-primary" onclick="AccountingSystem.showAddBudget()">+ Add Budget</button>
        </div>
        <div class="sub-table-card">
          <table class="sub-table">
            <thead><tr><th>Period</th><th>Category</th><th>Allocated</th><th>Spent</th><th>Remaining</th><th>Utilisation</th></tr></thead>
            <tbody>
              ${d.budgets.map(b => {
                const pct = b.allocated ? Math.min((b.spent / b.allocated * 100), 100) : 0;
                const over = b.spent > b.allocated;
                return `<tr>
                  <td><span class="sub-tag">${b.period}</span></td>
                  <td>${b.category}</td>
                  <td>${SubsystemApp.formatCurrency(b.allocated)}</td>
                  <td style="color:${over ? '#f87171' : 'inherit'}">${SubsystemApp.formatCurrency(b.spent)}</td>
                  <td style="color:${over ? '#f87171' : '#34d399'}">${SubsystemApp.formatCurrency(b.allocated - b.spent)}</td>
                  <td style="min-width:140px">
                    <div style="display:flex;align-items:center;gap:8px">
                      <div style="flex:1;background:#ffffff10;border-radius:4px;height:6px">
                        <div style="width:${pct}%;background:${over ? '#f87171' : pct > 80 ? '#fbbf24' : 'var(--sub-accent)'};height:6px;border-radius:4px;transition:width .5s"></div>
                      </div>
                      <span style="font-size:12px;color:${over ? '#f87171' : 'inherit'}">${pct.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  async renderReports() {
    const c = document.getElementById('sub-content');
    try {
      const d = await SubsystemApp.apiGet('/api/sub/accounting/reports/summary');
      const inc = d.income_statement;
      const inv = d.invoice_summary;
      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">Financial Reports</h2><p class="sub-section-sub">AI-powered financial analysis and summaries</p></div>
        </div>

        <div class="sub-charts-grid">
          <div class="sub-chart-card">
            <div class="sub-chart-title">📊 Income Statement</div>
            <div style="display:flex;flex-direction:column;gap:12px;margin-top:15px">
              <div class="sub-report-row"><span>Revenue</span><span style="color:#34d399;font-weight:700">${SubsystemApp.formatCurrency(inc.revenue)}</span></div>
              <div class="sub-report-row"><span>Total Expenses</span><span style="color:#f87171;font-weight:700">-${SubsystemApp.formatCurrency(inc.expenses)}</span></div>
              <hr style="border-color:#ffffff15"/>
              <div class="sub-report-row" style="font-size:16px">
                <span style="font-weight:700">Gross Profit</span>
                <span style="font-weight:700;color:${inc.gross_profit >= 0 ? '#34d399' : '#f87171'}">${SubsystemApp.formatCurrency(inc.gross_profit)}</span>
              </div>
              <div class="sub-report-row"><span>Net Margin</span><span style="color:var(--sub-accent)">${inc.net_margin}%</span></div>
            </div>
          </div>
          <div class="sub-chart-card">
            <div class="sub-chart-title">📄 Invoice Summary</div>
            <div style="display:flex;flex-direction:column;gap:12px;margin-top:15px">
              <div class="sub-report-row"><span>Total Invoices</span><span style="font-weight:700">${inv.total_invoices}</span></div>
              <div class="sub-report-row"><span>Paid</span><span style="color:#34d399;font-weight:700">${inv.paid}</span></div>
              <div class="sub-report-row"><span>Outstanding</span><span style="color:#f87171;font-weight:700">${inv.outstanding}</span></div>
              <hr style="border-color:#ffffff15"/>
              <div class="sub-report-row"><span>Total Billed</span><span style="font-weight:700">${SubsystemApp.formatCurrency(inv.total_billed)}</span></div>
              <div class="sub-report-row"><span>Collected</span><span style="color:#34d399;font-weight:700">${SubsystemApp.formatCurrency(inv.total_collected)}</span></div>
              <div class="sub-report-row"><span>Collection Rate</span><span style="color:var(--sub-accent)">${inv.collection_rate}%</span></div>
            </div>
          </div>
        </div>
      `;
    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  showAddTransaction() {
    this._showModal('Add Transaction', `
      <div class="sub-form-group"><label>Date</label><input type="date" id="af-date" class="sub-input" value="${new Date().toISOString().split('T')[0]}"/></div>
      <div class="sub-form-group"><label>Description</label><input type="text" id="af-desc" class="sub-input" placeholder="Transaction description"/></div>
      <div class="sub-form-group"><label>Amount ($)</label><input type="number" id="af-amt" class="sub-input" placeholder="0.00"/></div>
      <div class="sub-form-group"><label>Type</label>
        <select id="af-type" class="sub-input"><option value="income">Income</option><option value="expense">Expense</option></select>
      </div>
      <div class="sub-form-group"><label>Category</label><input type="text" id="af-cat" class="sub-input" placeholder="e.g. Sales, Marketing"/></div>
    `, async () => {
      await SubsystemApp.apiPost('/api/sub/accounting/transactions', {
        date: document.getElementById('af-date').value,
        description: document.getElementById('af-desc').value,
        amount: document.getElementById('af-amt').value,
        type: document.getElementById('af-type').value,
        category: document.getElementById('af-cat').value
      });
      this._closeModal();
      SubsystemApp.showToast('Transaction added', 'success');
      this.renderTransactions();
    });
  },

  showAddInvoice() {
    this._showModal('Create Invoice', `
      <div class="sub-form-group"><label>Client Name</label><input type="text" id="ai-client" class="sub-input" placeholder="Company or individual name"/></div>
      <div class="sub-form-group"><label>Client Email</label><input type="email" id="ai-email" class="sub-input" placeholder="client@example.com"/></div>
      <div class="sub-form-group"><label>Amount ($)</label><input type="number" id="ai-amt" class="sub-input" placeholder="0.00"/></div>
      <div class="sub-form-group"><label>Tax ($)</label><input type="number" id="ai-tax" class="sub-input" placeholder="0.00" value="0"/></div>
      <div class="sub-form-group"><label>Due Date</label><input type="date" id="ai-due" class="sub-input"/></div>
    `, async () => {
      await SubsystemApp.apiPost('/api/sub/accounting/invoices', {
        client_name: document.getElementById('ai-client').value,
        client_email: document.getElementById('ai-email').value,
        amount: document.getElementById('ai-amt').value,
        tax: document.getElementById('ai-tax').value,
        due_date: document.getElementById('ai-due').value,
        status: 'sent'
      });
      this._closeModal();
      SubsystemApp.showToast('Invoice created', 'success');
      this.renderInvoices();
    });
  },

  showAddBudget() {
    this._showModal('Add Budget', `
      <div class="sub-form-group"><label>Period</label><input type="text" id="ab-period" class="sub-input" placeholder="e.g. 2026-Q2"/></div>
      <div class="sub-form-group"><label>Category</label><input type="text" id="ab-cat" class="sub-input" placeholder="e.g. Marketing, Salaries"/></div>
      <div class="sub-form-group"><label>Allocated ($)</label><input type="number" id="ab-alloc" class="sub-input" placeholder="0.00"/></div>
    `, async () => {
      await SubsystemApp.apiPost('/api/sub/accounting/budgets', {
        period: document.getElementById('ab-period').value,
        category: document.getElementById('ab-cat').value,
        allocated: document.getElementById('ab-alloc').value
      });
      this._closeModal();
      SubsystemApp.showToast('Budget created', 'success');
      this.renderBudgets();
    });
  },

  async markPaid(id) {
    if (!confirm('Mark this invoice as paid?')) return;
    await SubsystemApp.apiPost(`/api/sub/accounting/invoices/${id}/status`, { status: 'paid' });
    SubsystemApp.showToast('Invoice marked as paid', 'success');
    this.renderInvoices();
  },

  _chartOptions() {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
      scales: {
        x: { grid: { color: '#ffffff08' }, ticks: { color: '#64748b' } },
        y: { grid: { color: '#ffffff08' }, ticks: { color: '#64748b', callback: v => '$' + (v/1000).toFixed(0) + 'k' } }
      }
    };
  },

  _showModal(title, bodyHTML, onSave) {
    let m = document.getElementById('sub-form-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'sub-form-modal';
      m.className = 'sub-modal-overlay';
      document.body.appendChild(m);
    }
    m.innerHTML = `
      <div class="sub-modal-card">
        <div class="sub-modal-header">
          <h3>${title}</h3>
          <button onclick="AccountingSystem._closeModal()" style="background:none;border:none;color:white;font-size:20px;cursor:pointer">✕</button>
        </div>
        <div class="sub-modal-body">${bodyHTML}</div>
        <div class="sub-modal-footer">
          <button class="sub-btn-secondary" onclick="AccountingSystem._closeModal()">Cancel</button>
          <button class="sub-btn-primary" id="sub-modal-save">Save</button>
        </div>
      </div>`;
    m.classList.remove('hidden');
    document.getElementById('sub-modal-save').onclick = onSave;
  },

  _closeModal() {
    const m = document.getElementById('sub-form-modal');
    if (m) m.classList.add('hidden');
  }
};

window.AccountingSystem = AccountingSystem;
