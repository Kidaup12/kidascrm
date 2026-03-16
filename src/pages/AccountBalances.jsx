'use client';

import { useState, useEffect } from 'react';
import { db } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import AccountReconciliation from '../components/AccountReconciliation';

export default function AccountBalances() {
    const [selectedMonth, setSelectedMonth] = useState('');
    const [availableMonths, setAvailableMonths] = useState([]);
    const [visibleMonthsWindow, setVisibleMonthsWindow] = useState([0, 5]);

    useEffect(() => {
        initializeMonthPicker();
    }, []);

    const initializeMonthPicker = () => {
        // Start from Jan 2025 as per reconciliation logic starting Jan 2026/late 2025
        const startDate = new Date('2025-01-01');
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        const months = [];
        let current = new Date(startDate);
        while (current <= endDate) {
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            months.push(`${year}-${month}`);
            current.setMonth(current.getMonth() + 1);
        }

        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        setAvailableMonths(months);
        setSelectedMonth(currentMonthStr);

        const currentIndex = months.indexOf(currentMonthStr);
        const start = Math.max(0, currentIndex - 2);
        setVisibleMonthsWindow([start, Math.min(months.length, start + 5)]);
    };

    const handleMonthSelect = (month) => {
        setSelectedMonth(month);
    };

    const changeMonthWindow = (direction) => {
        const currentIndex = availableMonths.indexOf(selectedMonth);
        const newIndex = currentIndex + direction;

        if (newIndex >= 0 && newIndex < availableMonths.length) {
            setSelectedMonth(availableMonths[newIndex]);
            const start = Math.max(0, newIndex - 2);
            setVisibleMonthsWindow([start, Math.min(availableMonths.length, start + 5)]);
        }
    };

    const visibleMonths = availableMonths.slice(visibleMonthsWindow[0], visibleMonthsWindow[1]);
    const selectedIndex = availableMonths.indexOf(selectedMonth);

    return (
        <>
            <header className="page-header tapestry-header">
                <h1 className="page-title">Account Balances</h1>
                <p className="text-muted">Reconcile opening and closing balances for all accounts.</p>
            </header>

            <div className="page-body">
                <div className="card mb-lg">
                    <div className="card-body" style={{ padding: '16px 24px' }}>
                        <div className="month-picker-container">
                            <button className="btn btn-sm btn-ghost" onClick={() => changeMonthWindow(-1)} disabled={selectedIndex <= 0}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                            <div className="month-tabs">
                                {visibleMonths.map(month => {
                                    const [year, mNum] = month.split('-');
                                    const d = new Date(year, mNum - 1);
                                    const monthName = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                                    return (
                                        <button 
                                            key={month} 
                                            className={`month-tab ${month === selectedMonth ? 'active' : ''}`} 
                                            onClick={() => handleMonthSelect(month)}
                                        >
                                            {monthName}
                                        </button>
                                    );
                                })}
                            </div>
                            <button className="btn btn-sm btn-ghost" onClick={() => changeMonthWindow(1)} disabled={selectedIndex >= availableMonths.length - 1}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Monthly Reconciliation</h2>
                    </div>
                    <div className="card-body">
                        {selectedMonth && <AccountReconciliation selectedMonth={selectedMonth} />}
                    </div>
                </div>
            </div>
        </>
    );
}
