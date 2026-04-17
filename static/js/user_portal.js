window.UserPortal = {
    roles: [],
    users: [],

    renderHome: async function() {
        const container = document.getElementById('content-area');
        container.innerHTML = `<div style="text-align:center;padding:50px"><div class="skeleton-loader"><div class="sk-bar wide"></div></div></div>`;
        
        try {
            const [rolesRes, usersRes] = await Promise.all([
                API.get('/rbac/roles'),
                API.get('/auth/users')
            ]);
            this.roles = rolesRes.roles || [];
            this.users = usersRes.users || [];
            
            this.render();
        } catch(e) {
            container.innerHTML = `<div class="error-state">Error loading User Portal: ${e.message}</div>`;
        }
    },

    render: function() {
        const container = document.getElementById('content-area');
        let html = `
            <div class="glass-panel" style="margin-bottom: 25px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h2 class="section-title">Enterprise User Management</h2>
                        <p style="color:var(--text-muted);">Manage user access, roles, and permissions across the domain.</p>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button class="btn-secondary" onclick="UserPortal.openRoleBuilder()">🔐 Built-in & Custom Roles</button>
                        <button class="btn-primary" onclick="UserPortal.openAddUser()">+ Register User</button>
                        <button class="btn-secondary" onclick="UserPortal.renderHome()">🔄 Refresh</button>
                    </div>
                </div>
            </div>

            <div class="grid-4" style="margin-bottom: 20px;">
                <div class="kpi-card"><div class="kpi-label">Total Users</div><div class="kpi-val">${this.users.length}</div></div>
                <div class="kpi-card"><div class="kpi-label">Active Users</div><div class="kpi-val">${this.users.filter(u => u.status !== 'disabled').length}</div></div>
                <div class="kpi-card"><div class="kpi-label">Domain Admins</div><div class="kpi-val">${this.users.filter(u => this.getRoleLevel(u.role_id) === 4).length}</div></div>
                <div class="kpi-card"><div class="kpi-label">Custom Roles</div><div class="kpi-val">${this.roles.filter(r => !r.built_in).length}</div></div>
            </div>

            <div class="glass-panel">
                <table class="aura-table">
                    <thead>
                        <tr>
                            <th>User Details</th>
                            <th>Role / Access Level</th>
                            <th>Status</th>
                            <th>Last Activity</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (!this.users.length) {
            html += `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">No users found.</td></tr>`;
        } else {
            this.users.forEach(u => {
                const role = this.roles.find(r => r.id === u.role_id) || { name: 'Unknown', color: '#999', level: 1 };
                const isActive = u.status !== 'disabled';
                
                html += `
                    <tr>
                        <td>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div class="user-avatar" style="width:32px; height:32px; font-size:14px; flex-shrink:0;">${u.name.charAt(0).toUpperCase()}</div>
                                <div>
                                    <div style="font-weight:600; font-size:14px;">${u.name}</div>
                                    <div style="font-size:11px; color:var(--text-muted);">${u.email || u.username}</div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <span class="prio-tag" style="background:rgba(255,255,255,0.05); color:${role.color}; border: 1px solid ${role.color}40;">${role.name}</span>
                            <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">Level ${role.level}</div>
                        </td>
                        <td>
                            <span class="status-badge" style="background: ${isActive ? 'var(--accent-success)' : 'var(--glass-border)'}20; color: ${isActive ? 'var(--accent-success)' : '#777'};">
                                ${isActive ? 'Active' : 'Disabled'}
                            </span>
                        </td>
                        <td>${u.last_login ? UI.formatDate(u.last_login) : 'Never'}</td>
                        <td class="action-cell">
                            <button class="btn-icon" onclick="UserPortal.openEditUser(${u.id})" title="Edit Role">⚙️</button>
                            <button class="btn-icon" onclick="UserPortal.toggleStatus(${u.id}, '${isActive ? 'disabled' : 'active'}')" title="${isActive ? 'Disable User' : 'Enable User'}">${isActive ? '🚫' : '✅'}</button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `</tbody></table></div>`;
        container.innerHTML = html;
        this.injectModals();
    },

    getRoleLevel: function(roleId) {
        const r = this.roles.find(r => r.id === roleId);
        return r ? r.level : 1;
    },

    injectModals: function() {
        if (!document.getElementById('up-modals')) {
            const div = document.createElement('div');
            div.id = 'up-modals';
            document.body.appendChild(div);
        }
        
        const roleOptions = this.roles.map(r => `<option value="${r.id}">${r.name} (Level ${r.level})</option>`).join('');
        
        document.getElementById('up-modals').innerHTML = `
            <!-- Add User Modal -->
            <div id="modal-add-user" class="modal hidden">
                <div class="modal-backdrop" onclick="UserPortal.closeModals()"></div>
                <div class="modal-box">
                    <div class="modal-header">
                        <h3>Register New User</h3>
                        <button class="modal-close" onclick="UserPortal.closeModals()">✕</button>
                    </div>
                    <div class="modal-body" style="display:flex; flex-direction:column; gap:15px;">
                        <div>
                           <label>Full Name</label>
                           <input type="text" id="add-user-name" class="aura-input" placeholder="e.g. Liam Smith"/>
                        </div>
                        <div>
                           <label>Username / Email</label>
                           <input type="text" id="add-user-email" class="aura-input" placeholder="e.g. liam@aura.com"/>
                        </div>
                        <div>
                           <label>Password</label>
                           <input type="password" id="add-user-pass" class="aura-input" placeholder="Secret password"/>
                        </div>
                        <button class="btn-primary" onclick="UserPortal.submitAddUser()">Register User</button>
                    </div>
                </div>
            </div>

            <!-- Edit User Modal -->
            <div id="modal-edit-user" class="modal hidden">
                <div class="modal-backdrop" onclick="UserPortal.closeModals()"></div>
                <div class="modal-box">
                    <div class="modal-header">
                        <h3>Assign Role</h3>
                        <button class="modal-close" onclick="UserPortal.closeModals()">✕</button>
                    </div>
                    <div class="modal-body" style="display:flex; flex-direction:column; gap:15px;">
                        <input type="hidden" id="edit-user-id" />
                        <div>
                           <label>Assign Role</label>
                           <select id="edit-user-role" class="aura-input">
                              ${roleOptions}
                           </select>
                        </div>
                        <button class="btn-primary" onclick="UserPortal.submitEditUser()">Save Assignment</button>
                    </div>
                </div>
            </div>

            <!-- Role Builder Modal -->
            <div id="modal-role-builder" class="modal hidden">
                <div class="modal-backdrop" onclick="UserPortal.closeModals()"></div>
                <div class="modal-box" style="max-width:800px;">
                    <div class="modal-header">
                        <h3>Role & Permissions Builder</h3>
                        <button class="modal-close" onclick="UserPortal.closeModals()">✕</button>
                    </div>
                    <div class="modal-body">
                        <div style="display:flex; gap:20px;">
                            <!-- Left sidebar: Roles List -->
                            <div style="flex:1; border-right:1px solid var(--glass-border); padding-right:15px;">
                                <h4 style="margin-top:0;">Existing Roles</h4>
                                <div id="rb-role-list" style="max-height:400px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
                                   ${this.roles.map(r => `
                                     <div style="padding:10px; border:1px solid var(--glass-border); border-radius:5px; background:rgba(255,255,255,0.02); display:flex; justify-content:space-between; align-items:center;">
                                        <div>
                                            <div style="font-weight:600; font-size:13px; color:${r.color}">${r.name}</div>
                                            <div style="font-size:11px; color:var(--text-muted)">Level ${r.level}</div>
                                        </div>
                                     </div>
                                   `).join('')}
                                </div>
                            </div>
                            
                            <!-- Right area: Create new role -->
                            <div style="flex:2;">
                                <h4 style="margin-top:0;">Create Custom Role</h4>
                                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
                                    <div><label>Role Name</label><input type="text" id="new-role-name" class="aura-input" placeholder="e.g. Sales Manager"/></div>
                                    <div><label>Role Color (Hex)</label><input type="text" id="new-role-color" class="aura-input" placeholder="#a78bfa" value="#a78bfa"/></div>
                                    <div><label>Role Level (1-4)</label><input type="number" id="new-role-level" class="aura-input" min="1" max="4" value="2"/></div>
                                </div>
                                <label>Permissions Array (JSON Array per Module)</label>
                                <textarea id="new-role-perms" class="aura-input" rows="8" style="font-family:monospace; font-size:12px;">{
  "Data": ["view", "add", "edit"],
  "Analytics": ["view"],
  "Campaigns": ["create"]
}</textarea>
                                <div style="margin-top:15px; text-align:right;">
                                    <button class="btn-primary" onclick="UserPortal.submitNewRole()">Create Role</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    openAddUser: function() {
        document.getElementById('modal-add-user').classList.remove('hidden');
    },
    
    openEditUser: function(userId) {
        const u = this.users.find(x => x.id === userId);
        if (!u) return;
        document.getElementById('edit-user-id').value = u.id;
        document.getElementById('edit-user-role').value = u.role_id;
        document.getElementById('modal-edit-user').classList.remove('hidden');
    },

    openRoleBuilder: function() {
        document.getElementById('modal-role-builder').classList.remove('hidden');
    },

    closeModals: function() {
        document.querySelectorAll('#up-modals .modal').forEach(m => m.classList.add('hidden'));
    },

    submitAddUser: async function() {
        const name = document.getElementById('add-user-name').value.trim();
        const email = document.getElementById('add-user-email').value.trim();
        const pass = document.getElementById('add-user-pass').value.trim();
        
        if (!name || !email || !pass) return UI.showToast("Please fill all fields", "error");
        
        try {
            await API.post('/auth/register', {
                name: name,
                username: email,
                email: email,
                password: pass,
                domain: Auth.domain.id
            });
            UI.showToast("User registered successfully", "success");
            this.closeModals();
            this.renderHome();
        } catch(e) {
            UI.showToast(e.message, "error");
        }
    },

    submitEditUser: async function() {
        const id = document.getElementById('edit-user-id').value;
        const role_id = document.getElementById('edit-user-role').value;
        
        try {
            await API.put(`/rbac/users/${id}/role`, { role_id });
            UI.showToast("Role updated", "success");
            this.closeModals();
            this.renderHome();
        } catch(e) {
            UI.showToast(e.message, "error");
        }
    },

    toggleStatus: async function(id, status) {
        if (!confirm(`Are you sure you want to change this user's status to ${status}?`)) return;
        try {
            await API.put(`/rbac/users/${id}/status`, { status });
            UI.showToast(`User status updated to ${status}`, "success");
            this.renderHome();
        } catch(e) {
            UI.showToast(e.message, "error");
        }
    },

    submitNewRole: async function() {
        const name = document.getElementById('new-role-name').value.trim();
        const color = document.getElementById('new-role-color').value.trim();
        const level = document.getElementById('new-role-level').value;
        let perms = {};
        
        try {
            perms = JSON.parse(document.getElementById('new-role-perms').value.trim());
        } catch(e) {
            return UI.showToast("Invalid JSON in permissions", "error");
        }
        
        if (!name) return UI.showToast("Role name is required", "error");
        
        try {
            await API.post('/rbac/roles', {
                name, color, level, permissions: perms
            });
            UI.showToast("Role created successfully", "success");
            this.closeModals();
            this.renderHome();
        } catch(e) {
            UI.showToast(e.message, "error");
        }
    }
};
