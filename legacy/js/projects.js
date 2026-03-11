// Projects Page JavaScript

let projectsData = [];
let clientsData = [];
let peopleData = [];
let currentProjectId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    loadClients();
    loadPeople();

    // Check for project ID in URL
    const projectId = app.getQueryParam('id');
    if (projectId) {
        viewProject(projectId);
    }

    // Filters
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('platformFilter').addEventListener('change', applyFilters);
});

async function loadProjects() {
    try {
        app.showLoading('projectsTable');
        projectsData = await db.projects.getAll();
        renderProjects(projectsData);
    } catch (error) {
        console.error('Error loading projects:', error);
        app.showError('projectsTable', 'Failed to load projects');
    }
}

async function loadClients() {
    try {
        const clients = await db.clients.getAll();
        clientsData = clients;
        const select = document.getElementById('clientSelect');
        select.innerHTML = '<option value="">Select client...</option>' +
            clients.map(c => `<option value="${c.id}">${c.client_name}</option>`).join('');
    } catch (error) {
        console.error('Error loading clients:', error);
    }
}

async function loadPeople() {
    try {
        const people = await db.people.getActive();
        peopleData = people.filter(p => p.role !== 'Founder'); // Only contractors/employees
        const select = document.getElementById('developerSelect');
        select.innerHTML = '<option value="">Select developer...</option>' +
            peopleData.map(p => `<option value="${p.id}">${p.name} (${p.role})</option>`).join('');
    } catch (error) {
        console.error('Error loading people:', error);
    }
}

