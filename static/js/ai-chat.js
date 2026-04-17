class AIChatSystem {
  constructor() {
    this.el = document.getElementById('ai-chat-panel');
    this.msgs = document.getElementById('ai-messages');
    this.inp = document.getElementById('ai-input');
    this.mode = 'chat';
    this.history = [];
  }

  open() {
    this.el.classList.remove('hidden');
    setTimeout(() => this.inp.focus(), 100);
  }

  close() {
    this.el.classList.add('hidden');
    this.mode = 'chat';
  }

  openSmartHelp() {
    this.open();
    this.addBubble("🪄 <b>Smart Contact Suggestion</b><br/>Type your issue or what you need help with, and I'll find the best expert in the company to assist you based on your habits and their real-time presence.", 'bot');
    this.mode = 'smart_help';
  }

  setMode(m) {
    this.mode = m;
    document.querySelectorAll('.ai-mode').forEach(b => b.classList.remove('active'));
    document.querySelector(`.ai-mode[data-mode="${m}"]`).classList.add('active');
    
    let prompt = '';
    if (m === 'dss') prompt = 'Recommend a decision to improve our current metrics.';
    if (m === 'whatif') prompt = 'What if revenue increases by 20%?';
    if (m === 'scenario') prompt = 'Compare best and worst case scenarios.';
    
    if (prompt) {
      this.inp.value = prompt;
      this.send();
    }
  }

  handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  sendSuggestion(btn) {
    this.inp.value = btn.innerText.replace(/^[^\s]+\s/, ''); // remove emoji
    this.send();
  }

  async send() {
    const text = this.inp.value.trim();
    if (!text) return;
    this.inp.value = '';
    
    this.addBubble(text, 'user');
    
    // Add loading indicator
    const loadId = 'loading-' + Date.now();
    this.addBubble('<div class="ai-orb" style="display:inline-block"></div> AI is analyzing data...', 'bot', loadId);

    try {
      if (this.mode === 'smart_help') {
        const res = await API.post('/ai/suggest_contact', { intent: text });
        document.getElementById(loadId)?.remove();
        this.renderContactSuggestions(res);
        this.mode = 'chat'; // reset after use
        return;
      }

      const dept = window.App ? window.App.currentDept : 'hr';
      const res = await API.post('/api/ai/chat', { 
        message: text, 
        history: this.history,
        department: dept 
      });
      
      document.getElementById(loadId)?.remove();
      this.history.push({ role: 'user', content: text });
      this.history.push({ role: 'assistant', content: res.response });
      this.renderResponse(res.response);

    } catch (e) {
      document.getElementById(loadId)?.remove();
      this.addBubble("⚠️ Error connecting to Intelligence Engine. " + e.message, 'bot');
    }
  }

  addBubble(html, sender, id = null) {
    const div = document.createElement('div');
    div.className = `ai-msg ${sender}`;
    if (id) div.id = id;
    div.innerHTML = `
      <div class="ai-msg-avatar">${sender === 'user' ? '👤' : '🤖'}</div>
      <div class="ai-msg-bubble">${html}</div>
    `;
    this.msgs.appendChild(div);
    this.msgs.scrollTo(0, this.msgs.scrollHeight);
  }

  renderResponse(r) {
    let html = '';
    if (r.summary) html += `<p><b>${r.title}</b><br/>${r.summary}</p>`;
    
    if (r.type === 'analysis' && r.insights) {
      html += `<ul>${r.insights.map(i => `<li>${i}</li>`).join('')}</ul>`;
      if (r.recommendations) {
        html += `<h4>Recommendations:</h4><ul>${r.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>`;
      }
    }
    else if (r.type === 'whatif' && r.scenarios) {
      html += `<ul>${r.insights.map(i => `<li>${i}</li>`).join('')}</ul>`;
      html += `<table class="aura-table"><tr><th>Scenario</th><th>Revenue</th><th>Profit</th></tr>`;
      r.scenarios.forEach(s => {
        html += `<tr><td>${s.label}</td><td>$${s.revenue.toLocaleString()}</td><td>$${s.profit.toLocaleString()}</td></tr>`;
      });
      html += `</table><p><i>${r.recommendation}</i></p>`;
    }
    else if (r.type === 'scenario' && r.scenarios) {
      r.scenarios.forEach(s => {
        html += `
          <div class="ai-card" style="border-left: 4px solid ${s.color}">
            <b>${s.name} (Prob: ${s.probability})</b><br/>
            Rev: $${s.revenue.toLocaleString()} | Profit: $${s.profit.toLocaleString()}<br/>
            <small>${s.assumptions.join(', ')}</small>
          </div>
        `;
      });
      html += `<p style="margin-top:10px"><i>${r.recommendation}</i></p>`;
    }
    else if (r.type === 'dss' && r.options) {
      r.options.forEach((o, idx) => {
        html += `
          <div class="ai-card">
            <b>Option ${idx+1}: ${o.title}</b><br/>
            Impact: ${o.impact} | Effort: ${o.effort}<br/>
            <div class="ai-score-bar"><div class="ai-score-fill" style="width:${o.success_prob}%"></div></div>
            <small>Estimated Success: ${o.success_prob}%</small>
            <button class="btn-primary" style="margin-top:8px; padding:4px 8px; font-size:11px" onclick="AIChat.executeDecision('${o.title.replace(/'/g,"\\'")}','${o.success_prob}')">Execute Decision</button>
          </div>
        `;
      });
    }
    else if (r.type === 'help') {
      html += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px">`;
      r.capabilities.forEach(c => {
        html += `<div class="ai-card" style="margin:0; font-size:11px" onclick="document.getElementById('ai-input').value='${c.action}';"><b>${c.icon} ${c.action}</b><br/><span style="color:var(--text-muted)">${c.example}</span></div>`;
      });
      html += `</div>`;
    }
    else {
      // General text fallback
      const txt = (r.summary || r.response || JSON.stringify(r)).replace(/\n/g, '<br/>');
      html += `<p>${txt}</p>`;
      if (r.suggestion) html += `<p><small style="color:var(--domain-color)">${r.suggestion}</small></p>`;
    }

    this.addBubble(html, 'bot');
  }

  renderContactSuggestions(r) {
    if (r.error) {
      this.addBubble("⚠️ " + r.error, 'bot');
      return;
    }
    
    let html = `<p>Identified Department: <b>${r.department_identified.toUpperCase()}</b><br/>Confidence: <b>${r.confidence}</b></p>`;
    
    if (!r.candidates || r.candidates.length === 0) {
      html += `<p>Could not find any suitable contacts.</p>`;
      this.addBubble(html, 'bot');
      return;
    }
    
    html += `<div style="display:flex; flex-direction:column; gap:10px;">`;
    r.candidates.forEach((c, idx) => {
      let badge = '';
      if (idx === 0) badge = `<span style="background:var(--domain-color); color:#fff; padding:2px 6px; border-radius:10px; font-size:10px; margin-left:5px;">Best Match</span>`;
      
      let statusColor = c.status === 'online' ? '#4caf50' : (c.status === 'busy' ? '#f44336' : (c.status === 'away' ? '#ff9800' : '#888'));
      
      html += `
        <div class="ai-card" style="border-left: 4px solid ${statusColor}; position:relative; margin:0px;">
          <b style="font-size:13px;">${c.name}</b> ${badge}<br/>
          <span style="font-size:11px; opacity:0.8;">${c.role.toUpperCase()} • ${c.department.toUpperCase()}</span><br/>
          <div style="margin-top:8px; display:flex; gap:5px;">
            <button class="btn-primary" style="padding:4px 10px; font-size:11px;" onclick="window.Comm?._initiateCall(${c.id})">📞 Call</button>
            <button class="btn-secondary" style="padding:4px 10px; font-size:11px;" onclick="App?._navTo('communication')">💬 Message</button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    this.addBubble(html, 'bot');
  }

  async executeDecision(title, score) {
    if (!Auth.user.permissions.can_edit) {
        UI.showToast("Permission denied. Managers and Admins only.", "error");
        return;
    }
    try {
      await API.post('/ai/decision', {
        department: window.App?.currentDept || 'hr',
        title: title,
        options: '[]',
        chosen_option: title,
        success_score: parseFloat(score)/100,
        outcome: 'pending'
      });
      UI.showToast("Decision recorded in intelligent ledger.", "success");
      this.addBubble(`✅ Automatically initiated workflow for: <b>${title}</b>. Team has been notified.`, 'bot');
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }

  clearHistory() {
    this.history = [];
    this.msgs.innerHTML = '';
    this.addBubble("History cleared. How can I help you today?", 'bot');
  }
}

window.AIChat = new AIChatSystem();
