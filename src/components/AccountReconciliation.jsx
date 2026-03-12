'use client';
import { useState, useEffect } from 'react';
import { db } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import Modal from './Modal';

const ACCOUNTS = ['Upwork', 'Wise', 'Bank', 'Till'];
const MONTHS_BACK = 12;

function getMonthList() {
    const months = [];
    const now = new Date();
    for (let i = 0; i < MONTHS_BACK; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        months.push({ key, label });
    }
    return months;
}

export default function AccountReconciliation() {
    const months = getMonthList();
    const [selectedMonth, setSelectedMonth] = useState(months[0].key);
    const [balances, setBalances] = useState({}); // { account: { opening_balance, closing_balance, is_locked } }
    const [calculated, setCalculated] = useState({}); // { account: net_from_transactions }
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editAccount, setEditAccount] = useState(null);
    const [editFields, setEditFields] = useState({ opening_balance: '', closing_balance: '' });
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [records, ...calcs] = await Promise.all([
                db.accountBalances.getByMonth(selectedMonth),
                ...ACCOUNTS.map(a => db.accountBalances.getCalculatedBalance(a, selectedMonth))
            ]);
            const balMap = {};
            records.forEach(r => { balMap[r.account] = r; });
            setBalances(balMap);
            const calcMap = {};
            ACCOUNTS.forEach((a, i) => { calcMap[a] = calcs[i]; });
            setCalculated(calcMap);
        } catch (e) {
            console.error('Account balance load error', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [selectedMonth]);

    const openEdit = (account) => {
        const rec = balances[account] || {};
        setEditAccount(account);
        setEditFields({
            opening_balance: rec.opening_balance ?? '',
            closing_balance: rec.closing_balance ?? ''
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const isJan2026 = selectedMonth === '2026-01';
            const rec = balances[editAccount];
            await db.accountBalances.upsert(editAccount, selectedMonth, {
                opening_balance: editFields.opening_balance !== '' ? parseFloat(editFields.opening_balance) : null,
                closing_balance: editFields.closing_balance !== '' ? parseFloat(editFields.closing_balance) : null,
                is_locked: isJan2026 ? true : (rec?.is_locked || false)
            });
            setIsModalOpen(false);
            load();
        } catch (e) {
            alert('Failed to save: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const isJan2026 = selectedMonth === '2026-01';

    return (
        <div className="card mb-lg">
            <div className="card-header" style={{ alignItems: 'center' }}>
                <h3 className="card-title">Account Balance Reconciliation</h3>
                <select
                    className="form-select"
                    style={{ width: 'auto', fontSize: '13px' }}
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                >
                    {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
            </div>
            <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
                {loading ? (
                    <div className="empty-state"><div className="animate-pulse">Loading balances...</div></div>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Account</th>
                                <th className="text-right">Opening Balance</th>
                                <th className="text-right">Net Transactions</th>
                                <th className="text-right">Expected Closing</th>
                                <th className="text-right">Actual Closing</th>
                                <th className="text-right">Difference</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {ACCOUNTS.map(account => {
                                const rec = balances[account] || {};
                                const opening = parseFloat(rec.opening_balance ?? 0);
                                const net = calculated[account] ?? 0;
                                const expected = opening + net;
                                const actual = rec.closing_balance != null ? parseFloat(rec.closing_balance) : null;
                                const diff = actual != null ? actual - expected : null;
                                const locked = rec.is_locked;
                                return (
                                    <tr key={account}>
                                        <td className="font-medium">{account}</td>
                                        <td className="text-right">
                                            {rec.opening_balance != null ? formatCurrency(opening) : <span className="text-muted">—</span>}
                                            {locked && <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--color-success)' }}>🔒</span>}
                                        </td>
                                        <td className="text-right" style={{ color: net >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                                            {net >= 0 ? '+' : ''}{formatCurrency(net)}
                                        </td>
                                        <td className="text-right font-medium">{formatCurrency(expected)}</td>
                                        <td className="text-right">
                                            {actual != null ? formatCurrency(actual) : <span className="text-muted">Not entered</span>}
                                        </td>
                                        <td className="text-right">
                                            {diff != null ? (
                                                <span style={{ color: Math.abs(diff) < 0.01 ? 'var(--color-success)' : diff > 0 ? 'var(--color-warning)' : 'var(--color-error)', fontWeight: 600 }}>
                                                    {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                                                    {Math.abs(diff) < 0.01 && ' ✓'}
                                                </span>
                                            ) : <span className="text-muted">—</span>}
                                        </td>
                                        <td>
                                            <button className="btn btn-sm btn-ghost" onClick={() => openEdit(account)}>
                                                {rec.opening_balance != null || rec.closing_balance != null ? 'Edit' : 'Enter'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            {isJan2026 && (
                <div style={{ padding: '8px 20px 12px', fontSize: '12px', color: 'var(--color-text-secondary)', background: 'var(--color-bg-tertiary)', borderTop: '1px solid var(--color-border)' }}>
                    📌 Jan 2026 is the starting point. Opening balances entered here will be locked after saving.
                </div>
            )}

            {/* Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
                title={`${editAccount} — ${months.find(m => m.key === selectedMonth)?.label}`}
                maxWidth="400px"
                footerActions={<>
                    <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                </>}
            >
                {isJan2026 && (
                    <div style={{ padding: '10px', marginBottom: '16px', background: 'rgba(0,168,118,0.1)', borderRadius: '8px', fontSize: '13px', color: 'var(--color-success)' }}>
                        This is the Jan 2026 starting point. Opening balance will be locked after save.
                    </div>
                )}
                <div className="form-group">
                    <label className="form-label">Opening Balance ($)</label>
                    <input type="number" className="form-input" step="0.01"
                        value={editFields.opening_balance}
                        onChange={e => setEditFields(p => ({ ...p, opening_balance: e.target.value }))}
                        disabled={!isJan2026 && balances[editAccount]?.is_locked}
                        placeholder="0.00"
                    />
                    {!isJan2026 && balances[editAccount]?.is_locked && (
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: 4 }}>🔒 Locked after Jan 2026</div>
                    )}
                </div>
                <div className="form-group">
                    <label className="form-label">Actual Closing Balance ($) <span className="text-muted">(enter after month ends)</span></label>
                    <input type="number" className="form-input" step="0.01"
                        value={editFields.closing_balance}
                        onChange={e => setEditFields(p => ({ ...p, closing_balance: e.target.value }))}
                        placeholder="0.00"
                    />
                </div>
            </Modal>
        </div>
    );
}
