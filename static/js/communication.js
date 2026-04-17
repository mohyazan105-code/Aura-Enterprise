/**
 * ActionAura — Internal Communication Engine
 * Manages: System activation, contacts, calls, meetings, chat, presence
 */

class CommunicationEngine {
  constructor() {
    this.isActive     = false;
    this.contacts     = {};
    this.callLogs     = [];
    this.meetings     = [];
    this.currentCall  = null;
    this.currentMeeting = null;
    this.callPollInterval = null;
    this.presenceInterval = null;
    this._chatPollInterval = null;
    this._participantPollInterval = null;
  }

  /* ─── INIT ────────────────────────────────────────────────── */
  async init() {
    try {
      const res = await API.get('/comm/status');
      this.isActive = res.active;
    } catch(e) {
      this.isActive = false;
    }
  }

  /* ─── RENDER MAIN COMM HUB ─────────────────────────────────── */
  async renderHub() {
    await this.init();
    const container = document.getElementById('content-area');

    if (!this.isActive) {
      this._renderInactiveState(container);
      return;
    }

    container.innerHTML = `<div class="skeleton-loader"><div class="sk-bar wide"></div><div class="sk-bar medium"></div><div class="sk-table"></div></div>`;

    const [contactsRes, logsRes, meetingsRes] = await Promise.all([
      API.get('/comm/contacts'),
      API.get('/comm/calls/logs'),
      API.get('/comm/meetings')
    ]);

    this.contacts = contactsRes.contacts || {};
    this.callLogs = logsRes.logs || [];
    this.meetings = meetingsRes.meetings || [];

    // Set self as online
    this._heartbeat();

    container.innerHTML = this._buildHubHTML();
    this._startCallPoller();
  }

  _renderInactiveState(container) {
    const isAdmin = window.Auth?.user?.role === 'admin';
    container.innerHTML = `
      <div class="comm-inactive-screen">
        <div class="comm-inactive-orb">
          <div class="comm-inactive-ring"></div>
          <div class="comm-inactive-ring r2"></div>
          <span class="comm-inactive-icon">📡</span>
        </div>
        <h2>Communication System Offline</h2>
        <p>The Internal Communication Module is currently disabled.<br>
           ${isAdmin
             ? 'As an administrator, you can activate it below.'
             : 'Please contact your system administrator to enable this feature.'
           }
        </p>
        ${isAdmin ? `
          <button class="btn-primary" style="margin-top:20px; padding:14px 40px; font-size:15px;" onclick="Comm.activateSystem(true)">
            ⚡ Activate Communication System
          </button>
        ` : `
          <div class="comm-inactive-badge">Feature Not Active</div>
        `}
      </div>
    `;
  }

  /* ─── ACTIVATION ────────────────────────────────────────────── */
  async activateSystem(activate = true) {
    try {
      await API.post('/comm/activate', { activate });
      this.isActive = activate;
      UI.showToast(activate ? '📡 Communication System Activated!' : 'System Deactivated', activate ? 'success' : 'info');
      this.renderHub();
    } catch(e) {
      UI.showToast(e.message || 'Failed to change activation', 'error');
    }
  }

