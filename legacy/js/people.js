// People Page JavaScript

let peopleData = [];
let currentPersonId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadPeople();

    // Role filter
    document.getElementById('roleFilter').addEventListener('change', (e) => {
        filterPeople(e.target.value);
    });
});

async function loadPeople() {
    try {
        app.showLoading('peopleTable');
        peopleData = await db.people.getWithFinancials();
        renderPeople(peopleData);
        updateSummary(peopleData);
    } catch (error) {
        console.error('Error loading people:', error);
        app.showError('peopleTable', 'Failed to load people');
    }
}

function updateSummary(people) {
    document.getElementById('totalPeople').textContent = people.length;

    const totalPaid = people.reduce((sum, p) => sum + parseFloat(p.total_paid || 0), 0);
    document.getElementById('totalPaid').textContent = app.formatCurrency(totalPaid);

    const totalPending = people.reduce((sum, p) => sum + parseFloat(p.total_pending || 0), 0);
    document.getElementById('totalPending').textContent = app.formatCurrency(totalPending);
}

function renderPeople(people) {
    const tbody = document.getElementById('peopleTable');

    if (!people || people.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="empty-state-icon">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                        <p class="empty-state-title">No team members yet</p>
                        <p class="empty-state-description">Add your first team member to get started</p>
                        <button class="btn btn-primary" onclick="openAddModal()">Add Person</button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = people.map(person => `
        <tr>
            <td>
                <div class="flex items-center gap-sm">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: ${person.role === 'Founder' ? 'var(--color-accent)' : 'var(--color-primary)'}; color: ${person.role === 'Founder' ? 'white' : 'var(--color-primary-dark)'}; display: flex; align-items: center; justify-content: center; font-weight: 600;">
                        ${person.name.charAt(0).toUpperCase()}
                    </div>
                    <span class="font-medium">${person.name}</span>
                </div>
            </td>
            <td><span class="badge ${app.getRoleBadge(person.role)}">${person.role}</span></td>
            <td class="text-muted">${person.payment_type || '-'}</td>
            <td>${person.standard_rate ? app.formatCurrency(person.standard_rate) : '-'}</td>
            <td class="text-right font-medium text-success">${app.formatCurrency(person.total_paid)}</td>
            <td class="text-right ${parseFloat(person.total_pending) > 0 ? 'text-warning font-medium' : 'text-muted'}">
                ${parseFloat(person.total_pending) > 0 ? app.formatCurrency(person.total_pending) : '-'}
            </td>
            <td>
                ${person.is_active
            ? '<span class="badge badge-success">Active</span>'
            : '<span class="badge badge-neutral">Inactive</span>'}
            </td>
            <td>
                <div class="flex gap-sm">
                    <button class="btn btn-sm btn-ghost" onclick="viewPerson('${person.id}')" title="View">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="editPerson('${person.id}')" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-ghost text-error" onclick="deletePerson('${person.id}')" title="Delete">
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

function filterPeople(role) {
    if (!role) {
        renderPeople(peopleData);
        updateSummary(peopleData);
    } else {
        const filtered = peopleData.filter(p => p.role === role);
        renderPeople(filtered);
        updateSummary(filtered);
    }
}

function openAddModal() {
    currentPersonId = null;
    document.getElementById('modalTitle').textContent = 'Add Person';
    app.resetForm('personForm');
    app.showModal('personModal');
}

async function editPerson(id) {
    try {
        currentPersonId = id;
        const person = await db.people.getById(id);
        document.getElementById('modalTitle').textContent = 'Edit Person';
        app.populateForm('personForm', {
            ...person,
            is_active: person.is_active ? 'true' : 'false'
        });
        app.showModal('personModal');
    } catch (error) {
        console.error('Error loading person:', error);
        app.showToast('Failed to load person', 'error');
    }
}

async function viewPerson(id) {
    try {
        const person = await db.people.getById(id);
        const transactions = await db.transactions.getByPerson(id);

        document.getElementById('viewPersonName').textContent = person.name;

        // Calculate totals
        const totalPaid = transactions.filter(t => t.payment_status === 'Paid').reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const totalPending = transactions.filter(t => t.payment_status === 'Pending').reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const content = document.getElementById('viewPersonContent');
        content.innerHTML = `
            <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 24px;">
                <div class="kpi-card">
                    <div class="kpi-label">Role</div>
                    <div class="mt-sm"><span class="badge ${app.getRoleBadge(person.role)}">${person.role}</span></div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Total Paid</div>
                    <div class="kpi-value text-success" style="font-size: 1.5rem;">${app.formatCurrency(totalPaid)}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Pending</div>
                    <div class="kpi-value text-warning" style="font-size: 1.5rem;">${app.formatCurrency(totalPending)}</div>
                </div>
            </div>
            
            <div class="flex gap-lg mb-lg">
                <div>
                    <span class="text-sm text-muted">Payment Type:</span>
                    <span class="font-medium">${person.payment_type || '-'}</span>
                </div>
                <div>
                    <span class="text-sm text-muted">Standard Rate:</span>
                    <span class="font-medium">${person.standard_rate ? app.formatCurrency(person.standard_rate) : '-'}</span>
                </div>
                <div>
                    <span class="text-sm text-muted">Status:</span>
                    ${person.is_active
                ? '<span class="badge badge-success">Active</span>'
                : '<span class="badge badge-neutral">Inactive</span>'}
                </div>
            </div>
            
            <h4 style="margin-bottom: 12px;">Payment History</h4>
            ${transactions && transactions.length > 0 ? `
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Project</th>
                                <th>Status</th>
                                <th class="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transactions.map(t => `
                                <tr>
                                    <td>${app.formatDateShort(t.date)}</td>
                                    <td><span class="badge ${app.getTypeBadge(t.type)}">${t.type}</span></td>
                                    <td>${t.projects?.project_name || '-'}</td>
                                    <td><span class="badge ${app.getStatusBadge(t.payment_status)}">${t.payment_status}</span></td>
                                    <td class="text-right font-medium">${app.formatCurrency(t.amount)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p class="text-muted">No payment history</p>'}
        `;

        app.showModal('viewPersonModal');
    } catch (error) {
        console.error('Error viewing person:', error);
        app.showToast('Failed to load person details', 'error');
    }
}

async function savePerson() {
    try {
        const formData = app.getFormData('personForm');

        if (!formData.name) {
            app.showToast('Name is required', 'warning');
            return;
        }

        // Convert is_active to boolean
        formData.is_active = formData.is_active === 'true';

        if (currentPersonId) {
            await db.people.update(currentPersonId, formData);
            app.showToast('Person updated successfully', 'success');
        } else {
            await db.people.create(formData);
            app.showToast('Person created successfully', 'success');
        }

        closeModal();
        loadPeople();
    } catch (error) {
        console.error('Error saving person:', error);
        app.showToast('Failed to save person', 'error');
    }
}

async function deletePerson(id) {
    if (!confirm('Are you sure you want to delete this person?')) {
        return;
    }

    try {
        await db.people.delete(id);
        app.showToast('Person deleted successfully', 'success');
        loadPeople();
    } catch (error) {
        console.error('Error deleting person:', error);
        app.showToast('Failed to delete person', 'error');
    }
}

function closeModal() {
    app.hideModal('personModal');
}

function closeViewModal() {
    app.hideModal('viewPersonModal');
}
