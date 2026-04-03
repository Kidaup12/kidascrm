import { useState, useEffect } from 'react';
import { db } from '../lib/supabase';
import { formatCurrency, formatDateShort, getRoleBadge, getStatusBadge, getTypeBadge } from '../lib/utils';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

export default function People() {
    // Data State
    const [peopleData, setPeopleData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Filters State
    const [roleFilter, setRoleFilter] = useState('');

    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [currentPerson, setCurrentPerson] = useState(null);
    const [formData, setFormData] = useState({ name: '', role: 'Contractor', payment_type: 'Per Project', standard_rate: '', is_active: 'true' });
    const [modalError, setModalError] = useState('');

    // View Modal State
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewData, setViewData] = useState({ person: null, transactions: [], totalPaid: 0, totalPending: 0, projectsOverview: [] });
    const [peopleViewTab, setPeopleViewTab] = useState('transactions'); // 'transactions' | 'projects'
    const [contractorOwed, setContractorOwed] = useState([]);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    useEffect(() => {
        loadPeople();
    }, []);

    const loadPeople = async () => {
        setLoading(true);
        try {
            const [data, owedData] = await Promise.all([
                db.people.getWithFinancials(),
                db.contractorOwed.getOwedByContractor()
            ]);
            setPeopleData(data);
            setContractorOwed(owedData);
        } catch (error) {
            console.error('Error loading people:', error);
        } finally {
            setLoading(false);
        }
    };

    let displayPeople = [...peopleData];
    if (roleFilter) {
        displayPeople = displayPeople.filter(p => p.role === roleFilter);
    }

    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        displayPeople = displayPeople.filter(p => 
            p.name?.toLowerCase().includes(lowerTerm) || 
            p.role?.toLowerCase().includes(lowerTerm)
        );
    }

    // Summary calculations
    const summaryTotalPeople = displayPeople.length;
    const summaryTotalPaid = displayPeople.reduce((sum, p) => sum + parseFloat(p.total_paid || 0), 0);
    const summaryTotalPending = displayPeople.reduce((sum, p) => sum + parseFloat(p.total_pending || 0), 0);

    // Form Handlers
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const openAddModal = () => {
        setCurrentPerson(null);
        setFormData({ name: '', role: 'Contractor', payment_type: 'Per Project', standard_rate: '', is_active: 'true' });
        setModalError('');
        setIsAddEditModalOpen(true);
    };

    const openEditModal = async (id) => {
        try {
            const person = await db.people.getById(id);
            setCurrentPerson(person);
            setFormData({
                name: person.name || '',
                role: person.role || 'Contractor',
                payment_type: person.payment_type || 'Per Project',
                standard_rate: person.standard_rate || '',
                is_active: person.is_active ? 'true' : 'false'
            });
            setModalError('');
            setIsAddEditModalOpen(true);
        } catch (error) {
            console.error('Error loading person:', error);
        }
    };

    const handleSavePerson = async () => {
        if (!formData.name) {
            alert('Name is required');
            return;
        }

        const dataToSave = {
            ...formData,
            is_active: formData.is_active === 'true',
            standard_rate: formData.standard_rate === '' ? null : Number(formData.standard_rate)
        };

        try {
            if (currentPerson) {
                await db.people.update(currentPerson.id, dataToSave);
            } else {
                await db.people.create(dataToSave);
            }
            setIsAddEditModalOpen(false);
            loadPeople();
        } catch (error) {
            console.error('Error saving person:', error);
            setModalError(error.message || 'Failed to save person. Check console logs.');
        }
    };

    const handleDeletePerson = (id) => {
        setConfirmDeleteId(id);
    };

    const confirmDeletePerson = async () => {
        if (!confirmDeleteId) return;

        try {
            await db.people.delete(confirmDeleteId);
            loadPeople();
        } catch (error) {
            console.error('Error deleting person:', error);
            alert(error.message || 'Failed to delete person');
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const openViewModal = async (id) => {
        try {
            const [person, transactions, assignedProjects, allProjectFinancials] = await Promise.all([
                db.people.getById(id),
                db.transactions.getByPerson(id),
                db.projectDevelopers.getByPerson(id),
                db.projects.getWithFinancials()
            ]);

            const totalPaid    = transactions.filter(t => t.payment_status === 'Completed').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
            const totalPending = transactions.filter(t => t.payment_status === 'Pending').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

            // Build projects overview with client payment status
            const projectsOverview = assignedProjects.map(ap => {
                const pf = allProjectFinancials.find(p => p.id === ap.project_id) || {};
                const devPaid = transactions
                    .filter(t => t.project_id === ap.project_id && t.payment_status === 'Completed')
                    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
                const devAgreed     = parseFloat(ap.agreed_amount || 0);
                const clientAgreed  = parseFloat(pf.total_agreed_amount || 0);
                const clientReceived = parseFloat(pf.total_received || 0);
                return {
                    id: ap.project_id,
                    name: pf.project_name || ap.projects?.project_name || 'Unknown',
                    clientName: pf.client_name || '-',
                    status: pf.status || '',
                    devAgreed,
                    devPaid,
                    devRemaining: devAgreed - devPaid,
                    clientAgreed,
                    clientReceived,
                    clientOwed: Math.max(0, clientAgreed - clientReceived),
                    projectTransactions: transactions.filter(t => t.project_id === ap.project_id)
                };
            });

            setViewData({ person, transactions, totalPaid, totalPending, projectsOverview });
            setPeopleViewTab('transactions');
            setIsViewModalOpen(true);
        } catch (error) {
            console.error('Error viewing person:', error);
            alert('Failed to load person details');
        }
    };

    const closeViewModal = () => {
        setIsViewModalOpen(false);
    };

    return (
        <>
            <header className="page-header tapestry-header">
                <h1 className="page-title">People & Contractors</h1>
                <div className="page-actions">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="form-input"
                        placeholder="Search people..."
                        style={{ width: '200px' }}
                    />
                    <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="form-select" style={{ width: 'auto' }}>
                        <option value="">All Roles</option>
                        <option value="Founder">Founders</option>
                        <option value="Contractor">Contractors</option>
                        <option value="Fixed Salary Employee">Employees</option>
                    </select>
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Person
                    </button>
                </div>
            </header>

            <div className="page-body">
                {/* Summary Cards */}
                <div className="kpi-grid" style={{ marginBottom: '24px' }}>
                    <div className="kpi-card">
                        <div className="kpi-label">Total Team Members</div>
                        <div className="kpi-value">{summaryTotalPeople}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Total Paid (All Time)</div>
                        <div className="kpi-value text-success">{formatCurrency(summaryTotalPaid)}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Pending Payments</div>
                        <div className="kpi-value text-warning">{formatCurrency(summaryTotalPending)}</div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Role</th>
                                <th>Payment Type</th>
                                <th>Rate</th>
                                <th className="text-right">Total Paid</th>
                                <th className="text-right">Pending</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="8">
                                        <div className="empty-state">
                                            <div className="animate-pulse">Loading people...</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : displayPeople.length === 0 ? (
                                <tr>
                                    <td colSpan="8">
                                        <div className="empty-state">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="empty-state-icon">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                            <p className="empty-state-title">No team members yet</p>
                                            <p className="empty-state-description">Add your first team member to get started</p>
                                            <button className="btn btn-primary" onClick={openAddModal}>Add Person</button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                displayPeople.map(person => {
                                    const roleBg = person.role === 'Founder' ? 'var(--color-accent)' : 'var(--color-primary)';
                                    const roleColor = person.role === 'Founder' ? 'white' : 'var(--color-primary-dark)';

                                    return (
                                        <tr key={person.id}>
                                            <td>
                                                <div className="flex items-center gap-sm">
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: roleBg, color: roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600' }}>
                                                        {person.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium">{person.name}</span>
                                                </div>
                                            </td>
                                            <td><Badge className={getRoleBadge(person.role)}>{person.role}</Badge></td>
                                            <td className="text-muted">{person.payment_type || '-'}</td>
                                            <td>{person.standard_rate ? formatCurrency(person.standard_rate) : '-'}</td>
                                            <td className="text-right font-medium text-success">{formatCurrency(person.total_paid)}</td>
                                            <td className={`text-right ${parseFloat(person.total_pending) > 0 ? 'text-warning font-medium' : 'text-muted'}`}>
                                                {parseFloat(person.total_pending) > 0 ? formatCurrency(person.total_pending) : '-'}
                                            </td>
                                            <td>
                                                {person.is_active
                                                    ? <span className="badge badge-success">Active</span>
                                                    : <span className="badge badge-neutral">Inactive</span>}
                                            </td>
                                            <td>
                                                <div className="flex gap-sm">
                                                    <button className="btn btn-sm btn-ghost" onClick={() => openViewModal(person.id)} title="View">
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                    </button>
                                                    <button className="btn btn-sm btn-ghost" onClick={() => openEditModal(person.id)} title="Edit">
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                    </button>
                                                    <button className="btn btn-sm btn-ghost text-error" onClick={() => handleDeletePerson(person.id)} title="Delete">
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Contractor Owed Section */}
            {contractorOwed.length > 0 && (() => {
                // Group by contractor
                const byContractor = {};
                contractorOwed.forEach(proj => {
                    const name = proj.people?.name || 'Unknown';
                    if (!byContractor[name]) byContractor[name] = { projects: [], totalOwed: 0, totalAgreed: 0, totalPaid: 0 };
                    byContractor[name].projects.push(proj);
                    byContractor[name].totalOwed += proj.owed;
                    byContractor[name].totalAgreed += proj.agreed;
                    byContractor[name].totalPaid += proj.paid;
                });
                const grandOwed = contractorOwed.reduce((s, p) => s + p.owed, 0);
                return (
                    <div className="page-body" style={{ paddingTop: 0 }}>
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Contractor Owed Overview</h3>
                                <div className="text-error font-semibold">{formatCurrency(grandOwed)} total outstanding</div>
                            </div>
                            <div className="card-body" style={{ padding: 0 }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Contractor</th>
                                            <th>Project</th>
                                            <th className="text-right">Agreed</th>
                                            <th className="text-right">Paid</th>
                                            <th className="text-right">Still Owed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(byContractor).map(([name, cData]) => (
                                            <>
                                                {cData.projects.map((proj, idx) => (
                                                    <tr key={proj.id} style={proj.owed > 0 ? { background: 'rgba(255,90,90,0.04)' } : {}}>
                                                        {idx === 0 && (
                                                            <td rowSpan={cData.projects.length} className="font-medium" style={{ verticalAlign: 'top', paddingTop: '14px', borderRight: '1px solid var(--color-border)' }}>
                                                                {name}
                                                                <div className="text-sm text-muted mt-xs">{cData.projects.length} project{cData.projects.length !== 1 ? 's' : ''}</div>
                                                            </td>
                                                        )}
                                                        <td className="text-muted" style={{ fontSize: '13px' }}>{proj.project_name}</td>
                                                        <td className="text-right">{formatCurrency(proj.agreed)}</td>
                                                        <td className="text-right text-success">{formatCurrency(proj.paid)}</td>
                                                        <td className="text-right font-semibold" style={{ color: proj.owed > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                                                            {proj.owed > 0 ? formatCurrency(proj.owed) : '✓ Settled'}
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr style={{ background: 'var(--color-bg-tertiary)', borderTop: '2px solid var(--color-border)' }}>
                                                    <td colSpan={2} className="font-semibold text-sm text-muted">Subtotal — {name}</td>
                                                    <td className="text-right font-medium">{formatCurrency(cData.totalAgreed)}</td>
                                                    <td className="text-right font-medium text-success">{formatCurrency(cData.totalPaid)}</td>
                                                    <td className="text-right font-semibold" style={{ color: cData.totalOwed > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                                                        {formatCurrency(cData.totalOwed)}
                                                    </td>
                                                </tr>
                                            </>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isAddEditModalOpen}
                onClose={() => setIsAddEditModalOpen(false)}
                title={currentPerson ? 'Edit Person' : 'Add Person'}
                footerActions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsAddEditModalOpen(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSavePerson}>Save Person</button>
                    </>
                }
            >
                <form id="personForm" onSubmit={e => e.preventDefault()}>
                    {modalError && <div className="text-error mb-sm" style={{padding: '10px', background: '#ffebee', borderRadius: '4px'}}>{modalError}</div>}
                    <div className="form-group">
                        <label className="form-label">Name *</label>
                        <input type="text" name="name" className="form-input" value={formData.name} onChange={handleFormChange} required />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Role</label>
                            <select name="role" className="form-select" value={formData.role} onChange={handleFormChange}>
                                <option value="Contractor">Contractor</option>
                                <option value="Employee">Employee</option>
                                <option value="Founder">Founder</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Payment Type</label>
                            <select name="payment_type" className="form-select" value={formData.payment_type} onChange={handleFormChange}>
                                <option value="Per Project">Per Project</option>
                                <option value="Salary">Salary</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Standard Rate</label>
                            <input type="number" name="standard_rate" className="form-input" value={formData.standard_rate} onChange={handleFormChange} step="0.01" min="0" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select name="is_active" className="form-select" value={formData.is_active} onChange={handleFormChange}>
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                            </select>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* View Person Modal */}
            <Modal
                isOpen={isViewModalOpen}
                onClose={closeViewModal}
                title="Person Details"
                maxWidth="700px"
            >
                {viewData.person && (
                    <>
                        <h3 style={{ marginBottom: '12px', fontSize: '1.15rem', fontWeight: 600 }}>{viewData.person.name}</h3>

                        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '16px' }}>
                            <div className="kpi-card">
                                <div className="kpi-label">Role</div>
                                <div className="mt-sm"><Badge className={getRoleBadge(viewData.person.role)}>{viewData.person.role}</Badge></div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-label">Total Paid</div>
                                <div className="kpi-value text-success" style={{ fontSize: '1.4rem' }}>{formatCurrency(viewData.totalPaid)}</div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-label">Pending</div>
                                <div className="kpi-value text-warning" style={{ fontSize: '1.4rem' }}>{formatCurrency(viewData.totalPending)}</div>
                            </div>
                        </div>

                        <div className="flex gap-lg mb-md">
                            <div><span className="text-sm text-muted">Payment Type: </span><span className="font-medium">{viewData.person.payment_type || '-'}</span></div>
                            <div><span className="text-sm text-muted">Rate: </span><span className="font-medium">{viewData.person.standard_rate ? formatCurrency(viewData.person.standard_rate) : '-'}</span></div>
                            <div><span className="text-sm text-muted">Status: </span>{viewData.person.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-neutral">Inactive</span>}</div>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid var(--color-border)', marginBottom: '16px' }}>
                            <button
                                className={`btn btn-sm ${peopleViewTab === 'transactions' ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ borderRadius: '4px 4px 0 0' }}
                                onClick={() => setPeopleViewTab('transactions')}>
                                Payment History
                            </button>
                            <button
                                className={`btn btn-sm ${peopleViewTab === 'projects' ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ borderRadius: '4px 4px 0 0' }}
                                onClick={() => setPeopleViewTab('projects')}>
                                Active Projects {viewData.projectsOverview?.length > 0 ? `(${viewData.projectsOverview.length})` : ''}
                            </button>
                        </div>

                        {/* Payment History Tab */}
                        {peopleViewTab === 'transactions' && (
                            viewData.transactions && viewData.transactions.length > 0 ? (
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Type</th>
                                                <th>Project</th>
                                                <th>Status</th>
                                                <th className="text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {viewData.transactions.map(t => (
                                                <tr key={t.id}>
                                                    <td>{formatDateShort(t.date)}</td>
                                                    <td><Badge className={getTypeBadge(t.type)}>{t.type}</Badge></td>
                                                    <td>{t.projects?.project_name || '-'}</td>
                                                    <td><Badge className={getStatusBadge(t.payment_status)}>{t.payment_status}</Badge></td>
                                                    <td className="text-right font-medium">{formatCurrency(t.amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-muted">No payment history</p>
                            )
                        )}

                        {/* Active Projects Tab */}
                        {peopleViewTab === 'projects' && (() => {
                            const projects = viewData.projectsOverview || [];
                            const totalDevOwed = projects.reduce((s, p) => s + p.devRemaining, 0);
                            return projects.length === 0 ? (
                                <p className="text-muted">No assigned projects.</p>
                            ) : (
                                <>
                                    {/* Accounts payable summary */}
                                    {totalDevOwed > 0 && (
                                        <div style={{ background: 'rgba(211,47,47,0.07)', border: '1px solid rgba(211,47,47,0.2)', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="text-sm font-medium">Total Accounts Payable (Dev)</span>
                                            <span className="font-semibold" style={{ color: 'var(--color-error)' }}>{formatCurrency(totalDevOwed)}</span>
                                        </div>
                                    )}

                                    {/* Per-project cards */}
                                    {projects.map(proj => (
                                        <div key={proj.id} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
                                            {/* Header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                <div>
                                                    <div className="font-semibold">{proj.name}</div>
                                                    <div className="text-sm text-muted">{proj.clientName}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                    {/* Client payment status badge */}
                                                    {proj.clientAgreed > 0 ? (
                                                        proj.clientOwed <= 0
                                                            ? <span className="badge badge-success">Client Paid ✓</span>
                                                            : <span className="badge badge-warning">Client Owes {formatCurrency(proj.clientOwed)}</span>
                                                    ) : (
                                                        <span className="badge badge-neutral">No Client Amount Set</span>
                                                    )}
                                                    {proj.status && <Badge className={getStatusBadge(proj.status)}>{proj.status}</Badge>}
                                                </div>
                                            </div>

                                            {/* Dev payment grid */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
                                                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '6px', padding: '8px 12px' }}>
                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Dev Agreed</div>
                                                    <div className="font-semibold">{formatCurrency(proj.devAgreed)}</div>
                                                </div>
                                                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '6px', padding: '8px 12px' }}>
                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Dev Paid</div>
                                                    <div className="font-semibold text-success">{formatCurrency(proj.devPaid)}</div>
                                                </div>
                                                <div style={{ background: proj.devRemaining > 0 ? 'rgba(255,152,0,0.08)' : 'var(--color-bg-secondary)', borderRadius: '6px', padding: '8px 12px' }}>
                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Dev Remaining</div>
                                                    <div className={`font-semibold ${proj.devRemaining > 0 ? 'text-warning' : 'text-muted'}`}>
                                                        {proj.devRemaining > 0 ? formatCurrency(proj.devRemaining) : '✓ Settled'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Progress bar */}
                                            {proj.devAgreed > 0 && (
                                                <div style={{ marginBottom: '10px' }}>
                                                    <div style={{ background: 'var(--color-bg-tertiary)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${Math.min(100, (proj.devPaid / proj.devAgreed) * 100)}%`, height: '100%', background: proj.devRemaining <= 0 ? 'var(--color-success)' : 'var(--color-warning)', borderRadius: '4px', transition: 'width 0.3s' }} />
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px' }}>
                                                        {((proj.devPaid / proj.devAgreed) * 100).toFixed(0)}% paid to dev
                                                    </div>
                                                </div>
                                            )}

                                            {/* Client amounts comparison note */}
                                            {proj.clientAgreed > 0 && (
                                                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', padding: '6px 10px', background: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
                                                    Client: {formatCurrency(proj.clientAgreed)} agreed — {formatCurrency(proj.clientReceived)} received
                                                    {proj.clientAgreed !== proj.devAgreed && (
                                                        <span style={{ marginLeft: '8px', color: 'var(--color-accent)', fontWeight: 600 }}>
                                                            Margin: {formatCurrency(proj.clientAgreed - proj.devAgreed)}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Linked transactions */}
                                            {proj.projectTransactions && proj.projectTransactions.length > 0 && (
                                                <details style={{ marginTop: '6px' }}>
                                                    <summary style={{ fontSize: '12px', color: 'var(--color-text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                                                        {proj.projectTransactions.length} linked transaction{proj.projectTransactions.length !== 1 ? 's' : ''}
                                                    </summary>
                                                    <div className="table-container" style={{ marginTop: '8px' }}>
                                                        <table className="table" style={{ fontSize: '12px' }}>
                                                            <thead>
                                                                <tr>
                                                                    <th>Date</th>
                                                                    <th>Type</th>
                                                                    <th>Status</th>
                                                                    <th className="text-right">Amount</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {proj.projectTransactions.map(t => (
                                                                    <tr key={t.id}>
                                                                        <td>{formatDateShort(t.date)}</td>
                                                                        <td><Badge className={getTypeBadge(t.type)}>{t.type}</Badge></td>
                                                                        <td><Badge className={getStatusBadge(t.payment_status)}>{t.payment_status}</Badge></td>
                                                                        <td className={`text-right font-medium ${t.type === 'Revenue' ? 'text-success' : ''}`}>{formatCurrency(t.amount)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                    ))}
                                </>
                            );
                        })()}
                    </>
                )}
            </Modal>

            <ConfirmModal
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={confirmDeletePerson}
                title="Delete Person"
                message="Are you sure you want to delete this person?"
            />
        </>
    );
}
