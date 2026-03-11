// Dashboard JavaScript

let expenseChart = null;
let trendChart = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();

    // Period selector change
    document.getElementById('periodSelector').addEventListener('change', (e) => {
        loadDashboardData(e.target.value);
    });
});

async function initDashboard() {
    // Initialize charts first
    initCharts();

    // Load data for default period (month)
    await loadDashboardData('month');
}

function initCharts() {
    // Expense Breakdown Chart (Doughnut)
    const expenseCtx = document.getElementById('expenseChart').getContext('2d');
    expenseChart = new Chart(expenseCtx, {
        type: 'doughnut',
        data: {
            labels: ['Dev Payments', 'Tool Costs', 'Ads', 'Misc Expenses', 'Salaries'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                backgroundColor: app.chartColors.categories,
                borderWidth: 0,
                spacing: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: {
                            family: 'Inter',
                            size: 12
                        }
                    }
                }
            }
        }
    });

    // Trend Chart (Line)
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Revenue',
                    data: [],
                    borderColor: app.chartColors.revenue,
                    backgroundColor: 'rgba(0, 168, 118, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                },
                {
                    label: 'Profit',
                    data: [],
                    borderColor: app.chartColors.profit,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: (value) => app.formatCurrency(value)
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 20,
                        font: {
                            family: 'Inter',
                            size: 12
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

async function loadDashboardData(period) {
    try {
        const { startDate, endDate } = app.getDateRange(period);

        // Load all data in parallel
        const [kpis, expenseData, trendData, founderBalances, moneyOwed, recentTxs] = await Promise.all([
            db.dashboard.getKPIs(startDate, endDate),
            db.dashboard.getExpenseBreakdown(startDate, endDate),
            db.dashboard.getMonthlyTrend(6),
            db.dashboard.getFounderBalances(),
            db.dashboard.getMoneyOwed(),
            db.transactions.getAll({ startDate, endDate })
        ]);

        // Update KPIs
        updateKPIs(kpis);

        // Update Expense Chart
        updateExpenseChart(expenseData);

        // Update Trend Chart
        updateTrendChart(trendData);

        // Update Founder Balances
        updateFounderBalances(founderBalances);

        // Update Money Owed
        updateMoneyOwed(moneyOwed);

        // Update Recent Transactions
        updateRecentTransactions(recentTxs.slice(0, 5));

    } catch (error) {
        console.error('Error loading dashboard:', error);
        app.showToast('Failed to load dashboard data', 'error');
    }
}

function updateKPIs(kpis) {
    document.getElementById('kpiRevenue').textContent = app.formatCurrency(kpis.revenue);
    document.getElementById('kpiProfit').textContent = app.formatCurrency(kpis.profit);
    document.getElementById('kpiExpenses').textContent = app.formatCurrency(kpis.totalExpenses);
    document.getElementById('kpiWithdrawals').textContent = app.formatCurrency(kpis.founderWithdrawals);

    // Expense percentage
    const expensePercent = kpis.revenue > 0 ? ((kpis.totalExpenses / kpis.revenue) * 100).toFixed(1) : 0;
    document.getElementById('kpiExpensesChange').innerHTML = `<span>${expensePercent}% of revenue</span>`;

    // Profit margin
    const profitMargin = kpis.revenue > 0 ? ((kpis.profit / kpis.revenue) * 100).toFixed(1) : 0;
    const profitChangeEl = document.getElementById('kpiProfitChange');
    profitChangeEl.className = `kpi-change ${kpis.profit >= 0 ? 'positive' : 'negative'}`;
    profitChangeEl.innerHTML = `<span>${profitMargin}% margin</span>`;
}

function updateExpenseChart(data) {
    expenseChart.data.datasets[0].data = data.values;
    expenseChart.update();
}

function updateTrendChart(data) {
    const labels = data.map(d => app.formatMonth(d.month));
    const revenues = data.map(d => parseFloat(d.revenue) || 0);
    const profits = data.map(d => parseFloat(d.net_profit) || 0);

    trendChart.data.labels = labels;
    trendChart.data.datasets[0].data = revenues;
    trendChart.data.datasets[1].data = profits;
    trendChart.update();
}

function updateFounderBalances(balances) {
    const container = document.getElementById('founderBalances');

    if (!balances || balances.length === 0) {
        container.innerHTML = `<p class="text-muted text-center">No founder data</p>`;
        return;
    }

    container.innerHTML = balances.map(founder => `
        <div class="founder-card">
            <div class="founder-name">${founder.name}</div>
            <div class="founder-balance">${app.formatCurrency(founder.balance)}</div>
            <div class="founder-label">owed</div>
        </div>
    `).join('');
}

function updateMoneyOwed(data) {
    document.getElementById('clientsOweUs').textContent = app.formatCurrency(data.clientsOweUs);
    document.getElementById('weOweContractors').textContent = app.formatCurrency(data.weOweContractors);
}

function updateRecentTransactions(transactions) {
    const container = document.getElementById('recentTransactions');

    if (!transactions || transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 24px;">
                <p class="text-muted">No transactions found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = transactions.map(tx => `
        <div class="summary-item">
            <span class="summary-item-label">
                <span class="badge ${app.getTypeBadge(tx.type)}">${tx.type}</span>
                <span class="text-sm text-muted">${app.formatDateShort(tx.date)}</span>
            </span>
            <span class="summary-item-value ${tx.type === 'Revenue' ? 'positive' : ''}">
                ${tx.type === 'Revenue' ? '+' : '-'}${app.formatCurrency(tx.amount)}
            </span>
        </div>
    `).join('');
}
