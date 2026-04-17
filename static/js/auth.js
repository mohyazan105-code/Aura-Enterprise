const Auth = {
  user: null,
  domain: null,

  async check() {
    try {
      const res = await API.get('/auth/me');
      if (res && res.user) {
        this.user = res.user;
        this.domain = res.domain;
        return true;
      }
    } catch(e) {}
    return false;
  },

  async login() {
    const u = document.getElementById('inp-username').value;
    const p = document.getElementById('inp-password').value;
    const d = document.getElementById('login-domain-name').dataset.id || localStorage.getItem('aura_domain') || 'banking';
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');

    if (!u || !p) {
      errEl.innerText = "Please enter both username and password.";
      errEl.classList.remove('hidden');
      return;
    }

    try {
      document.getElementById('btn-login').disabled = true;
      const res = await API.post('/auth/login', { username: u, password: p, domain: d });
      this.user = res.user;
      this.domain = res.domain;
      
      // Trigger WebGL Transition (eat the screen!)
      if (window.VisualFX && window.VisualFX.engine) {
          window.VisualFX.engine.eatScreen();
          await new Promise(r => setTimeout(r, 1200)); 
      }
      App.showDashboard();
    } catch (e) {
      errEl.innerText = e.message;
      errEl.classList.remove('hidden');
    } finally {
      document.getElementById('btn-login').disabled = false;
    }
  },

  async logout() {
    try {
      await API.post('/auth/logout');
    } catch(e){}
    this.user = null;
    this.domain = null;
    localStorage.removeItem('aura_domain');
    App.showDomainSelect();
  },

  fillDemo(u, p) {
    document.getElementById('inp-username').value = u;
    document.getElementById('inp-password').value = p;
  },

  togglePass() {
    const inp = document.getElementById('inp-password');
    if (inp.type === 'password') {
        inp.type = 'text';
        if (window.VisualFX && window.VisualFX.engine) window.VisualFX.engine.setExpand(0.3);
    } else {
        inp.type = 'password';
        if (window.VisualFX && window.VisualFX.engine) window.VisualFX.engine.setExpand(0.0);
    }
  },

  showAdminLogin() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-admin-login').classList.add('active');
    if (window.AuraBlackhole) window.AuraBlackhole.mountTo('page-admin-login');
  },

  async submitAdminLogin() {
    const u = document.getElementById('admin-user').value;
    const p = document.getElementById('admin-pass').value;
    const page = document.getElementById('page-admin-login');
    page.querySelectorAll('button, input').forEach(el => el.disabled = true);

    try {
      const res = await API.post('/auth/login', { username: u, password: p, domain: 'global' });
      this.user = res.user;
      this.domain = res.domain;

      // ── Cinematic Black Hole eat-screen ───────────────────────
      await new Promise(resolve => {
        const overlay = document.getElementById('sa-eat-overlay');
        if (!overlay) { resolve(); return; }
        // Force reflow then trigger the CSS expansion
        overlay.classList.remove('eating');
        void overlay.offsetWidth;
        overlay.classList.add('eating');
        // After animation completes (1.4s css transition) resolve
        setTimeout(resolve, 1350);
      });

      // Switch page (overlay is still covering the screen)
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-system-admin').classList.add('active');
      if (window.AuraBlackhole) window.AuraBlackhole.stop();

      if (window.SystemAdmin) await window.SystemAdmin.init();

      // Fade the overlay back out smoothly
      const overlay = document.getElementById('sa-eat-overlay');
      if (overlay) {
        overlay.style.transition = 'opacity 0.6s ease';
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.classList.remove('eating');
          overlay.style.opacity = '';
          overlay.style.transition = '';
        }, 700);
      }

    } catch(e) {
      UI.showToast('Command Override Failed: ' + e.message, 'error');
      page.querySelectorAll('button, input').forEach(el => el.disabled = false);
    }
  }
};
window.Auth = Auth;