  /* ─── BUILD MAIN HUB HTML ───────────────────────────────────── */
  _buildHubHTML() {
    const pendingMeetings = this.meetings.filter(m => m.status === 'scheduled').length;
    const ongoingMeetings = this.meetings.filter(m => m.status === 'ongoing').length;
    const totalContacts   = Object.values(this.contacts).flat().length;
    const recentCalls     = this.callLogs.slice(0, 5);

    return `
      <!-- Header Bar -->
      <div class="comm-header-bar glass-panel">
        <div>
          <h2 class="section-title">📡 Internal Communications</h2>
          <p style="color:var(--text-muted); font-size:12px;">Enterprise calling & meeting center</p>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <div class="comm-status-self">
            <div class="comm-dot online"></div> Online
          </div>
          ${window.Auth?.user?.role === 'admin' ? `
            <button class="btn-secondary" style="font-size:11px;" onclick="Comm.activateSystem(false)">⚡ Deactivate</button>
          ` : ''}
          <button class="btn-primary" onclick="Comm.openNewCall()">📞 New Call</button>
          <button class="btn-secondary" onclick="Comm.openNewMeeting()">📅 Schedule Meeting</button>
        </div>
      </div>

      <!-- KPI Row -->
      <div class="grid-4" style="margin-bottom:20px;">
        <div class="kpi-card">
          <div class="kpi-label">Contacts</div>
          <div class="kpi-val">${totalContacts}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Scheduled Meetings</div>
          <div class="kpi-val" style="color:var(--accent-info)">${pendingMeetings}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Ongoing Meetings</div>
          <div class="kpi-val" style="color:var(--accent-success)">${ongoingMeetings}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Recent Calls</div>
          <div class="kpi-val">${this.callLogs.length}</div>
        </div>
      </div>

      <!-- Main Grid -->
      <div style="display:grid; grid-template-columns:340px 1fr; gap:20px;">

        <!-- Left: Contact List -->
        <div class="glass-panel" style="padding:0; overflow:hidden; height:fit-content; max-height:600px;">
          <div style="padding:16px 20px; border-bottom:1px solid var(--glass-border);">
            <h3 style="font-size:14px; font-weight:600;">👥 Directory</h3>
          </div>
          <div style="overflow-y:auto; max-height:520px;" class="comm-contact-scroll">
            ${this._buildContactList()}
          </div>
        </div>

        <!-- Right: Meetings + Call Logs -->
        <div style="display:flex; flex-direction:column; gap:20px;">

          <!-- Meeting Dashboard -->
          <div class="glass-panel">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3 style="font-size:14px; font-weight:600;">📅 Meeting Rooms</h3>
              <button class="btn-primary" style="font-size:12px; padding:6px 14px;" onclick="Comm.openNewMeeting()">+ New</button>
            </div>
            <div id="comm-meetings-list">
              ${this._buildMeetingCards()}
            </div>
          </div>

          <!-- Call Logs -->
          <div class="glass-panel">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3 style="font-size:14px; font-weight:600;">📋 Recent Calls</h3>
              <button class="btn-secondary" style="font-size:11px; padding:5px 10px;" onclick="Comm.renderHub()">🔄 Refresh</button>
            </div>
            <div id="comm-call-logs">
              ${this._buildCallLogs(recentCalls)}
            </div>
          </div>
        </div>
      </div>

      <!-- Modals -->
      ${this._buildNewCallModal()}
      ${this._buildNewMeetingModal()}
      ${this._buildMeetingRoomModal()}
      ${this._buildIncomingCallPanel()}
    `;
  }

