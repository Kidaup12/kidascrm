import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '../lib/supabase';
import { formatCurrency, formatDate, formatDateShort, getStatusBadge, getPlatformBadge, getTypeBadge } from '../lib/utils';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

export default function Projects() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // Data State
    const [projectsData, setProjectsData] = useState([]);
    const [clientsData, setClientsData] = useState([]);
    const [peopleData, setPeopleData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters State
    const [statusFilter, setStatusFilter] = useState('');
    const [platformFilter, setPlatformFilter] = useState('');

    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [currentProject, setCurrentProject] = useState(null);
    const [formData, setFormData] = useState({ project_name: '', client_id: '', platform: 'Upwork', status: 'Active', total_agreed_amount: '', notes: '' });
    const [modalError, setModalError] = useState('');

    // View Modal State
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewData, setViewData] = useState({ project: null, devPayments: [], transactions: [], profit: 0 });

    // Assign Developer Modal State
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignFormData, setAssignFormData] = useState({ project_id: '', person_id: '', agreed_amount: '' });

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [projects, clients, people] = await Promise.all([
                db.projects.getWithFinancials(),
                db.clients.getAll(),
                db.people.getActive()
            ]);
            setProjectsData(projects);
            setClientsData(clients);
            setPeopleData(people.filter(p => p.role !== 'Founder'));

            // Check URL for specific project
            const projectId = searchParams.get('id');
            if (projectId) {
                openViewModal(projectId);
            }
        } catch (error) {
            console.error('Error loading page data:', error);
            alert('Failed to load project data');
        } finally {
            setLoading(false);
        }
    };

    const loadProjectsOnly = async () => {
        try {
            const projects = await db.projects.getWithFinancials();
            setProjectsData(projects);
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    };

    let displayProjects = [...projectsData];
    if (statusFilter) displayProjects = displayProjects.filter(p => p.status === statusFilter);
    if (platformFilter) displayProjects = displayProjects.filter(p => p.platform === platformFilter);

    // Form Handlers
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAssignFormChange = (e) => {
        const { name, value } = e.target;
        setAssignFormData(prev => ({ ...prev, [name]: value }));
    };

    const openAddModal = () => {
        setCurrentProject(null);
        setFormData({ project_name: '', client_id: '', platform: 'Upwork', status: 'Active', total_agreed_amount: '', notes: '' });
        setModalError('');
        setIsAddEditModalOpen(true);
    };

    const openEditModal = async (id) => {
        try {
            const project = await db.projects.getById(id);
            setCurrentProject(project);
            setFormData({
                project_name: project.project_name || '',
                client_id: project.client_id || '',
                platform: project.platform || 'Upwork',
                status: project.status || 'Active',
                total_agreed_amount: project.total_agreed_amount || '',
                notes: project.notes || ''
            });
            setModalError('');
            setIsAddEditModalOpen(true);
        } catch (error) {
            console.error('Error loading project:', error);
        }
    };

    const handleSaveProject = async () => {
        if (!formData.project_name || !formData.client_id) {
            alert('Project name and client are required');
            return;
        }

        const dataToSave = {
            ...formData,
            total_agreed_amount: formData.total_agreed_amount === '' ? null : Number(formData.total_agreed_amount)
        };

        try {
            if (currentProject) {
                await db.projects.update(currentProject.id, dataToSave);
            } else {
                await db.projects.create(dataToSave);
            }
            setIsAddEditModalOpen(false);
            loadProjectsOnly();
        } catch (error) {
            console.error('Error saving project:', error);
            setModalError(error.message || 'Failed to save project');
        }
    };

    const handleDeleteProject = async (id) => {
        if (!window.confirm('Are you sure you want to delete this project? This will also delete all associated transactions.')) {
            return;
        }

        try {
            await db.projects.delete(id);
            loadProjectsOnly();
        } catch (error) {
            console.error('Error deleting project:', error);
            alert(error.message || 'Failed to delete project');
        }
    };

    const openViewModal = async (id) => {
        try {
            const project = await db.projects.getById(id);
            const devPayments = await db.projects.getDeveloperPayments(id);
            const transactions = await db.transactions.getByProject(id);

            const profit = parseFloat(transactions.filter(t => t.type === 'Revenue').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)) -
                parseFloat(transactions.filter(t => t.type !== 'Revenue').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0));

            setViewData({ project, devPayments, transactions, profit });

            // update URL
            router.replace(`?id=${id}`, { scroll: false });
            setIsViewModalOpen(true);
        } catch (error) {
            console.error('Error viewing project:', error);
        }
    };

    const closeViewModal = () => {
        setIsViewModalOpen(false);
        router.replace('?', { scroll: false });
    };

    const openAssignModal = (projectId) => {
        setAssignFormData({ project_id: projectId, person_id: '', agreed_amount: '' });
        setIsAssignModalOpen(true);
    };

    const handleAssignDeveloper = async () => {
        if (!assignFormData.person_id || !assignFormData.agreed_amount) {
            alert('Developer and agreed amount are required');
            return;
        }

        try {
            await db.projectDevelopers.assign(assignFormData.project_id, assignFormData.person_id, Number(assignFormData.agreed_amount));
            setIsAssignModalOpen(false);
            openViewModal(assignFormData.project_id); // refresh view data
        } catch (error) {
            console.error('Error assigning developer:', error);
            alert('Failed to assign developer');
        }
    };

    return (
        <>
            <header className="page-header tapestry-header">
                <h1 className="page-title">Projects</h1>
                <div className="page-actions">
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-select" style={{ width: 'auto' }}>
                        <option value="">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                    </select>
                    <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} className="form-select" style={{ width: 'auto' }}>
                        <option value="">All Platforms</option>
                        <option value="Upwork">Upwork</option>
                        <option value="Bank">Bank</option>
                        <option value="Wise">Wise</option>
                    </select>
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Project
                    </button>
                </div>
            </header>

            <div className="page-body">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th>Client</th>
                                <th>Status</th>
                                <th>Platform</th>
                                <th className="text-right">Agreed</th>
                                <th className="text-right">Received</th>
                                <th className="text-right">Costs</th>
                                <th className="text-right">Profit</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="9">
                                        <div className="empty-state">
                                            <div className="animate-pulse">Loading projects...</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : displayProjects.length === 0 ? (
                                <tr>
                                    <td colSpan="9">
                                        <div className="empty-state">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="empty-state-icon">
                                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                            </svg>
                                            <p className="empty-state-title">No projects yet</p>
                                            <p className="empty-state-description">Create your first project to start tracking</p>
                                            <button className="btn btn-primary" onClick={openAddModal}>Add Project</button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                displayProjects.map(project => {
                                    const totalReceived = parseFloat(project.total_received) || 0;
                                    const totalDevPayments = parseFloat(project.total_dev_payments) || 0;
                                    const profit = totalReceived - totalDevPayments;
                                    const profitClass = profit >= 0 ? 'text-success' : 'text-error';

                                    return (
                                        <tr key={project.id}>
                                            <td>
                                                <div>
                                                    <div className="font-medium">{project.project_name}</div>
                                                    <div className="text-sm text-muted">{project.status || 'Active'}</div>
                                                </div>
                                            </td>
                                            <td>{project.clients?.client_name || '-'}</td>
                                            <td><Badge className={getStatusBadge(project.status)}>{project.status}</Badge></td>
                                            <td><Badge className="badge-neutral">{project.platform || 'N/A'}</Badge></td>
                                            <td className="text-right">{formatCurrency(project.total_agreed_amount)}</td>
                                            <td className="text-right">{formatCurrency(totalReceived)}</td>
                                            <td className="text-right">{formatCurrency(totalDevPayments)}</td>
                                            <td className={`text-right font-medium ${profitClass}`}>{formatCurrency(profit)}</td>
                                            <td>
                                                <div className="flex gap-sm">
                                                    <button className="btn btn-sm btn-ghost" onClick={() => openViewModal(project.id)} title="View">
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                    </button>
                                                    <button className="btn btn-sm btn-ghost" onClick={() => openEditModal(project.id)} title="Edit">
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                    </button>
                                                    <button className="btn btn-sm btn-ghost text-error" onClick={() => handleDeleteProject(project.id)} title="Delete">
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

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isAddEditModalOpen}
                onClose={() => setIsAddEditModalOpen(false)}
                title={currentProject ? 'Edit Project' : 'Add Project'}
                footerActions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsAddEditModalOpen(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSaveProject}>Save Project</button>
                    </>
                }
            >
                <form id="projectForm" onSubmit={e => e.preventDefault()}>
                    {modalError && <div className="text-error mb-sm" style={{padding: '10px', background: '#ffebee', borderRadius: '4px'}}>{modalError}</div>}
                    <div className="form-group">
                        <label className="form-label">Project Name *</label>
                        <input type="text" name="project_name" className="form-input" value={formData.project_name} onChange={handleFormChange} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Client *</label>
                        <select name="client_id" className="form-select" value={formData.client_id} onChange={handleFormChange} required>
                            <option value="">Select client...</option>
                            {clientsData.map(c => (
                                <option key={c.id} value={c.id}>{c.client_name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Platform</label>
                            <select name="platform" className="form-select" value={formData.platform} onChange={handleFormChange}>
                                <option value="Upwork">Upwork</option>
                                <option value="Bank">Bank</option>
                                <option value="Wise">Wise</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select name="status" className="form-select" value={formData.status} onChange={handleFormChange}>
                                <option value="Active">Active</option>
                                <option value="Completed">Completed</option>
                                <option value="On Hold">On Hold</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Total Agreed Amount</label>
                            <input type="number" name="total_agreed_amount" className="form-input" value={formData.total_agreed_amount} onChange={handleFormChange} step="0.01" min="0" />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Notes</label>
                            <textarea name="notes" className="form-textarea" rows="2" placeholder="Additional notes..." value={formData.notes} onChange={handleFormChange}></textarea>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* View Project Modal */}
            <Modal
                isOpen={isViewModalOpen}
                onClose={closeViewModal}
                title="Project Details"
                maxWidth="800px"
            >
                {viewData.project && (
                    <>
                        {/* Project KPIs */}
                        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '24px' }}>
                            <div className="kpi-card">
                                <div className="kpi-label">Client</div>
                                <div className="font-semibold mt-sm">{viewData.project.clients?.client_name || '-'}</div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-label">Agreed Amount</div>
                                <div className="kpi-value" style={{ fontSize: '1.25rem' }}>{formatCurrency(viewData.project.total_agreed_amount)}</div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-label">Received</div>
                                <div className="kpi-value text-success" style={{ fontSize: '1.25rem' }}>
                                    {formatCurrency(viewData.transactions.filter(t => t.type === 'Revenue').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0))}
                                </div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-label">Profit</div>
                                <div className={`kpi-value ${viewData.profit >= 0 ? 'text-success' : 'text-error'}`} style={{ fontSize: '1.25rem' }}>
                                    {formatCurrency(viewData.profit)}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mb-md">
                            <Badge className={getStatusBadge(viewData.project.status)}>{viewData.project.status}</Badge>
                            <Badge className={getPlatformBadge(viewData.project.platform)}>{viewData.project.platform}</Badge>
                            <span className="text-sm text-muted">Created: {formatDate(viewData.project.created_at)}</span>
                        </div>

                        {/* Developer Payments Section */}
                        <div className="card mb-lg">
                            <div className="card-header">
                                <h4 className="card-title">Developer Payments</h4>
                                <button className="btn btn-sm btn-primary" onClick={() => openAssignModal(viewData.project.id)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    Assign Dev
                                </button>
                            </div>
                            <div className="card-body">
                                {viewData.devPayments && viewData.devPayments.length > 0 ? (
                                    <table className="table" style={{ margin: '-16px' }}>
                                        <thead>
                                            <tr>
                                                <th>Developer</th>
                                                <th className="text-right">Agreed</th>
                                                <th className="text-right">Paid</th>
                                                <th className="text-right">Remaining</th>
                                                <th>Progress</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {viewData.devPayments.map(dp => {
                                                const paid = parseFloat(dp.total_paid) || 0;
                                                const agreed = parseFloat(dp.agreed_amount) || 0;
                                                const remaining = parseFloat(dp.balance) || 0;
                                                const percent = agreed > 0 ? (paid / agreed) * 100 : 0;
                                                const statusClass = percent >= 100 ? 'success' : percent > 0 ? 'warning' : '';

                                                return (
                                                    <tr key={dp.id || dp.person_id}>
                                                        <td className="font-medium">{dp.person_name}</td>
                                                        <td className="text-right">{formatCurrency(agreed)}</td>
                                                        <td className="text-right text-success">{formatCurrency(paid)}</td>
                                                        <td className={`text-right ${remaining > 0 ? 'text-warning' : ''}`}>{formatCurrency(remaining)}</td>
                                                        <td style={{ width: '120px' }}>
                                                            <div className="progress-bar">
                                                                <div className={`progress-bar-fill ${statusClass}`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {percent >= 100
                                                                ? <span className="badge badge-success">✓ Paid</span>
                                                                : <span className="badge badge-warning">Pending</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p className="text-muted text-center">No developers assigned yet</p>
                                )}
                            </div>
                        </div>

                        {/* Transactions Section */}
                        <div className="card">
                            <div className="card-header">
                                <h4 className="card-title">Transactions</h4>
                                <Link to={`/transactions?project=${viewData.project.id}`} className="btn btn-sm btn-ghost">Add Transaction</Link>
                            </div>
                            <div className="card-body">
                                {viewData.transactions && viewData.transactions.length > 0 ? (
                                    <table className="table" style={{ margin: '-16px' }}>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Type</th>
                                                <th>Person</th>
                                                <th>Description</th>
                                                <th className="text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {viewData.transactions.map(t => (
                                                <tr key={t.id}>
                                                    <td>{formatDateShort(t.date)}</td>
                                                    <td><Badge className={getTypeBadge(t.type)}>{t.type}</Badge></td>
                                                    <td>{t.people?.name || '-'}</td>
                                                    <td className="text-muted">{t.description || '-'}</td>
                                                    <td className={`text-right font-medium ${t.type === 'Revenue' ? 'text-success' : ''}`}>
                                                        {t.type === 'Revenue' ? '+' : '-'}{formatCurrency(t.amount)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p className="text-muted text-center">No transactions yet</p>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </Modal>

            {/* Assign Developer Modal */}
            <Modal
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                title="Assign Developer"
                maxWidth="400px"
                footerActions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsAssignModalOpen(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleAssignDeveloper}>Assign</button>
                    </>
                }
            >
                <form id="assignDevForm" onSubmit={e => e.preventDefault()}>
                    <div className="form-group">
                        <label className="form-label">Developer *</label>
                        <select name="person_id" className="form-select" value={assignFormData.person_id} onChange={handleAssignFormChange} required>
                            <option value="">Select developer...</option>
                            {peopleData.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Agreed Amount *</label>
                        <input type="number" name="agreed_amount" className="form-input" value={assignFormData.agreed_amount} onChange={handleAssignFormChange} step="0.01" min="0" required />
                    </div>
                </form>
            </Modal>
        </>
    );
}

