// users.js - Complete with mobile support
document.addEventListener('DOMContentLoaded', function() {
    loadUsers();
    setupMobileTable();
    
    document.getElementById('addUserBtn').addEventListener('click', showAddUserModal);
    document.getElementById('userForm').addEventListener('submit', saveUser);
});

function setupMobileTable() {
    // Make table responsive on mobile
    const table = document.getElementById('usersTable');
    if (window.innerWidth < 768) {
        table.classList.add('mobile-table');
        
        // Convert table rows to cards on mobile
        convertTableToCards();
    }
    
    // Re-convert on window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth < 768) {
            convertTableToCards();
        } else {
            revertTableFromCards();
        }
    });
}

async function loadUsers() {
    try {
        showLoading('usersTableBody');
        
        const { data: users, error } = await supabaseClient
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (window.innerWidth < 768) {
            renderUsersCards(users);
        } else {
            renderUsersTable(users);
        }
        
    } catch (error) {
        console.error('Error loading users:', error);
        showError('usersTableBody', 'Failed to load users');
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem;">
                    <div style="font-size: 2rem; margin-bottom: 1rem;">👥</div>
                    <p>No users found</p>
                    <button onclick="showAddUserModal()" class="btn btn-primary" style="margin-top: 1rem;">Add First User</button>
                </td>
            </tr>
        `;
        return;
    }
    
    let rowsHTML = '';
    
    users.forEach(user => {
        rowsHTML += `
            <tr>
                <td><strong>${user.employee_id}</strong></td>
                <td>${user.full_name}</td>
                <td>${user.email}</td>
                <td>${user.department}</td>
                <td>
                    <span class="status-badge ${getRoleBadgeClass(user.role)}">
                        ${user.role}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${user.is_active ? 'status-on-track' : 'status-delayed'}">
                        ${user.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button onclick="editUser('${user.id}')" class="btn btn-outline btn-sm">
                            Edit
                        </button>
                        <button onclick="toggleUserStatus('${user.id}', ${user.is_active})" 
                                class="btn ${user.is_active ? 'btn-warning' : 'btn-success'} btn-sm">
                            ${user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = rowsHTML;
}

function renderUsersCards(users) {
    const container = document.getElementById('usersTableBody');
    container.innerHTML = ''; // Clear existing content
    
    if (users.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 2rem; margin-bottom: 1rem;">👥</div>
                <p>No users found</p>
                <button onclick="showAddUserModal()" class="btn btn-primary" style="margin-top: 1rem;">Add First User</button>
            </div>
        `;
        return;
    }
    
    users.forEach(user => {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 1.25rem;
            margin-bottom: 1rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <div>
                    <h4 style="margin: 0 0 0.25rem 0;">${user.full_name}</h4>
                    <p style="margin: 0; color: var(--secondary-color); font-size: 0.875rem;">${user.employee_id}</p>
                </div>
                <span class="status-badge ${user.is_active ? 'status-on-track' : 'status-delayed'}">
                    ${user.is_active ? 'Active' : 'Inactive'}
                </span>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <span style="color: var(--secondary-color);">📧</span>
                    <span>${user.email}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <span style="color: var(--secondary-color);">🏢</span>
                    <span>${user.department}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="color: var(--secondary-color);">👑</span>
                    <span class="status-badge ${getRoleBadgeClass(user.role)}">
                        ${user.role}
                    </span>
                </div>
            </div>
            
            <div style="display: flex; gap: 0.5rem;">
                <button onclick="editUser('${user.id}')" class="btn btn-outline" style="flex: 1;">Edit</button>
                <button onclick="toggleUserStatus('${user.id}', ${user.is_active})" 
                        class="btn ${user.is_active ? 'btn-warning' : 'btn-success'}" style="flex: 1;">
                    ${user.is_active ? 'Deactivate' : 'Activate'}
                </button>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function getRoleBadgeClass(role) {
    const classes = {
        'Admin': 'status-delayed',
        'Engineering': 'status-pending',
        'Tool Room': 'status-pending',
        'QA': 'status-on-track',
        'Production': 'status-on-track',
        'Management': 'status-completed'
    };
    
    return classes[role] || 'status-pending';
}

function showAddUserModal() {
    document.getElementById('userModalTitle').textContent = 'Add New User';
    document.getElementById('userId').value = '';
    document.getElementById('userForm').reset();
    document.getElementById('userModal').style.display = 'flex';
}

function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
}

async function saveUser(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userId = document.getElementById('userId').value;
    
    const userData = {
        employee_id: formData.get('employee_id'),
        full_name: formData.get('full_name'),
        email: formData.get('email'),
        department: formData.get('department'),
        role: formData.get('role'),
        is_active: formData.get('is_active') === 'on'
    };
    
    try {
        if (userId) {
            // Update existing user
            const { error } = await supabaseClient
                .from('users')
                .update(userData)
                .eq('id', userId);
            
            if (error) throw error;
            
            showToast('User updated successfully!');
        } else {
            // Insert new user
            const { error } = await supabaseClient
                .from('users')
                .insert([userData]);
            
            if (error) throw error;
            
            showToast('User added successfully!');
        }
        
        closeUserModal();
        loadUsers();
        
    } catch (error) {
        console.error('Error saving user:', error);
        alert('Error saving user: ' + error.message);
    }
}

async function editUser(userId) {
    try {
        const { data: user, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        
        document.getElementById('userModalTitle').textContent = 'Edit User';
        document.getElementById('userId').value = user.id;
        document.getElementById('employee_id').value = user.employee_id;
        document.getElementById('full_name').value = user.full_name;
        document.getElementById('email').value = user.email;
        document.getElementById('department').value = user.department;
        document.getElementById('role').value = user.role;
        document.getElementById('is_active').checked = user.is_active;
        
        document.getElementById('userModal').style.display = 'flex';
        
    } catch (error) {
        console.error('Error loading user:', error);
        alert('Error loading user details');
    }
}

async function toggleUserStatus(userId, currentStatus) {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this user?`)) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('users')
            .update({ is_active: !currentStatus })
            .eq('id', userId);
        
        if (error) throw error;
        
        showToast(`User ${currentStatus ? 'deactivated' : 'activated'} successfully!`);
        loadUsers();
        
    } catch (error) {
        console.error('Error updating user status:', error);
        alert('Error updating user status');
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showLoading(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 2rem;">
                <div style="display: inline-block; width: 30px; height: 30px; border: 3px solid var(--border-color); border-top-color: var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top: 1rem; color: var(--secondary-color);">Loading users...</p>
            </td>
        </tr>
    `;
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger-color);">
                <div style="font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
                <p>${message}</p>
                <button onclick="loadUsers()" class="btn btn-outline" style="margin-top: 1rem;">Retry</button>
            </td>
        </tr>
    `;
}

function convertTableToCards() {
    // This function converts table to cards on mobile
    // Implementation depends on your table structure
}

function revertTableFromCards() {
    // This function reverts cards back to table
}