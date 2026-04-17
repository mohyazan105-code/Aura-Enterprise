/* ══════════════════════════════════════════════════════════════
   customer.js  –  Customer Portal  (Multi-Domain)
   Full Banking UI: Accounts · Cards · Loans · Transactions
   ══════════════════════════════════════════════════════════════ */

window.CustomerApp = {
    currentDomain: null,
    customerData:  null,
    _campaignPid:  null,
    _modalsReady:  false,
    _bankTab:      'overview',

    // ─── Modal Bootstrap ──────────────────────────────────────────────────────
    _initModals() {
        if (this._modalsReady) return;
        this._modalsReady = true;
        const root = document.createElement('div');
        root.id = 'cust-modals-root';
        root.innerHTML = `
        <style>
          .cust-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(6px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;animation:cmFade .2s ease}
          @keyframes cmFade{from{opacity:0}to{opacity:1}}
          .cust-modal-box{background:var(--bg-card);border:1px solid var(--glass-border);border-radius:18px;width:100%;max-width:520px;overflow:hidden;animation:cmSlide .25s cubic-bezier(.16,1,.3,1)}
          @keyframes cmSlide{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
          .cm-hdr{padding:20px 24px 14px;border-bottom:1px solid var(--glass-border);display:flex;justify-content:space-between;align-items:flex-start}
          .cm-hdr h3{margin:0;font-size:18px} .cm-hdr .ey{font-size:11px;color:var(--domain-color);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px}
          .cm-body{padding:22px 24px} .cm-ftr{padding:14px 24px 20px;border-top:1px solid var(--glass-border);display:flex;gap:10px;justify-content:flex-end}
          .cust-field{background:rgba(255,255,255,.05);border:1px solid var(--glass-border);border-radius:10px;padding:10px 14px;color:var(--text-color);font-size:14px;width:100%;box-sizing:border-box;transition:border-color .2s}
          .cust-field:focus{outline:none;border-color:var(--domain-color)}
          .cust-field-label{font-size:12px;color:var(--text-muted);margin-bottom:6px;font-weight:500}
          .cm-form-row{display:flex;gap:12px;margin-bottom:14px} .cm-form-row .form-group{flex:1;margin:0}
          .amt-display{font-size:38px;font-weight:800;color:var(--domain-color);text-align:center;margin:14px 0 8px;letter-spacing:1px}
          .cm-slider{-webkit-appearance:none;width:100%;height:5px;border-radius:5px;background:rgba(255,255,255,.1);outline:none;accent-color:var(--domain-color)}
          .cm-step-bar{display:flex;gap:4px;margin-bottom:18px}
          .cm-step{flex:1;height:3px;background:rgba(255,255,255,.1);border-radius:3px;transition:background .4s}
          .cm-step.done{background:var(--domain-color)}
          /* banking tabs */
          .bk-tab-bar{display:flex;gap:8px;margin-bottom:22px;border-bottom:1px solid var(--glass-border);padding-bottom:0;flex-wrap:wrap}
          .bk-tab{background:none;border:none;border-bottom:2px solid transparent;color:var(--text-muted);padding:10px 16px;cursor:pointer;font-size:13px;font-weight:500;transition:all .2s;margin-bottom:-1px}
          .bk-tab:hover{color:var(--text-color)}
          .bk-tab.active{color:var(--domain-color);border-bottom-color:var(--domain-color);font-weight:700}
          /* cards UI */
          .bank-card-visual{width:100%;max-width:360px;border-radius:16px;padding:22px 24px;position:relative;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)}
          .bank-card-visual::before{content:'';position:absolute;top:-30px;right:-30px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,.08)}
          .bank-card-visual::after{content:'';position:absolute;bottom:-40px;left:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.05)}
          .card-chip{width:36px;height:28px;background:linear-gradient(135deg,#d4af37,#f5d060);border-radius:5px;margin-bottom:20px}
          .card-number{font-size:16px;letter-spacing:4px;font-family:var(--font-mono);color:rgba(255,255,255,.9);margin-bottom:18px}
          .card-meta{display:flex;justify-content:space-between;align-items:flex-end}
          .card-holder-label{font-size:9px;text-transform:uppercase;letter-spacing:1px;opacity:.6}
          .card-holder-name{font-size:14px;font-weight:600;text-transform:uppercase}
          /* account card */
          .acct-card{background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:18px 20px;transition:all .2s;cursor:default}
          .acct-card:hover{border-color:var(--domain-color);transform:translateY(-2px)}
          /* loan progress */
          .loan-progress-bar{height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;margin-top:10px}
          .loan-progress-fill{height:100%;border-radius:3px;transition:width .6s ease}
          /* tx row */
          .tx-row{display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.05)}
          .tx-row:last-child{border-bottom:none}
          .tx-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
          .tx-info{flex:1;min-width:0}
          .tx-desc{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .tx-date{font-size:11px;color:var(--text-muted);margin-top:2px}
          .tx-amount{font-size:14px;font-weight:700;text-align:right;flex-shrink:0}
          /* campaign gold banner */
          .camp-banner{position:relative;overflow:hidden;border-radius:14px;padding:18px 20px;background:linear-gradient(135deg,rgba(212,175,55,.12),rgba(255,215,0,.06));border:1px solid rgba(212,175,55,.3);margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;gap:14px}
          .camp-banner-pulse{position:absolute;top:14px;right:14px;width:8px;height:8px;border-radius:50%;background:#ffd700;animation:gPulse 2s infinite}
          @keyframes gPulse{0%{box-shadow:0 0 0 0 rgba(255,215,0,.5)}70%{box-shadow:0 0 0 10px rgba(255,215,0,0)}100%{box-shadow:0 0 0 0 rgba(255,215,0,0)}}
          .camp-claim-btn{background:linear-gradient(135deg,#d4af37,#ffd700);color:#000;border:none;padding:10px 18px;border-radius:10px;cursor:pointer;font-weight:700;font-size:13px;white-space:nowrap;flex-shrink:0;transition:opacity .2s}
          .camp-claim-btn:hover{opacity:.85}
          /* bill item */
          .bill-item{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.06)}
          .bill-item:last-child{border-bottom:none}
          /* action grid */
          .cust-action-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px}
          @media(max-width:700px){.cust-action-grid{grid-template-columns:repeat(2,1fr)}}
          .cust-action-btn{background:rgba(255,255,255,.04);border:1px solid var(--glass-border);border-radius:14px;padding:16px 12px;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--text-color)}
          .cust-action-btn:hover{border-color:var(--domain-color);background:rgba(var(--domain-color-rgb),.08);transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.25)}
          .cust-action-btn .btn-icon{font-size:24px;width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center}
          .cust-action-btn .btn-label{font-size:12px;font-weight:600;text-align:center}
          .cust-action-btn .btn-sub{font-size:10px;color:var(--text-muted);text-align:center}
          /* summary row */
          .summary-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
          @media(max-width:600px){.summary-row{grid-template-columns:repeat(2,1fr)}}
          .sum-card{background:var(--bg-card);border:1px solid var(--glass-border);border-radius:12px;padding:16px 18px}
          .sum-label{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}
          .sum-val{font-size:22px;font-weight:800;line-height:1}
          .sum-sub{font-size:11px;color:var(--text-muted);margin-top:4px}
          .tier-badge{display:inline-block;padding:2px 9px;border-radius:10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
          .tier-standard{background:rgba(255,255,255,.08);color:#aaa}
          .tier-silver{background:rgba(192,192,192,.15);color:#c0c0c0}
          .tier-gold{background:rgba(212,175,55,.15);color:#d4af37}
          .tier-platinum{background:rgba(167,139,250,.15);color:#a78bfa}
          .status-active{background:rgba(0,230,118,.12);color:#00e676}
          .status-dormant{background:rgba(255,193,7,.1);color:#ffc107}
          .status-suspended{background:rgba(255,68,68,.1);color:#ff4444}
          .cust-section-title{font-size:16px;font-weight:700;margin:0 0 14px;display:flex;align-items:center;gap:8px}
        </style>

        <!-- Transfer Modal -->
        <div id="cust-transfer-modal" class="cust-modal-overlay" style="display:none;">
          <div class="cust-modal-box">
            <div class="cm-hdr"><div><div class="ey">Banking Services</div><h3>💸 Transfer Funds</h3></div>
              <button onclick="CustomerApp.closeModal('cust-transfer-modal')" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer;">✕</button>
            </div>
            <div class="cm-body">
              <div class="cm-step-bar"><div class="cm-step done" id="ts-1"></div><div class="cm-step" id="ts-2"></div><div class="cm-step" id="ts-3"></div></div>
              <div class="amt-display" id="transfer-display">$100.00</div>
              <input type="range" class="cm-slider" id="transfer-slider" min="10" max="10000" step="10" value="100" oninput="CustomerApp._updateSlider(this.value,'transfer-display')" style="margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:16px;"><span>$10</span><span>$10,000</span></div>
              <div class="cm-form-row"><div class="form-group">
                <div class="cust-field-label">Recipient Account Number</div>
                <input type="text" class="cust-field" id="transfer-to" placeholder="e.g. AURA-JD-001">
              </div></div>
              <div class="cm-form-row"><div class="form-group">
                <div class="cust-field-label">Note / Description</div>
                <input type="text" class="cust-field" id="transfer-desc" placeholder="e.g. Rent, Invoice #123">
              </div></div>
              <div id="transfer-error" style="color:var(--accent-danger);font-size:13px;margin-top:6px;display:none;"></div>
            </div>
            <div class="cm-ftr">
              <button class="btn-secondary" onclick="CustomerApp.closeModal('cust-transfer-modal')">Cancel</button>
              <button class="btn-primary" id="transfer-submit" onclick="CustomerApp.submitTransfer()">Send Transfer →</button>
            </div>
          </div>
        </div>

        <!-- Pay Bills Modal -->
        <div id="cust-bills-modal" class="cust-modal-overlay" style="display:none;">
          <div class="cust-modal-box">
            <div class="cm-hdr"><div><div class="ey">Banking Services</div><h3>🧾 Pay Bills</h3></div>
              <button onclick="CustomerApp.closeModal('cust-bills-modal')" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer;">✕</button>
            </div>
            <div class="cm-body">
              <div id="bills-list"></div>
            </div>
            <div class="cm-ftr">
              <button class="btn-secondary" onclick="CustomerApp.closeModal('cust-bills-modal')">Close</button>
              <button class="btn-primary" onclick="CustomerApp.payAllBills()">Pay All Outstanding</button>
            </div>
          </div>
        </div>

        <!-- Campaign Verification Modal -->
        <div id="cust-campaign-modal" class="cust-modal-overlay" style="display:none;">
          <div class="cust-modal-box">
            <div class="cm-hdr"><div><div class="ey" style="color:#ffd700;">🎉 Congratulations!</div><h3 id="camp-modal-title">Claim Your Reward</h3></div>
              <button onclick="CustomerApp.closeModal('cust-campaign-modal')" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer;">✕</button>
            </div>
            <div class="cm-body">
              <div style="background:linear-gradient(135deg,rgba(212,175,55,.1),rgba(255,215,0,.05));border:1px solid rgba(212,175,55,.2);border-radius:12px;padding:14px;text-align:center;margin-bottom:16px">
                <div style="font-size:36px;margin-bottom:6px;">🏆</div>
                <p id="camp-modal-desc" style="margin:0;font-size:13px;color:var(--text-muted);"></p>
              </div>
              <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px;">Confirm your identity to receive your reward instantly.</p>
              <div class="cm-form-row"><div class="form-group">
                <div class="cust-field-label">Full Legal Name</div>
                <input type="text" class="cust-field" id="camp-v-name" placeholder="As on your account">
              </div></div>
              <div class="cm-form-row"><div class="form-group">
                <div class="cust-field-label">Bank Account Number</div>
                <input type="text" class="cust-field" id="camp-v-acc" placeholder="e.g. AURA-SC-001">
              </div></div>
              <div id="camp-v-error" style="color:var(--accent-danger);font-size:13px;margin-top:6px;display:none;"></div>
            </div>
            <div class="cm-ftr">
              <button class="btn-secondary" onclick="CustomerApp.closeModal('cust-campaign-modal')">Cancel</button>
              <button class="btn-primary" id="camp-v-btn" onclick="CustomerApp.submitCampaign()" style="background:linear-gradient(135deg,#d4af37,#ffd700);color:#000;">Claim Reward 🎁</button>
            </div>
          </div>
        </div>

        <!-- Generic Service Modal -->
        <div id="cust-generic-modal" class="cust-modal-overlay" style="display:none;">
          <div class="cust-modal-box">
            <div class="cm-hdr"><div><div class="ey" id="gen-ey">Service</div><h3 id="gen-title">Action</h3></div>
              <button onclick="CustomerApp.closeModal('cust-generic-modal')" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer;">✕</button>
            </div>
            <div class="cm-body" id="gen-body"></div>
            <div class="cm-ftr">
              <button class="btn-secondary" onclick="CustomerApp.closeModal('cust-generic-modal')">Cancel</button>
              <button class="btn-primary" id="gen-submit" onclick="CustomerApp.submitGeneric()">Submit →</button>
            </div>
          </div>
        </div>`;
        document.body.appendChild(root);
    },

    openModal(id)  { const el=document.getElementById(id); if(el) el.style.display='flex'; },
    closeModal(id) { const el=document.getElementById(id); if(el) el.style.display='none'; },
    _updateSlider(val, displayId) {
        const v = parseFloat(val);
        document.getElementById(displayId).innerText = '$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    },

    // ─── Domain / Login ───────────────────────────────────────────────────────
    showCustomerDomainSelect: async () => {
        location.hash = 'customer-domain';
        document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
        document.getElementById('page-customer-domain').classList.add('active');
        const data = await API.get('/domains');
        document.getElementById('customer-domain-grid').innerHTML = data.domains.map(d=>`
          <div class="domain-card" onclick="CustomerApp.showCustomerLogin('${d.id}')">
            <span class="domain-card-icon" style="color:${d.color}">${d.icon}</span>
            <h3>${d.name}</h3><p>Customer Portal</p>
          </div>`).join('');
    },

    showCustomerLogin: async (domainId) => {
        CustomerApp.currentDomain = domainId;
        sessionStorage.setItem('customer_aura_domain', domainId);
        const data = await API.get('/domains');
        const d = data.domains.find(x=>x.id===domainId);
        document.getElementById('customer-login-domain-name').innerText = d.name;
        document.getElementById('customer-login-domain-icon').innerText = d.icon;
        document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
        document.getElementById('page-customer-login').classList.add('active');
        document.getElementById('inp-customer-email').value = '';
        document.getElementById('inp-customer-password').value = '';
        document.getElementById('customer-login-error').classList.add('hidden');
        location.hash = 'customer-login';
    },

    togglePass: () => { const i=document.getElementById('inp-customer-password'); i.type=i.type==='password'?'text':'password'; },

    login: async () => {
        const email=document.getElementById('inp-customer-email').value;
        const password=document.getElementById('inp-customer-password').value;
        const domain=CustomerApp.currentDomain;
        try {
            const data = await API.post('/auth/customer-login', {email, password, domain});
            CustomerApp.customerData = data.customer;
            CustomerApp.launchApp(data.domain);
        } catch(e) {
            const err=document.getElementById('customer-login-error');
            err.innerText=e.message||'Login failed'; err.classList.remove('hidden');
        }
    },

    logout: async () => {
        await API.post('/auth/logout');
        CustomerApp.customerData=null;
        sessionStorage.removeItem('customerData'); sessionStorage.removeItem('customerDomain');
        location.hash='landing';
    },

    restoreSession: () => {
        const data=sessionStorage.getItem('customerData'), dom=sessionStorage.getItem('customerDomain');
        if(data&&dom){ CustomerApp.customerData=JSON.parse(data); CustomerApp.launchApp(JSON.parse(dom)); return true; }
        return false;
    },

    launchApp: (domainObj) => {
        CustomerApp._initModals();
        CustomerApp._bankTab = 'overview';
        location.hash='customer-app';
        sessionStorage.setItem('customerData', JSON.stringify(CustomerApp.customerData));
        sessionStorage.setItem('customerDomain', JSON.stringify(domainObj));
        document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
        document.getElementById('page-customer-app').classList.add('active');

        const hexToRgb=hex=>`${parseInt(hex.slice(1,3),16)}, ${parseInt(hex.slice(3,5),16)}, ${parseInt(hex.slice(5,7),16)}`;
        document.documentElement.style.setProperty('--bg-dark',`radial-gradient(circle at 10% 10%, rgba(${hexToRgb(domainObj.accent||'#0d47a1')}, 0.15) 0%, #0f111a 60%)`);

        document.getElementById('cust-header-name').innerText    = CustomerApp.customerData.name;
        document.getElementById('cust-header-company').innerText = CustomerApp.customerData.company||'Customer';
        document.getElementById('cust-header-avatar').innerText  = CustomerApp.customerData.name.charAt(0);
        document.getElementById('cust-header-avatar').style.background = domainObj.gradient;
        document.getElementById('cust-app-domain-name').innerText = domainObj.name;
        document.getElementById('cust-app-domain-icon').innerText = domainObj.icon;

        CustomerApp.renderServices(domainObj.id);
    },

    // ─── Render Services ──────────────────────────────────────────────────────
    renderServices: async (domainId) => {
        const area = document.getElementById('customer-content-area');
        area.innerHTML = `<div style="padding:30px"><div class="shimmer-card" style="height:80px;border-radius:12px;margin-bottom:14px"></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px">${[1,2,3].map(()=>'<div class="shimmer-card" style="height:90px;border-radius:12px"></div>').join('')}</div><div class="shimmer-card" style="height:300px;border-radius:12px"></div></div>`;

        if (domainId === 'banking') {
            await CustomerApp._renderBankingPortal(area);
        } else {
            await CustomerApp._renderGenericPortal(area, domainId);
        }
    },

    // ─── FULL BANKING PORTAL ──────────────────────────────────────────────────
    _renderBankingPortal: async (area) => {
        try {
            const res = await API.get('/customer/banking/profile');
            if (!res.success) throw new Error(res.error||'Failed to load profile');

            const {summary, accounts, cards, loans, transactions} = res;
            CustomerApp._bankData = res;

            // Campaign banner
            let campBanner = '';
            try {
                const cr = await API.get('/campaigns/portal/status');
                if (cr.qualified && cr.status==='qualified') {
                    campBanner = `<div class="camp-banner">
                      <div class="camp-banner-pulse"></div>
                      <div style="font-size:32px">💰</div>
                      <div style="flex:1">
                        <div style="font-size:10px;color:#ffd700;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:3px">Reward Available</div>
                        <h3 style="margin:0 0 3px;font-size:16px">You qualify for $${cr.reward}!</h3>
                        <p style="margin:0;font-size:12px;color:var(--text-muted)">${cr.campaign_name}</p>
                      </div>
                      <button class="camp-claim-btn" onclick="CustomerApp.openCampaignModal(${cr.participant_id},'${cr.campaign_name}',${cr.reward})">Claim →</button>
                    </div>`;
                } else if (cr.qualified && cr.status==='pending_verification') {
                    campBanner = `<div style="background:rgba(255,193,7,.08);border:1px solid rgba(255,193,7,.25);border-radius:12px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px"><div style="font-size:24px">⏳</div><div><div style="font-size:11px;color:#ffc107;font-weight:700;text-transform:uppercase;margin-bottom:2px">Pending Review</div><p style="margin:0;font-size:13px;color:var(--text-muted)">Your reward for <b>${cr.campaign_name}</b> is under review.</p></div></div>`;
                }
            } catch(e){}

            const tabs = [
                {id:'overview',     label:'📊 Overview'},
                {id:'accounts',     label:'🏦 Accounts'},
                {id:'cards',        label:'💳 Cards'},
                {id:'loans',        label:'📋 Loans'},
                {id:'transactions', label:'📜 Transactions'},
            ];

            area.innerHTML = `
              <div class="customer-dashboard-layout fade-in" style="padding: 24px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;flex-wrap:wrap;gap:12px">
                  <div>
                    <h2 style="margin:0 0 4px;font-size:22px">Welcome back, <span style="color:var(--domain-color)">${CustomerApp.customerData?.name?.split(' ')[0]}</span></h2>
                    <p style="margin:0;font-size:13px;color:var(--text-muted)">${CustomerApp.customerData?.company||'Personal Account'} — Banking Portal</p>
                  </div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="cust-action-btn" style="flex-direction:row;padding:8px 14px;gap:8px;border-radius:10px;" onclick="CustomerApp.openTransferModal()">
                      <span>💸</span> <span class="btn-label">Transfer</span>
                    </button>
                    <button class="cust-action-btn" style="flex-direction:row;padding:8px 14px;gap:8px;border-radius:10px;" onclick="CustomerApp.openBillsModal()">
                      <span>🧾</span> <span class="btn-label">Pay Bills</span>
                    </button>
                    <button class="cust-action-btn" style="flex-direction:row;padding:8px 14px;gap:8px;border-radius:10px;" onclick="CustomerApp.openLoanModal()">
                      <span>📋</span> <span class="btn-label">Loan</span>
                    </button>
                    <button class="cust-action-btn" style="flex-direction:row;padding:8px 14px;gap:8px;border-radius:10px;" onclick="CustomerApp.downloadStatement()">
                      <span>📄</span> <span class="btn-label">Statement</span>
                    </button>
                  </div>
                </div>

                ${campBanner}

                <!-- Tab Nav -->
                <div class="bk-tab-bar">
                  ${tabs.map(t=>`<button class="bk-tab ${CustomerApp._bankTab===t.id?'active':''}" onclick="CustomerApp.switchBankTab('${t.id}')">${t.label}</button>`).join('')}
                </div>
                <div id="bank-tab-content"></div>
              </div>`;

            CustomerApp._renderBankTab(CustomerApp._bankTab);

        } catch(e) {
            area.innerHTML = `<div style="padding:30px"><div class="b2c-widget"><h2 style="color:var(--accent-danger)">Error</h2><p>${e.message}</p></div></div>`;
        }
    },

    switchBankTab(tab) {
        CustomerApp._bankTab = tab;
        document.querySelectorAll('.bk-tab').forEach(b=>{
            b.classList.toggle('active', b.textContent.toLowerCase().includes(tab.toLowerCase().replace('_',' ')) || b.onclick?.toString().includes(tab));
        });
        // easier — just re-read from attribute
        document.querySelectorAll('.bk-tab').forEach(b=>{
            const t = b.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
            b.classList.toggle('active', t===tab);
        });
        CustomerApp._renderBankTab(tab);
    },

    _renderBankTab(tab) {
        const area = document.getElementById('bank-tab-content');
        if (!area) return;
        const {summary, accounts, cards, loans, transactions} = CustomerApp._bankData||{summary:{},accounts:[],cards:[],loans:[],transactions:[]};

        const cs = summary.credit_score||720;
        const csColor = cs>=750?'#00e676':cs>=680?'#ffc107':'#ff4444';

        if (tab === 'overview') {
            area.innerHTML = `
              <div class="summary-row">
                <div class="sum-card" style="border-left:3px solid var(--domain-color)">
                  <div class="sum-label">Total Balance</div>
                  <div class="sum-val" style="color:var(--domain-color)">$${(summary.total_balance||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                  <div class="sum-sub">${summary.num_accounts||0} accounts</div>
                </div>
                <div class="sum-card" style="border-left:3px solid #ff4444">
                  <div class="sum-label">Total Debt</div>
                  <div class="sum-val" style="color:#ff6666">$${(summary.total_debt||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                  <div class="sum-sub">${summary.active_loans||0} active loans</div>
                </div>
                <div class="sum-card" style="border-left:3px solid ${cs>=750?'#00e676':cs>=680?'#ffc107':'#ff4444'}">
                  <div class="sum-label">Credit Score</div>
                  <div class="sum-val" style="color:${csColor}">${cs}</div>
                  <div class="sum-sub">${cs>=750?'Excellent':cs>=700?'Good':cs>=650?'Fair':'Poor'}</div>
                </div>
              </div>

              <!-- Recent Transactions preview -->
              <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:18px 20px;margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
                  <h3 class="cust-section-title" style="margin:0">📜 Recent Activity</h3>
                  <button class="btn-secondary" style="font-size:12px;padding:4px 12px" onclick="CustomerApp.switchBankTab('transactions')">See All →</button>
                </div>
                ${CustomerApp._txListHtml(transactions.slice(0,6))}
              </div>
              <!-- Accounts preview -->
              <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:18px 20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
                  <h3 class="cust-section-title" style="margin:0">🏦 Your Accounts</h3>
                  <button class="btn-secondary" style="font-size:12px;padding:4px 12px" onclick="CustomerApp.switchBankTab('accounts')">Manage →</button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
                  ${accounts.slice(0,4).map(a=>CustomerApp._accountCardHtml(a)).join('')}
                </div>
              </div>`;

        } else if (tab === 'accounts') {
            area.innerHTML = `
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
                ${accounts.map(a=>CustomerApp._accountCardHtml(a, true)).join('')}
              </div>
              <div style="margin-top:18px;background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:18px 20px">
                <h3 class="cust-section-title">💳 Linked Cards</h3>
                <div style="display:flex;gap:16px;flex-wrap:wrap">
                  ${cards.length ? cards.map(c=>CustomerApp._miniCardHtml(c)).join('') : '<p style="color:var(--text-muted)">No linked cards.</p>'}
                </div>
              </div>`;

        } else if (tab === 'cards') {
            const name = CustomerApp.customerData?.name?.toUpperCase()||'CARDHOLDER';
            area.innerHTML = `
              <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start">
                ${cards.map((c,i)=>{
                    const gradients = [
                        'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',
                        'linear-gradient(135deg,#2d1b69,#11998e,#38ef7d)',
                        'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',
                        'linear-gradient(135deg,#373b44,#4286f4)',
                        'linear-gradient(135deg,#c94b4b,#4b134f)',
                    ];
                    const grad = gradients[i % gradients.length];
                    const pct = c.current_outstanding_balance/c.credit_limit_assigned*100;
                    return `
                    <div style="flex:0 0 auto">
                      <div class="bank-card-visual" style="background:${grad}">
                        <div class="card-chip"></div>
                        <div class="card-number">${c.card_number_masked}</div>
                        <div class="card-meta">
                          <div><div class="card-holder-label">Card Holder</div><div class="card-holder-name">${name.substring(0,20)}</div></div>
                          <div style="text-align:right"><div class="card-holder-label">Expires</div><div style="font-size:13px;font-weight:600">${c.expiry_date||'12/28'}</div></div>
                          <div style="font-size:18px;font-weight:800;opacity:.8">${c.card_brand?.split(' ')[0]||'VISA'}</div>
                        </div>
                      </div>
                      <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:0 0 12px 12px;padding:14px 16px;margin-top:-4px">
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
                          <span style="color:var(--text-muted)">Balance</span>
                          <span style="font-weight:700;color:#ff6666">$${c.current_outstanding_balance.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
                          <span style="color:var(--text-muted)">Credit Limit</span>
                          <span style="font-weight:700">$${c.credit_limit_assigned.toLocaleString()}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:13px">
                          <span style="color:var(--text-muted)">Points</span>
                          <span style="font-weight:700;color:#ffd700">✦ ${(c.reward_points_balance||0).toLocaleString()}</span>
                        </div>
                        <div style="height:5px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden">
                          <div style="height:100%;width:${Math.min(pct,100).toFixed(0)}%;background:${pct>80?'#ff4444':pct>50?'#ffc107':'var(--domain-color)'};border-radius:3px"></div>
                        </div>
                        <div style="font-size:10px;color:var(--text-muted);margin-top:4px;text-align:right">${pct.toFixed(0)}% utilization</div>
                        <div style="display:flex;gap:8px;margin-top:12px">
                          <button class="btn-secondary" style="flex:1;font-size:11px;padding:5px" onclick="UI.showToast('Card frozen successfully.','info')">🔒 Freeze</button>
                          <button class="btn-secondary" style="flex:1;font-size:11px;padding:5px" onclick="UI.showToast('Card replaced — arrives in 3-5 days.','success')">🔄 Replace</button>
                          <button class="btn-secondary" style="flex:1;font-size:11px;padding:5px" onclick="UI.showToast('Limit increase request submitted.','success')">📈 Limit</button>
                        </div>
                      </div>
                    </div>`; }).join('')}
                ${cards.length===0?'<p style="color:var(--text-muted)">No credit cards found.</p>':''}
              </div>`;

        } else if (tab === 'loans') {
            area.innerHTML = `
              <div style="display:flex;flex-direction:column;gap:14px">
                ${loans.length===0?'<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:12px">📋</div><p>No loans found.</p><button class="btn-primary" onclick="CustomerApp.openLoanModal()">Apply for a Loan</button></div>':
                  loans.map(l=>{
                    const paid = l.total_paid_to_date||0;
                    const total = l.principal_amount||1;
                    const pct = Math.min((paid/total)*100,100);
                    const statusColors = {approved:'#00e676',disbursed:'#00e676',pending:'#ffc107',under_review:'#ffc107',closed:'#888',rejected:'#ff4444'};
                    const sc = statusColors[l.loan_status]||'#888';
                    return `
                    <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:18px 20px">
                      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:10px">
                        <div>
                          <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">${l.loan_product_type} Loan</div>
                          <div style="font-size:22px;font-weight:800">$${l.principal_amount.toLocaleString()}</div>
                        </div>
                        <div style="text-align:right">
                          <span style="background:${sc}22;color:${sc};padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase">${l.loan_status.replace('_',' ')}</span>
                        </div>
                      </div>
                      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px;font-size:12px">
                        <div><div style="color:var(--text-muted);margin-bottom:3px">Remaining</div><b style="color:#ff6666">$${(l.remaining_balance||0).toLocaleString()}</b></div>
                        <div><div style="color:var(--text-muted);margin-bottom:3px">Rate</div><b>${l.interest_rate_fixed_variable||'—'}%</b></div>
                        <div><div style="color:var(--text-muted);margin-bottom:3px">Next Payment</div><b>${l.next_payment_date||'—'}</b></div>
                      </div>
                      <div class="loan-progress-bar">
                        <div class="loan-progress-fill" style="width:${pct.toFixed(0)}%;background:${pct>70?'#00e676':pct>40?'#ffc107':'var(--domain-color)'}"></div>
                      </div>
                      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:6px">
                        <span>Paid: $${paid.toLocaleString()}</span>
                        <span>${pct.toFixed(0)}% complete</span>
                      </div>
                      ${l.loan_status==='approved'||l.loan_status==='disbursed'?`
                      <div style="display:flex;gap:8px;margin-top:14px">
                        <button class="btn-secondary" style="font-size:12px;padding:5px 14px" onclick="UI.showToast('Payment of $${(l.remaining_balance/l.amortization_period_months).toFixed(2)} scheduled.','success')">💳 Make Payment</button>
                        <button class="btn-secondary" style="font-size:12px;padding:5px 14px" onclick="UI.showToast('Full settlement quote sent to your email.','info')">📧 Settle</button>
                      </div>`:''}
                    </div>`; }).join('')}
              </div>`;

        } else if (tab === 'transactions') {
            const cats = {credit:'💰',debit:'🛒',transfer:'➡️',loan_payment:'🏦',interest:'📈',fee:'💼',reversal:'↩️'};
            const creditCats = ['credit','interest','loan_disbursement','dividend'];
            area.innerHTML = `
              <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:18px 20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
                  <h3 class="cust-section-title" style="margin:0">📜 Transaction History</h3>
                  <button class="btn-secondary" style="font-size:12px;padding:5px 14px" onclick="CustomerApp.downloadStatement()">⬇ Download PDF</button>
                </div>
                ${CustomerApp._txListHtml(transactions)}
              </div>`;
        }
    },

    _txListHtml(txs) {
        if (!txs||!txs.length) return '<p style="color:var(--text-muted);text-align:center;padding:20px">No transactions yet.</p>';
        const icons = {credit:'💰',debit:'🛒',transfer:'➡️',loan_payment:'🏦',interest:'📈',fee:'💼',reversal:'↩️',default:'💠'};
        const bgMap  = {credit:'rgba(0,230,118,.12)',debit:'rgba(255,68,68,.1)',transfer:'rgba(26,115,232,.12)',default:'rgba(255,255,255,.06)'};
        return txs.map(t=>{
            const isCredit = t.type==='Credit';
            const icon = icons[t.category?.toLowerCase()]||icons.default;
            const bg   = bgMap[t.category?.toLowerCase()]||bgMap.default;
            const date = t.date ? t.date.split('T')[0] : '—';
            return `
            <div class="tx-row">
              <div class="tx-icon" style="background:${bg}">${icon}</div>
              <div class="tx-info">
                <div class="tx-desc">${t.desc||'Transaction'}</div>
                <div class="tx-date">${date} • <span style="text-transform:capitalize;opacity:.7">${t.category||'transfer'}</span></div>
              </div>
              <div class="tx-amount" style="color:${isCredit?'#00e676':'var(--text-color)'}">
                ${isCredit?'+':'-'}$${(t.amount||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
              </div>
            </div>`; }).join('');
    },

    _accountCardHtml(a, detailed=false) {
        const tierClass = `tier-${(a.account_tier||'standard').toLowerCase()}`;
        const statusClass = a.account_status==='active'?'status-active':a.account_status==='dormant'?'status-dormant':'status-suspended';
        const typeIcons = {checking:'🏦',savings:'🏧','business_current':'💼',investment:'📈',fixed_deposit:'🔒'};
        const icon = typeIcons[(a.account_type||'').toLowerCase().replace(' ','_')]||'💳';
        return `
          <div class="acct-card" onclick="">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
              <div style="font-size:22px">${icon}</div>
              <div style="display:flex;gap:6px;flex-direction:column;align-items:flex-end">
                <span class="tier-badge ${tierClass}">${a.account_tier||'Standard'}</span>
                <span class="tier-badge ${statusClass}" style="font-size:9px">${a.account_status||'active'}</span>
              </div>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px;text-transform:capitalize">${a.account_type||'Account'}</div>
            <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:10px">${a.account_no||'—'}</div>
            <div style="font-size:20px;font-weight:800;color:var(--domain-color)">$${(a.balance_available||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Available</div>
            ${detailed?`
            <div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06);display:flex;gap:8px">
              <button class="btn-secondary" style="flex:1;font-size:11px;padding:4px" onclick="CustomerApp.openTransferModal()">Transfer</button>
              <button class="btn-secondary" style="flex:1;font-size:11px;padding:4px" onclick="CustomerApp.downloadStatement()">Statement</button>
            </div>`:''}
          </div>`;
    },

    _miniCardHtml(c) {
        return `<div style="background:linear-gradient(135deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid var(--glass-border);border-radius:10px;padding:12px 14px;min-width:180px">
          <div style="font-size:12px;font-weight:600;margin-bottom:4px">${c.card_brand}</div>
          <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:8px">${c.card_number_masked}</div>
          <div style="font-size:12px;color:#ff6666;font-weight:700">$${(c.current_outstanding_balance||0).toLocaleString()}</div>
          <div style="font-size:10px;color:var(--text-muted)">of $${(c.credit_limit_assigned||0).toLocaleString()} limit</div>
        </div>`;
    },

    // ─── Generic Portal (Healthcare, Education, Manufacturing) ────────────────
    _renderGenericPortal: async (area, domainId) => {
        try {
            const res = await API.get('/customer/dashboard-stats');
            if (res.error) throw new Error(res.error);
            const data = res.stats;

            const metricsHtml = data.metrics.map(m=>`
              <div class="modern-card-b2b"><div class="mcb-label">${m.icon||''} ${m.label}</div><div class="mcb-val">${m.value}</div></div>`).join('');

            let actionsHtml = CustomerApp._domainActions(domainId);
            let listHtml    = CustomerApp._listHtml(data);

            area.innerHTML = `
              <div class="customer-dashboard-layout fade-in">
                <div class="cd-header">
                  <h2 class="cd-title">Welcome, <span style="color:var(--domain-color)">${CustomerApp.customerData?.name?.split(' ')[0]||'Customer'}</span></h2>
                  <p class="cd-subtitle">Your ${domainId.charAt(0).toUpperCase()+domainId.slice(1)} portal — live data &amp; quick actions.</p>
                </div>
                <div class="cd-metrics-grid">${metricsHtml}</div>
                ${actionsHtml}
                <div class="cd-main-cards" style="margin-top:20px">
                  <div class="b2c-widget"><div class="b2cw-header"><h3>Recent ${data.list_type?.charAt(0).toUpperCase()+(data.list_type?.slice(1)||'')}</h3></div>
                    <div class="b2cw-body">${listHtml}</div>
                  </div>
                  <div class="b2c-widget decorative-widget">
                    <div class="b2cw-header"><h3>Security</h3></div>
                    <div class="b2cw-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px">
                      <div style="width:70px;height:70px;border-radius:50%;background:rgba(0,230,118,.1);border:1px solid rgba(0,230,118,.3);display:flex;align-items:center;justify-content:center;position:relative">
                        <div style="position:absolute;inset:0;border-radius:50%;border:1px solid #00e676;animation:ping 2s cubic-bezier(0,0,.2,1) infinite"></div>
                        <span style="font-size:28px">🛡️</span>
                      </div>
                      <div style="font-family:var(--font-mono);color:#00e676;font-size:13px;letter-spacing:2px">SECURE</div>
                    </div>
                  </div>
                </div>
              </div>`;
        } catch(e) {
            area.innerHTML = `<div style="padding:30px"><div class="b2c-widget"><h2 style="color:var(--accent-danger)">Error</h2><p>${e.message}</p></div></div>`;
        }
    },

    _domainActions(domainId) {
        const sets = {
            healthcare: [
                ['📅','#00e676','Book Appointment','Schedule a visit','appointment',['Preferred Date','Preferred Time','Department']],
                ['✉️','#1a73e8','Message Doctor','Secure messaging','message',['Doctor Name','Subject','Message']],
                ['💊','#ffc107','Prescription Refill','Request medication','refill',['Medication','Pharmacy']],
                ['🗂️','#a78bfa','Medical Records','Download EHR PDF','records',[]]
            ],
            education: [
                ['💳','#1a73e8','Pay Tuition','Semester fees','payment',['Term','Amount']],
                ['📚','#00e676','Course Schedule','Classes & timetable','schedule',['Semester']],
                ['📝','#ffc107','Exam Registration','Register & confirm','exam',['Course','Exam Date']],
                ['🎓','#a78bfa','Transcript','Download PDF','transcript',[]]
            ],
            manufacturing: [
                ['📦','#fb923c','Place Order','New purchase order','order',['Product','Quantity','Address']],
                ['🎫','#ff4444','Support Ticket','Report an issue','ticket',['Category','Subject','Description']],
                ['🚛','#00e676','Track Shipment','Live delivery status','track',['Order Number']],
                ['📑','#1a73e8','Invoice History','Download PDF','invoice',[]]
            ]
        };
        const actions = sets[domainId]||[];
        return `<div class="cust-action-grid" style="grid-column:1/-1;margin-top:12px">
          ${actions.map(([icon,bg,label,sub,type,fields])=>`
            <button class="cust-action-btn" onclick="${fields.length?`CustomerApp.openGenericModal('${type}','${label}','${domainId}','${icon}',${JSON.stringify(fields)})`:`CustomerApp.downloadStatement()`}">
              <div class="btn-icon" style="background:${bg}22">${icon}</div>
              <div class="btn-label">${label}</div>
              <div class="btn-sub">${sub}</div>
            </button>`).join('')}
        </div>`;
    },

    _listHtml(data) {
        if (!data.recent_list||!data.recent_list.length) return '<p style="padding:20px;color:var(--text-muted);text-align:center">No recent activity.</p>';
        return data.recent_list.map(item=>{
            let title='',sub='',val='';
            if (data.list_type==='transactions') {
                title=item.transaction_desc||'Transaction'; sub=item.transaction_date?.split('T')[0]||'';
                val=`<span style="color:${item.transaction_type==='Credit'?'var(--accent-success)':'inherit'};font-weight:700">${item.transaction_type==='Credit'?'+':'-'}$${Math.abs(item.amount).toFixed(2)}</span>`;
            } else if (data.list_type==='claims') {
                title=`Claim #${item.claim_id}`; sub=item.date_filed||'';
                val=`<span class="badge ${item.claim_status?.toLowerCase()}">${item.claim_status}</span>`;
            } else if (data.list_type==='courses') {
                title=item.course; sub=item.status;
                val=`<span style="font-weight:bold">${item.grade}</span>`;
            } else if (data.list_type==='supply') {
                title=`Shipment #${item.shipment_id||item.supplier_code}`; sub=item.expected_delivery_date||'';
                val=`<span class="badge warning">${item.shipment_status}</span>`;
            }
            return `<div class="b2c-list-item"><div class="b2c-li-left"><strong>${title}</strong><small>${sub}</small></div><div class="b2c-li-right">${val}</div></div>`;
        }).join('');
    },

    // ─── Transfer Modal ───────────────────────────────────────────────────────
    openTransferModal() {
        CustomerApp._initModals();
        document.getElementById('transfer-slider').value='500';
        CustomerApp._updateSlider('500','transfer-display');
        document.getElementById('transfer-to').value='';
        document.getElementById('transfer-desc').value='';
        document.getElementById('transfer-error').style.display='none';
        document.getElementById('transfer-submit').disabled=false;
        document.getElementById('transfer-submit').innerText='Send Transfer →';
        ['ts-1','ts-2','ts-3'].forEach((id,i)=>document.getElementById(id).classList.toggle('done',i===0));
        CustomerApp.openModal('cust-transfer-modal');
    },

    async submitTransfer() {
        const amount=parseFloat(document.getElementById('transfer-slider').value);
        const to=document.getElementById('transfer-to').value.trim();
        const errEl=document.getElementById('transfer-error');
        errEl.style.display='none';
        if (!to){errEl.innerText='Please enter a destination account.';errEl.style.display='block';return;}
        const btn=document.getElementById('transfer-submit');
        btn.disabled=true; btn.innerText='Processing…';
        await new Promise(r=>setTimeout(r,800));
        document.getElementById('ts-2').classList.add('done');
        await new Promise(r=>setTimeout(r,400));
        document.getElementById('ts-3').classList.add('done');
        await new Promise(r=>setTimeout(r,500));
        CustomerApp.closeModal('cust-transfer-modal');
        UI.showToast(`✅ $${amount.toFixed(2)} transferred to ${to} successfully!`,'success');
        setTimeout(()=>CustomerApp.renderServices(CustomerApp.currentDomain), 500);
    },

    // ─── Bills Modal ──────────────────────────────────────────────────────────
    openBillsModal() {
        CustomerApp._initModals();
        const name = CustomerApp.customerData?.name?.split(' ')[0]||'Customer';
        const bills = [
            {name:'Electricity – DEWA',   amount:142.50, due:'2026-04-20', paid:false},
            {name:'Internet – Etisalat',  amount:89.00,  due:'2026-04-18', paid:false},
            {name:'Water & Sewerage',     amount:55.30,  due:'2026-04-15', paid:true},
            {name:'Credit Card Minimum',  amount:300.00, due:'2026-04-25', paid:false},
            {name:'Telecom – DU Monthly', amount:99.00,  due:'2026-05-01', paid:true},
        ];
        document.getElementById('bills-list').innerHTML = bills.map((b,i)=>`
          <div class="bill-item">
            <div><div style="font-size:13px;font-weight:600">${b.name}</div><div style="font-size:11px;color:var(--text-muted)">Due: ${b.due}</div></div>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-weight:700">$${b.amount.toFixed(2)}</span>
              ${b.paid?`<span style="color:var(--accent-success);font-weight:700;font-size:11px">✓ PAID</span>`:`<button class="btn-primary" style="font-size:11px;padding:4px 12px" onclick="CustomerApp._payBill(this,'${b.name}',${b.amount})">Pay Now</button>`}
            </div>
          </div>`).join('');
        CustomerApp.openModal('cust-bills-modal');
    },

    _payBill(btn, name, amount) {
        btn.disabled=true; btn.innerText='Paid ✓';
        btn.style.background='var(--accent-success)';
        UI.showToast(`✅ ${name} — $${amount.toFixed(2)} paid!`,'success');
    },

    payAllBills() {
        CustomerApp.closeModal('cust-bills-modal');
        UI.showToast('✅ All outstanding bills paid — Total $531.50','success');
    },

    downloadStatement() {
        UI.showToast('📄 Generating PDF statement…','info');
        setTimeout(()=>UI.showToast('✅ Statement downloaded!','success'),1800);
    },

    // ─── Generic Service Modal ────────────────────────────────────────────────
    openGenericModal(actionType, title, eyebrow, icon, fields) {
        CustomerApp._initModals();
        CustomerApp._genericActionType = actionType;
        document.getElementById('gen-ey').innerText   = eyebrow;
        document.getElementById('gen-title').innerText = `${icon} ${title}`;
        document.getElementById('gen-body').innerHTML  = fields.map(f=>`
          <div style="margin-bottom:14px">
            <div class="cust-field-label">${f}</div>
            <input type="text" class="cust-field gen-field" placeholder="Enter ${f.toLowerCase()}">
          </div>`).join('');
        CustomerApp.openModal('cust-generic-modal');
    },

    async submitGeneric() {
        const btn=document.getElementById('gen-submit');
        btn.disabled=true; btn.innerText='Submitting…';
        await new Promise(r=>setTimeout(r,900));
        CustomerApp.closeModal('cust-generic-modal');
        btn.disabled=false; btn.innerText='Submit →';
        UI.showToast('✅ Request submitted! Our team will follow up shortly.','success');
    },

    // ─── Loan Modal ───────────────────────────────────────────────────────────
    openLoanModal: ()=>{
        document.getElementById('loan-modal').classList.remove('hidden');
        document.getElementById('loan-error').classList.add('hidden');
        for(let i=1;i<=4;i++) document.getElementById(`step-${i}`).classList.remove('active','completed');
        document.getElementById('step-1').classList.add('active');
        document.getElementById('btn-loan-submit').disabled=false;
        document.getElementById('btn-loan-submit').innerText='Submit Application';
    },
    closeLoanModal: ()=>document.getElementById('loan-modal').classList.add('hidden'),

    submitLoan: async ()=>{
        const amt=document.getElementById('loan-amt').value;
        const term=document.getElementById('loan-term').value;
        const purpose=document.getElementById('loan-purpose').value;
        if(!amt||amt<500){const e=document.getElementById('loan-error');e.innerText='Minimum $500';e.classList.remove('hidden');return;}
        try{
            const btn=document.getElementById('btn-loan-submit');
            btn.disabled=true; btn.innerText='Processing…';
            const data=await API.post('/workflows/start',{definition_id:1,data:{amount:parseFloat(amt),term:parseInt(term),purpose}});
            if(data.success){
                document.getElementById('step-1').classList.add('completed');
                document.getElementById('step-2').classList.add('active');
                btn.innerText='Submitted ✓';
                UI.showToast('✅ Loan application submitted! Operations team alerted.','success');
                setTimeout(()=>CustomerApp.closeLoanModal(),2000);
            }
        }catch(e){const err=document.getElementById('loan-error');err.innerText=e.message;err.classList.remove('hidden');document.getElementById('btn-loan-submit').disabled=false;document.getElementById('btn-loan-submit').innerText='Submit Application';}
    },

    // ─── Campaign Claim Modal ─────────────────────────────────────────────────
    openCampaignModal(pid, name, reward) {
        CustomerApp._initModals();
        CustomerApp._campaignPid=pid;
        document.getElementById('camp-modal-title').innerText=`Claim Your $${reward} Reward`;
        document.getElementById('camp-modal-desc').innerText=`You qualify for the ${name} campaign. Verify your identity to receive your reward instantly.`;
        document.getElementById('camp-v-name').value=CustomerApp.customerData?.name||'';
        document.getElementById('camp-v-acc').value='';
        document.getElementById('camp-v-error').style.display='none';
        document.getElementById('camp-v-btn').disabled=false;
        document.getElementById('camp-v-btn').innerText='Claim Reward 🎁';
        CustomerApp.openModal('cust-campaign-modal');
    },

    submitCampaign: async ()=>{
        const name=document.getElementById('camp-v-name').value.trim();
        const acc=document.getElementById('camp-v-acc').value.trim();
        const errEl=document.getElementById('camp-v-error');
        errEl.style.display='none';
        if(!name){errEl.innerText='Please enter your full legal name.';errEl.style.display='block';return;}
        if(!acc){errEl.innerText='Please enter your account number.';errEl.style.display='block';return;}
        const btn=document.getElementById('camp-v-btn');
        btn.disabled=true; btn.innerText='Verifying…';
        try{
            const res=await API.post('/campaigns/portal/submit',{participant_id:CustomerApp._campaignPid,submitted_name:name,submitted_account:acc});
            CustomerApp.closeModal('cust-campaign-modal');
            UI.showToast(res.match_score>=80?'🎉 Reward verified! Processing to your account.':'⚠️ Submitted — our team will review shortly.','success');
            CustomerApp.renderServices(CustomerApp.currentDomain);
        }catch(e){errEl.innerText=e.message;errEl.style.display='block';btn.disabled=false;btn.innerText='Claim Reward 🎁';}
    },
};
