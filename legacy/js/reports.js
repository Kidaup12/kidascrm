// Reports Page JavaScript

let monthlyData = [];
let monthlyChart = null;
let platformChart = null;
const currentYear = new Date().getFullYear();

document.addEventListener('DOMContentLoaded', () => {
    setupYearFilter();
    loadReports(currentYear);

    document.getElementById('yearFilter').addEventListener('change', (e) => {
        loadReports(parseInt(e.target.value));
    });
});

function setupYearFilter() {
    const select = document.getElementById('yearFilter');
    const years = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
        years.push(y);
    }
    select.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
}

async function loadReports(year) {
    try {
        // Load monthly summary data
        monthlyData = await db.reports.getMonthlySummary(year);

        // Calculate annual totals
        updateAnnualSummary(monthlyData);

        // Update charts
        updateMonthlyChart(monthlyData);
        await updatePlatformChart(year);

        // Render monthly table
        renderMonthlySummary(monthlyData);

        // Load top clients and projects
        await loadTopClients();
        await loadTopProjects();
    } catch (error) {
        console.error('Error loading reports:', error);
        app.showToast('Failed to load reports', 'error');
    }
}

function updateAnnualSummary(data) {
    const totals = data.reduce((acc, m) => {
        acc.revenue += parseFloat(m.revenue) || 0;
        acc.profit += parseFloat(m.net_profit) || 0;
        acc.expenses += (parseFloat(m.dev_payments) || 0) +
            (parseFloat(m.tool_costs) || 0) +
            (parseFloat(m.ads) || 0) +
            (parseFloat(m.misc_expenses) || 0) +
            (parseFloat(m.salaries) || 0);
        return acc;
    }, { revenue: 0, profit: 0, expenses: 0 });

    document.getElementById('annualRevenue').textContent = app.formatCurrency(totals.revenue);
    document.getElementById('annualProfit').textContent = app.formatCurrency(totals.profit);
    document.getElementById('totalExpenses').textContent = app.formatCurrency(totals.expenses);

    const margin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
    document.getElementById('profitMargin').textContent = margin.toFixed(1) + '%';
}

function updateMonthlyChart(data) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Prepare full year data (fill gaps)
    const chartData = months.map((_, i) => {
        const monthNum = (i + 1).toString().padStart(2, '0');
        const monthData = data.find(d => {
            const monthStr = d.month ? d.month.substring(5, 7) : '';
            return parseInt(monthStr) === (i + 1);
        });
        return {
            month: months[i],
            revenue: monthData ? parseFloat(monthData.revenue) : 0,
            profit: monthData ? parseFloat(monthData.net_profit) : 0
        };
    });

    const ctx = document.getElementById('monthlyChart').getContext('2d');

    if (monthlyChart) {
        monthlyChart.destroy();
    }

    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.map(d => d.month),
            datasets: [
                {
                    label: 'Revenue',
                    data: chartData.map(d => d.revenue),
                    backgroundColor: 'rgba(159, 232, 112, 0.7)',
                    borderColor: '#9FE870',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Profit',
                    data: chartData.map(d => d.profit),
                    backgroundColor: 'rgba(22, 51, 0, 0.8)',
                    borderColor: '#163300',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true, boxWidth: 8 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => app.formatCurrency(value, '', 0)
                    }
                }
            }
        }
    });
}

