import { useState, useEffect } from 'react';
import { db } from '../lib/supabase';
import { formatCurrency, getStatusBadge, filterTable } from '../lib/utils';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

export default function Clients() {
    const [clientsData, setClientsData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [currentClient, setCurrentClient] = useState(null);
    const [formData, setFormData] = useState({ client_name: '', contact_info: '', status: 'Active' });
    const [modalError, setModalError] = useState('');

    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewData, setViewData] = useState({ client: null, projects: [] });

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        setLoading(true);
        try {
            const data = await db.clients.getWithFinancials();
            setClientsData(data);
        } catch (error) {
            console.error('Error loading clients:', error);
            // alert('Failed to load clients');
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
        setFormData({ client_name: '', contact_info: '', status: 'Active' });
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
                status: client.status || 'Active'
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
            if (currentClient) {
                await db.clients.update(currentClient.id, formData);
            } else {
                await db.clients.create(formData);
            }
            setIsAddEditModalOpen(false);
            loadClients();
        } catch (error) {
            console.error('Error saving client:', error);
            setModalError(error.message || 'Failed to save client');
        }
    };

    const handleDeleteClient = async (id) => {
        if (!window.confirm('Are you sure you want to delete this client? This will also delete all associated projects and transactions.')) {
            return;
        }

        try {
            await db.clients.delete(id);
            loadClients();
        } catch (error) {
            console.error('Error deleting client:', error);
            alert(error.message || 'Failed to delete client');
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
                                <th className="text-right">Total Owed</th>
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
                                        <td className="text-right">-</td>
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
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsAddEditModalOpen(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSaveClient}>Save Client</button>
                    </>
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
        </>
    );
}
