import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

const currentYear = new Date().getFullYear();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Reports() {
    const [year, setYear] = useState(currentYear);
    const [monthlyData, setMonthlyData] = useState([]);
    const [platformData, setPlatformData] = useState({});
    const [topClients, setTopClients] = useState([]);
    const [topProjects, setTopProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

    useEffect(() => {
        loadData();
    }, [year]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [mSummary, tClients, tProj, transactions] = await Promise.all([
                db.reports.getMonthlySummary(year),
                db.clients.getWithFinancials(),
                db.projects.getWithFinancials(),
                db.transactions.getAll({ startDate: `${year}-01-01`, endDate: `${year}-12-31`, type: 'Revenue' })
            ]);

            setMonthlyData(mSummary);

            // Top clients
            const sortedClients = tClients
                .sort((a, b) => parseFloat(b.total_revenue || 0) - parseFloat(a.total_revenue || 0))
                .slice(0, 5);
            setTopClients(sortedClients);

            // Top projects
            const sortedProjects = tProj.map(p => ({
                ...p,
                profit: (parseFloat(p.total_received) || 0) - (parseFloat(p.total_dev_payments) || 0)
            })).sort((a, b) => b.profit - a.profit).slice(0, 5);
            setTopProjects(sortedProjects);

            // Platform data
            const platTotals = transactions.reduce((acc, tx) => {
                acc[tx.account] = (acc[tx.account] || 0) + parseFloat(tx.amount || 0);
                return acc;
            }, {});
            setPlatformData(platTotals);

        } catch (error) {
            console.error('Error loading reports:', error);
            alert('Failed to load reports');
        } finally {
            setLoading(false);
        }
    };

    // Calculate annual totals
    const annualTotals = useMemo(() => {
        return monthlyData.reduce((acc, m) => {
            acc.revenue += parseFloat(m.revenue) || 0;
            acc.profit += parseFloat(m.net_profit) || 0;
            acc.expenses += (parseFloat(m.dev_payments) || 0) +
                (parseFloat(m.tool_costs) || 0) +
                (parseFloat(m.ads) || 0) +
                (parseFloat(m.misc_expenses) || 0) +
                (parseFloat(m.salaries) || 0);
            return acc;
        }, { revenue: 0, profit: 0, expenses: 0 });
    }, [monthlyData]);

    const profitMargin = annualTotals.revenue > 0 ? (annualTotals.profit / annualTotals.revenue) * 100 : 0;

    // Chart Data
    const barChartData = useMemo(() => {
        const data = MONTHS.map((_, i) => {
            const monthNum = i + 1;
            const monthData = monthlyData.find(d => {
                const monthStr = d.month ? d.month.substring(5, 7) : '';
                return parseInt(monthStr) === monthNum;
            });
            return {
                revenue: monthData ? parseFloat(monthData.revenue) : 0,
                profit: monthData ? parseFloat(monthData.net_profit) : 0
            };
        });

        return {
            labels: MONTHS,
            datasets: [
                {
                    label: 'Revenue',
                    data: data.map(d => d.revenue),
                    backgroundColor: 'rgba(159, 232, 112, 0.7)',
                    borderColor: '#9FE870',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Profit',
                    data: data.map(d => d.profit),
                    backgroundColor: 'rgba(22, 51, 0, 0.8)',
                    borderColor: '#163300',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        };
    }, [monthlyData]);

    const doughnutChartData = useMemo(() => {
        const labels = Object.keys(platformData);
        const data = Object.values(platformData);

        return {
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
        };
    }, [platformData]);

    const exportCSV = () => {
        let csv = `Month,Revenue,Dev Payments,Tool Costs,Other Expenses,Withdrawals,Profit,Margin %\n`;

        MONTHS_FULL.forEach((monthName, i) => {
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

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financial-report-${year}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return <div className="p-xl text-center">Loading reports...</div>;
    }

    return (
        <>
            <header className="page-header tapestry-header">
                <h1 className="page-title">Financial Reports</h1>
                <div className="page-actions">
                    <select className="form-select" style={{ width: 'auto' }} value={year} onChange={e => setYear(Number(e.target.value))}>
                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button className="btn btn-secondary" onClick={exportCSV}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Export CSV
                    </button>
                </div>
            </header>

            <div className="page-body">
                {/* Annual Summary */}
                <div className="kpi-grid" style={{ marginBottom: '24px' }}>
                    <div className="kpi-card">
                        <div className="kpi-label">Annual Revenue</div>
                        <div className="kpi-value">{formatCurrency(annualTotals.revenue)}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Annual Profit</div>
                        <div className="kpi-value text-success">{formatCurrency(annualTotals.profit)}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Total Expenses</div>
                        <div className="kpi-value">{formatCurrency(annualTotals.expenses)}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Profit Margin</div>
                        <div className="kpi-value">{profitMargin.toFixed(1)}%</div>
                    </div>
                </div>

                {/* Charts */}
                <div className="grid-2" style={{ marginBottom: '24px' }}>
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Monthly Revenue vs Profit</h3>
                        </div>
                        <div className="card-body" style={{ height: '300px' }}>
                            <Bar
                                data={barChartData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } } },
                                    scales: { y: { beginAtZero: true, ticks: { callback: v => formatCurrency(v) } } }
                                }}
                            />
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Revenue by Platform</h3>
                        </div>
                        <div className="card-body" style={{ height: '300px' }}>
                            <Doughnut
                                data={doughnutChartData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
                                        tooltip: {
                                            callbacks: {
                                                label: (context) => {
                                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                                    const percent = ((context.raw / total) * 100).toFixed(1);
                                                    return `${context.label}: ${formatCurrency(context.raw)} (${percent}%)`;
                                                }
                                            }
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Monthly Summary Table */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Monthly Summary</h3>
                    </div>
                    <div className="card-body">
                        <table className="table" style={{ margin: '-16px' }}>
                            <thead>
                                <tr>
                                    <th>Month</th>
                                    <th className="text-right">Revenue</th>
                                    <th className="text-right">Dev Payments</th>
                                    <th className="text-right">Tools</th>
                                    <th className="text-right">Other Expenses</th>
                                    <th className="text-right">Withdrawals</th>
                                    <th className="text-right">Profit</th>
                                    <th className="text-right">Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {MONTHS.map((monthName, i) => {
                                    const monthNum = i + 1;
                                    const mData = monthlyData.find(d => {
                                        const monthStr = d.month ? d.month.substring(5, 7) : '';
                                        return parseInt(monthStr) === monthNum;
                                    });

                                    if (!mData) {
                                        return (
                                            <tr key={monthName} className="text-muted">
                                                <td>{monthName}</td>
                                                <td className="text-right">-</td>
                                                <td className="text-right">-</td>
                                                <td className="text-right">-</td>
                                                <td className="text-right">-</td>
                                                <td className="text-right">-</td>
                                                <td className="text-right">-</td>
                                                <td className="text-right">-</td>
                                            </tr>
                                        );
                                    }

                                    const revenue = parseFloat(mData.revenue) || 0;
                                    const devPayments = parseFloat(mData.dev_payments) || 0;
                                    const toolCosts = parseFloat(mData.tool_costs) || 0;
                                    const otherExpenses = (parseFloat(mData.ads) || 0) + (parseFloat(mData.misc_expenses) || 0) + (parseFloat(mData.salaries) || 0);
                                    const withdrawals = parseFloat(mData.founder_withdrawals) || 0;
                                    const profit = parseFloat(mData.net_profit) || 0;
                                    const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;

                                    return (
                                        <tr key={monthName}>
                                            <td className="font-medium">{monthName}</td>
                                            <td className="text-right text-success">{formatCurrency(revenue)}</td>
                                            <td className="text-right">{formatCurrency(devPayments)}</td>
                                            <td className="text-right">{formatCurrency(toolCosts)}</td>
                                            <td className="text-right">{formatCurrency(otherExpenses)}</td>
                                            <td className="text-right">{formatCurrency(withdrawals)}</td>
                                            <td className={`text-right font-medium ${profit >= 0 ? 'text-success' : 'text-error'}`}>{formatCurrency(profit)}</td>
                                            <td className="text-right">{margin}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Top Clients & Projects */}
                <div className="grid-2" style={{ marginTop: '24px' }}>
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Top Clients by Revenue</h3>
                        </div>
                        <div className="card-body">
                            {topClients.length > 0 ? (
                                <div className="space-y-sm">
                                    {topClients.map((c, i) => (
                                        <div key={c.id} className="flex justify-between items-center py-sm" style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <div className="flex items-center gap-sm">
                                                <span className="text-sm text-muted" style={{ width: '20px' }}>#{i + 1}</span>
                                                <span className="font-medium">{c.client_name}</span>
                                            </div>
                                            <span className="text-success font-medium">{formatCurrency(c.total_revenue)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-muted text-center">No client data yet</p>}
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Top Projects by Profit</h3>
                        </div>
                        <div className="card-body">
                            {topProjects.length > 0 ? (
                                <div className="space-y-sm">
                                    {topProjects.map((p, i) => {
                                        const profit = p.profit || 0;
                                        return (
                                            <div key={p.id} className="flex justify-between items-center py-sm" style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <div className="flex items-center gap-sm">
                                                    <span className="text-sm text-muted" style={{ width: '20px' }}>#{i + 1}</span>
                                                    <span className="font-medium">{p.project_name}</span>
                                                </div>
                                                <span className={`${profit >= 0 ? 'text-success' : 'text-error'} font-medium`}>{formatCurrency(profit)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <p className="text-muted text-center">No project data yet</p>}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