async function updatePlatformChart(year) {
    try {
        const transactions = await db.transactions.getAll({
            startDate: `${year}-01-01`,
            endDate: `${year}-12-31`,
            type: 'Revenue'
        });

        const platformTotals = transactions.reduce((acc, tx) => {
            acc[tx.account] = (acc[tx.account] || 0) + parseFloat(tx.amount);
            return acc;
        }, {});

        const labels = Object.keys(platformTotals);
        const data = Object.values(platformTotals);

        const ctx = document.getElementById('platformChart').getContext('2d');

        if (platformChart) {
            platformChart.destroy();
        }

        platformChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#9FE870',  // Primary green
                        '#163300',  // Dark green
                        '#5CB85C',  // Success green
                        '#2ECC71'   // Emerald
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, boxWidth: 8 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percent = ((context.raw / total) * 100).toFixed(1);
                                return `${context.label}: ${app.formatCurrency(context.raw)} (${percent}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading platform data:', error);
    }
}

function renderMonthlySummary(data) {
    const tbody = document.getElementById('monthlySummaryTable');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Create full year rows
    const rows = months.map((monthName, i) => {
        const monthNum = i + 1;
        const mData = data.find(d => {
            const monthStr = d.month ? d.month.substring(5, 7) : '';
            return parseInt(monthStr) === monthNum;
        });

        if (!mData) {
            return `<tr class="text-muted">
                <td>${monthName}</td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
            </tr>`;
        }

        const revenue = parseFloat(mData.revenue) || 0;
        const devPayments = parseFloat(mData.dev_payments) || 0;
        const toolCosts = parseFloat(mData.tool_costs) || 0;
        const otherExpenses = (parseFloat(mData.ads) || 0) + (parseFloat(mData.misc_expenses) || 0) + (parseFloat(mData.salaries) || 0);
        const withdrawals = parseFloat(mData.founder_withdrawals) || 0;
        const profit = parseFloat(mData.net_profit) || 0;
        const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;

        return `<tr>
            <td class="font-medium">${monthName}</td>
            <td class="text-right text-success">${app.formatCurrency(revenue)}</td>
            <td class="text-right">${app.formatCurrency(devPayments)}</td>
            <td class="text-right">${app.formatCurrency(toolCosts)}</td>
            <td class="text-right">${app.formatCurrency(otherExpenses)}</td>
            <td class="text-right">${app.formatCurrency(withdrawals)}</td>
            <td class="text-right font-medium ${profit >= 0 ? 'text-success' : 'text-error'}">${app.formatCurrency(profit)}</td>
            <td class="text-right">${margin}%</td>
        </tr>`;
    });

    tbody.innerHTML = rows.join('');
}

async function loadTopClients() {
    try {
        const clients = await db.clients.getWithFinancials();
        const sorted = clients.sort((a, b) => parseFloat(b.total_revenue || 0) - parseFloat(a.total_revenue || 0)).slice(0, 5);

        const container = document.getElementById('topClients');
        container.innerHTML = sorted.length > 0 ? `
            <div class="space-y-sm">
                ${sorted.map((c, i) => `
                    <div class="flex justify-between items-center py-sm" style="border-bottom: 1px solid var(--color-border);">
                        <div class="flex items-center gap-sm">
                            <span class="text-sm text-muted" style="width: 20px;">#${i + 1}</span>
                            <span class="font-medium">${c.client_name}</span>
                        </div>
                        <span class="text-success font-medium">${app.formatCurrency(c.total_revenue)}</span>
                    </div>
                `).join('')}
            </div>
        ` : '<p class="text-muted text-center">No client data yet</p>';
    } catch (error) {
        console.error('Error loading top clients:', error);
    }
}

async function loadTopProjects() {
    try {
        const projects = await db.projects.getWithFinancials();
        const sorted = projects.map(p => ({
            ...p,
            profit: (parseFloat(p.total_received) || 0) - (parseFloat(p.total_dev_payments) || 0)
        })).sort((a, b) => b.profit - a.profit).slice(0, 5);

        const container = document.getElementById('topProjects');
        container.innerHTML = sorted.length > 0 ? `
            <div class="space-y-sm">
                ${sorted.map((p, i) => {
            const profit = p.profit || 0;
            return `
                        <div class="flex justify-between items-center py-sm" style="border-bottom: 1px solid var(--color-border);">
                            <div class="flex items-center gap-sm">
                                <span class="text-sm text-muted" style="width: 20px;">#${i + 1}</span>
                                <span class="font-medium">${p.project_name}</span>
                            </div>
                            <span class="${profit >= 0 ? 'text-success' : 'text-error'} font-medium">${app.formatCurrency(profit)}</span>
                        </div>
                    `;
        }).join('')}
            </div>
        ` : '<p class="text-muted text-center">No project data yet</p>';
    } catch (error) {
        console.error('Error loading top projects:', error);
    }
}

async function exportCSV() {
    try {
        const year = document.getElementById('yearFilter').value;
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        // Build CSV
        let csv = `Month,Revenue,Dev Payments,Tool Costs,Other Expenses,Withdrawals,Profit,Margin %\n`;

        months.forEach((monthName, i) => {
            const monthNum = i + 1;
            const mData = monthlyData.find(d => {
                const monthStr = d.month ? d.month.substring(5, 7) : '';
                return parseInt(monthStr) === monthNum;
            });

            if (mData) {
                const revenue = parseFloat(mData.revenue) || 0;
                const devPayments = parseFloat(mData.dev_payments) || 0;
                const toolCosts = parseFloat(mData.tool_costs) || 0;
                const otherExpenses = (parseFloat(mData.ads) || 0) + (parseFloat(mData.misc_expenses) || 0) + (parseFloat(mData.salaries) || 0);
                const withdrawals = parseFloat(mData.founder_withdrawals) || 0;
                const profit = parseFloat(mData.net_profit) || 0;
                const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;

                csv += `${monthName},${revenue},${devPayments},${toolCosts},${otherExpenses},${withdrawals},${profit},${margin}%\n`;
            } else {
                csv += `${monthName},0,0,0,0,0,0,0%\n`;
            }
        });

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financial-report-${year}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        app.showToast('Report exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting CSV:', error);
        app.showToast('Failed to export report', 'error');
    }
}
