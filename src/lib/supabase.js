import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fvvxkbaeqreyjxndohgl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2dnhrYmFlcXJleWp4bmRvaGdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NDUzODMsImV4cCI6MjA4NjEyMTM4M30.BrpkMgghho1d6qwIOsfyGqgUGoTPyWhuZnMxxjhOjkM';

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const db = {
    clients: {
        async getAll() {
            const { data, error } = await supabaseClient.from('clients').select('*').order('client_name');
            if (error) throw error; return data || [];
        },
        async getById(id) {
            const { data, error } = await supabaseClient.from('clients').select('*').eq('id', id).single();
            if (error) throw error; return data;
        },
        async create(client) {
            const { data, error } = await supabaseClient.from('clients')
                .insert({ ...client, created_at: new Date().toISOString() })
                .select().single();
            if (error) throw error; return data;
        },
        async update(id, client) {
            const { data, error } = await supabaseClient.from('clients').update({ ...client, updated_at: new Date().toISOString() }).eq('id', id).select().single();
            if (error) throw error; return data;
        },
        async delete(id) {
            const { error } = await supabaseClient.from('clients').delete().eq('id', id);
            if (error) throw error;
        },
        async getWithFinancials() {
            const { data, error } = await supabaseClient.from('client_financials').select('*').order('client_name');
            if (error) throw error; return data || [];
        },
        async getLastTransactionDate(clientId) {
            // Find the most recent transaction for any project belonging to this client
            const { data, error } = await supabaseClient
                .from('transactions')
                .select('date, projects!inner(client_id)')
                .eq('projects.client_id', clientId)
                .order('date', { ascending: false })
                .limit(1);
            if (error) return null;
            return data?.[0]?.date || null;
        }
    },
    projects: {
        async getAll() {
            const { data, error } = await supabaseClient.from('projects').select('*, clients(client_name)').order('created_at', { ascending: false });
            if (error) throw error; return data || [];
        },
        async getWithFinancials() {
            const { data, error } = await supabaseClient.from('project_financials').select('*').order('project_name');
            if (error) throw error; return data || [];
        },
        async getByClient(clientId) {
            const { data, error } = await supabaseClient.from('project_financials').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
            if (error) throw error; return data || [];
        },
        async getById(id) {
            const { data, error } = await supabaseClient.from('projects').select('*, clients(client_name)').eq('id', id).single();
            if (error) throw error; return data;
        },
        async create(project) {
            const { data, error } = await supabaseClient.from('projects')
                .insert({ ...project, created_at: new Date().toISOString() })
                .select().single();
            if (error) throw error; return data;
        },
        async update(id, project) {
            const { data, error } = await supabaseClient.from('projects').update({ ...project, updated_at: new Date().toISOString() }).eq('id', id).select().single();
            if (error) throw error; return data;
        },
        async delete(id) {
            const { error } = await supabaseClient.from('projects').delete().eq('id', id);
            if (error) throw error;
        },
        async getDeveloperPayments(projectId) {
            const { data, error } = await supabaseClient.from('project_developer_payments').select('*').eq('project_id', projectId);
            if (error) throw error; return data || [];
        }
    },
    people: {
        async getAll() {
            const { data, error } = await supabaseClient.from('people').select('*').order('name');
            if (error) throw error; return data || [];
        },
        async getWithFinancials() {
            const { data, error } = await supabaseClient.from('people_financials').select('*').order('name');
            if (error) throw error; return data || [];
        },
        async getActive() {
            const { data, error } = await supabaseClient.from('people').select('*').eq('is_active', true).order('name');
            if (error) throw error; return data || [];
        },
        async getById(id) {
            const { data, error } = await supabaseClient.from('people').select('*').eq('id', id).single();
            if (error) throw error; return data;
        },
        async create(person) {
            const { data, error } = await supabaseClient.from('people').insert(person).select().single();
            if (error) throw error; return data;
        },
        async update(id, person) {
            const { data, error } = await supabaseClient.from('people').update({ ...person, updated_at: new Date().toISOString() }).eq('id', id).select().single();
            if (error) throw error; return data;
        },
        async delete(id) {
            const { error } = await supabaseClient.from('people').delete().eq('id', id);
            if (error) throw error;
        }
    },
    projectDevelopers: {
        async assign(projectId, personId, agreedAmount) {
            const { data, error } = await supabaseClient.from('project_developers').upsert({ project_id: projectId, person_id: personId, agreed_amount: agreedAmount }).select().single();
            if (error) throw error; return data;
        },
        async remove(projectId, personId) {
            const { error } = await supabaseClient.from('project_developers').delete().eq('project_id', projectId).eq('person_id', personId);
            if (error) throw error;
        },
        async getByProject(projectId) {
            const { data, error } = await supabaseClient.from('project_developers').select('*, people(name)').eq('project_id', projectId);
            if (error) throw error; return data || [];
        },
        async getByPerson(personId) {
            const { data, error } = await supabaseClient.from('project_developers').select('*, projects(project_name)').eq('person_id', personId);
            if (error) throw error; return data || [];
        }
    },
    transactions: {
        async getAll(filters = {}) {
            let query = supabaseClient.from('transactions').select('*, projects(project_name), people(name)').order('date', { ascending: false });
            if (filters.startDate) query = query.gte('date', filters.startDate);
            if (filters.endDate) query = query.lte('date', filters.endDate);
            if (filters.type) query = query.eq('type', filters.type);
            if (filters.account) query = query.eq('account', filters.account);
            if (filters.projectId) query = query.eq('project_id', filters.projectId);
            if (filters.personId) query = query.eq('person_id', filters.personId);
            if (filters.paymentStatus) query = query.eq('payment_status', filters.paymentStatus);
            if (filters.billingType) query = query.eq('billing_type', filters.billingType);
            const { data, error } = await query;
            if (error) throw error; return data || [];
        },
        async getByProject(projectId) {
            const { data, error } = await supabaseClient.from('transactions').select('*, people(name)').eq('project_id', projectId).order('date', { ascending: false });
            if (error) throw error; return data || [];
        },
        async getByPerson(personId) {
            const { data, error } = await supabaseClient.from('transactions').select('*, projects(project_name)').eq('person_id', personId).order('date', { ascending: false });
            if (error) throw error; return data || [];
        },
        async create(transaction) {
            const { data, error } = await supabaseClient.from('transactions').insert(transaction).select().single();
            if (error) throw error; return data;
        },
        async update(id, transaction) {
            const { data, error } = await supabaseClient.from('transactions').update({ ...transaction, updated_at: new Date().toISOString() }).eq('id', id).select().single();
            if (error) throw error; return data;
        },
        async delete(id) {
            const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
            if (error) throw error;
        }
    },
    dashboard: {
        async getKPIs(startDate, endDate) {
            const { data, error } = await supabaseClient.from('transactions').select('type, amount').gte('date', startDate).lte('date', endDate);
            if (error) throw error;
            const kpis = { revenue: 0, devPayments: 0, toolCosts: 0, ads: 0, miscExpenses: 0, salaries: 0, founderWithdrawals: 0, totalExpenses: 0, profit: 0 };
            (data || []).forEach(t => {
                const amount = parseFloat(t.amount) || 0;
                switch (t.type) {
                    case 'Revenue': kpis.revenue += amount; break;
                    case 'Dev Payment': kpis.devPayments += amount; kpis.totalExpenses += amount; break;
                    case 'Tool Cost': kpis.toolCosts += amount; kpis.totalExpenses += amount; break;
                    case 'Ads': kpis.ads += amount; kpis.totalExpenses += amount; break;
                    case 'Misc Expense': kpis.miscExpenses += amount; kpis.totalExpenses += amount; break;
                    case 'Salary': kpis.salaries += amount; kpis.totalExpenses += amount; break;
                    case 'Founder Withdrawal': kpis.founderWithdrawals += amount; break;
                }
            });
            kpis.profit = kpis.revenue - kpis.totalExpenses;
            return kpis;
        },
        async getMRRData(startDate, endDate) {
            const { data, error } = await supabaseClient.from('transactions')
                .select('type, amount, billing_type')
                .gte('date', startDate).lte('date', endDate)
                .eq('billing_type', 'Recurring');
            if (error) return { mrr: 0, recurringCosts: 0 };
            let mrr = 0, recurringCosts = 0;
            (data || []).forEach(t => {
                const amount = parseFloat(t.amount) || 0;
                if (t.type === 'Revenue') mrr += amount;
                else recurringCosts += amount;
            });
            return { mrr, recurringCosts };
        },
        async getNewCounts(startDate, endDate) {
            const [{ count: newClients }, { count: newProjects }] = await Promise.all([
                supabaseClient.from('clients').select('*', { count: 'exact', head: true }).gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59'),
                supabaseClient.from('projects').select('*', { count: 'exact', head: true }).gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59')
            ]);
            return { newClients: newClients || 0, newProjects: newProjects || 0 };
        },
        async getExpenseBreakdown(startDate, endDate) {
            const kpis = await this.getKPIs(startDate, endDate);
            return {
                labels: ['Dev Payments', 'Tool Costs', 'Ads', 'Misc Expenses', 'Salaries'],
                values: [kpis.devPayments, kpis.toolCosts, kpis.ads, kpis.miscExpenses, kpis.salaries]
            };
        },
        async getMonthlyTrend(months = 6) {
            const { data, error } = await supabaseClient.from('monthly_summary').select('*').order('month', { ascending: false }).limit(months);
            if (error) throw error; return (data || []).reverse();
        },
        async getFounderBalances(startDate, endDate) {
            const { data: founders, error: foundersError } = await supabaseClient.from('people').select('id, name').eq('role', 'Founder');
            if (foundersError) throw foundersError;
            
            // get month withdrawals
            const { data: monthW } = await supabaseClient.from('transactions').select('person_id, amount').eq('type', 'Founder Withdrawal').eq('payment_status', 'Completed').gte('date', startDate).lte('date', endDate);
            
            // get year withdrawals
            const yearStart = startDate.substring(0, 4) + '-01-01';
            const yearEnd = startDate.substring(0, 4) + '-12-31';
            const { data: yearW } = await supabaseClient.from('transactions').select('person_id, amount').eq('type', 'Founder Withdrawal').eq('payment_status', 'Completed').gte('date', yearStart).lte('date', yearEnd);

            const calcOwed = (withdrawals) => {
                const totals = {};
                (founders || []).forEach(f => totals[f.id] = 0);
                (withdrawals || []).forEach(w => {
                    if (totals[w.person_id] !== undefined) totals[w.person_id] += parseFloat(w.amount || 0);
                });
                const maxW = Math.max(...Object.values(totals), 0);
                return (founders || []).map(f => {
                    const w = totals[f.id];
                    return { id: f.id, name: f.name, balance: maxW - w };
                }).filter(f => f.balance > 0);
            };

            return {
                monthly: calcOwed(monthW),
                yearly: calcOwed(yearW)
            };
        },
        async getMoneyOwed() {
            const { data: projectsData, error: projectsError } = await supabaseClient.from('project_financials').select('amount_owed').gt('amount_owed', 0);
            if (projectsError) throw projectsError;
            const clientsOweUs = (projectsData || []).reduce((sum, p) => sum + parseFloat(p.amount_owed || 0), 0);

            const { data: pendingPayments, error: pendingError } = await supabaseClient.from('transactions').select('amount').eq('payment_status', 'Pending').in('type', ['Dev Payment', 'Salary']);
            if (pendingError) throw pendingError;
            const weOweContractors = (pendingPayments || []).reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

            return { clientsOweUs, weOweContractors };
        },
        async getRecentTransactions(limit = 5) {
            const { data, error } = await supabaseClient.from('transactions').select('*, projects(project_name), people(name)').order('date', { ascending: false }).limit(limit);
            if (error) throw error; return data || [];
        },
        async getRecurringCosts() {
            const { data, error } = await supabaseClient.from('transactions')
                .select('*')
                .eq('billing_type', 'Recurring')
                .neq('type', 'Revenue')
                .order('date', { ascending: false });
            if (error) throw error;
            const tools = {};
            (data || []).forEach(t => {
                const desc = t.description?.trim() || 'Unknown Recurring Cost';
                if (!tools[desc]) {
                    tools[desc] = { name: desc, lastPaidDate: new Date(t.date), amount: parseFloat(t.amount) || 0 };
                }
            });
            return Object.values(tools).map(tool => {
                const nextDue = new Date(tool.lastPaidDate);
                nextDue.setDate(nextDue.getDate() + 29);
                return { ...tool, nextDueDate: nextDue.toISOString().split('T')[0] };
            }).sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate));
        },
        async getAccountBalances() {
            const { data, error } = await supabaseClient.from('transactions').select('type, account, amount');
            if (error) throw error;
            const balances = { Upwork: 0, Wise: 0, Bank: 0, Till: 0 };
            (data || []).forEach(t => {
                const acc = t.account;
                if (balances[acc] !== undefined) {
                    const amount = parseFloat(t.amount) || 0;
                    if (t.type === 'Revenue') { balances[acc] += amount; } else { balances[acc] -= amount; }
                }
            });
            return balances;
        }
    },
    debts: {
        async getPendingObligations() {
            const { data, error } = await supabaseClient.from('transactions')
                .select('*, projects(project_name), people(name)')
                .eq('payment_status', 'Pending')
                .in('type', ['Dev Payment', 'Misc Expense', 'Salary'])
                .order('date', { ascending: false });
            if (error) throw error; return data || [];
        },
        async create(payload) {
            const { data, error } = await supabaseClient.from('transactions').insert({ ...payload, payment_status: 'Pending' }).select().single();
            if (error) throw error; return data;
        },
        async update(id, payload) {
            const { data, error } = await supabaseClient.from('transactions').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).select().single();
            if (error) throw error; return data;
        },
        async markPaid(id) {
            const { data, error } = await supabaseClient.from('transactions')
                .update({ payment_status: 'Completed', date: new Date().toISOString().split('T')[0] })
                .eq('id', id)
                .select();
            if (error) throw error; return data;
        }
    },
    reports: {
        async getMonthlySummary(year) {
            const { data, error } = await supabaseClient.from('monthly_summary').select('*').gte('month', `${year}-01-01`).lte('month', `${year}-12-31`).order('month');
            if (error) throw error; return data || [];
        },
        async getMonthlyData(year) {
            const { data, error } = await supabaseClient.from('transactions').select('*').gte('date', `${year}-01-01`).lte('date', `${year}-12-31`).order('date');
            if (error) throw error; return data || [];
        },
        async getTopClients(year, limit = 5) {
            const { data, error } = await supabaseClient.from('client_financials').select('*').order('total_revenue', { ascending: false }).limit(limit);
            if (error) throw error; return data || [];
        },
        async getTopProjects(year, limit = 5) {
            const { data, error } = await supabaseClient.from('project_financials').select('*').order('total_received', { ascending: false }).limit(limit);
            if (error) throw error; return data || [];
        }
    },
    accountBalances: {
        // Get all balance records (sorted by account + month)
        async getAll() {
            const { data, error } = await supabaseClient.from('account_monthly_balances').select('*').order('account').order('month');
            if (error) throw error; return data || [];
        },
        // Get records for a specific month
        async getByMonth(month) {
            const { data, error } = await supabaseClient.from('account_monthly_balances').select('*').eq('month', month);
            if (error) throw error; return data || [];
        },
        // Upsert a balance record (create or update)
        async upsert(account, month, fields) {
            const { data, error } = await supabaseClient.from('account_monthly_balances')
                .upsert({ account, month, ...fields }, { onConflict: 'account,month' })
                .select().single();
            if (error) throw error; return data;
        },
        // Lock the opening balance for Jan 2026 (is_locked = true)
        async lock(account, month) {
            const { data, error } = await supabaseClient.from('account_monthly_balances')
                .update({ is_locked: true }).eq('account', month ? `${account}_${month}` : account).select();
            if (error) throw error; return data;
        },
        // Calculate the expected closing balance from transactions
        async getCalculatedBalance(account, month) {
            // Get the start of this month and end of this month
            const [year, mon] = month.split('-');
            const startDate = `${month}-01`;
            const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
            const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
            const { data, error } = await supabaseClient.from('transactions')
                .select('type, amount').eq('account', account).gte('date', startDate).lte('date', endDate);
            if (error) return 0;
            let net = 0;
            (data || []).forEach(t => {
                const amt = parseFloat(t.amount) || 0;
                if (t.type === 'Revenue') net += amt;
                else net -= amt;
            });
            return net;
        }
    },
    reports: {
        async getMonthlySummary(year) {
            const { data, error } = await supabaseClient.from('monthly_summary')
                .select('*')
                .gte('month', `${year}-01-01`)
                .lte('month', `${year}-12-31`)
                .order('month');
            if (error) throw error;
            return data || [];
        }
    },
    contractorOwed: {
        // Get all projects with a primary contractor + calculate amount owed
        async getOwedByContractor() {
            // Fetch all projects that have a primary_contractor_id set
            const { data: projects, error: pErr } = await supabaseClient.from('projects')
                .select('id, project_name, total_agreed_amount, primary_contractor_id, people(name, role)')
                .not('primary_contractor_id', 'is', null);
            if (pErr) throw pErr;

            // For each project, calculate total payments made to that contractor via Dev Payment transactions
            const results = await Promise.all((projects || []).map(async proj => {
                const { data: payments } = await supabaseClient.from('transactions')
                    .select('amount')
                    .eq('project_id', proj.id)
                    .eq('person_id', proj.primary_contractor_id)
                    .in('type', ['Dev Payment'])
                    .eq('payment_status', 'Completed');
                const paid = (payments || []).reduce((s, t) => s + parseFloat(t.amount || 0), 0);
                const agreed = parseFloat(proj.total_agreed_amount || 0);
                return {
                    ...proj,
                    agreed,
                    paid,
                    owed: Math.max(0, agreed - paid)
                };
            }));
            return results;
        }
    }
};

