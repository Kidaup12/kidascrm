import React, { useState, useEffect } from 'react';
import { db } from '../lib/supabase';
import { formatDateShort, formatCurrency } from '../lib/utils';
import Badge from '../components/Badge';

export default function Debts() {
    const [debts, setDebts] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadDebts = async () => {
        setLoading(true);
        try {
            const data = await db.debts.getPendingObligations();
            setDebts(data);
        } catch (error) {
            console.error('Error loading debts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDebts();
    }, []);

    const handleMarkPaid = async (id) => {
        if (!window.confirm('Mark this obligation as paid?')) return;
        try {
            await db.debts.markPaid(id);
            loadDebts(); // reload the list
        } catch (error) {
            console.error('Error marking paid:', error);
            alert('Failed to update status');
        }
    };

    const totalDevAmount = debts.filter(d => d.type === 'Dev Payment').reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    const totalMiscAmount = debts.filter(d => d.type === 'Misc Expense').reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    const totalSalaryAmount = debts.filter(d => d.type === 'Salary').reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    const grandTotal = totalDevAmount + totalMiscAmount + totalSalaryAmount;

    return (
        <>
            <header className="page-header tapestry-header">
                <h1 className="page-title">Pending Debts & Obligations</h1>
            </header>

            <div className="page-body">
                <div className="summary-grid mb-lg">
                    <div className="summary-card">
                        <div className="summary-card-header"><h4 className="card-title">Total Pending</h4></div>
                        <div className="summary-item-value text-error" style={{ fontSize: '1.5rem', marginTop: '10px' }}>
                            {formatCurrency(grandTotal)}
                        </div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-card-header"><h4 className="card-title">Breakdown</h4></div>
                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div className="flex justify-between">
                                <span className="text-muted">Dev Payments:</span>
                                <span className="font-medium">{formatCurrency(totalDevAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Salaries:</span>
                                <span className="font-medium">{formatCurrency(totalSalaryAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Misc Expenses:</span>
                                <span className="font-medium">{formatCurrency(totalMiscAmount)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Date Added</th>
                                    <th>Type</th>
                                    <th>Payee / Person</th>
                                    <th>Project</th>
                                    <th>Description</th>
                                    <th className="text-right">Amount</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="7">
                                            <div className="empty-state">
                                                <div className="animate-pulse">Loading pending obligations...</div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : debts.length === 0 ? (
                                    <tr>
                                        <td colSpan="7">
                                            <div className="empty-state">
                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="empty-state-icon text-success">
                                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                                </svg>
                                                <p className="empty-state-title">You're all caught up!</p>
                                                <p className="empty-state-description">No pending debts or obligations found.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    debts.map(debt => (
                                        <tr key={debt.id}>
                                            <td>{formatDateShort(debt.date)}</td>
                                            <td><Badge className="badge-warning">{debt.type}</Badge></td>
                                            <td className="font-medium">{debt.people?.name || '-'}</td>
                                            <td>{debt.projects?.project_name || '-'}</td>
                                            <td className="text-muted">{debt.description || '-'}</td>
                                            <td className="text-right font-semibold text-error">{formatCurrency(debt.amount)}</td>
                                            <td>
                                                <button className="btn btn-sm btn-primary" onClick={() => handleMarkPaid(debt.id)}>
                                                    Mark Paid
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
