import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '../lib/supabase';
import { formatCurrency, formatDateShort, getTypeBadge, getPlatformBadge, getStatusBadge } from '../lib/utils';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

const ProjectSearchSelect = ({ value, onChange, projects, className }) => {
    const [projectSearchTerm, setProjectSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const selectedName = value === '__ADD_NEW__' ? '+ Add New Project' : projects.find(p => p.id === value)?.project_name || '';

    useEffect(() => {
        if (!isOpen) setProjectSearchTerm(selectedName);
    }, [isOpen, selectedName]);

    const filtered = projects.filter(p => p.project_name?.toLowerCase().includes(projectSearchTerm.toLowerCase()));

    return (
        <div style={{ position: 'relative' }} className={className}>
            <input
                type="text"
                className={className || "form-input"}
                placeholder={isOpen ? "Type to search..." : "Select project..."}
                value={isOpen ? projectSearchTerm : selectedName}
                onChange={e => {
                    setProjectSearchTerm(e.target.value);
                    if (!isOpen) setIsOpen(true);
                    if (!e.target.value) onChange('');
                }}
                onFocus={() => { setIsOpen(true); setProjectSearchTerm(''); }}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            />
            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-secondary)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            {isOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '250px', overflowY: 'auto', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '4px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', textAlign: 'left', marginTop: '4px' }}>
                    <div 
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                        onMouseDown={e => { e.preventDefault(); onChange(''); setIsOpen(false); }}
                    >
                        <span className="text-muted">No project</span>
                    </div>
                    <div 
                        style={{ padding: '8px 12px', cursor: 'pointer', color: 'var(--color-accent)', fontWeight: 600, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                        onMouseDown={e => { e.preventDefault(); onChange('__ADD_NEW__'); setIsOpen(false); }}
                    >
                        + Add New Project
                    </div>
                    {filtered.map(p => (
                        <div 
                            key={p.id}
                            style={{ padding: '8px 12px', cursor: 'pointer', background: p.id === value ? 'var(--color-primary-light)' : 'var(--color-bg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            onMouseDown={e => { e.preventDefault(); onChange(p.id); setIsOpen(false); }}
                            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'}
                            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                        >
                            {p.project_name}
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', background: 'var(--color-bg)' }}>No matches found</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default function Transactions() {
    const searchParams = useSearchParams();

    // Data State
    const [transactionsData, setTransactionsData] = useState([]);
    const [projectsData, setProjectsData] = useState([]);
    const [peopleData, setPeopleData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter State
    const [typeFilter, setTypeFilter] = useState('');
    const [accountFilter, setAccountFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Month Picker State
    const [selectedMonth, setSelectedMonth] = useState('');
    const [availableMonths, setAvailableMonths] = useState([]);
    const [visibleMonthsWindow, setVisibleMonthsWindow] = useState([0, 5]);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // Modal State
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [currentTransaction, setCurrentTransaction] = useState(null);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        type: 'Revenue',
        account: 'Upwork',
        project_id: '',
        person_id: '',
        description: '',
        payment_status: 'Completed',
        amount: '',
        currency: 'USD',
        billing_type: 'One-off'
    });
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    // Quick Add State
    const [quickAdd, setQuickAdd] = useState({
        date: '',
        type: '',
        account: '',
        project_id: '',
        person_id: '',
        description: '',
        payment_status: 'Completed',
        amount: '',
        billing_type: 'One-off',
        currency: 'USD'
    });

    useEffect(() => {
        initializeMonthPicker();
        loadInitialData();
    }, []);

    // Also watchURL params to set default project
    useEffect(() => {
        const projectIdUrl = searchParams.get('project');
        if (projectIdUrl && projectsData.length > 0 && !isAddEditModalOpen) {
            openAddModal();
            setFormData(prev => ({ ...prev, project_id: projectIdUrl }));
        }
    }, [searchParams, projectsData]);

    const initializeMonthPicker = () => {
        const startDate = new Date('2024-01-01');  // Start from Jan 2024 to cover imported history
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

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [projects, people] = await Promise.all([
                db.projects.getAll(),
                db.people.getAll()
            ]);
            setProjectsData(projects);
            setPeopleData(people);
            // Transactions will be loaded via effect on selectedMonth
        } catch (error) {
            console.error('Error loading initial data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedMonth) {
            loadTransactions();
        }
    }, [selectedMonth, typeFilter, accountFilter, statusFilter]);

    // Filtering logic
    const filteredData = useMemo(() => {
        let items = [...transactionsData];
        if (typeFilter) items = items.filter(t => t.type === typeFilter);
        if (accountFilter) items = items.filter(t => t.account === accountFilter);
        if (statusFilter) items = items.filter(t => t.payment_status === statusFilter);
        
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            items = items.filter(t => 
                t.description?.toLowerCase().includes(lowerTerm) ||
                t.projects?.project_name?.toLowerCase().includes(lowerTerm) ||
                t.people?.name?.toLowerCase().includes(lowerTerm) ||
                t.amount?.toString().includes(lowerTerm)
            );
        }
        
        return items;
    }, [transactionsData, typeFilter, accountFilter, statusFilter, searchTerm]);

    const loadTransactions = async () => {
        setLoading(true);
        try {
            let startDate, endDate;
            if (selectedMonth) {
                const [year, month] = selectedMonth.split('-');
                startDate = `${year}-${month}-01`;
                const lastDay = new Date(year, month, 0).getDate();
                endDate = `${year}-${month}-${lastDay}`;
            }

            const filters = {
                type: typeFilter || undefined,
                account: accountFilter || undefined,
                paymentStatus: statusFilter || undefined,
                startDate,
                endDate
            };

            const data = await db.transactions.getAll(filters);
            setTransactionsData(data);
            setCurrentPage(1);
        } catch (error) {
            console.error('Error loading transactions:', error);
            alert('Failed to load transactions');
        } finally {
            setLoading(false);
        }
    };

    // Month Navigation
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

    // Pagination
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedData = filteredData.slice(startIndex, endIndex);

    // Form Change Handlers
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleQuickAddChange = (e) => {
        const { name, value } = e.target;
        setQuickAdd(prev => ({ ...prev, [name]: value }));
    };

    // Quick Project feature
    const handleProjectSelect = async (e, formType) => {
        const value = e.target.value;
        if (value === '__ADD_NEW__') {
            const projectName = window.prompt('Enter project name:');
            if (!projectName) return;

            // Assume we create a dummy client or we ask for client name
            const clientName = window.prompt('Enter client name:');
            if (!clientName) return;

            try {
                // To keep it simple, we just create it using supabase directly or rely on the same logic 
                const newClientRes = await db.clients.create({ client_name: clientName, status: 'Active' }).select().single();
                let clientId = newClientRes?.id;

                // If the client creation doesn't return the ID because of how the legacy wrapper is written, 
                // we might need to fetch it. The legacy wrapper just does insert without selecting.
                // Let's assume we do a quick fetch
                if (!clientId) {
                    const allClients = await db.clients.getAll();
                    const newClient = allClients.find(c => c.client_name === clientName);
                    clientId = newClient.id;
                }

                const newProject = {
                    project_name: projectName,
                    client_id: clientId,
                    status: 'Active',
                    platform: 'Web'
                };

                // Insert project. Notice db.projects.create doesn't return it in legacy either.
                await db.projects.create(newProject);
                const projects = await db.projects.getAll();
                setProjectsData(projects);

                const createdProj = projects.find(p => p.project_name === projectName && p.client_id === clientId);
                if (createdProj) {
                    if (formType === 'modal') {
                        setFormData(prev => ({ ...prev, project_id: createdProj.id }));
                    } else {
                        setQuickAdd(prev => ({ ...prev, project_id: createdProj.id }));
                    }
                }
            } catch (err) {
                console.error("Error creating quick project", err);
                alert("Failed to create quick project");
            }
        } else {
            if (formType === 'modal') {
                setFormData(prev => ({ ...prev, project_id: value }));
            } else {
                setQuickAdd(prev => ({ ...prev, project_id: value }));
            }
        }
    };

    const openAddModal = () => {
        setCurrentTransaction(null);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            type: 'Revenue', account: 'Upwork',
            project_id: '', person_id: '', description: '',
            payment_status: 'Completed', amount: '',
            currency: 'USD', billing_type: 'One-off'
        });
        setIsAddEditModalOpen(true);
    };

    const openEditModal = (tx) => {
        setCurrentTransaction(tx);
        setFormData({
            date: tx.date || '',
            type: tx.type || 'Revenue',
            account: tx.account || 'Upwork',
            project_id: tx.project_id || '',
            person_id: tx.person_id || '',
            description: tx.description || '',
            payment_status: tx.payment_status || 'Completed',
            amount: tx.amount || '',
            currency: tx.currency || 'USD',
            billing_type: tx.billing_type || 'One-off'
        });
        setIsAddEditModalOpen(true);
    };

    const handleSaveTransaction = async (dataToSave, isQuickAdd = false) => {
        // Clean amount
        if (dataToSave.amount) {
            dataToSave.amount = String(dataToSave.amount).replace(/[$,]/g, '');
        }

        if (!dataToSave.date || !dataToSave.amount || !dataToSave.type || !dataToSave.account) {
            alert('Date, amount, type, and account are required');
            return false;
        }

        if (['Dev Payment', 'Salary', 'Founder Withdrawal'].includes(dataToSave.type) && !dataToSave.person_id) {
            alert('Person is required for this transaction type');
            return false;
        }

        const payload = {
            ...dataToSave,
            project_id: dataToSave.project_id || null,
            person_id: dataToSave.person_id || null,
            // KES→USD conversion
            currency: dataToSave.currency || 'USD',
            original_amount: dataToSave.currency === 'KES' ? parseFloat(String(dataToSave.amount).replace(/[$,]/g, '')) : null,
            amount: dataToSave.currency === 'KES'
                ? +(parseFloat(String(dataToSave.amount).replace(/[$,]/g, '')) / 128).toFixed(2)
                : parseFloat(String(dataToSave.amount).replace(/[$,]/g, '')),
            billing_type: dataToSave.billing_type || null
        };

        try {
            if (currentTransaction && !isQuickAdd) {
                await db.transactions.update(currentTransaction.id, payload);
            } else {
                await db.transactions.create(payload);
            }
            loadTransactions();
            return true;
        } catch (error) {
            console.error('Error saving transaction:', error);
            alert('Failed to save transaction');
            return false;
        }
    };

    const saveModalTransaction = async () => {
        const success = await handleSaveTransaction(formData);
        if (success) {
            setIsAddEditModalOpen(false);
        }
    };

    const saveQuickTransaction = async () => {
        const success = await handleSaveTransaction(quickAdd, true);
        if (success) {
            setQuickAdd({
                date: '', type: '', account: '', project_id: '', person_id: '', description: '', payment_status: 'Completed', amount: '', billing_type: 'One-off', currency: 'USD'
            });
            document.getElementById('quickDate')?.focus();
        }
    };

    const handleQuickAddKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveQuickTransaction();
        } else if (e.key === 'Escape') {
            setQuickAdd({
                date: '', type: '', account: '', project_id: '', person_id: '', description: '', payment_status: 'Paid', amount: '', billing_type: 'One-off', currency: 'USD'
            });
        }
    };

    const handleDeleteTransaction = (id) => {
        setConfirmDeleteId(id);
    };

    const confirmDeleteTransaction = async () => {
        if (!confirmDeleteId) return;
        try {
            await db.transactions.delete(confirmDeleteId);
            loadTransactions();
        } catch (error) {
            console.error('Error deleting transaction:', error);
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const visibleMonths = availableMonths.slice(visibleMonthsWindow[0], visibleMonthsWindow[1]);
    const selectedIndex = availableMonths.indexOf(selectedMonth);

    // Form logic for showing/hiding fields
    const showProjectModal = true; // Project is always shown per legacy switch logic
    const showPersonModal = ['Dev Payment', 'Salary', 'Founder Withdrawal'].includes(formData.type);

    return (
        <>
            <header className="page-header tapestry-header">
                <h1 className="page-title">Transactions</h1>
                <div className="page-actions">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="form-input"
                        placeholder="Search transactions..."
                        style={{ width: '220px' }}
                    />
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Transaction
                    </button>
                </div>
            </header>

            <div className="page-body">
                {/* Month Picker */}
                <div className="card mb-md">
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
                                        <button key={month} className={`month-tab ${month === selectedMonth ? 'active' : ''}`} onClick={() => handleMonthSelect(month)}>
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

                {/* Filters */}
                <div className="card mb-lg">
                    <div className="card-body">
                        <div className="form-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Type</label>
                                <select className="form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                                    <option value="">All Types</option>
                                    <option value="Revenue">Revenue</option>
                                    <option value="Dev Payment">Dev Payment</option>
                                    <option value="Tool Cost">Tool Cost</option>
                                    <option value="Ads">Ads</option>
                                    <option value="Misc Expense">Misc Expense</option>
                                    <option value="Salary">Salary</option>
                                    <option value="Founder Withdrawal">Founder Withdrawal</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Account</label>
                                <select className="form-select" value={accountFilter} onChange={e => setAccountFilter(e.target.value)}>
                                    <option value="">All Accounts</option>
                                    <option value="Upwork">Upwork</option>
                                    <option value="Bank">Bank</option>
                                    <option value="Wise">Wise</option>
                                    <option value="Till">Till</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Status</label>
                                <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                    <option value="">All Status</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Pending">Pending</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Account</th>
                                <th>Project</th>
                                <th>Person</th>
                                <th>Description</th>
                                <th>Status</th>
                                <th className="text-right">Amount</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Quick Add Row */}
                            <tr className="quick-add-row" onKeyDown={handleQuickAddKeyDown}>
                                <td><input type="date" id="quickDate" name="date" className="inline-input" value={quickAdd.date} onChange={handleQuickAddChange} /></td>
                                <td>
                                    <div className="flex gap-xs items-center">
                                        <select name="type" className="inline-select" value={quickAdd.type} onChange={handleQuickAddChange}>
                                            <option value="">Type...</option>
                                            <option value="Revenue">Revenue</option>
                                            <option value="Dev Payment">Dev Payment</option>
                                            <option value="Tool Cost">Tool Cost</option>
                                            <option value="Ads">Ads</option>
                                            <option value="Misc Expense">Misc Expense</option>
                                            <option value="Salary">Salary</option>
                                            <option value="Founder Withdrawal">Founder Withdrawal</option>
                                        </select>
                                        <select name="billing_type" className="inline-select" style={{width: 'auto', backgroundColor: 'var(--color-bg-secondary)', paddingRight: '8px'}} value={quickAdd.billing_type || 'One-off'} onChange={handleQuickAddChange}>
                                            <option value="One-off">One-off</option>
                                            <option value="Recurring">Recurring</option>
                                        </select>
                                    </div>
                                </td>
                                <td>
                                    <select name="account" className="inline-select" value={quickAdd.account} onChange={handleQuickAddChange}>
                                        <option value="">Account...</option>
                                        <option value="Upwork">Upwork</option>
                                        <option value="Bank">Bank</option>
                                        <option value="Wise">Wise</option>
                                        <option value="Till">Till</option>
                                    </select>
                                </td>
                                <td>
                                    <ProjectSearchSelect 
                                        value={quickAdd.project_id} 
                                        onChange={(val) => handleQuickAddChange({ target: { name: 'project_id', value: val }})} 
                                        projects={projectsData}
                                        className="inline-input"
                                    />
                                </td>
                                <td>
                                    <select name="person_id" className="inline-select" value={quickAdd.person_id} onChange={handleQuickAddChange}>
                                        <option value="">No person</option>
                                        {peopleData.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </td>
                                <td><input type="text" name="description" className="inline-input" placeholder="Description..." value={quickAdd.description} onChange={handleQuickAddChange} /></td>
                                <td>
                                    <select name="payment_status" className="inline-select" value={quickAdd.payment_status} onChange={handleQuickAddChange}>
                                        <option value="Paid">Paid</option>
                                        <option value="Pending">Pending</option>
                                    </select>
                                </td>
                                <td className="text-right">
                                    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                                        <select 
                                            name="currency" 
                                            style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', fontSize: '12px', color: 'var(--color-text-secondary)', zIndex: 1, padding: '0 4px', cursor: 'pointer', appearance: 'none' }} 
                                            value={quickAdd.currency} 
                                            onChange={handleQuickAddChange}
                                        >
                                            <option value="USD">$</option>
                                            <option value="KES">KSh</option>
                                        </select>
                                        <input type="number" name="amount" className="inline-input" style={{ paddingLeft: '40px', textAlign: 'right' }} placeholder="0.00" step="0.01" min="0" value={quickAdd.amount} onChange={handleQuickAddChange} />
                                    </div>
                                </td>
                                <td>
                                    <button className="btn btn-sm btn-primary" onClick={saveQuickTransaction} title="Save (Enter)">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </button>
                                </td>
                            </tr>

                            {loading ? (
                                <tr>
                                    <td colSpan="9">
                                        <div className="empty-state">
                                            <div className="animate-pulse">Loading transactions...</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan="9">
                                        <div className="empty-state">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="empty-state-icon">
                                                <line x1="12" y1="1" x2="12" y2="23" />
                                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                            </svg>
                                            <p className="empty-state-title">No transactions yet</p>
                                            <p className="empty-state-description">Add your first transaction to start tracking</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map(tx => (
                                    <tr key={tx.id}>
                                        <td>{formatDateShort(tx.date)}</td>
                                        <td>
                                            <div className="flex items-center gap-xs">
                                                <Badge className={getTypeBadge(tx.type)}>{tx.type}</Badge>
                                                {tx.billing_type === 'Recurring' && <span className="badge badge-warning" style={{fontSize: '10px', padding: '2px 4px'}}>Recurring</span>}
                                            </div>
                                        </td>
                                        <td><Badge className={getPlatformBadge(tx.account)}>{tx.account}</Badge></td>
                                        <td>{tx.projects?.project_name || '-'}</td>
                                        <td>{tx.people?.name || '-'}</td>
                                        <td className="text-muted">{tx.description || '-'}</td>
                                        <td><Badge className={getStatusBadge(tx.payment_status)}>{tx.payment_status}</Badge></td>
                                        <td className={`text-right font-medium ${tx.type === 'Revenue' ? 'text-success' : ''}`}>
                                            {tx.type === 'Revenue' ? '+' : '-'}{formatCurrency(tx.amount)}
                                        </td>
                                        <td>
                                            <div className="flex gap-sm">
                                                <button className="btn btn-sm btn-ghost" onClick={() => openEditModal(tx)} title="Edit">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                </button>
                                                <button className="btn btn-sm btn-ghost text-error" onClick={() => handleDeleteTransaction(tx.id)} title="Delete" style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalItems > 0 && (
                    <div className="pagination-wrapper">
                        <div className="pagination-info">
                            Showing {startIndex + 1}-{endIndex} of {totalItems} transactions
                        </div>
                        <div className="pagination-controls">
                            <select className="form-select" style={{ width: 'auto', padding: '6px 32px 6px 12px' }} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}>
                                <option value="25">25 per page</option>
                                <option value="50">50 per page</option>
                                <option value="100">100 per page</option>
                                <option value={totalItems}>All</option>
                            </select>
                            <button className="btn btn-sm btn-ghost" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                            <span className="pagination-page">Page {currentPage} of {totalPages}</span>
                            <button className="btn btn-sm btn-ghost" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isAddEditModalOpen}
                onClose={() => setIsAddEditModalOpen(false)}
                title={currentTransaction ? 'Edit Transaction' : 'Add Transaction'}
                maxWidth="560px"
                footerActions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsAddEditModalOpen(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={saveModalTransaction}>Save Transaction</button>
                    </>
                }
            >
                <form id="transactionForm" onSubmit={e => e.preventDefault()}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Date *</label>
                            <input type="date" name="date" className="form-input" required value={formData.date} onChange={handleFormChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Amount *</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', pointerEvents: 'none' }}>$</span>
                                <input type="number" name="amount" className="form-input" style={{ paddingLeft: '28px' }} step="0.01" min="0" required placeholder="0.00" value={formData.amount} onChange={handleFormChange} />
                            </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Type *</label>
                            <select name="type" className="form-select" required value={formData.type} onChange={handleFormChange}>
                                <option value="Revenue">Revenue</option>
                                <option value="Dev Payment">Dev Payment</option>
                                <option value="Tool Cost">Tool Cost</option>
                                <option value="Ads">Ads</option>
                                <option value="Misc Expense">Misc Expense</option>
                                <option value="Salary">Salary</option>
                                <option value="Founder Withdrawal">Founder Withdrawal</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Account *</label>
                            <select name="account" className="form-select" required value={formData.account} onChange={handleFormChange}>
                                <option value="Upwork">Upwork</option>
                                <option value="Bank">Bank</option>
                                <option value="Wise">Wise</option>
                                <option value="Till">Till</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Project <span className="text-muted">(Optional)</span></label>
                        <ProjectSearchSelect 
                            value={formData.project_id} 
                            onChange={(val) => handleProjectSelect({ target: { value: val } }, 'modal')} 
                            projects={projectsData}
                            className="form-input"
                        />
                    </div>

                    {showPersonModal && (
                        <div className="form-group">
                            <label className="form-label">Person</label>
                            <select name="person_id" className="form-select" value={formData.person_id} onChange={handleFormChange}>
                                <option value="">Select person...</option>
                                {peopleData.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Payment Status</label>
                            <select name="payment_status" className="form-select" value={formData.payment_status} onChange={handleFormChange}>
                                <option value="Completed">Completed</option>
                                <option value="Pending">Pending</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Currency</label>
                            <select name="currency" className="form-select" value={formData.currency} onChange={handleFormChange}>
                                <option value="USD">USD ($)</option>
                                <option value="KES">KES (÷128 → USD)</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Billing Type</label>
                        <select name="billing_type" className="form-select" value={formData.billing_type} onChange={handleFormChange}>
                            <option value="One-off">One-off</option>
                            <option value="Recurring">Recurring (monthly)</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea name="description" className="form-textarea" rows="2" placeholder="Optional notes..." value={formData.description} onChange={handleFormChange}></textarea>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={confirmDeleteTransaction}
                title="Delete Transaction"
                message="Are you sure you want to delete this transaction?"
            />
        </>
    );
}

