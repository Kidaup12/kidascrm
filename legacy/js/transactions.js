// Transactions Page JavaScript

let transactionsData = [];
let projectsData = [];
let peopleData = [];
let currentTransactionId = null;
let currentPage = 1;
let pageSize = 50;
let filteredData = [];
let selectedMonth = null; // Format: 'YYYY-MM'
let availableMonths = [];

document.addEventListener('DOMContentLoaded', () => {
    initializeMonthPicker();
    loadTransactions();
    loadProjects();
    loadPeople();

    // Check for project filter in URL
    const projectId = app.getQueryParam('project');
    if (projectId) {
        // Pre-select project when adding new transaction
        openAddModal();
        setTimeout(() => {
            document.getElementById('projectSelect').value = projectId;
        }, 500);
    }

    // Setup filters
    document.getElementById('typeFilter').addEventListener('change', applyFilters);
    document.getElementById('accountFilter').addEventListener('change', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
});

async function loadTransactions() {
    try {
        app.showLoading('transactionsTable');
        transactionsData = await db.transactions.getAll();
        filteredData = transactionsData;
        currentPage = 1;
        renderTransactions();
    } catch (error) {
        console.error('Error loading transactions:', error);
        app.showError('transactionsTable', 'Failed to load transactions');
    }
}

async function loadProjects() {
    try {
        const projects = await db.projects.getAll();
        projectsData = projects;

        // Populate modal dropdown
        const projectSelect = document.getElementById('projectSelect');
        projectSelect.innerHTML = `
            <option value="">No project</option>
            <option value="__ADD_NEW__" style="color: var(--color-accent); font-weight: 600;">+ Add New Project</option>
            ${projects.map(p => `<option value="${p.id}">${p.project_name}</option>`).join('')}
        `;

        // Populate quick add dropdown
        const quickProjectSelect = document.getElementById('quickProject');
        if (quickProjectSelect) {
            quickProjectSelect.innerHTML = `
                <option value="">No project</option>
                ${projects.map(p => `<option value="${p.id}">${p.project_name}</option>`).join('')}
            `;
        }
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

async function loadPeople() {
    try {
        const people = await db.people.getAll();
        peopleData = people;

        // Populate modal dropdown
        const personSelect = document.getElementById('personSelect');
        personSelect.innerHTML = `
            <option value="">No person</option>
            ${people.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        `;

        // Populate quick add dropdown
        const quickPersonSelect = document.getElementById('quickPerson');
        if (quickPersonSelect) {
            quickPersonSelect.innerHTML = `
                <option value="">No person</option>
                ${people.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            `;
        }
    } catch (error) {
        console.error('Error loading people:', error);
    }
}

function renderTransactions() {
    const tbody = document.getElementById('transactionsTable');

    // Save the quick add row
    const quickAddRow = document.getElementById('quickAddRow');

    // Calculate pagination
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedData = filteredData.slice(startIndex, endIndex);

    if (!filteredData || filteredData.length === 0) {
        // Clear tbody but preserve the quick add row
        const emptyStateHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="empty-state-icon">
                            <line x1="12" y1="1" x2="12" y2="23"/>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                        <p class="empty-state-title">No transactions yet</p>
                        <p class="empty-state-description">Add your first transaction to start tracking</p>
                        <button class="btn btn-primary" onclick="openAddModal()">Add Transaction</button>
                    </div>
                </td>
            </tr>
        `;

        tbody.innerHTML = '';
        // Re-add quick add row first
        if (quickAddRow) {
            tbody.appendChild(quickAddRow);
            // Add empty state after the quick add row
            tbody.insertAdjacentHTML('beforeend', emptyStateHTML);
        } else {
            tbody.innerHTML = emptyStateHTML;
        }

        updatePaginationControls(0, 0);
        return;
    }

    // Clear tbody and re-add quick add row
    tbody.innerHTML = '';
    if (quickAddRow) {
        tbody.appendChild(quickAddRow);
    }

    // Add transaction rows
    const transactionsHTML = paginatedData.map(tx => `
        <tr>
            <td>${app.formatDateShort(tx.date)}</td>
            <td><span class="badge ${app.getTypeBadge(tx.type)}">${tx.type}</span></td>
            <td><span class="badge ${app.getPlatformBadge(tx.account)}">${tx.account}</span></td>
            <td>${tx.projects?.project_name || '-'}</td>
            <td>${tx.people?.name || '-'}</td>
            <td class="text-muted">${tx.description || '-'}</td>
            <td><span class="badge ${app.getStatusBadge(tx.payment_status)}">${tx.payment_status}</span></td>
            <td class="text-right font-medium ${tx.type === 'Revenue' ? 'text-success' : ''}">
                ${tx.type === 'Revenue' ? '+' : '-'}${app.formatCurrency(tx.amount)}
            </td>
            <td>
                <div class="flex gap-sm">
                    <button class="btn btn-sm btn-ghost" onclick="editTransaction('${tx.id}')" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-ghost text-error" onclick="deleteTransaction('${tx.id}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    tbody.insertAdjacentHTML('beforeend', transactionsHTML);

    updatePaginationControls(totalItems, totalPages);
}

async function applyFilters() {
    // Calculate month date range
    let startDate, endDate;
    if (selectedMonth) {
        const [year, month] = selectedMonth.split('-');
        startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${year}-${month}-${lastDay}`;
    }

    const filters = {
        type: document.getElementById('typeFilter').value || undefined,
        account: document.getElementById('accountFilter').value || undefined,
        paymentStatus: document.getElementById('statusFilter').value || undefined,
        startDate: startDate,
        endDate: endDate
    };

    try {
        filteredData = await db.transactions.getAll(filters);
        currentPage = 1;
        renderTransactions();
    } catch (error) {
        console.error('Error filtering transactions:', error);
    }
}

function updatePaginationControls(totalItems, totalPages) {
    const container = document.getElementById('paginationControls');
    if (!container) return;

    if (totalItems === 0) {
        container.innerHTML = '';
        return;
    }

    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    container.innerHTML = `
        <div class="pagination-info">
            Showing ${startItem}-${endItem} of ${totalItems} transactions
        </div>
        <div class="pagination-controls">
            <select id="pageSizeSelect" class="form-select" style="width: auto; padding: 6px 32px 6px 12px;" onchange="changePageSize()">
                <option value="25" ${pageSize === 25 ? 'selected' : ''}>25 per page</option>
                <option value="50" ${pageSize === 50 ? 'selected' : ''}>50 per page</option>
                <option value="100" ${pageSize === 100 ? 'selected' : ''}>100 per page</option>
                <option value="${totalItems}" ${pageSize >= totalItems ? 'selected' : ''}>All</option>
            </select>
            <button class="btn btn-sm btn-ghost" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            </button>
            <span class="pagination-page">Page ${currentPage} of ${totalPages}</span>
            <button class="btn btn-sm btn-ghost" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </button>
        </div>
    `;
}

function changePage(page) {
    const totalPages = Math.ceil(filteredData.length / pageSize);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTransactions();
}

function changePageSize() {
    const select = document.getElementById('pageSizeSelect');
    pageSize = parseInt(select.value);
    currentPage = 1;
    renderTransactions();
}

function openAddModal() {
    currentTransactionId = null;
    document.getElementById('modalTitle').textContent = 'Add Transaction';
    app.resetForm('transactionForm');

    // Set default date to today
    document.querySelector('[name="date"]').value = new Date().toISOString().split('T')[0];

    handleTypeChange();
    app.showModal('transactionModal');
}

async function editTransaction(id) {
    try {
        currentTransactionId = id;
        const tx = transactionsData.find(t => t.id === id);

        if (!tx) {
            app.showToast('Transaction not found', 'error');
            return;
        }

        document.getElementById('modalTitle').textContent = 'Edit Transaction';
        app.populateForm('transactionForm', tx);
        handleTypeChange();
        app.showModal('transactionModal');
    } catch (error) {
        console.error('Error loading transaction:', error);
        app.showToast('Failed to load transaction', 'error');
    }
}

function handleTypeChange() {
    const type = document.getElementById('transactionType').value;
    const projectGroup = document.getElementById('projectGroup');
    const personGroup = document.getElementById('personGroup');

    // Show/hide fields based on type
    switch (type) {
        case 'Revenue':
            projectGroup.style.display = 'block';
            personGroup.style.display = 'none';
            break;
        case 'Dev Payment':
        case 'Salary':
        case 'Founder Withdrawal':
            projectGroup.style.display = 'block';
            personGroup.style.display = 'block';
            break;
        default:
            projectGroup.style.display = 'block';
            personGroup.style.display = 'none';
    }
}

// =============================================
// MONTH PICKER FUNCTIONS
// =============================================

function initializeMonthPicker() {
    // Generate months from Jan 2026 to current month + 1 year
    const startDate = new Date('2026-01-01');
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    availableMonths = [];
    let current = new Date(startDate);

    while (current <= endDate) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        availableMonths.push(`${year}-${month}`);
        current.setMonth(current.getMonth() + 1);
    }

    // Set current month as default
    const now = new Date();
    selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    renderMonthTabs();
}

function renderMonthTabs() {
    const container = document.getElementById('monthTabs');
    if (!container) return;

    const selectedIndex = availableMonths.indexOf(selectedMonth);

    // Show 5 months at a time (2 before, current, 2 after)
    const start = Math.max(0, selectedIndex - 2);
    const end = Math.min(availableMonths.length, start + 5);
    const visibleMonths = availableMonths.slice(start, end);

    // Only update if content actually changed (prevent unnecessary re-renders)
    const newHTML = visibleMonths.map(month => {
        const [year, monthNum] = month.split('-');
        const date = new Date(year, monthNum - 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const isActive = month === selectedMonth;

        return `<button class="month-tab ${isActive ? 'active' : ''}" onclick="selectMonth('${month}')" type="button">${monthName}</button>`;
    }).join('');

    if (container.innerHTML !== newHTML) {
        container.innerHTML = newHTML;
    }

    // Update navigation button states
    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');

    if (prevBtn) prevBtn.disabled = selectedIndex === 0;
    if (nextBtn) nextBtn.disabled = selectedIndex === availableMonths.length - 1;
}

function selectMonth(month) {
    if (selectedMonth === month) return; // Prevent unnecessary updates
    selectedMonth = month;
    renderMonthTabs();
    applyFilters();
}

function changeMonth(direction) {
    const currentIndex = availableMonths.indexOf(selectedMonth);
    const newIndex = currentIndex + direction;

    if (newIndex >= 0 && newIndex < availableMonths.length) {
        selectMonth(availableMonths[newIndex]);
    }
}

// =============================================
// PROJECT HANDLING
// =============================================

function handleProjectSelect() {
    const select = document.getElementById('projectSelect');
    if (select.value === '__ADD_NEW__') {
        openQuickProjectModal();
        select.value = ''; // Reset selection
    }
}

function openQuickProjectModal() {
    // Store current transaction modal state
    const transactionModal = document.getElementById('transactionModal');
    const wasOpen = transactionModal.classList.contains('active');

    if (wasOpen) {
        app.hideModal('transactionModal');
    }

    // Open projects page in new context or show inline modal
    const projectName = prompt('Enter project name:');
    if (!projectName) {
        if (wasOpen) app.showModal('transactionModal');
        return;
    }

    const clientName = prompt('Enter client name:');
    if (!clientName) {
        if (wasOpen) app.showModal('transactionModal');
        return;
    }

    // Create project quickly
    createQuickProject(projectName, clientName, wasOpen);
}

async function createQuickProject(projectName, clientName, reopenTransactionModal) {
    try {
        // First, check if client exists or create new one
        let client = clientsData?.find(c => c.client_name.toLowerCase() === clientName.toLowerCase());

        if (!client) {
            const newClient = await db.clients.create({ client_name: clientName, status: 'Active' });
            client = newClient;
        }

        // Create project
        const newProject = await db.projects.create({
            project_name: projectName,
            client_id: client.id,
            status: 'Active',
            platform: 'Web'
        });

        // Reload projects and select the new one
        await loadProjects();
        document.getElementById('projectSelect').value = newProject.id;

        app.showToast(`Project "${projectName}" created successfully!`, 'success');

        if (reopenTransactionModal) {
            app.showModal('transactionModal');
        }
    } catch (error) {
        console.error('Error creating quick project:', error);
        app.showToast('Failed to create project', 'error');
        if (reopenTransactionModal) {
            app.showModal('transactionModal');
        }
    }
}


async function saveTransaction() {
    try {
        const formData = app.getFormData('transactionForm');

        // Clean up amount - remove any currency symbols
        if (formData.amount) {
            formData.amount = String(formData.amount).replace(/[$,]/g, '');
        }

        if (!formData.date || !formData.amount || !formData.type || !formData.account) {
            app.showToast('Date, amount, type, and account are required', 'warning');
            return;
        }

        // Validation for person-based transactions
        if (['Dev Payment', 'Salary', 'Founder Withdrawal'].includes(formData.type) && !formData.person_id) {
            app.showToast('Person is required for this transaction type', 'warning');
            return;
        }

        // Clean up null values
        if (!formData.project_id) formData.project_id = null;
        if (!formData.person_id) formData.person_id = null;


        if (currentTransactionId) {
            await db.transactions.update(currentTransactionId, formData);
            app.showToast('Transaction updated successfully', 'success');
        } else {
            await db.transactions.create(formData);
            app.showToast('Transaction created successfully', 'success');
        }

        closeModal();
        loadTransactions();
    } catch (error) {
        console.error('Error saving transaction:', error);
        app.showToast('Failed to save transaction', 'error');
    }
}

async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) {
        return;
    }

    try {
        await db.transactions.delete(id);
        app.showToast('Transaction deleted successfully', 'success');
        await loadTransactions();
    } catch (error) {
        console.error('Error deleting transaction:', error);
        app.showToast('Failed to delete transaction', 'error');
    }
}

// =============================================
// QUICK ADD (INLINE EDITING)
// =============================================

async function saveQuickTransaction() {
    try {
        // Get values from quick add row
        const formData = {
            date: document.getElementById('quickDate').value,
            type: document.getElementById('quickType').value,
            account: document.getElementById('quickAccount').value,
            project_id: document.getElementById('quickProject').value || null,
            person_id: document.getElementById('quickPerson').value || null,
            description: document.getElementById('quickDescription').value,
            payment_status: document.getElementById('quickStatus').value,
            amount: document.getElementById('quickAmount').value
        };

        // Clean up amount - remove any currency symbols
        if (formData.amount) {
            formData.amount = String(formData.amount).replace(/[$,]/g, '');
        }

        // Validation
        if (!formData.date || !formData.amount || !formData.type || !formData.account) {
            app.showToast('Date, amount, type, and account are required', 'warning');
            return;
        }

        // Validation for person-based transactions
        if (['Dev Payment', 'Salary', 'Founder Withdrawal'].includes(formData.type) && !formData.person_id) {
            app.showToast('Person is required for this transaction type', 'warning');
            return;
        }

        // Save transaction
        await db.transactions.create(formData);
        app.showToast('Transaction created successfully', 'success');

        // Clear the quick add row
        clearQuickAddRow();

        // Reload transactions
        await loadTransactions();

        // Focus back on date field for next entry
        document.getElementById('quickDate').focus();

    } catch (error) {
        console.error('Error saving transaction:', error);
        app.showToast('Failed to save transaction', 'error');
    }
}

function clearQuickAddRow() {
    document.getElementById('quickDate').value = '';
    document.getElementById('quickType').value = '';
    document.getElementById('quickAccount').value = '';
    document.getElementById('quickProject').value = '';
    document.getElementById('quickPerson').value = '';
    document.getElementById('quickDescription').value = '';
    document.getElementById('quickStatus').value = 'Paid';
    document.getElementById('quickAmount').value = '';
}

// Add keyboard shortcuts for quick add row
document.addEventListener('DOMContentLoaded', () => {
    const quickAddInputs = [
        'quickDate', 'quickType', 'quickAccount', 'quickProject',
        'quickPerson', 'quickDescription', 'quickStatus', 'quickAmount'
    ];

    quickAddInputs.forEach((id, index) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('keydown', (e) => {
                // Arrow key navigation (Google Sheets style)
                if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
                    // Move to next field
                    if (index < quickAddInputs.length - 1) {
                        e.preventDefault();
                        document.getElementById(quickAddInputs[index + 1]).focus();
                    }
                }
                if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
                    // Move to previous field
                    if (index > 0) {
                        e.preventDefault();
                        document.getElementById(quickAddInputs[index - 1]).focus();
                    }
                }
                // Save on Enter key
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveQuickTransaction();
                }
                // Clear on Escape key
                if (e.key === 'Escape') {
                    e.preventDefault();
                    clearQuickAddRow();
                    document.getElementById('quickDate').focus();
                }
            });
        }
    });
});

function closeModal() {
    app.hideModal('transactionModal');
}
