/**
 * Action Aura — Inventory Management Subsystem UI
 */
const InventorySystem = {
  async render(section) {
    switch (section) {
      case 'dashboard':       return this.renderDashboard();
      case 'products':        return this.renderProducts();
      case 'movements':       return this.renderMovements();
      case 'suppliers':       return this.renderSuppliers();
      case 'purchase_orders': return this.renderPurchaseOrders();
      case 'alerts':          return this.renderAlerts();
      default:                return this.renderDashboard();
    }
  },

  async renderDashboard() {
    const c = document.getElementById('sub-content');
    try {
      const d = await SubsystemApp.apiGet('/api/sub/inventory/dashboard');
      const k = d.kpis;
      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">Inventory Dashboard</h2><p class="sub-section-sub">Real-time stock control and supply chain intelligence</p></div>
        </div>

        <div class="sub-kpi-grid">
          ${SubsystemApp.kpiCard('Total SKUs', k.total_skus, '🏷️', '#fb923c')}
          ${SubsystemApp.kpiCard('Stock Value', SubsystemApp.formatCurrency(k.total_stock_value), '💰', '#60a5fa')}
          ${SubsystemApp.kpiCard('Low Stock Alerts', k.low_stock_alerts, '⚠️', k.low_stock_alerts > 5 ? '#f87171' : '#fbbf24', 'Need reorder')}
          ${SubsystemApp.kpiCard('Out of Stock', k.out_of_stock, '🚨', k.out_of_stock > 0 ? '#f87171' : '#34d399')}
          ${SubsystemApp.kpiCard('Pending Orders', k.pending_orders, '📋', '#a78bfa')}
          ${SubsystemApp.kpiCard('Active Suppliers', k.active_suppliers, '🤝', '#34d399')}
          ${SubsystemApp.kpiCard('Inventory Turnover', k.inventory_turnover + 'x', '🔄', '#fb923c', 'Annual')}
          ${SubsystemApp.kpiCard('Avg Lead Time', k.avg_lead_time + 'd', '⏱️', '#60a5fa', 'Days to receive')}
        </div>

        <div class="sub-charts-grid">
          <div class="sub-chart-card">
            <div class="sub-chart-title">📈 Stock Movement Trend</div>
            <div class="sub-chart-wrap"><canvas id="inv-line-chart"></canvas></div>
          </div>
          <div class="sub-chart-card">
            <div class="sub-chart-title">📦 Stock by Category</div>
            <div class="sub-chart-wrap"><canvas id="inv-cat-chart"></canvas></div>
          </div>
        </div>

        ${d.low_stock_items.length > 0 ? `
        <div class="sub-chart-card" style="margin-top:20px">
          <div class="sub-chart-title">🚨 Low Stock Alerts — Immediate Attention Required</div>
          <div class="sub-alert-list" style="margin-top:12px">
            ${d.low_stock_items.map(p => `
              <div class="sub-alert-row">
                <div>
                  <span style="font-weight:600">${p.name}</span>
                  <span class="sub-tag" style="margin-left:8px">${p.sku}</span>
                </div>
                <div style="display:flex;align-items:center;gap:12px">
                  <span style="color:${p.quantity === 0 ? '#f87171' : '#fbbf24'};font-weight:700">${p.quantity} units</span>
                  <span style="font-size:11px;color:var(--text-muted)">Reorder at: ${p.reorder_level}</span>
                  ${SubsystemApp.badge(p.quantity === 0 ? 'OUT' : 'LOW', p.quantity === 0 ? 'red' : 'yellow')}
                  <button class="sub-btn-mini orange" onclick="InventorySystem.showCreatePO(${p.id}, '${p.name}')">Order Now</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>` : `
        <div class="sub-chart-card" style="margin-top:20px;text-align:center;padding:40px">
          <div style="font-size:48px;margin-bottom:12px">✅</div>
          <h3 style="color:#34d399">All Stock Levels Healthy</h3>
          <p style="color:var(--text-muted)">No low stock alerts at this time.</p>
        </div>`}

        <div class="sub-chart-card" style="margin-top:20px">
          <div class="sub-chart-title">🤝 Top Supplier Reliability Scores</div>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
            ${d.top_suppliers.map(s => `
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:140px;font-size:13px">${s.name}</div>
                <div style="flex:1;background:#ffffff10;border-radius:4px;height:8px">
                  <div style="width:${s.reliability}%;background:${s.reliability > 90 ? '#34d399' : s.reliability > 80 ? '#fbbf24' : '#f87171'};height:8px;border-radius:4px;transition:width .6s"></div>
                </div>
                <div style="width:50px;text-align:right;font-weight:600;font-size:13px">${s.reliability}%</div>
                <div style="font-size:11px;color:var(--text-muted);width:60px">${s.lead_time}d lead</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      SubsystemApp.renderChart('inv-line-chart', {
        type: 'line',
        data: {
          labels: d.movement_trend.labels,
          datasets: [
            { label: 'Stock In', data: d.movement_trend.stock_in, borderColor: '#34d399', backgroundColor: '#34d39915', tension: 0.4, fill: true, pointRadius: 4 },
            { label: 'Stock Out', data: d.movement_trend.stock_out, borderColor: '#f87171', backgroundColor: '#f8717115', tension: 0.4, fill: true, pointRadius: 4 }
          ]
        },
        options: this._chartOpts()
      });

      SubsystemApp.renderChart('inv-cat-chart', {
        type: 'bar',
        data: {
          labels: d.stock_by_category.labels,
          datasets: [{ label: 'Units in Stock', data: d.stock_by_category.values, backgroundColor: ['#fb923c66','#60a5fa66','#34d39966','#a78bfa66','#fbbf2466'], borderColor: ['#fb923c','#60a5fa','#34d399','#a78bfa','#fbbf24'], borderWidth: 1, borderRadius: 6 }]
        },
        options: this._chartOpts()
      });

    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  async renderProducts() {
    const c = document.getElementById('sub-content');
    try {
      const d = await SubsystemApp.apiGet('/api/sub/inventory/products');
      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">Product Catalog</h2><p class="sub-section-sub">${d.products.length} products tracked</p></div>
          <button class="sub-btn-primary" onclick="InventorySystem.showAddProduct()">+ Add Product</button>
        </div>
        <div class="sub-table-card">
          <table class="sub-table">
            <thead><tr><th>SKU</th><th>Product Name</th><th>Category</th><th>Unit Cost</th><th>Sell Price</th><th>Qty</th><th>Reorder</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${d.products.map(p => {
                const isLow = p.quantity <= p.reorder_level;
                const isOut = p.quantity === 0;
                return `<tr class="${isOut ? 'sub-row-danger' : isLow ? 'sub-row-warning' : ''}">
                  <td style="font-family:monospace;font-size:11px;color:var(--sub-accent)">${p.sku}</td>
                  <td><strong>${p.name}</strong><div style="font-size:11px;color:var(--text-muted)">${p.supplier_name || '—'}</div></td>
                  <td><span class="sub-tag">${p.category_name || '—'}</span></td>
                  <td>${SubsystemApp.formatCurrency(p.unit_cost)}</td>
                  <td>${SubsystemApp.formatCurrency(p.sell_price)}</td>
                  <td style="font-weight:700;color:${isOut ? '#f87171' : isLow ? '#fbbf24' : '#34d399'}">
                    ${p.quantity} ${isOut ? '🚨' : isLow ? '⚠️' : ''}
                  </td>
                  <td style="color:var(--text-muted)">${p.reorder_level}</td>
                  <td style="font-size:12px">${p.location || '—'}</td>
                  <td>${SubsystemApp.badge(p.status || 'active', 'green')}</td>
                  <td style="display:flex;gap:4px;flex-wrap:wrap">
                    <button class="sub-btn-mini" onclick="InventorySystem.adjustStock(${p.id}, '${p.name}')">Adjust</button>
                    <button class="sub-btn-mini orange" onclick="InventorySystem.showCreatePO(${p.id}, '${p.name}')">Order</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  async renderMovements() {
    const c = document.getElementById('sub-content');
    try {
      const d = await SubsystemApp.apiGet('/api/sub/inventory/movements?limit=60');
      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">Stock Movements</h2><p class="sub-section-sub">All inbound and outbound stock transactions</p></div>
          <button class="sub-btn-primary" onclick="InventorySystem.showAddMovement()">+ Log Movement</button>
        </div>
        <div class="sub-table-card">
          <table class="sub-table">
            <thead><tr><th>Date</th><th>SKU</th><th>Product</th><th>Type</th><th>Quantity</th><th>Reference</th><th>Reason</th><th>By</th></tr></thead>
            <tbody>
              ${d.movements.map(m => `
                <tr>
                  <td>${SubsystemApp.formatDate(m.date)}</td>
                  <td style="font-family:monospace;font-size:11px;color:var(--sub-accent)">${m.sku || '—'}</td>
                  <td>${m.product_name || '—'}</td>
                  <td>${SubsystemApp.badge(m.type, m.type === 'in' ? 'green' : 'red')}</td>
                  <td style="font-weight:700;color:${m.type === 'in' ? '#34d399' : '#f87171'}">${m.type === 'in' ? '+' : '-'}${m.quantity}</td>
                  <td style="font-family:monospace;font-size:11px">${m.reference || '—'}</td>
                  <td style="font-size:12px">${m.reason || '—'}</td>
                  <td style="font-size:12px;color:var(--text-muted)">${m.performed_by || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  async renderSuppliers() {
    const c = document.getElementById('sub-content');
    try {
      const d = await SubsystemApp.apiGet('/api/sub/inventory/suppliers');
      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">Supplier Directory</h2><p class="sub-section-sub">${d.suppliers.length} suppliers registered</p></div>
          <button class="sub-btn-primary" onclick="InventorySystem.showAddSupplier()">+ Add Supplier</button>
        </div>
        <div class="sub-table-card">
          <table class="sub-table">
            <thead><tr><th>Supplier</th><th>Contact</th><th>Location</th><th>Lead Time</th><th>Reliability</th><th>Status</th></tr></thead>
            <tbody>
              ${d.suppliers.map(s => {
                const rel = s.reliability_score || 0;
                return `<tr>
                  <td><strong>${s.name}</strong></td>
                  <td><div>${s.email || '—'}</div><div style="font-size:11px;color:var(--text-muted)">${s.phone || '—'}</div></td>
                  <td style="font-size:12px">${s.address || '—'}</td>
                  <td style="font-weight:600">${s.lead_time} days</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px">
                      <div style="width:70px;background:#ffffff10;border-radius:4px;height:6px">
                        <div style="width:${rel}%;background:${rel > 90 ? '#34d399' : rel > 80 ? '#fbbf24' : '#f87171'};height:6px;border-radius:4px"></div>
                      </div>
                      <span style="font-size:12px;font-weight:600;color:${rel > 90 ? '#34d399' : rel > 80 ? '#fbbf24' : '#f87171'}">${rel}%</span>
                    </div>
                  </td>
                  <td>${SubsystemApp.badge(s.status || 'active', 'green')}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  async renderPurchaseOrders() {
    const c = document.getElementById('sub-content');
    try {
      const d = await SubsystemApp.apiGet('/api/sub/inventory/purchase_orders');
      const statusColor = { pending: 'yellow', confirmed: 'blue', received: 'green', cancelled: 'red' };
      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">Purchase Orders</h2><p class="sub-section-sub">${d.purchase_orders.filter(p => p.status === 'pending').length} pending orders</p></div>
          <button class="sub-btn-primary" onclick="InventorySystem.showCreatePO()">+ Create PO</button>
        </div>
        <div class="sub-table-card">
          <table class="sub-table">
            <thead><tr><th>PO Number</th><th>Product</th><th>Supplier</th><th>Qty</th><th>Unit Cost</th><th>Total</th><th>Expected</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${d.purchase_orders.map(po => `
                <tr>
                  <td style="font-family:monospace;font-size:11px;color:var(--sub-accent)">${po.po_number}</td>
                  <td>${po.product_name || '—'}<div style="font-size:11px;color:var(--text-muted)">${po.sku || ''}</div></td>
                  <td>${po.supplier_name || '—'}</td>
                  <td style="font-weight:600">${po.quantity}</td>
                  <td>${SubsystemApp.formatCurrency(po.unit_cost)}</td>
                  <td style="font-weight:700;color:var(--sub-accent)">${SubsystemApp.formatCurrency(po.total)}</td>
                  <td>${SubsystemApp.formatDate(po.expected_date)}</td>
                  <td>${SubsystemApp.badge(po.status, statusColor[po.status] || 'gray')}</td>
                  <td>${po.status === 'pending' || po.status === 'confirmed' ? `<button class="sub-btn-mini green" onclick="InventorySystem.receivePO(${po.id})">Receive</button>` : '✓'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  async renderAlerts() {
    const c = document.getElementById('sub-content');
    try {
      const d = await SubsystemApp.apiGet('/api/sub/inventory/alerts');
      const severityColor = { critical: '#f87171', high: '#fb923c', warning: '#fbbf24' };
      c.innerHTML = `
        <div class="sub-section-header">
          <div><h2 class="sub-section-title">Stock Alerts</h2><p class="sub-section-sub">${d.total} items require attention</p></div>
        </div>
        ${d.total === 0 ? `
          <div class="sub-chart-card" style="text-align:center;padding:60px">
            <div style="font-size:60px;margin-bottom:16px">✅</div>
            <h3 style="color:#34d399;margin-bottom:8px">All Clear!</h3>
            <p style="color:var(--text-muted)">All stock levels are above reorder points. No action required.</p>
          </div>
        ` : d.alerts.map(a => `
          <div class="sub-alert-card" style="border-left-color:${severityColor[a.severity]};margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
                  ${SubsystemApp.badge(a.severity.toUpperCase(), a.severity === 'critical' ? 'red' : a.severity === 'high' ? 'orange' : 'yellow')}
                  <strong>${a.name}</strong>
                  <span class="sub-tag">${a.sku}</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted)">
                  Category: ${a.category || '—'} · Supplier: ${a.supplier_name || '—'} · Lead time: ${a.lead_time || '?'}d
                </div>
              </div>
              <div style="text-align:right">
                <div style="font-size:24px;font-weight:700;color:${severityColor[a.severity]}">${a.quantity}</div>
                <div style="font-size:11px;color:var(--text-muted)">units left</div>
                <div style="font-size:11px;color:var(--text-muted)">Reorder at ${a.reorder_level}</div>
              </div>
            </div>
            <div style="margin-top:12px;display:flex;align-items:center;gap:12px">
              <span style="font-size:12px;color:var(--text-muted)">Suggested Order: <strong style="color:var(--sub-accent)">${a.suggested_order} units</strong></span>
              <button class="sub-btn-mini orange" onclick="InventorySystem.showCreatePO(${a.id}, '${a.name}')">Create PO</button>
            </div>
          </div>
        `).join('')}
      `;
    } catch (e) { c.innerHTML = `<div class="sub-error">${e.message}</div>`; }
  },

  showAddProduct() {
    this._showModal('Add Product', `
      <div class="sub-form-group"><label>SKU</label><input id="ip-sku" class="sub-input" placeholder="e.g. SKU-X001"/></div>
      <div class="sub-form-group"><label>Product Name</label><input id="ip-name" class="sub-input" placeholder="Product name"/></div>
      <div class="sub-form-group"><label>Unit Cost ($)</label><input id="ip-cost" class="sub-input" type="number" placeholder="0.00"/></div>
      <div class="sub-form-group"><label>Sell Price ($)</label><input id="ip-price" class="sub-input" type="number" placeholder="0.00"/></div>
      <div class="sub-form-group"><label>Quantity</label><input id="ip-qty" class="sub-input" type="number" placeholder="0"/></div>
      <div class="sub-form-group"><label>Reorder Level</label><input id="ip-reorder" class="sub-input" type="number" placeholder="10"/></div>
      <div class="sub-form-group"><label>Location</label><input id="ip-loc" class="sub-input" placeholder="e.g. Warehouse A"/></div>
    `, async () => {
      await SubsystemApp.apiPost('/api/sub/inventory/products', {
        sku: document.getElementById('ip-sku').value,
        name: document.getElementById('ip-name').value,
        unit_cost: document.getElementById('ip-cost').value,
        sell_price: document.getElementById('ip-price').value,
        quantity: document.getElementById('ip-qty').value,
        reorder_level: document.getElementById('ip-reorder').value,
        location: document.getElementById('ip-loc').value
      });
      this._closeModal();
      SubsystemApp.showToast('Product added', 'success');
      this.renderProducts();
    });
  },

  adjustStock(id, name) {
    this._showModal(`Adjust Stock — ${name}`, `
      <div class="sub-form-group"><label>Movement Type</label>
        <select id="ia-type" class="sub-input"><option value="in">Stock In (+)</option><option value="out">Stock Out (-)</option></select>
      </div>
      <div class="sub-form-group"><label>Quantity</label><input id="ia-qty" class="sub-input" type="number" placeholder="0" min="1"/></div>
      <div class="sub-form-group"><label>Reason</label><input id="ia-reason" class="sub-input" placeholder="e.g. Customer Order, Restock"/></div>
    `, async () => {
      await SubsystemApp.apiPost('/api/sub/inventory/movements', {
        product_id: id, type: document.getElementById('ia-type').value,
        quantity: document.getElementById('ia-qty').value,
        reason: document.getElementById('ia-reason').value,
        date: new Date().toISOString().split('T')[0], performed_by: 'Staff'
      });
      this._closeModal();
      SubsystemApp.showToast('Stock adjusted', 'success');
      this.renderProducts();
    });
  },

  async showCreatePO(productId = null, productName = null) {
    const supData = await SubsystemApp.apiGet('/api/sub/inventory/suppliers');
    const prodData = await SubsystemApp.apiGet('/api/sub/inventory/products');
    this._showModal('Create Purchase Order', `
      <div class="sub-form-group"><label>Product</label>
        <select id="po-prod" class="sub-input">
          ${prodData.products.map(p => `<option value="${p.id}" ${p.id == productId ? 'selected' : ''}>${p.name} (${p.sku})</option>`).join('')}
        </select>
      </div>
      <div class="sub-form-group"><label>Supplier</label>
        <select id="po-sup" class="sub-input">${supData.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
      </div>
      <div class="sub-form-group"><label>Quantity</label><input id="po-qty" class="sub-input" type="number" placeholder="100"/></div>
      <div class="sub-form-group"><label>Unit Cost ($)</label><input id="po-cost" class="sub-input" type="number" placeholder="0.00"/></div>
      <div class="sub-form-group"><label>Expected Date</label><input id="po-date" class="sub-input" type="date"/></div>
    `, async () => {
      await SubsystemApp.apiPost('/api/sub/inventory/purchase_orders', {
        product_id: document.getElementById('po-prod').value,
        supplier_id: document.getElementById('po-sup').value,
        quantity: document.getElementById('po-qty').value,
        unit_cost: document.getElementById('po-cost').value,
        expected_date: document.getElementById('po-date').value
      });
      this._closeModal();
      SubsystemApp.showToast('Purchase order created', 'success');
      this.renderPurchaseOrders();
    });
  },

  async showAddSupplier() {
    this._showModal('Add Supplier', `
      <div class="sub-form-group"><label>Supplier Name</label><input id="is-name" class="sub-input" placeholder="Company name"/></div>
      <div class="sub-form-group"><label>Email</label><input id="is-email" class="sub-input" type="email" placeholder="orders@supplier.com"/></div>
      <div class="sub-form-group"><label>Phone</label><input id="is-phone" class="sub-input" placeholder="+1-555-0000"/></div>
      <div class="sub-form-group"><label>Address</label><input id="is-addr" class="sub-input" placeholder="City, Country"/></div>
      <div class="sub-form-group"><label>Lead Time (Days)</label><input id="is-lead" class="sub-input" type="number" placeholder="7"/></div>
    `, async () => {
      await SubsystemApp.apiPost('/api/sub/inventory/suppliers', {
        name: document.getElementById('is-name').value,
        email: document.getElementById('is-email').value,
        phone: document.getElementById('is-phone').value,
        address: document.getElementById('is-addr').value,
        lead_time: document.getElementById('is-lead').value
      });
      this._closeModal(); SubsystemApp.showToast('Supplier added', 'success'); this.renderSuppliers();
    });
  },

  async showAddMovement() {
    const prodData = await SubsystemApp.apiGet('/api/sub/inventory/products');
    this._showModal('Log Stock Movement', `
      <div class="sub-form-group"><label>Product</label>
        <select id="im-prod" class="sub-input">${prodData.products.map(p => `<option value="${p.id}">${p.name} (${p.sku})</option>`).join('')}</select>
      </div>
      <div class="sub-form-group"><label>Type</label>
        <select id="im-type" class="sub-input"><option value="in">Stock In</option><option value="out">Stock Out</option></select>
      </div>
      <div class="sub-form-group"><label>Quantity</label><input id="im-qty" class="sub-input" type="number" placeholder="0"/></div>
      <div class="sub-form-group"><label>Reason</label><input id="im-reason" class="sub-input" placeholder="e.g. Restock, Sold, Damaged"/></div>
    `, async () => {
      await SubsystemApp.apiPost('/api/sub/inventory/movements', {
        product_id: document.getElementById('im-prod').value,
        type: document.getElementById('im-type').value,
        quantity: document.getElementById('im-qty').value,
        reason: document.getElementById('im-reason').value,
        date: new Date().toISOString().split('T')[0], performed_by: 'Staff'
      });
      this._closeModal(); SubsystemApp.showToast('Movement logged', 'success'); this.renderMovements();
    });
  },

  async receivePO(id) {
    if (!confirm('Mark this purchase order as received? Stock will be updated.')) return;
    await SubsystemApp.apiPost(`/api/sub/inventory/purchase_orders/${id}/receive`, {});
    SubsystemApp.showToast('PO received — stock updated', 'success');
    this.renderPurchaseOrders();
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
      <div class="sub-modal-header"><h3>${title}</h3><button onclick="InventorySystem._closeModal()" style="background:none;border:none;color:white;font-size:20px;cursor:pointer">✕</button></div>
      <div class="sub-modal-body">${bodyHTML}</div>
      <div class="sub-modal-footer"><button class="sub-btn-secondary" onclick="InventorySystem._closeModal()">Cancel</button><button class="sub-btn-primary" id="sub-modal-save">Save</button></div>
    </div>`;
    m.classList.remove('hidden');
    document.getElementById('sub-modal-save').onclick = onSave;
  },
  _closeModal() { const m = document.getElementById('sub-form-modal'); if (m) m.classList.add('hidden'); }
};

window.InventorySystem = InventorySystem;