function renderProjects(projects) {
    const tbody = document.getElementById('projectsTable');

    if (!projects || projects.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="empty-state-icon">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                        <p class="empty-state-title">No projects yet</p>
                        <p class="empty-state-description">Create your first project to start tracking</p>
                        <button class="btn btn-primary" onclick="openAddModal()">Add Project</button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = projects.map(project => {
        const totalReceived = parseFloat(project.total_received) || 0;
        const totalDevPayments = parseFloat(project.total_dev_payments) || 0;
        const profit = totalReceived - totalDevPayments;
        const profitClass = profit >= 0 ? 'text-success' : 'text-error';

        return `
            <tr>
                <td>
                    <div>
                        <div class="font-medium">${project.project_name}</div>
                        <div class="text-sm text-muted">${project.status || 'Active'}</div>
                    </div>
                </td>
                <td>${project.client_name || '-'}</td>
                <td><span class="badge ${app.getStatusBadge(project.status)}">${project.status}</span></td>
                <td><span class="badge badge-neutral">${project.platform || 'N/A'}</span></td>
                <td class="text-right">${app.formatCurrency(project.total_agreed_amount)}</td>
                <td class="text-right">${app.formatCurrency(totalReceived)}</td>
                <td class="text-right">${app.formatCurrency(totalDevPayments)}</td>
                <td class="text-right font-medium ${profitClass}">${app.formatCurrency(profit)}</td>
                <td>
                    <div class="flex gap-sm">
                        <button class="btn btn-sm btn-ghost" onclick="viewProject('${project.id}')" title="View">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                        </button>
                        <button class="btn btn-sm btn-ghost" onclick="editProject('${project.id}')" title="Edit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="btn btn-sm btn-ghost text-error" onclick="deleteProject('${project.id}')" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function applyFilters() {
    const status = document.getElementById('statusFilter').value;
    const platform = document.getElementById('platformFilter').value;

    let filtered = [...projectsData];

    if (status) {
        filtered = filtered.filter(p => p.status === status);
    }
    if (platform) {
        filtered = filtered.filter(p => p.platform === platform);
    }

    renderProjects(filtered);
}

function openAddModal() {
    currentProjectId = null;
    document.getElementById('modalTitle').textContent = 'Add Project';
    app.resetForm('projectForm');
    app.showModal('projectModal');
}

async function editProject(id) {
    try {
        currentProjectId = id;
        const project = await db.projects.getById(id);
        document.getElementById('modalTitle').textContent = 'Edit Project';
        app.populateForm('projectForm', project);
        app.showModal('projectModal');
    } catch (error) {
        console.error('Error loading project:', error);
        app.showToast('Failed to load project', 'error');
    }
}

async function viewProject(id) {
    try {
        currentProjectId = id;
        const project = await db.projects.getById(id);
        const devPayments = await db.projects.getDeveloperPayments(id);
        const transactions = await db.transactions.getByProject(id);

        document.getElementById('viewProjectName').textContent = project.project_name;

        const content = document.getElementById('viewProjectContent');
        const profit = parseFloat(transactions.filter(t => t.type === 'Revenue').reduce((sum, t) => sum + parseFloat(t.amount), 0)) -
            parseFloat(transactions.filter(t => t.type !== 'Revenue').reduce((sum, t) => sum + parseFloat(t.amount), 0));

        content.innerHTML = `
            <!-- Project KPIs -->
            <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 24px;">
                <div class="kpi-card">
                    <div class="kpi-label">Client</div>
                    <div class="font-semibold mt-sm">${project.clients?.client_name || '-'}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Agreed Amount</div>
                    <div class="kpi-value" style="font-size: 1.25rem;">${app.formatCurrency(project.total_agreed_amount)}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Received</div>
                    <div class="kpi-value text-success" style="font-size: 1.25rem;">${app.formatCurrency(transactions.filter(t => t.type === 'Revenue').reduce((sum, t) => sum + parseFloat(t.amount), 0))}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Profit</div>
                    <div class="kpi-value ${profit >= 0 ? 'text-success' : 'text-error'}" style="font-size: 1.25rem;">${app.formatCurrency(profit)}</div>
                </div>
            </div>
            
            <div class="flex justify-between items-center mb-md">
                <span class="badge ${app.getStatusBadge(project.status)}">${project.status}</span>
                <span class="badge ${app.getPlatformBadge(project.platform)}">${project.platform}</span>
                <span class="text-sm text-muted">Created: ${app.formatDate(project.created_at)}</span>
            </div>
            
            <!-- Developer Payments Section -->
            <div class="card mb-lg">
                <div class="card-header">
                    <h4 class="card-title">Developer Payments</h4>
                    <button class="btn btn-sm btn-primary" onclick="openAssignModal('${id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Assign Dev
                    </button>
                </div>
                <div class="card-body">
                    ${devPayments && devPayments.length > 0 ? `
                        <table class="table" style="margin: -16px;">
                            <thead>
                                <tr>
                                    <th>Developer</th>
                                    <th class="text-right">Agreed</th>
                                    <th class="text-right">Paid</th>
                                    <th class="text-right">Remaining</th>
                                    <th>Progress</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${devPayments.map(dp => {
            const paid = parseFloat(dp.total_paid) || 0;
            const agreed = parseFloat(dp.agreed_amount) || 0;
            const remaining = parseFloat(dp.balance) || 0;
            const percent = agreed > 0 ? (paid / agreed) * 100 : 0;
            const statusClass = percent >= 100 ? 'success' : percent > 0 ? 'warning' : '';

            return `
                                        <tr>
                                            <td class="font-medium">${dp.person_name}</td>
                                            <td class="text-right">${app.formatCurrency(agreed)}</td>
                                            <td class="text-right text-success">${app.formatCurrency(paid)}</td>
                                            <td class="text-right ${remaining > 0 ? 'text-warning' : ''}">${app.formatCurrency(remaining)}</td>
                                            <td style="width: 120px;">
                                                <div class="progress-bar">
                                                    <div class="progress-bar-fill ${statusClass}" style="width: ${Math.min(percent, 100)}%"></div>
                                                </div>
                                            </td>
                                            <td>
                                                ${percent >= 100
                    ? '<span class="badge badge-success">✓ Paid</span>'
                    : '<span class="badge badge-warning">Pending</span>'}
                                            </td>
                                        </tr>
                                    `;
        }).join('')}
                            </tbody>
                        </table>
                    ` : '<p class="text-muted text-center">No developers assigned yet</p>'}
                </div>
            </div>
            
            <!-- Transactions Section -->
            <div class="card">
                <div class="card-header">
                    <h4 class="card-title">Transactions</h4>
                    <a href="transactions.html?project=${id}" class="btn btn-sm btn-ghost">Add Transaction</a>
                </div>
                <div class="card-body">
                    ${transactions && transactions.length > 0 ? `
                        <table class="table" style="margin: -16px;">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Person</th>
                                    <th>Description</th>
                                    <th class="text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${transactions.map(t => `
                                    <tr>
                                        <td>${app.formatDateShort(t.date)}</td>
                                        <td><span class="badge ${app.getTypeBadge(t.type)}">${t.type}</span></td>
                                        <td>${t.people?.name || '-'}</td>
                                        <td class="text-muted">${t.description || '-'}</td>
                                        <td class="text-right font-medium ${t.type === 'Revenue' ? 'text-success' : ''}">
                                            ${t.type === 'Revenue' ? '+' : '-'}${app.formatCurrency(t.amount)}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p class="text-muted text-center">No transactions yet</p>'}
                </div>
            </div>
        `;

        app.showModal('viewProjectModal');
    } catch (error) {
        console.error('Error viewing project:', error);
        app.showToast('Failed to load project details', 'error');
    }
}

async function saveProject() {
    try {
        const formData = app.getFormData('projectForm');

        if (!formData.project_name || !formData.client_id) {
            app.showToast('Project name and client are required', 'warning');
            return;
        }

        if (currentProjectId) {
            await db.projects.update(currentProjectId, formData);
            app.showToast('Project updated successfully', 'success');
        } else {
            await db.projects.create(formData);
            app.showToast('Project created successfully', 'success');
        }

        closeModal();
        loadProjects();
    } catch (error) {
        console.error('Error saving project:', error);
        app.showToast('Failed to save project', 'error');
    }
}

async function deleteProject(id) {
    if (!confirm('Are you sure you want to delete this project? This will also delete all associated transactions.')) {
        return;
    }

    try {
        await db.projects.delete(id);
        app.showToast('Project deleted successfully', 'success');
        loadProjects();
    } catch (error) {
        console.error('Error deleting project:', error);
        app.showToast('Failed to delete project', 'error');
    }
}

function openAssignModal(projectId) {
    document.getElementById('assignProjectId').value = projectId;
    app.resetForm('assignDevForm');
    document.getElementById('assignProjectId').value = projectId;
    app.showModal('assignDevModal');
}

async function assignDeveloper() {
    try {
        const formData = app.getFormData('assignDevForm');

        if (!formData.person_id || !formData.agreed_amount) {
            app.showToast('Developer and agreed amount are required', 'warning');
            return;
        }

        await db.projectDevelopers.assign(formData.project_id, formData.person_id, formData.agreed_amount);
        app.showToast('Developer assigned successfully', 'success');

        closeAssignModal();
        viewProject(formData.project_id);
    } catch (error) {
        console.error('Error assigning developer:', error);
        app.showToast('Failed to assign developer', 'error');
    }
}

function closeModal() {
    app.hideModal('projectModal');
}

function closeViewModal() {
    app.hideModal('viewProjectModal');
}

function closeAssignModal() {
    app.hideModal('assignDevModal');
}
