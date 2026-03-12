import { useState, useEffect } from 'react';
import { db } from '../lib/supabase';
import { formatCurrency, formatDateShort, getStatusBadge, filterTable } from '../lib/utils';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

export default function Clients() {
    const [clientsData, setClientsData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [currentClient, setCurrentClient] = useState(null);
    const [formData, setFormData] = useState({ client_name: '', contact_info: '', status: 'Active' });
    const [modalError, setModalError] = useState('');
    const [lastTxDates, setLastTxDates] = useState({});
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewData, setViewData] = useState({ client: null, projects: [] });

    const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
    const [linkMode, setLinkMode] = useState('new'); // 'new' or 'existing'
    const [allProjects, setAllProjects] = useState([]);
    const [existingProjectId, setExistingProjectId] = useState('');
    const [projectFormData, setProjectFormData] = useState({ project_name: '', client_id: '', platform: 'Upwork', status: 'Active', total_agreed_amount: '', notes: '', primary_contractor_id: '' });
    const [peopleData, setPeopleData] = useState([]);

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        setLoading(true);
        try {
            const data = await db.clients.getWithFinancials();
            const people = await db.people.getActive();
            const projects = await db.projects.getAll();
            setClientsData(data);
            setPeopleData(people);
            setAllProjects(projects);
            // Load last transaction date for each client in parallel
            const dates = {};
            await Promise.all(data.map(async c => {
                dates[c.id] = await db.clients.getLastTransactionDate(c.id);
            }));
            setLastTxDates(dates);
        } catch (error) {
            console.error('Error loading clients:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const displayClients = filterTable(clientsData, searchTerm, ['client_name', 'contact_info']);

    const openAddModal = () => {
        setCurrentClient(null);
        setFormData({ client_name: '', contact_info: '', status: 'Active', referral_source: '', created_at: new Date().toISOString().split('T')[0] });
        setModalError('');
        setIsAddEditModalOpen(true);
    };

    const openEditModal = async (id) => {
        try {
            const client = await db.clients.getById(id);
            setCurrentClient(client);
            setFormData({
                client_name: client.client_name || '',
                contact_info: client.contact_info || '',
                status: client.status || 'Active',
                referral_source: client.referral_source || '',
                created_at: client.created_at ? client.created_at.split('T')[0] : ''
            });
            setModalError('');
            setIsAddEditModalOpen(true);
        } catch (error) {
            console.error('Error loading client:', error);
        }
    };

    const openViewModal = async (id) => {
        try {
            const client = await db.clients.getById(id);
            const projects = await db.projects.getByClient(id);
            setViewData({ client, projects });
            setIsViewModalOpen(true);
        } catch (error) {
            console.error('Error viewing client:', error);
        }
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveClient = async () => {
        if (!formData.client_name) {
            alert('Client name is required');
            return;
        }

        try {
            const dataToSave = { ...formData };
            if (dataToSave.created_at) {
                // Keep the time if it's an update, or append a default time if new or just date is provided
                dataToSave.created_at = dataToSave.created_at.includes('T') ? dataToSave.created_at : `${dataToSave.created_at}T12:00:00.000Z`;
            } else {
                delete dataToSave.created_at;
            }

            if (currentClient) {
                await db.clients.update(currentClient.id, dataToSave);
            } else {
                await db.clients.create(dataToSave);
            }
            setIsAddEditModalOpen(false);
            loadClients();
        } catch (error) {
            console.error('Error saving client:', error);
            setModalError(error.message || 'Failed to save client');
        }
    };

    const handleDeleteClient = (id) => {
        setConfirmDeleteId(id);
    };

    const confirmDeleteClient = async () => {
        if (!confirmDeleteId) return;

        try {
            await db.clients.delete(confirmDeleteId);
            loadClients();
        } catch (error) {
            console.error('Error deleting client:', error);
            alert(error.message || 'Failed to delete client');
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const openAddProjectModal = (clientId) => {
        setProjectFormData({ project_name: '', client_id: clientId, platform: 'Upwork', status: 'Active', total_agreed_amount: '', notes: '', primary_contractor_id: '' });
        setExistingProjectId('');
        setLinkMode('new');
        setModalError('');
        setIsAddProjectModalOpen(true);
    };

    const handleProjectFormChange = (e) => {
        const { name, value } = e.target;
        setProjectFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveLinkedProject = async () => {
        if (linkMode === 'new') {
            if (!projectFormData.project_name) {
                alert('Project name is required');
                return;
            }

            const dataToSave = {
                ...projectFormData,
                total_agreed_amount: projectFormData.total_agreed_amount === '' ? null : Number(projectFormData.total_agreed_amount),
                primary_contractor_id: projectFormData.primary_contractor_id || null
            };

            try {
                await db.projects.create(dataToSave);
                setIsAddProjectModalOpen(false);
                loadClients(); // Reload to update project counts
            } catch (error) {
                console.error('Error saving linked project:', error);
                setModalError(error.message || 'Failed to save project');
            }
        } else {
            // Link existing
            if (!existingProjectId) {
                alert('Please select a project to link');
                return;
            }

            try {
                await db.projects.update(existingProjectId, { client_id: projectFormData.client_id });
                setIsAddProjectModalOpen(false);
                loadClients(); // Reload to update project counts display
            } catch (error) {
                console.error('Error linking project:', error);
                setModalError(error.message || 'Failed to link project');
            }
        }
    };

    return (
        <>
            <header className="page-header tapestry-header">
                <h1 className="page-title">Clients</h1>
                <div className="page-actions">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        className="form-input"
                        placeholder="Search clients..."
                        style={{ width: '250px' }}
                    />
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Client
                    </button>
                </div>
            </header>

            <div className="page-body">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Client Name</th>
                                <th>Status</th>
                                <th>Projects</th>
                                <th className="text-right">Total Paid</th>
                                <th>Last Transaction</th>
                                <th>Source</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6">
                                        <div className="empty-state">
                                            <div className="animate-pulse">Loading clients...</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : displayClients.length === 0 ? (
                                <tr>
                                    <td colSpan="6">
                                        <div className="empty-state">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="empty-state-icon">
                                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                <circle cx="9" cy="7" r="4" />
                                            </svg>
                                            <p className="empty-state-title">No clients yet</p>
                                            <p className="empty-state-description">Add your first client to get started</p>
                                            <button className="btn btn-primary" onClick={openAddModal}>Add Client</button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                displayClients.map(client => (
                                    <tr key={client.id}>
                                        <td>
                                            <div className="flex items-center gap-sm">
                                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-primary)', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600' }}>
                                                    {client.client_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{client.client_name}</div>
                                                    <div className="text-sm text-muted">{client.contact_info || 'No contact info'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td><Badge className={getStatusBadge(client.status)}>{client.status}</Badge></td>
                                        <td>{client.total_projects || 0} projects</td>
                                        <td className="text-right font-medium">{formatCurrency(client.total_revenue)}</td>
                                        <td className="text-sm text-muted">
                                            {lastTxDates[client.id] ? formatDateShort(lastTxDates[client.id]) : <span style={{color:'var(--color-text-secondary)'}}>—</span>}
                                        </td>
                                        <td>
                                            {client.referral_source && (
                                                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                                                    {client.referral_source}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="flex gap-sm">
                                                <button className="btn btn-sm btn-ghost" onClick={() => openViewModal(client.id)} title="View">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                                                    </svg>
                                                </button>
                                                <button className="btn btn-sm btn-ghost" onClick={() => openEditModal(client.id)} title="Edit">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                    </svg>
                                                </button>
                                                <button className="btn btn-sm btn-ghost text-error" onClick={() => handleDeleteClient(client.id)} title="Delete">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    </svg>
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

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isAddEditModalOpen}
                onClose={() => setIsAddEditModalOpen(false)}
                title={currentClient ? 'Edit Client' : 'Add Client'}
                footerActions={
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div>
                            {currentClient && (
                                <button className="btn btn-ghost" style={{ color: 'var(--color-accent)' }} onClick={() => openAddProjectModal(currentClient.id)}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    Add Project
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary" onClick={() => setIsAddEditModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveClient}>Save Client</button>
                        </div>
                    </div>
                }
            >
                <form id="clientForm" onSubmit={e => e.preventDefault()}>
                    {modalError && <div className="text-error mb-sm" style={{padding: '10px', background: '#ffebee', borderRadius: '4px'}}>{modalError}</div>}
                    <div className="form-group">
                        <label className="form-label">Client Name *</label>
                        <input type="text" name="client_name" className="form-input" value={formData.client_name} onChange={handleFormChange} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Contact Info</label>
                        <textarea name="contact_info" className="form-textarea" rows="3" placeholder="Email, phone, notes..." value={formData.contact_info} onChange={handleFormChange}></textarea>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Status</label>
                        <select name="status" className="form-select" value={formData.status} onChange={handleFormChange}>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Referred From <span className="text-muted">(Optional)</span></label>
                        <select name="referral_source" className="form-select" value={formData.referral_source} onChange={handleFormChange}>
                            <option value="">— Not specified —</option>
                            <option value="Upwork">Upwork</option>
                            <option value="Facebook Ad">Facebook Ad</option>
                            <option value="Referral">Referral</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Created Date <span className="text-muted">(Optional offset)</span></label>
                        <input type="date" name="created_at" className="form-input" value={formData.created_at || ''} onChange={handleFormChange} />
                    </div>
                </form>
            </Modal>

            {/* View Modal */}
            <Modal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                title="Client Details"
                maxWidth="700px"
            >
                {viewData.client && (
                    <>
                        <h3 style={{ marginBottom: '16px', fontSize: '1.25rem', fontWeight: 600 }}>{viewData.client.client_name}</h3>

                        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
                            <div className="kpi-card">
                                <div className="kpi-label">Status</div>
                                <div className="mt-sm"><Badge className={getStatusBadge(viewData.client.status)}>{viewData.client.status}</Badge></div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-label">Total Paid</div>
                                <div className="kpi-value" style={{ fontSize: '1.5rem' }}>
                                    {formatCurrency(viewData.projects.reduce((sum, p) => sum + parseFloat(p.total_received || 0), 0))}
                                </div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-label">Amount Owed</div>
                                <div className="kpi-value text-success" style={{ fontSize: '1.5rem' }}>
                                    {formatCurrency(viewData.projects.reduce((sum, p) => sum + parseFloat(p.amount_owed || 0), 0))}
                                </div>
                            </div>
                        </div>

                        <h4 style={{ marginBottom: '12px' }}>Contact Info</h4>
                        <p className="text-secondary" style={{ marginBottom: '24px' }}>
                            {viewData.client.contact_info || 'No contact information'}
                        </p>

                        <h4 style={{ marginBottom: '12px' }}>Projects ({viewData.projects.length})</h4>
                        {viewData.projects.length > 0 ? (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Project</th>
                                            <th>Status</th>
                                            <th className="text-right">Agreed</th>
                                            <th className="text-right">Received</th>
                                            <th className="text-right">Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewData.projects.map(p => (
                                            <tr key={p.id}>
                                                <td>
                                                    <span className="font-medium" style={{ color: 'var(--color-accent)' }}>{p.project_name}</span>
                                                </td>
                                                <td><Badge className={getStatusBadge(p.status)}>{p.status}</Badge></td>
                                                <td className="text-right">{formatCurrency(p.total_agreed_amount)}</td>
                                                <td className="text-right">{formatCurrency(p.total_received)}</td>
                                                <td className={`text-right ${parseFloat(p.profit) >= 0 ? 'text-success' : 'text-error'}`}>
                                                    {formatCurrency(p.profit)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-muted">No projects yet</p>
                        )}
                    </>
                )}
            </Modal>

            {/* Add Project Modal */}
            <Modal
                isOpen={isAddProjectModalOpen}
                onClose={() => setIsAddProjectModalOpen(false)}
                title="Link Project to Client"
                maxWidth="600px"
                footerActions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsAddProjectModalOpen(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSaveLinkedProject}>{linkMode === 'new' ? 'Create Project' : 'Link Project'}</button>
                    </>
                }
            >
                <form id="linkedProjectForm" onSubmit={e => e.preventDefault()}>
                    {modalError && <div className="text-error mb-sm" style={{padding: '10px', background: '#ffebee', borderRadius: '4px'}}>{modalError}</div>}
                    
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
                        <button 
                            type="button"
                            className={`btn ${linkMode === 'new' ? 'btn-primary' : 'btn-ghost'}`} 
                            onClick={() => setLinkMode('new')}
                        >
                            Create New
                        </button>
                        <button 
                            type="button"
                            className={`btn ${linkMode === 'existing' ? 'btn-primary' : 'btn-ghost'}`} 
                            onClick={() => setLinkMode('existing')}
                        >
                            Link Existing
                        </button>
                    </div>

                    {linkMode === 'new' ? (
                        <>
                            <div className="form-row">
                                <div className="form-group" style={{ flex: 2 }}>
                                    <label className="form-label">Project Name *</label>
                                    <input type="text" name="project_name" className="form-input" value={projectFormData.project_name} onChange={handleProjectFormChange} required />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Client *</label>
                                    <select name="client_id" className="form-select" value={projectFormData.client_id} disabled>
                                        {clientsData.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                <div className="form-group">
                                    <label className="form-label">Platform</label>
                                    <select name="platform" className="form-select" value={projectFormData.platform} onChange={handleProjectFormChange}>
                                        <option value="Upwork">Upwork</option>
                                        <option value="Direct">Direct</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select name="status" className="form-select" value={projectFormData.status} onChange={handleProjectFormChange}>
                                        <option value="Active">Active</option>
                                        <option value="Completed">Completed</option>
                                        <option value="On Hold">On Hold</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Total Agreed Amount</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', pointerEvents: 'none' }}>$</span>
                                        <input type="number" name="total_agreed_amount" className="form-input" style={{ paddingLeft: '28px' }} step="0.01" min="0" placeholder="0.00" value={projectFormData.total_agreed_amount} onChange={handleProjectFormChange} />
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Primary Contractor <span className="text-muted">(Optional)</span></label>
                                <select name="primary_contractor_id" className="form-select" value={projectFormData.primary_contractor_id} onChange={handleProjectFormChange}>
                                    <option value="">-- None --</option>
                                    {peopleData.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                                    ))}
                                </select>
                                <small className="text-muted mt-xs" style={{ display: 'block' }}>Setting this makes tracking developer specific tasks easier.</small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Notes</label>
                                <textarea name="notes" className="form-textarea" rows="3" placeholder="Project requirements, milestones..." value={projectFormData.notes} onChange={handleProjectFormChange}></textarea>
                            </div>
                        </>
                    ) : (
                        <div className="form-group">
                            <label className="form-label">Select Existing Project</label>
                            <select 
                                className="form-select" 
                                value={existingProjectId} 
                                onChange={(e) => setExistingProjectId(e.target.value)}
                            >
                                <option value="">-- Select a project --</option>
                                {allProjects.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.project_name} {p.clients ? `(Currently: ${p.clients.client_name})` : '(No Client)'}
                                    </option>
                                ))}
                            </select>
                            <small className="text-muted mt-xs" style={{ display: 'block' }}>This will reassign the selected project to the current client.</small>
                        </div>
                    )}
                </form>
            </Modal>

            <ConfirmModal
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={confirmDeleteClient}
                title="Delete Client"
                message="Are you sure you want to delete this client? This will also delete all associated projects and transactions."
            />
        </>
    );
}
