export const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount || 0);
};

export const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatDateShort = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatMonth = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export const formatPercent = (value) => {
    return `${(value * 100).toFixed(1)}%`;
};

export const getDateRange = (period) => {
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
            startDate = new Date(period.start);
            endDate = new Date(period.end);
    }

    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    };
};

export const getStatusBadge = (status) => {
    const badges = { 'Active': 'badge-success', 'Completed': 'badge-success', 'On Hold': 'badge-warning', 'Inactive': 'badge-neutral', 'Pending': 'badge-warning' };
    return badges[status] || 'badge-neutral';
};

export const getPlatformBadge = (platform) => {
    const badges = { 'Upwork': 'badge-upwork', 'Bank': 'badge-bank', 'Wise': 'badge-wise' };
    return badges[platform] || 'badge-neutral';
};

export const getRoleBadge = (role) => {
    const badges = { 'Founder': 'badge-info', 'Contractor': 'badge-success', 'Fixed Salary Employee': 'badge-warning', 'Employee': 'badge-warning' };
    return badges[role] || 'badge-neutral';
};

export const getTypeBadge = (type) => {
    const badges = { 'Revenue': 'badge-success', 'Dev Payment': 'badge-info', 'Tool Cost': 'badge-neutral', 'Ads': 'badge-warning', 'Misc Expense': 'badge-neutral', 'Salary': 'badge-info', 'Founder Withdrawal': 'badge-info' };
    return badges[type] || 'badge-neutral';
};

export const sortTable = (data, column, direction = 'asc') => {
    return [...data].sort((a, b) => {
        let aVal = a[column]; let bVal = b[column];
        if (aVal == null) aVal = ''; if (bVal == null) bVal = '';
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        aVal = String(aVal).toLowerCase(); bVal = String(bVal).toLowerCase();
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
};

export const filterTable = (data, searchTerm, columns) => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(row => columns.some(col => {
        const val = row[col];
        if (val == null) return false;
        return String(val).toLowerCase().includes(term);
    }));
};

export const chartColors = {
    primary: '#9FE870',
    revenue: '#00A876',
    expense: '#F5A623',
    profit: '#163300',
    categories: ['#00B9A0', '#2196F3', '#F5A623', '#9C27B0', '#FF5722']
};
