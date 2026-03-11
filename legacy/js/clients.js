// Clients Page JavaScript

let clientsData = [];
let currentClientId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadClients();

    // Search functionality
    document.getElementById('searchInput').addEventListener('input',
        app.debounce((e) => filterClients(e.target.value), 300)
    );
});

async function loadClients() {
    try {
        app.showLoading('clientsTable');
        clientsData = await db.clients.getWithFinancials();
        renderClients(clientsData);
    } catch (error) {
        console.error('Error loading clients:', error);
        app.showError('clientsTable', 'Failed to load clients');
    }
}

function renderClients(clients) {
    const tbody = document.getElementById('clientsTable');

    if (!clients || clients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="empty-state-icon">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                        </svg>
                        <p class="empty-state-title">No clients yet</p>
                        <p class="empty-state-description">Add your first client to get started</p>
                        <button class="btn btn-primary" onclick="openAddModal()">Add Client</button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = clients.map(client => `
        <tr>
            <td>
                <div class="flex items-center gap-sm">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--color-primary); color: var(--color-primary-dark); display: flex; align-items: center; justify-content: center; font-weight: 600;">
                        ${client.client_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="font-medium">${client.client_name}</div>
                        <div class="text-sm text-muted">${client.contact_info || 'No contact info'}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge ${app.getStatusBadge(client.status)}">${client.status}</span></td>
            <td>${client.total_projects || 0} projects</td>
            <td class="text-right font-medium">${app.formatCurrency(client.total_revenue)}</td>
            <td class="text-right">-</td>
            <td>
                <div class="flex gap-sm">
                    <button class="btn btn-sm btn-ghost" onclick="viewClient('${client.id}')" title="View">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="editClient('${client.id}')" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-ghost text-error" onclick="deleteClient('${client.id}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function filterClients(searchTerm) {
    const filtered = app.filterTable(clientsData, searchTerm, ['client_name', 'contact_info']);
    renderClients(filtered);
}

function openAddModal() {
    currentClientId = null;
    document.getElementById('modalTitle').textContent = 'Add Client';
    app.resetForm('clientForm');
    app.showModal('clientModal');
}

async function editClient(id) {
    try {
        currentClientId = id;
        const client = await db.clients.getById(id);
        document.getElementById('modalTitle').textContent = 'Edit Client';
        app.populateForm('clientForm', client);
        app.showModal('clientModal');
    } catch (error) {
        console.error('Error loading client:', error);
        app.showToast('Failed to load client', 'error');
    }
}

async function viewClient(id) {
    try {
        const client = await db.clients.getById(id);
        const projects = await db.projects.getByClient(id);

        document.getElementById('viewClientName').textContent = client.client_name;

        const content = document.getElementById('viewClientContent');
        content.innerHTML = `
            <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 24px;">
                <div class="kpi-card">
                    <div class="kpi-label">Status</div>
                    <div class="mt-sm"><span class="badge ${app.getStatusBadge(client.status)}">${client.status}</span></div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Total Paid</div>
                    <div class="kpi-value" style="font-size: 1.5rem;">${app.formatCurrency(projects.reduce((sum, p) => sum + parseFloat(p.total_received || 0), 0))}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Amount Owed</div>
                    <div class="kpi-value text-success" style="font-size: 1.5rem;">${app.formatCurrency(projects.reduce((sum, p) => sum + parseFloat(p.amount_owed || 0), 0))}</div>
                </div>
            </div>
            
            <h4 style="margin-bottom: 12px;">Contact Info</h4>
            <p class="text-secondary" style="margin-bottom: 24px;">${client.contact_info || 'No contact information'}</p>
            
            <h4 style="margin-bottom: 12px;">Projects (${projects.length})</h4>
            ${projects.length > 0 ? `
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th>Status</th>
                                <th class="text-right">Agreed</th>
                                <th class="text-right">Received</th>
                                <th class="text-right">Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${projects.map(p => `
                                <tr>
                                    <td>
                                        <a href="projects.html?id=${p.id}" class="font-medium" style="color: var(--color-accent);">${p.project_name}</a>
                                    </td>
                                    <td><span class="badge ${app.getStatusBadge(p.status)}">${p.status}</span></td>
                                    <td class="text-right">${app.formatCurrency(p.total_agreed_amount)}</td>
                                    <td class="text-right">${app.formatCurrency(p.total_received)}</td>
                                    <td class="text-right ${parseFloat(p.profit) >= 0 ? 'text-success' : 'text-error'}">${app.formatCurrency(p.profit)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p class="text-muted">No projects yet</p>'}
        `;

        app.showModal('viewClientModal');
    } catch (error) {
        console.error('Error viewing client:', error);
        app.showToast('Failed to load client details', 'error');
    }
}

async function saveClient() {
    try {
        const formData = app.getFormData('clientForm');

        if (!formData.client_name) {
            app.showToast('Client name is required', 'warning');
            return;
        }

        if (currentClientId) {
            await db.clients.update(currentClientId, formData);
            app.showToast('Client updated successfully', 'success');
        } else {
            await db.clients.create(formData);
            app.showToast('Client created successfully', 'success');
        }

        closeModal();
        loadClients();
    } catch (error) {
        console.error('Error saving client:', error);
        app.showToast('Failed to save client', 'error');
    }
}

async function deleteClient(id) {
    if (!confirm('Are you sure you want to delete this client? This will also delete all associated projects and transactions.')) {
        return;
    }

    try {
        await db.clients.delete(id);
        app.showToast('Client deleted successfully', 'success');
        loadClients();
    } catch (error) {
        console.error('Error deleting client:', error);
        app.showToast('Failed to delete client', 'error');
    }
}

function closeModal() {
    app.hideModal('clientModal');
}

function closeViewModal() {
    app.hideModal('viewClientModal');
}
