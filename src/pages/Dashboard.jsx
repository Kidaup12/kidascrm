import { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { db } from '../lib/supabase';
import { formatCurrency, formatMonth, formatDateShort, getTypeBadge, chartColors } from '../lib/utils';
import Badge from '../components/Badge';
import AccountReconciliation from '../components/AccountReconciliation';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

// ── Date helpers ─────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function buildMonthList() {
    const months = [];
    const start = new Date('2024-01-01');
    const end = new Date('2026-12-01'); // show through Dec 2026
    let cur = new Date(start);
    while (cur <= end) {
        months.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}`);
        cur.setMonth(cur.getMonth() + 1);
    }
    return months;
}

function weeksInMonth(yearMonth) {
    const [y, m] = yearMonth.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0);
    const weeks = [];
    // Start from Monday of the first day's week
    let cur = new Date(firstDay);
    const dow = cur.getDay(); // 0=Sun
    cur.setDate(cur.getDate() - ((dow + 6) % 7)); // back to Monday
    while (cur <= lastDay) {
        const wStart = new Date(Math.max(cur, firstDay));
        const wEnd = new Date(cur);
        wEnd.setDate(wEnd.getDate() + 6);
        const clampedEnd = new Date(Math.min(wEnd, lastDay));
        weeks.push({ start: toISO(wStart), end: toISO(clampedEnd), label: `${wStart.getDate()} – ${clampedEnd.getDate()}` });
        cur.setDate(cur.getDate() + 7);
    }
    return weeks;
}

export default function Dashboard() {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const ALL_MONTHS = buildMonthList();

    const [selectedMonth, setSelectedMonth] = useState(thisMonth);
    const [selectedWeek, setSelectedWeek]   = useState(null); // {start, end, label}
    
    // Find where the current month is in the array, and put it near the end of the 5-item visible window
    const thisMonthIdx = ALL_MONTHS.indexOf(thisMonth);
    const initialScrollIdx = thisMonthIdx >= 0 ? Math.max(0, thisMonthIdx - 4) : Math.max(0, ALL_MONTHS.length - 5);
    const [monthScrollIdx, setMonthScrollIdx] = useState(initialScrollIdx);

    const weeks = weeksInMonth(selectedMonth);

    // Compute date range from selection
    const getRange = () => {
        if (selectedWeek) return { startDate: selectedWeek.start,  endDate: selectedWeek.end };
        // whole month
        const [y, m] = selectedMonth.split('-').map(Number);
        const last = new Date(y, m, 0);
        return { startDate: `${selectedMonth}-01`, endDate: toISO(last) };
    };

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        kpis: { revenue: 0, profit: 0, totalExpenses: 0, founderWithdrawals: 0 },
        expenseData: { labels: [], values: [] },
        trendData: [],
        founderBalances: { monthly: [], yearly: [] },
        moneyOwed: { clientsOweUs: 0, weOweContractors: 0 },
        recentTransactions: [],
        accountBalances: { Upwork: 0, Wise: 0, Bank: 0, Till: 0 },
        recurringCosts: [],
        mrrData: { mrr: 0, recurringCosts: 0 },
        newCounts: { newClients: 0, newProjects: 0 }
    });

    const [founderView, setFounderView] = useState('Monthly');

    const rangeKey = JSON.stringify({ selectedMonth, selectedWeek });

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const { startDate, endDate } = getRange();

                const [kpis, expenseData, trendData, founderBalances, moneyOwed, recentTxs, accountBalances, recurringCosts, mrrData, newCounts] = await Promise.all([
                    db.dashboard.getKPIs(startDate, endDate),
                    db.dashboard.getExpenseBreakdown(startDate, endDate),
                    db.dashboard.getMonthlyTrend(6),
                    db.dashboard.getFounderBalances(startDate, endDate),
                    db.dashboard.getMoneyOwed(),
                    db.dashboard.getRecentTransactions(5),
                    db.dashboard.getAccountBalances(),
                    db.dashboard.getRecurringCosts(),
                    db.dashboard.getMRRData(startDate, endDate),
                    db.dashboard.getNewCounts(startDate, endDate)
                ]);

                setData({ kpis, expenseData, trendData, founderBalances, moneyOwed, recentTransactions: recentTxs, accountBalances, recurringCosts, mrrData, newCounts });
            } catch (error) {
                console.error('Dashboard error', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [rangeKey]);

    // calculate derived values
    const kpis = data.kpis;
    const expensePercent = kpis.revenue > 0 ? ((kpis.totalExpenses / kpis.revenue) * 100).toFixed(1) : 0;
    const profitMargin = kpis.revenue > 0 ? ((kpis.profit / kpis.revenue) * 100).toFixed(1) : 0;
    const withdrawalPercent = kpis.revenue > 0 ? ((kpis.founderWithdrawals / kpis.revenue) * 100).toFixed(1) : 0;
    const totalBalance = Object.values(data.accountBalances).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0);
    const balancePercent = kpis.revenue > 0 ? ((totalBalance / kpis.revenue) * 100).toFixed(1) : 0;

    // Charts data
    const expenseChartData = {
        labels: data.expenseData.labels,
        datasets: [{
            data: data.expenseData.values,
            backgroundColor: chartColors.categories,
            borderWidth: 0,
            spacing: 2
        }]
    };

    const expenseChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { callback: (value) => formatCurrency(value) }
            },
            x: {
                grid: { display: false }
            }
        },
        plugins: {
            legend: {
                display: false // no need for legend on a bar chart where categories are on the axis
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.label || '';
                        if (label) { label += ': '; }
                        const value = context.parsed;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                        label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
                        return `${label} (${percentage})`;
                    }
                }
            }
        }
    };

    const expenseCategories = data.expenseData.labels.map((label, index) => ({
        label,
        value: Number(data.expenseData.values[index] || 0)
    }));
    const sortedExpenseCategories = [...expenseCategories].sort((a, b) => b.value - a.value);
    const expenseTotal = sortedExpenseCategories.reduce((sum, item) => sum + item.value, 0);

    const trendChartData = {
        labels: data.trendData.map(d => formatMonth(d.month)),
        datasets: [
            {
                label: 'Revenue',
                data: data.trendData.map(d => parseFloat(d.revenue) || 0),
                backgroundColor: 'rgba(0, 168, 118, 0.8)',
                borderRadius: 4
            },
            {
                label: 'Profit',
                data: data.trendData.map(d => parseFloat(d.net_profit) || 0),
                backgroundColor: 'rgba(21, 101, 192, 0.8)',
                borderRadius: 4
            }
        ]
    };

    const trendChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' }, ticks: { callback: (value) => formatCurrency(value) } },
            x: { grid: { display: false } }
        },
        plugins: {
            legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', padding: 20, font: { family: 'Inter', size: 12 } } }
        },
        interaction: { intersect: false, mode: 'index' }
    };

    // Visible 5-month window
    const visibleMonths = ALL_MONTHS.slice(monthScrollIdx, monthScrollIdx + 5);
    const fmtMonth = (ym) => { const [y, m] = ym.split('-'); const d = new Date(y, m - 1); return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); };

    return (
        <>
            <header className="page-header tapestry-header">
                <h1 className="page-title">Dashboard</h1>
            </header>

            {/* ── Cascading Date Picker ── */}
            <div className="card" style={{ margin: '0 0 16px 0' }}>
                <div className="card-body" style={{ padding: '12px 20px' }}>

                    {/* Row 1: Months */}
                    <div className="month-picker-container" style={{ marginBottom: selectedWeek || weeks.length > 1 ? '10px' : 0 }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setMonthScrollIdx(i => Math.max(0, i - 1))} disabled={monthScrollIdx === 0}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <div className="month-tabs">
                            {visibleMonths.map(ym => (
                                <button key={ym} className={`month-tab ${selectedMonth === ym ? 'active' : ''}`}
                                    onClick={() => { setSelectedMonth(ym); setSelectedWeek(null); }}>
                                    {fmtMonth(ym)}
                                </button>
                            ))}
                        </div>
                        <button className="btn btn-sm btn-ghost" onClick={() => setMonthScrollIdx(i => Math.min(ALL_MONTHS.length - 5, i + 1))} disabled={monthScrollIdx >= ALL_MONTHS.length - 5}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    </div>

                    {/* Row 2: Weeks in selected month */}
                    {weeks.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: selectedWeek ? '10px' : 0 }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', alignSelf: 'center', marginRight: '4px' }}>Week:</span>
                            {weeks.map((w, i) => (
                                <button key={w.start}
                                    className={`btn btn-sm ${selectedWeek?.start === w.start ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ fontSize: '12px', padding: '4px 10px' }}
                                    onClick={() => setSelectedWeek(selectedWeek?.start === w.start ? null : w)}>
                                    W{i + 1} ({w.label})
                                </button>
                            ))}
                        </div>
                    )}

                </div>
            </div>

            <div className="page-body">
                {loading ? (
                    <div className="empty-state">
                        <div className="animate-pulse">Loading Dashboard...</div>
                    </div>
                ) : (
                    <>
                        {/* KPI Cards */}
                        <div className="kpi-grid">
                            <div className="kpi-card">
                                <div className="kpi-card-header">
                                    <span className="kpi-label">Revenue</span>
                                    <div className="kpi-icon revenue">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                                    </div>
                                </div>
                                <div className="kpi-value">{formatCurrency(kpis.revenue)}</div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-card-header">
                                    <span className="kpi-label">Profit</span>
                                    <div className="kpi-icon profit">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
                                    </div>
                                </div>
                                <div className="kpi-value">{formatCurrency(kpis.profit)}</div>
                                <div className={`kpi-change ${kpis.profit >= 0 ? 'positive' : 'negative'}`}>
                                    <span>{profitMargin}% margin</span>
                                </div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-card-header">
                                    <span className="kpi-label">Expenses</span>
                                    <div className="kpi-icon expense">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                                    </div>
                                </div>
                                <div className="kpi-value">{formatCurrency(kpis.totalExpenses)}</div>
                                <div className="kpi-change">
                                    <span>{expensePercent}% of revenue</span>
                                </div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-card-header">
                                    <span className="kpi-label">Withdrawals</span>
                                    <div className="kpi-icon withdrawal">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                                    </div>
                                </div>
                                <div className="kpi-value">{formatCurrency(kpis.founderWithdrawals)}</div>
                                <div className="kpi-change">
                                    <span>{withdrawalPercent}% of revenue</span>
                                </div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-card-header">
                                    <span className="kpi-label">Balance</span>
                                    <div className="kpi-icon profit">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v8m4-4H8" /></svg>
                                    </div>
                                </div>
                                <div className="kpi-value">{formatCurrency(totalBalance)}</div>
                                <div className="kpi-change">
                                    <span>{balancePercent}% of revenue</span>
                                </div>
                            </div>
                        </div>

                        {/* MRR + Growth KPI Row */}
                        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '24px' }}>
                            <div className="kpi-card">
                                <div className="kpi-card-header">
                                    <span className="kpi-label">MRR (Recurring Revenue)</span>
                                    <div className="kpi-icon revenue">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                                    </div>
                                </div>
                                <div className="kpi-value">{formatCurrency(data.mrrData.mrr)}</div>
                                <div className="kpi-change"><span>Recurring income</span></div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-card-header">
                                    <span className="kpi-label">Recurring Costs</span>
                                    <div className="kpi-icon expenses">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    </div>
                                </div>
                                <div className="kpi-value">{formatCurrency(data.mrrData.recurringCosts)}</div>
                                <div className="kpi-change"><span>Subscriptions & tools</span></div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-card-header">
                                    <span className="kpi-label">New Clients</span>
                                    <div className="kpi-icon revenue">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                    </div>
                                </div>
                                <div className="kpi-value">{data.newCounts.newClients}</div>
                                <div className="kpi-change"><span>Added this period</span></div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-card-header">
                                    <span className="kpi-label">New Projects</span>
                                    <div className="kpi-icon profit">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                    </div>
                                </div>
                                <div className="kpi-value">{data.newCounts.newProjects}</div>
                                <div className="kpi-change"><span>Started this period</span></div>
                            </div>
                        </div>

                        {/* Charts Row */}
                        <div className="chart-grid">
                            <div className="card">
                                <div className="card-header"><h3 className="card-title">Expense Breakdown</h3></div>
                                <div className="card-body">
                                    <div style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.94rem' }}>
                                        Expense categories sorted by amount.
                                    </div>
                                    <div style={{ marginTop: '0.5rem' }}>
                                        {sortedExpenseCategories.length === 0 ? (
                                            <p className="text-muted" style={{ margin: 0 }}>No expense categories available.</p>
                                        ) : (
                                            sortedExpenseCategories.map(item => (
                                                <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '6px', color: '#111' }}>{item.label}</div>
                                                        <div style={{ background: 'rgba(0,0,0,0.08)', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${expenseTotal > 0 ? (item.value / expenseTotal) * 100 : 0}%`, height: '100%', background: 'rgba(0,0,0,0.55)', borderRadius: '999px' }} />
                                                        </div>
                                                    </div>
                                                    <div style={{ whiteSpace: 'nowrap', fontSize: '0.95rem', color: '#111' }}>{formatCurrency(item.value)}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header"><h3 className="card-title">Revenue & Profit Trend</h3></div>
                                <div className="card-body">
                                    <div className="chart-container" style={{ position: 'relative', height: '300px' }}>
                                        <Bar data={trendChartData} options={trendChartOptions} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary Widgets */}
                        <div className="summary-grid">
                            <div className="summary-card">
                                <div className="summary-card-header" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <h4 className="card-title">Accounts Receivable / Payable</h4>
                                    <div className="text-xs text-muted" style={{ marginTop: '6px' }}>Only worked out for this month.</div>
                                </div>
                                <div className="summary-item">
                                    <span className="summary-item-label">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00A876" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /></svg>
                                        Accounts Receivable
                                    </span>
                                    <span className="summary-item-value positive">{formatCurrency(data.moneyOwed.clientsOweUs)}</span>
                                </div>
                                <div className="summary-item">
                                    <span className="summary-item-label">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /></svg>
                                        Accounts Payable
                                    </span>
                                    <span className="summary-item-value negative">{formatCurrency(data.moneyOwed.weOweContractors)}</span>
                                </div>
                            </div>

                            <div className="summary-card">
                                <div className="summary-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 className="card-title" style={{ margin: 0 }}>Founder Balances</h4>
                                    <div className="btn-group" style={{ display: 'flex', gap: '4px' }}>
                                        <button className={`btn btn-xs ${founderView === 'Monthly' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFounderView('Monthly')}>Monthly</button>
                                        <button className={`btn btn-xs ${founderView === 'Yearly' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFounderView('Yearly')}>Yearly</button>
                                    </div>
                                </div>
                                <div className="founder-widget" style={{ minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    {(!data.founderBalances[founderView.toLowerCase()] || data.founderBalances[founderView.toLowerCase()].length === 0) ? (
                                        <p className="text-muted text-center" style={{ padding: '12px', margin: 0 }}>All settled up!</p>
                                    ) : (
                                        data.founderBalances[founderView.toLowerCase()].map(f => (
                                            <div className="founder-card" key={f.id}>
                                                <div className="founder-name">{f.name}</div>
                                                <div className="founder-balance text-success">{formatCurrency(f.balance)}</div>
                                                <div className="founder-label">owed</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="summary-card">
                                <div className="summary-card-header">
                                    <h4 className="card-title">Recent Transactions</h4>
                                </div>
                                <div>
                                    {data.recentTransactions.length === 0 ? (
                                        <div className="empty-state" style={{ padding: '24px' }}>
                                            <p className="text-muted">No transactions found</p>
                                        </div>
                                    ) : (
                                        data.recentTransactions.map(tx => (
                                            <div className="summary-item" key={tx.id}>
                                                <span className="summary-item-label">
                                                    <Badge className={getTypeBadge(tx.type)}>{tx.type}</Badge>
                                                    <span className="text-sm text-muted" style={{ marginLeft: '8px' }}>{formatDateShort(tx.date)}</span>
                                                </span>
                                                <span className={`summary-item-value ${tx.type === 'Revenue' ? 'positive' : ''}`}>
                                                    {tx.type === 'Revenue' ? '+' : '-'}{formatCurrency(tx.amount)}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="summary-card">
                                <div className="summary-card-header"><h4 className="card-title">Account Balances</h4></div>
                                <div>
                                    {Object.entries(data.accountBalances).map(([account, balance]) => (
                                        <div className="summary-item" key={account}>
                                            <span className="summary-item-label">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                                                {account}
                                            </span>
                                            <span className={`summary-item-value ${balance >= 0 ? 'positive' : 'negative'}`}>
                                                {formatCurrency(balance)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="summary-card">
                                <div className="summary-card-header"><h4 className="card-title">Recurring Costs</h4></div>
                                <div className="summary-item">
                                    <span className="summary-item-label">Expected recurring costs this period</span>
                                    <span className="summary-item-value negative">{formatCurrency(data.mrrData.recurringCosts)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Account Balance Reconciliation */}
                        <AccountReconciliation />
                    </>
                )}
            </div>
        </>
    );
}
