import React, { useState, useEffect } from 'react';
import { db } from '../lib/supabase';
import { formatDateShort, formatCurrency } from '../lib/utils';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

const EMPTY_FORM = {
    date: new Date().toISOString().split('T')[0],
    type: 'Dev Payment',
    amount: '',
    description: '',
    project_id: '',
    person_id: ''
};

export default function Debts() {
    const [debts, setDebts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState([]);
    const [people, setPeople] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDebt, setEditingDebt] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [modalError, setModalError] = useState('');
    const [saving, setSaving] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const loadDebts = async () => {
        setLoading(true);
        try {
            const [data, projData, peopleData] = await Promise.all([
                db.debts.getPendingObligations(),
                db.projects.getAll(),
                db.people.getAll()
            ]);
            setDebts(data);
            setProjects(projData);
            setPeople(peopleData);
        } catch (error) {
            console.error('Error loading debts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadDebts(); }, []);

    const openAddModal = () => {
        setEditingDebt(null);
        setFormData(EMPTY_FORM);
        setModalError('');
        setIsModalOpen(true);
    };

    const openEditModal = (debt) => {
        setEditingDebt(debt);
        setFormData({
            date: debt.date || new Date().toISOString().split('T')[0],
            type: debt.type || 'Dev Payment',
            amount: debt.amount || '',
            description: debt.description || '',
            project_id: debt.project_id || '',
            person_id: debt.person_id || ''
        });
        setModalError('');
        setIsModalOpen(true);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            setModalError('Amount is required');
            return;
        }
        setSaving(true);
        setModalError('');
        try {
            const payload = {
                date: formData.date,
                type: formData.type,
                amount: parseFloat(formData.amount),
                description: formData.description || null,
                project_id: formData.project_id || null,
                person_id: formData.person_id || null,
                account: 'Bank'
            };
            if (editingDebt) {
                await db.debts.update(editingDebt.id, payload);
            } else {
                await db.debts.create(payload);
            }
            setIsModalOpen(false);
            loadDebts();
        } catch (err) {
            setModalError(err.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleMarkPaid = (id) => {
        setConfirmDeleteId(id);
    };

    const confirmMarkPaid = async () => {
        if (!confirmDeleteId) return;
        try {
            await db.debts.markPaid(confirmDeleteId);
            loadDebts();
        } catch (error) {
            console.error('Error marking paid:', error);
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const totalDevAmount     = debts.filter(d => d.type === 'Dev Payment').reduce((s, d) => s + parseFloat(d.amount || 0), 0);
    const totalMiscAmount    = debts.filter(d => d.type === 'Misc Expense').reduce((s, d) => s + parseFloat(d.amount || 0), 0);
    const totalSalaryAmount  = debts.filter(d => d.type === 'Salary').reduce((s, d) => s + parseFloat(d.amount || 0), 0);
    const grandTotal = totalDevAmount + totalMiscAmount + totalSalaryAmount;

    let displayDebts = [...debts];
    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        displayDebts = displayDebts.filter(d => 
            d.description?.toLowerCase().includes(lowerTerm) || 
            d.people?.name?.toLowerCase().includes(lowerTerm) ||
            d.projects?.project_name?.toLowerCase().includes(lowerTerm)
        );
    }

    return (
        <>
            <header className="page-header tapestry-header">
                <h1 className="page-title">Pending Debts & Obligations</h1>
                <div className="page-actions">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="form-input"
                        placeholder="Search debts..."
                        style={{ width: '200px' }}
                    />
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Add Entry
                    </button>
                </div>
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
                                    <tr><td colSpan="7"><div className="empty-state"><div className="animate-pulse">Loading pending obligations...</div></div></td></tr>
                                ) : displayDebts.length === 0 ? (
                                    <tr><td colSpan="7">
                                        <div className="empty-state">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="empty-state-icon text-success">
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                            </svg>
                                            <p className="empty-state-title">You're all caught up!</p>
                                            <p className="empty-state-description">No pending debts or obligations found.</p>
                                            <button className="btn btn-primary" onClick={openAddModal}>Add Entry</button>
                                        </div>
                                    </td></tr>
                                ) : (
                                    displayDebts.map(debt => (
                                        <tr key={debt.id}>
                                            <td>{formatDateShort(debt.date)}</td>
                                            <td><Badge className="badge-warning">{debt.type}</Badge></td>
                                            <td className="font-medium">{debt.people?.name || '-'}</td>
                                            <td>{debt.projects?.project_name || '-'}</td>
                                            <td className="text-muted">{debt.description || '-'}</td>
                                            <td className="text-right font-semibold text-error">{formatCurrency(debt.amount)}</td>
                                            <td>
                                                <div className="flex gap-sm">
                                                    <button className="btn btn-sm btn-ghost" onClick={() => openEditModal(debt)} title="Edit">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    </button>
                                                    <button className="btn btn-sm btn-primary" onClick={() => handleMarkPaid(debt.id)}>
                                                        Mark Paid
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add / Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingDebt ? 'Edit Debt Entry' : 'Add Debt Entry'}
                maxWidth="480px"
                footerActions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : editingDebt ? 'Save Changes' : 'Add Entry'}
                        </button>
                    </>
                }
            >
                {modalError && <div className="alert alert-error mb-md">{modalError}</div>}
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Date *</label>
                        <input type="date" name="date" className="form-input" value={formData.date} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Amount (USD) *</label>
                        <input type="number" name="amount" className="form-input" placeholder="0.00" step="0.01" min="0" value={formData.amount} onChange={handleFormChange} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Type *</label>
                    <select name="type" className="form-select" value={formData.type} onChange={handleFormChange}>
                        <option value="Dev Payment">Dev Payment</option>
                        <option value="Salary">Salary</option>
                        <option value="Misc Expense">Misc Expense</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Person <span className="text-muted">(Optional)</span></label>
                    <select name="person_id" className="form-select" value={formData.person_id} onChange={handleFormChange}>
                        <option value="">No person</option>
                        {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Project <span className="text-muted">(Optional)</span></label>
                    <select name="project_id" className="form-select" value={formData.project_id} onChange={handleFormChange}>
                        <option value="">No project</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Description</label>
                    <input type="text" name="description" className="form-input" placeholder="e.g. Payment for March deliverable" value={formData.description} onChange={handleFormChange} />
                </div>
            </Modal>

            <ConfirmModal
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={confirmMarkPaid}
                title="Mark Paid"
                message="Are you sure you want to mark this obligation as paid? This will create a completed transaction."
                confirmText="Mark Paid"
                confirmColor="btn-success"
            />
        </>
    );
}
