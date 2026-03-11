// App Utilities
// Shared functions across all pages

const app = {
    // =====================
    // Formatting Helpers
    // =====================
    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(amount || 0);
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    },

    formatDateShort(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    },

    formatMonth(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
    },

    formatPercent(value) {
        return `${(value * 100).toFixed(1)}%`;
    },

    // =====================
    // Date Range Helpers
    // =====================
    getDateRange(period) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate, endDate;

        switch (period) {
            case 'week':
                const dayOfWeek = today.getDay();
                startDate = new Date(today);
                startDate.setDate(today.getDate() - dayOfWeek);
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                break;

            case 'month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;

            case 'year':
                startDate = new Date(today.getFullYear(), 0, 1);
                endDate = new Date(today.getFullYear(), 11, 31);
                break;

            case 'all':
                startDate = new Date('2020-01-01');
                endDate = new Date('2030-12-31');
                break;

            default:
                // Custom range - expect period to be { start, end }
                startDate = new Date(period.start);
                endDate = new Date(period.end);
        }

        return {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        };
    },

    // =====================
    // Badge / Status Helpers
    // =====================
    getStatusBadge(status) {
        const badges = {
            'Active': 'badge-success',
            'Completed': 'badge-info',
            'On Hold': 'badge-warning',
            'Inactive': 'badge-neutral',
            'Paid': 'badge-success',
            'Pending': 'badge-warning'
        };
        return badges[status] || 'badge-neutral';
    },

    getPlatformBadge(platform) {
        const badges = {
            'Upwork': 'badge-upwork',
            'Bank': 'badge-bank',
            'Wise': 'badge-wise'
        };
        return badges[platform] || 'badge-neutral';
    },

    getRoleBadge(role) {
        const badges = {
            'Founder': 'badge-info',
            'Contractor': 'badge-success',
            'Fixed Salary Employee': 'badge-warning'
        };
        return badges[role] || 'badge-neutral';
    },

    getTypeBadge(type) {
        const badges = {
            'Revenue': 'badge-success',
            'Dev Payment': 'badge-info',
            'Tool Cost': 'badge-neutral',
            'Ads': 'badge-warning',
            'Misc Expense': 'badge-neutral',
            'Salary': 'badge-info',
            'Founder Withdrawal': 'badge-info'
        };
        return badges[type] || 'badge-neutral';
    },

    // =====================
    // Modal Helpers
    // =====================
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    hideAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    },

    // =====================
    // Toast Notifications
    // =====================
    showToast(message, type = 'info') {
        // Remove existing toasts
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        // Add toast styles if not already in document
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                .toast {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    padding: 12px 16px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 9999;
                    animation: slideIn 0.3s ease;
                }
                .toast-info { background: #2196F3; color: white; }
                .toast-success { background: #00A876; color: white; }
                .toast-warning { background: #F5A623; color: white; }
                .toast-error { background: #D32F2F; color: white; }
                .toast-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => toast.remove(), 3000);
    },

    // =====================
    // Loading States
    // =====================
    showLoading(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="animate-pulse">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="empty-state-icon">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 6v6l4 2"/>
                        </svg>
                    </div>
                    <p class="text-muted">Loading...</p>
                </div>
            `;
        }
    },

    showError(containerId, message) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="empty-state-icon text-error">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M15 9l-6 6M9 9l6 6"/>
                    </svg>
                    <p class="empty-state-title">Error</p>
                    <p class="empty-state-description">${message}</p>
                </div>
            `;
        }
    },

    // =====================
    // Table Helpers
    // =====================
    sortTable(data, column, direction = 'asc') {
        return [...data].sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];

            // Handle null/undefined
            if (aVal == null) aVal = '';
            if (bVal == null) bVal = '';

            // Handle numbers
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return direction === 'asc' ? aVal - bVal : bVal - aVal;
            }

            // Handle strings
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();

            if (direction === 'asc') {
                return aVal.localeCompare(bVal);
            } else {
                return bVal.localeCompare(aVal);
            }
        });
    },

    filterTable(data, searchTerm, columns) {
        if (!searchTerm) return data;

        const term = searchTerm.toLowerCase();
        return data.filter(row => {
            return columns.some(col => {
                const val = row[col];
                if (val == null) return false;
                return String(val).toLowerCase().includes(term);
            });
        });
    },

    // =====================
    // Chart Colors
    // =====================
    chartColors: {
        primary: '#9FE870',
        revenue: '#00A876',
        expense: '#F5A623',
        profit: '#163300',
        categories: [
            '#00B9A0', // Dev Payments
            '#2196F3', // Tool Costs
            '#F5A623', // Ads
            '#9C27B0', // Misc
            '#FF5722'  // Salaries
        ]
    },

    // =====================
    // Form Helpers
    // =====================
    getFormData(formId) {
        const form = document.getElementById(formId);
        if (!form) return {};

        const formData = new FormData(form);
        const data = {};

        for (let [key, value] of formData.entries()) {
            // Convert empty strings to null
            if (value === '') {
                data[key] = null;
            }
            // Convert numeric strings to numbers
            else if (!isNaN(value) && value.trim() !== '') {
                data[key] = parseFloat(value);
            }
            else {
                data[key] = value;
            }
        }

        return data;
    },

    resetForm(formId) {
        const form = document.getElementById(formId);
        if (form) form.reset();
    },

    populateForm(formId, data) {
        const form = document.getElementById(formId);
        if (!form) return;

        Object.entries(data).forEach(([key, value]) => {
            const input = form.querySelector(`[name="${key}"]`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = value;
                } else {
                    input.value = value || '';
                }
            }
        });
    },

    // =====================
    // URL / Navigation
    // =====================
    getQueryParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    },

    setQueryParam(name, value) {
        const url = new URL(window.location);
        url.searchParams.set(name, value);
        window.history.replaceState({}, '', url);
    },

    // =====================
    // Debounce
    // =====================
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// Export for use in other modules
window.app = app;