  /* ─── CONTACT LIST ──────────────────────────────────────────── */
  _buildContactList() {
    if (!Object.keys(this.contacts).length) {
      return `<div class="comm-empty">No contacts found</div>`;
    }
    return Object.entries(this.contacts).map(([dept, users]) => `
      <div class="comm-dept-group">
        <div class="comm-dept-label">${dept.toUpperCase()}</div>
        ${users.map(u => `
          <div class="comm-contact-item" onclick="Comm.callUser(${u.id}, '${u.name.replace(/'/g, '')}')">
            <div class="comm-contact-avatar">${u.name.charAt(0)}</div>
            <div class="comm-contact-info">
              <div class="comm-contact-name" title="${u.name}">${u.name}</div>
              <div class="comm-contact-role">${u.role || 'Staff'}</div>
            </div>
            <div class="comm-presence-dot ${u.status || 'offline'}" title="${u.status}"></div>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  /* ─── MEETING CARDS ─────────────────────────────────────────── */
  _buildMeetingCards() {
    if (!this.meetings.length) {
      return `<div class="comm-empty">No meetings. Schedule one above.</div>`;
    }

    return this.meetings.map(m => {
      const statusColors = { scheduled: '#f59e0b', ongoing: '#00c853', ended: '#666' };
      const statusEmojis = { scheduled: '🕐', ongoing: '🔴', ended: '✅' };
      const color = statusColors[m.status] || '#666';
      const canJoin = m.status === 'ongoing';
      const canStart = m.status === 'scheduled' && m.host_id === window.Auth?.user?.id;

      return `
        <div class="comm-meeting-card" style="border-left-color:${color}">
          <div class="comm-meeting-top">
            <div>
              <div class="comm-meeting-title">${statusEmojis[m.status]} ${m.title}</div>
              <div class="comm-meeting-meta">
                Host: ${m.host_name} • ${m.scheduled_at ? UI.formatDate(m.scheduled_at) : 'No schedule set'}
              </div>
            </div>
            <div class="comm-meeting-badge" style="background:${color}20; color:${color}; border:1px solid ${color}40;">
              ${m.status.toUpperCase()}
            </div>
          </div>
          ${m.agenda ? `<div class="comm-meeting-agenda">${m.agenda}</div>` : ''}
          <div class="comm-meeting-actions">
            ${canStart ? `<button class="btn-primary" style="font-size:12px; padding:6px 14px;" onclick="Comm.startMeeting(${m.id})">▶ Start Now</button>` : ''}
            ${canJoin  ? `<button class="btn-primary" style="font-size:12px; padding:6px 14px; background:var(--accent-success);" onclick="Comm.joinMeeting(${m.id})">📹 Join</button>` : ''}
            <button class="btn-secondary" style="font-size:12px; padding:6px 12px;" onclick="Comm.viewMeeting(${m.id})">Details</button>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ─── CALL LOGS ─────────────────────────────────────────────── */
  _buildCallLogs(logs) {
    if (!logs.length) return `<div class="comm-empty">No recent calls.</div>`;

    const icons = { ended: '📞', missed: '❌', rejected: '🚫', active: '🔴', ringing: '🔔' };
    return `
      <table class="aura-table">
        <thead><tr><th>Status</th><th>Caller</th><th>Callee</th><th>Time</th><th>Duration</th></tr></thead>
        <tbody>
          ${logs.map(l => `
            <tr>
              <td><span class="comm-call-status ${l.status}">${icons[l.status] || '📞'} ${l.status}</span></td>
              <td>${l.caller_name}</td>
              <td>${l.callee_name}</td>
              <td>${UI.formatDate(l.started_at)}</td>
              <td>${l.duration_seconds > 0 ? this._fmtDuration(l.duration_seconds) : '–'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  _fmtDuration(secs) {
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m}m ${s}s`;
  }

  /* ─── MODALS HTML ───────────────────────────────────────────── */
  _buildNewCallModal() {
    const allUsers = Object.values(this.contacts).flat();
    return `
      <div id="comm-call-modal" class="modal hidden">
        <div class="modal-backdrop" onclick="document.getElementById('comm-call-modal').classList.add('hidden')"></div>
        <div class="modal-box" style="max-width:460px;">
          <div class="modal-header">
            <h3>📞 Initiate Call</h3>
            <button class="modal-close" onclick="document.getElementById('comm-call-modal').classList.add('hidden')">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Filter by Department</label>
              <select id="call-dept-filter" class="intel-select" onchange="Comm._filterCallContacts(this.value)">
                <option value="">— All Departments —</option>
                ${Object.keys(this.contacts).map(d => `<option value="${d}">${d.toUpperCase()}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Select Employee</label>
              <select id="call-target-user" class="intel-select">
                ${allUsers.map(u => `<option value="${u.id}" data-dept="${u.department}">${u.name} — ${u.role} (${u.status})</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="document.getElementById('comm-call-modal').classList.add('hidden')">Cancel</button>
            <button class="btn-primary" onclick="Comm._submitCall()">📞 Call Now</button>
          </div>
        </div>
      </div>
    `;
  }

  _buildNewMeetingModal() {
    const allUsers = Object.values(this.contacts).flat();
    return `
      <div id="comm-meeting-modal" class="modal hidden">
        <div class="modal-backdrop" onclick="document.getElementById('comm-meeting-modal').classList.add('hidden')"></div>
        <div class="modal-box" style="max-width:520px;">
          <div class="modal-header">
            <h3>📅 Schedule Meeting</h3>
            <button class="modal-close" onclick="document.getElementById('comm-meeting-modal').classList.add('hidden')">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Meeting Title</label>
              <input type="text" id="mtg-title" class="intel-input" placeholder="e.g. Q2 Planning Session">
            </div>
            <div class="grid-2" style="gap:15px;">
              <div class="form-group">
                <label>Scheduled Date & Time</label>
                <input type="datetime-local" id="mtg-datetime" class="intel-input">
              </div>
              <div class="form-group">
                <label>Department</label>
                <select id="mtg-dept" class="intel-select">
                  <option value="">All</option>
                  ${Object.keys(this.contacts).map(d => `<option value="${d}">${d.toUpperCase()}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Agenda</label>
              <input type="text" id="mtg-agenda" class="intel-input" placeholder="Key discussion points...">
            </div>
            <div class="form-group">
              <label>Invite Participants (select multiple)</label>
              <div class="comm-invite-list" id="comm-invite-list">
                ${allUsers.map(u => `
                  <label class="comm-invite-item">
                    <input type="checkbox" class="comm-invite-check" value="${u.id}">
                    <span class="comm-presence-dot ${u.status}"></span>
                    <span>${u.name}</span>
                    <span style="color:var(--text-muted); font-size:11px;">(${u.department})</span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="document.getElementById('comm-meeting-modal').classList.add('hidden')">Cancel</button>
            <button class="btn-primary" onclick="Comm._submitMeeting()">📅 Create Meeting</button>
          </div>
        </div>
      </div>
    `;
  }

  _buildMeetingRoomModal() {
    return `
      <div id="comm-room-modal" class="modal hidden">
        <div class="modal-backdrop"></div>
        <div class="modal-box" style="max-width:900px; width:90vw; max-height:85vh; display:flex; flex-direction:column;">
          <div class="modal-header comm-room-header">
            <div>
              <h3 id="room-title">📹 Meeting Room</h3>
              <div id="room-code-display" style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);"></div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <div id="room-timer" class="comm-timer">00:00</div>
              <button class="btn-secondary" style="font-size:12px;" onclick="Comm._toggleVideo(this)">📷 Video</button>
              <button class="btn-secondary" style="font-size:12px;" onclick="Comm._toggleMic(this)">🎤 Mic</button>
              <button class="btn-secondary" style="font-size:12px;" onclick="Comm._toggleScreen(this)">🖥 Share</button>
              <button class="btn-primary" style="background:#e53935; font-size:12px;" onclick="Comm._leaveMeeting()">Leave</button>
              <button class="modal-close" onclick="Comm._forceCloseRoom()">✕</button>
            </div>
          </div>
          <div class="comm-room-body">
            <!-- Video Area -->
            <div class="comm-video-area" id="comm-video-area">
              <div class="comm-video-grid" id="comm-video-grid">
                <!-- Participant video tiles injected here -->
              </div>
              <div class="comm-screen-share-overlay hidden" id="screen-share-overlay">
                <div class="comm-screen-sim">
                  <div style="font-size:48px">🖥️</div>
                  <div style="color:var(--text-muted); margin-top:10px;">Screen sharing active (simulated)</div>
                </div>
              </div>
            </div>

            <!-- Sidebar: Chat + Participants -->
            <div class="comm-room-sidebar">
              <div class="comm-room-tabs">
                <button class="comm-tab active" data-tab="chat" onclick="Comm._switchRoomTab('chat')">💬 Chat</button>
                <button class="comm-tab" data-tab="people" onclick="Comm._switchRoomTab('people')">👥 People</button>
              </div>

              <div id="room-tab-chat" class="comm-tab-content">
                <div class="comm-chat-messages" id="comm-chat-messages"></div>
                <div class="comm-chat-input-bar">
                  <input type="text" id="comm-chat-input" placeholder="Message..." onkeydown="Comm._chatKeydown(event)">
                  <button onclick="Comm._sendChatMessage()">➤</button>
                </div>
              </div>

              <div id="room-tab-people" class="comm-tab-content hidden">
                <div id="comm-participants-list" class="comm-participants-list"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _buildIncomingCallPanel() {
    return `
      <div id="comm-incoming-panel" class="comm-incoming hidden">
        <div class="comm-incoming-ring"></div>
        <div class="comm-incoming-info">
          <div class="comm-incoming-avatar" id="incoming-avatar">?</div>
          <div>
            <div class="comm-incoming-name" id="incoming-name">Unknown Caller</div>
            <div class="comm-incoming-dept" id="incoming-dept">Incoming Call...</div>
          </div>
        </div>
        <div class="comm-incoming-actions">
          <button class="comm-accept-btn" onclick="Comm._acceptCall()">📞</button>
          <button class="comm-reject-btn" onclick="Comm._rejectCall()">📵</button>
        </div>
      </div>
    `;
  }

  /* ─── ACTIONS ───────────────────────────────────────────────── */
  openNewCall() {
    document.getElementById('comm-call-modal')?.classList.remove('hidden');
  }

  openNewMeeting() {
    document.getElementById('comm-meeting-modal')?.classList.remove('hidden');
  }

  callUser(userId, name) {
    const sel = document.getElementById('call-target-user');
    if (sel) sel.value = userId;
    this.openNewCall();
  }

  _filterCallContacts(dept) {
    const sel = document.getElementById('call-target-user');
    if (!sel) return;
    const options = sel.querySelectorAll ? [...sel.options] : Array.from(sel.options);
    options.forEach(opt => {
      const d = opt.getAttribute('data-dept') || '';
      opt.hidden = dept ? d !== dept : false;
    });
  }

  async _submitCall() {
    const calleeId = parseInt(document.getElementById('call-target-user')?.value);
    if (!calleeId) return;
    document.getElementById('comm-call-modal').classList.add('hidden');
    try {
      const res = await API.post('/comm/calls/initiate', { callee_id: calleeId });
      this.currentCall = res.call_id;
      UI.showToast(`📞 Ringing ${res.callee_name}...`, 'info');
      this._showActiveCallBar(res.callee_name, res.call_id);
    } catch(e) {
      UI.showToast(e.message || 'Could not place call', 'error');
    }
  }

  _showActiveCallBar(name, callId) {
    // Remove old if exists
    document.getElementById('comm-active-bar')?.remove();
    const bar = document.createElement('div');
    bar.id = 'comm-active-bar';
    bar.className = 'comm-active-call-bar';
    bar.innerHTML = `
      <div class="comm-active-ring-anim"></div>
      <span>📞 Calling <b>${name}</b>...</span>
      <button onclick="Comm._endCall(${callId})" class="comm-end-btn">End Call</button>
    `;
    document.body.appendChild(bar);

    // Auto-dismiss after 30s (missed)
    setTimeout(() => { bar.remove(); }, 30000);
  }

  async _endCall(callId) {
    document.getElementById('comm-active-bar')?.remove();
    try {
      await API.post('/comm/calls/respond', { call_id: callId, action: 'end' });
      UI.showToast('Call ended', 'info');
      this.currentCall = null;
    } catch(e) {}
  }

  /* ─── INCOMING CALL POLLER ──────────────────────────────────── */
  _startCallPoller() {
    clearInterval(this.callPollInterval);
    this.callPollInterval = setInterval(() => this._pollIncoming(), 4000);
  }

  async _pollIncoming() {
    try {
      const res = await API.get('/comm/calls/incoming');
      const calls = res.calls || [];
      if (calls.length > 0 && !document.getElementById('comm-incoming-panel')?.classList.contains('visible')) {
        this._showIncoming(calls[0]);
      }
    } catch(e) {}
  }

  _showIncoming(call) {
    const panel = document.getElementById('comm-incoming-panel');
    if (!panel) return;
    this._pendingCall = call;
    document.getElementById('incoming-name').textContent = call.caller_name;
    document.getElementById('incoming-dept').textContent = `Incoming from ${call.department || 'Unknown Dept'}`;
    document.getElementById('incoming-avatar').textContent = call.caller_name?.charAt(0) || '?';
    panel.classList.remove('hidden');
    panel.classList.add('visible');
  }

  async _acceptCall() {
    const call = this._pendingCall;
    if (!call) return;
    document.getElementById('comm-incoming-panel')?.classList.remove('visible');
    document.getElementById('comm-incoming-panel')?.classList.add('hidden');
    try {
      await API.post('/comm/calls/respond', { call_id: call.id, action: 'accept' });
      UI.showToast(`📞 Call connected with ${call.caller_name}`, 'success');
    } catch(e) {}
    this._pendingCall = null;
  }

  async _rejectCall() {
    const call = this._pendingCall;
    if (!call) return;
    document.getElementById('comm-incoming-panel')?.classList.remove('visible');
    document.getElementById('comm-incoming-panel')?.classList.add('hidden');
    try {
      await API.post('/comm/calls/respond', { call_id: call.id, action: 'reject' });
    } catch(e) {}
    this._pendingCall = null;
  }

  /* ─── MEETINGS ──────────────────────────────────────────────── */
  async _submitMeeting() {
    const title  = document.getElementById('mtg-title')?.value?.trim();
    const dt     = document.getElementById('mtg-datetime')?.value;
    const dept   = document.getElementById('mtg-dept')?.value;
    const agenda = document.getElementById('mtg-agenda')?.value?.trim();
    const invites = [...document.querySelectorAll('.comm-invite-check:checked')].map(c => parseInt(c.value));

    if (!title) { UI.showToast('Meeting title required', 'error'); return; }

    try {
      const res = await API.post('/comm/meetings/create', {
        title, scheduled_at: dt, department: dept, agenda, invites
      });
      document.getElementById('comm-meeting-modal').classList.add('hidden');
      UI.showToast(`📅 Meeting "${title}" scheduled! Room: ${res.room_code}`, 'success');
      this.renderHub();
    } catch(e) {
      UI.showToast(e.message || 'Failed to create meeting', 'error');
    }
  }

  async startMeeting(meetingId) {
    try {
      await API.post(`/comm/meetings/${meetingId}/start`);
      UI.showToast('Meeting started!', 'success');
      this.joinMeeting(meetingId);
    } catch(e) {
      UI.showToast(e.message, 'error');
    }
  }

  async joinMeeting(meetingId) {
    try {
      await API.post(`/comm/meetings/${meetingId}/join`);
      const res = await API.get(`/comm/meetings/${meetingId}`);
      this.currentMeeting = res.meeting;
      this._openMeetingRoom(res.meeting);
    } catch(e) {
      UI.showToast(e.message || 'Failed to join', 'error');
    }
  }

  async viewMeeting(meetingId) {
    try {
      const res = await API.get(`/comm/meetings/${meetingId}`);
      this.currentMeeting = res.meeting;
      this._openMeetingRoom(res.meeting);
    } catch(e) {
      UI.showToast(e.message, 'error');
    }
  }

  _openMeetingRoom(meeting) {
    const modal = document.getElementById('comm-room-modal');
    if (!modal) return;

    document.getElementById('room-title').textContent = `📹 ${meeting.title}`;
    document.getElementById('room-code-display').textContent = `Room Code: ${meeting.room_code}`;

    this._renderParticipants(meeting.participants || []);
    this._renderChat(meeting.chat || []);
    this._renderVideoGrid(meeting.participants || []);

    modal.classList.remove('hidden');
    this._startRoomTimer();
    this._startChatPoller(meeting.id);
    this._startParticipantPoller(meeting.id);
  }

  _renderVideoGrid(participants) {
    const grid = document.getElementById('comm-video-grid');
    if (!grid) return;

    const me = window.Auth?.user;
    const allParticipants = [...participants];
    if (me && !allParticipants.find(p => p.user_id === me.id)) {
      allParticipants.unshift({ user_id: me.id, user_name: me.name });
    }

    grid.innerHTML = allParticipants.slice(0, 6).map((p, i) => `
      <div class="comm-video-tile ${i === 0 ? 'self' : ''}">
        <div class="comm-video-avatar">${(p.user_name || 'U').charAt(0)}</div>
        <div class="comm-video-name">${p.user_name || 'Unknown'}${i === 0 ? ' (You)' : ''}</div>
        <div class="comm-video-indicators">
          <span class="comm-vid-icon" title="Camera on">📷</span>
          <span class="comm-vid-icon" title="Mic on">🎤</span>
        </div>
      </div>
    `).join('');
  }

  _renderChat(messages) {
    const box = document.getElementById('comm-chat-messages');
    if (!box) return;
    if (!messages.length) {
      box.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px; font-size:12px;">No messages yet</div>`;
      return;
    }
    box.innerHTML = messages.map(m => `
      <div class="comm-chat-msg ${m.user_id === window.Auth?.user?.id ? 'self' : ''}">
        <span class="comm-chat-name">${m.name}</span>
        <div class="comm-chat-bubble">${m.message}</div>
        <span class="comm-chat-time">${m.time}</span>
      </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
  }

  _renderParticipants(participants) {
    const list = document.getElementById('comm-participants-list');
    if (!list) return;
    list.innerHTML = participants.length
      ? participants.map(p => `
          <div class="comm-participant-row">
            <div class="comm-contact-avatar" style="width:30px;height:30px;font-size:13px;">${(p.user_name || 'U').charAt(0)}</div>
            <span>${p.user_name || 'Unknown'}</span>
          </div>
        `).join('')
      : `<div style="color:var(--text-muted); font-size:12px; padding:10px;">No participants yet</div>`;
  }

  _switchRoomTab(tab) {
    document.querySelectorAll('.comm-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('room-tab-chat')?.classList.toggle('hidden', tab !== 'chat');
    document.getElementById('room-tab-people')?.classList.toggle('hidden', tab !== 'people');
  }

  async _sendChatMessage() {
    const input = document.getElementById('comm-chat-input');
    const message = input?.value?.trim();
    if (!message || !this.currentMeeting) return;
    input.value = '';
    try {
      const res = await API.post(`/comm/meetings/${this.currentMeeting.id}/chat`, { message });
      this._renderChat(res.chat);
    } catch(e) {}
  }

  _chatKeydown(e) {
    if (e.key === 'Enter') this._sendChatMessage();
  }

  _startChatPoller(meetingId) {
    clearInterval(this._chatPollInterval);
    this._chatPollInterval = setInterval(async () => {
      try {
        const res = await API.get(`/comm/meetings/${meetingId}`);
        this._renderChat(res.meeting?.chat || []);
      } catch(e) {}
    }, 4000);
  }

  _startParticipantPoller(meetingId) {
    clearInterval(this._participantPollInterval);
    this._participantPollInterval = setInterval(async () => {
      try {
        const res = await API.get(`/comm/meetings/${meetingId}/participants`);
        const parts = res.participants || [];
        this._renderParticipants(parts);
        this._renderVideoGrid(parts);
      } catch(e) {}
    }, 5000);
  }

  async _leaveMeeting() {
    if (!this.currentMeeting) return;
    clearInterval(this._chatPollInterval);
    clearInterval(this._participantPollInterval);
    clearInterval(this._roomTimer);

    const isHost = this.currentMeeting.host_id === window.Auth?.user?.id;
    try {
      if (isHost) {
        if (confirm('You are the host. End meeting for all participants?')) {
          await API.post(`/comm/meetings/${this.currentMeeting.id}/end`);
          UI.showToast('Meeting ended', 'info');
        } else {
          await API.post(`/comm/meetings/${this.currentMeeting.id}/leave`);
        }
      } else {
        await API.post(`/comm/meetings/${this.currentMeeting.id}/leave`);
      }
    } catch(e) {}
    this.currentMeeting = null;
    document.getElementById('comm-room-modal')?.classList.add('hidden');
    this.renderHub();
  }

  _forceCloseRoom() {
    clearInterval(this._chatPollInterval);
    clearInterval(this._participantPollInterval);
    clearInterval(this._roomTimer);
    document.getElementById('comm-room-modal')?.classList.add('hidden');
  }

  /* ─── ROOM CONTROLS (Simulated) ─────────────────────────────── */
  _toggleVideo(btn) {
    const on = btn.textContent.includes('📷');
    btn.textContent = on ? '📷 Off' : '📷 Video';
    btn.style.opacity = on ? '0.5' : '1';
    UI.showToast(on ? 'Camera off' : 'Camera on', 'info');
  }
  _toggleMic(btn) {
    const on = btn.textContent.includes('🎤');
    btn.textContent = on ? '🎤 Muted' : '🎤 Mic';
    btn.style.opacity = on ? '0.5' : '1';
    UI.showToast(on ? 'Microphone muted' : 'Microphone on', 'info');
  }
  _toggleScreen(btn) {
    const overlay = document.getElementById('screen-share-overlay');
    const sharing = overlay?.classList.contains('hidden');
    overlay?.classList.toggle('hidden', !sharing);
    btn.textContent = sharing ? '🖥 Stop' : '🖥 Share';
    UI.showToast(sharing ? 'Screen sharing started (simulated)' : 'Screen sharing stopped', 'info');
  }

  /* ─── TIMER ─────────────────────────────────────────────────── */
  _startRoomTimer() {
    clearInterval(this._roomTimer);
    let secs = 0;
    const display = document.getElementById('room-timer');
    this._roomTimer = setInterval(() => {
      secs++;
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      if (display) display.textContent = `${m}:${s}`;
    }, 1000);
  }

  /* ─── HEARTBEAT (online presence) ──────────────────────────── */
  _heartbeat() {
    clearInterval(this.presenceInterval);
    API.post('/comm/presence', { status: 'online' }).catch(() => {});
    this.presenceInterval = setInterval(() => {
      API.post('/comm/presence', { status: 'online' }).catch(() => {});
    }, 30000);
  }

  /* ─── CLEANUP ───────────────────────────────────────────────── */
  destroy() {
    clearInterval(this.callPollInterval);
    clearInterval(this.presenceInterval);
    clearInterval(this._chatPollInterval);
    clearInterval(this._participantPollInterval);
    clearInterval(this._roomTimer);
    API.post('/comm/presence', { status: 'offline' }).catch(() => {});
  }
}

window.Comm = new CommunicationEngine();
