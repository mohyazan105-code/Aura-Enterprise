class KPIExplainerSystem {
  constructor() {
    this.modal = document.getElementById('kpi-explain-modal');
    this.titleEl = document.getElementById('kpi-explain-title');
    this.defEl = document.getElementById('kpi-explain-def');
    this.purpEl = document.getElementById('kpi-explain-purpose');
    this.formEl = document.getElementById('kpi-explain-formula');
    this.srcEl = document.getElementById('kpi-explain-source');
    this.insightEl = document.getElementById('kpi-explain-insight');
  }

  async open(kpiName, value, trend = '') {
    // Show Loading State
    this.titleEl.innerText = kpiName;
    this.defEl.innerHTML = '<div class="ai-orb" style="display:inline-block"></div> Loading knowledge base...';
    this.purpEl.innerText = '...';
    this.formEl.innerText = '...';
    this.srcEl.innerText = '...';
    this.insightEl.innerHTML = 'AI is analyzing the current metric...';
    
    this.modal.classList.remove('hidden');

    try {
      const res = await API.post('/ai/explain_kpi', {
        kpi_name: kpiName,
        value: value,
        trend: trend,
        lang: 'en' // Hardcoded English defaults
      });

      if (res.error) throw new Error(res.error);

      // Render response
      this.defEl.innerText = res.definition || 'No standard definition available.';
      this.purpEl.innerText = res.purpose || 'General performance tracking.';
      this.formEl.innerText = res.formula || 'Calculated automatically.';
      this.srcEl.innerText = res.data_source || 'Aura Integrated DB';
      
      this.insightEl.innerHTML = `<span style="font-size:18px">🪄</span> <b>AI Contextual Insight:</b><br/>${res.ai_insight || 'Values indicate standard operational capacity.'}`;
      
    } catch (e) {
      this.defEl.innerText = "Error loading KPI details.";
      this.insightEl.innerHTML = `⚠️ ${e.message}`;
    }
  }

  close() {
    this.modal.classList.add('hidden');
  }

  toggleLang(lang) {
    const kpiName = this.titleEl.innerText;
    // For simplicity, re-fetch. In production, we'd cache.
    // Assuming value is retrievable or we just re-run without it for static defs.
    this.open(kpiName, '', '', lang); 
  }
}

window.KPIExplainer = new KPIExplainerSystem();
