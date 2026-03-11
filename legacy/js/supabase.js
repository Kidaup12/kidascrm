// =============================================
// SUPABASE CONFIGURATION
// =============================================

const SUPABASE_URL = 'https://fvvxkbaeqreyjxndohgl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2dnhrYmFlcXJleWp4bmRvaGdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NDUzODMsImV4cCI6MjA4NjEyMTM4M30.BrpkMgghho1d6qwIOsfyGqgUGoTPyWhuZnMxxjhOjkM';

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================
// DATABASE HELPERS
// =============================================

const db = {
    // =========================================
    // CLIENTS
    // =========================================
    clients: {
        async getAll() {
            const { data, error } = await supabaseClient
                .from('clients')
                .select('*')
                .order('client_name');
            if (error) throw error;
            return data || [];
        },

        async getById(id) {
            const { data, error } = await supabaseClient
                .from('clients')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        },

        async create(client) {
            const { data, error } = await supabaseClient
                .from('clients')
                .insert(client)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async update(id, client) {
            const { data, error } = await supabaseClient
                .from('clients')
                .update({ ...client, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async delete(id) {
            const { error } = await supabaseClient
                .from('clients')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },

        // Get clients with financial summary
        async getWithFinancials() {
            const { data, error } = await supabaseClient
                .from('client_financials')
                .select('*')
                .order('client_name');
            if (error) throw error;
            return data || [];
        }
    },

    // =========================================
    // PROJECTS
    // =========================================
    projects: {
        async getAll() {
            const { data, error } = await supabaseClient
                .from('projects')
                .select('*, clients(client_name)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },

        async getWithFinancials() {
            const { data, error } = await supabaseClient
                .from('project_financials')
                .select('*')
                .order('project_name');
            if (error) throw error;
            return data || [];
        },

        async getByClient(clientId) {
            const { data, error } = await supabaseClient
                .from('project_financials')
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },

        async getById(id) {
            const { data, error } = await supabaseClient
                .from('projects')
                .select('*, clients(client_name)')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        },

        async create(project) {
            const { data, error } = await supabaseClient
                .from('projects')
                .insert(project)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async update(id, project) {
            const { data, error } = await supabaseClient
                .from('projects')
                .update({ ...project, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async delete(id) {
            const { error } = await supabaseClient
                .from('projects')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },

        async getDeveloperPayments(projectId) {
            const { data, error } = await supabaseClient
                .from('project_developer_payments')
                .select('*')
                .eq('project_id', projectId);
            if (error) throw error;
            return data || [];
        }
    },

    // =========================================
    // PEOPLE
    // =========================================
    people: {
        async getAll() {
            const { data, error } = await supabaseClient
                .from('people')
                .select('*')
                .order('name');
            if (error) throw error;
            return data || [];
        },

        async getWithFinancials() {
            const { data, error } = await supabaseClient
                .from('people_financials')
                .select('*')
                .order('name');
            if (error) throw error;
            return data || [];
        },

        async getActive() {
            const { data, error } = await supabaseClient
                .from('people')
                .select('*')
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data || [];
        },

        async getById(id) {
            const { data, error } = await supabaseClient
                .from('people')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        },

        async create(person) {
            const { data, error } = await supabaseClient
                .from('people')
                .insert(person)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async update(id, person) {
            const { data, error } = await supabaseClient
                .from('people')
                .update({ ...person, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async delete(id) {
            const { error } = await supabaseClient
                .from('people')
                .delete()
                .eq('id', id);
            if (error) throw error;
        }
    },

    // =========================================
    // PROJECT DEVELOPERS (Junction Table)
    // =========================================
    projectDevelopers: {
        async assign(projectId, personId, agreedAmount) {
            const { data, error } = await supabaseClient
                .from('project_developers')
                .upsert({
                    project_id: projectId,
                    person_id: personId,
                    agreed_amount: agreedAmount
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async remove(projectId, personId) {
            const { error } = await supabaseClient
                .from('project_developers')
                .delete()
                .eq('project_id', projectId)
                .eq('person_id', personId);
            if (error) throw error;
        },

        async getByProject(projectId) {
            const { data, error } = await supabaseClient
                .from('project_developers')
                .select('*, people(name)')
                .eq('project_id', projectId);
            if (error) throw error;
            return data || [];
        }
    },

    // =========================================
    // TRANSACTIONS
    // =========================================
    transactions: {
        async getAll(filters = {}) {
            let query = supabaseClient
                .from('transactions')
                .select('*, projects(project_name), people(name)')
                .order('date', { ascending: false });

            if (filters.startDate) {
                query = query.gte('date', filters.startDate);
            }
            if (filters.endDate) {
                query = query.lte('date', filters.endDate);
            }
            if (filters.type) {
                query = query.eq('type', filters.type);
            }
            if (filters.account) {
                query = query.eq('account', filters.account);
            }
            if (filters.projectId) {
                query = query.eq('project_id', filters.projectId);
            }
            if (filters.personId) {
                query = query.eq('person_id', filters.personId);
            }
            if (filters.paymentStatus) {
                query = query.eq('payment_status', filters.paymentStatus);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },

        async getByProject(projectId) {
            const { data, error } = await supabaseClient
                .from('transactions')
                .select('*, people(name)')
                .eq('project_id', projectId)
                .order('date', { ascending: false });
            if (error) throw error;
            return data || [];
        },

        async getByPerson(personId) {
            const { data, error } = await supabaseClient
                .from('transactions')
                .select('*, projects(project_name)')
                .eq('person_id', personId)
                .order('date', { ascending: false });
            if (error) throw error;
            return data || [];
        },

        async create(transaction) {
            const { data, error } = await supabaseClient
                .from('transactions')
                .insert(transaction)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async update(id, transaction) {
            const { data, error } = await supabaseClient
                .from('transactions')
                .update({ ...transaction, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async delete(id) {
            const { error } = await supabaseClient
                .from('transactions')
                .delete()
                .eq('id', id);
            if (error) throw error;
        }
    },

    // =========================================
    // DASHBOARD & REPORTS
    // =========================================
    dashboard: {
        async getKPIs(startDate, endDate) {
            const { data, error } = await supabaseClient
                .from('transactions')
                .select('type, amount')
                .gte('date', startDate)
                .lte('date', endDate);

            if (error) throw error;

            const kpis = {
                revenue: 0,
                devPayments: 0,
                toolCosts: 0,
                ads: 0,
                miscExpenses: 0,
                salaries: 0,
                founderWithdrawals: 0,
                totalExpenses: 0,
                profit: 0
            };

            (data || []).forEach(t => {
                const amount = parseFloat(t.amount) || 0;
                switch (t.type) {
                    case 'Revenue':
                        kpis.revenue += amount;
                        break;
                    case 'Dev Payment':
                        kpis.devPayments += amount;
                        kpis.totalExpenses += amount;
                        break;
                    case 'Tool Cost':
                        kpis.toolCosts += amount;
                        kpis.totalExpenses += amount;
                        break;
                    case 'Ads':
                        kpis.ads += amount;
                        kpis.totalExpenses += amount;
                        break;
                    case 'Misc Expense':
                        kpis.miscExpenses += amount;
                        kpis.totalExpenses += amount;
                        break;
                    case 'Salary':
                        kpis.salaries += amount;
                        kpis.totalExpenses += amount;
                        break;
                    case 'Founder Withdrawal':
                        kpis.founderWithdrawals += amount;
                        break;
                }
            });

            kpis.profit = kpis.revenue - kpis.totalExpenses;
            return kpis;
        },

        async getExpenseBreakdown(startDate, endDate) {
            const kpis = await this.getKPIs(startDate, endDate);
            return {
                labels: ['Dev Payments', 'Tool Costs', 'Ads', 'Misc Expenses', 'Salaries'],
                values: [kpis.devPayments, kpis.toolCosts, kpis.ads, kpis.miscExpenses, kpis.salaries]
            };
        },

        async getMonthlyTrend(months = 6) {
            const { data, error } = await supabaseClient
                .from('monthly_summary')
                .select('*')
                .order('month', { ascending: false })
                .limit(months);

            if (error) throw error;
            return (data || []).reverse();
        },

        async getFounderBalances() {
            // Get founders
            const { data: founders, error: foundersError } = await supabaseClient
                .from('people')
                .select('id, name')
                .eq('role', 'Founder');

            if (foundersError) throw foundersError;

            // Get monthly summaries for calculating shares
            const { data: summaries, error: summaryError } = await supabaseClient
                .from('monthly_summary')
                .select('*')
                .order('month');

            if (summaryError) throw summaryError;

            // Get withdrawals per founder
            const { data: withdrawals, error: withdrawalsError } = await supabaseClient
                .from('transactions')
                .select('person_id, amount')
                .eq('type', 'Founder Withdrawal')
                .eq('payment_status', 'Paid');

            if (withdrawalsError) throw withdrawalsError;

            // Calculate totals
            const totalProfit = (summaries || []).reduce((sum, s) => sum + parseFloat(s.net_profit || 0), 0);
            const founderCount = (founders || []).length || 1;
            const sharePerFounder = totalProfit / founderCount;

            const balances = (founders || []).map(founder => {
                const totalWithdrawn = (withdrawals || [])
                    .filter(w => w.person_id === founder.id)
                    .reduce((sum, w) => sum + parseFloat(w.amount || 0), 0);

                return {
                    id: founder.id,
                    name: founder.name,
                    shareDue: sharePerFounder,
                    totalWithdrawn: totalWithdrawn,
                    balance: sharePerFounder - totalWithdrawn
                };
            });

            return balances;
        },

        async getMoneyOwed() {
            // Clients owe us
            const { data: projectsData, error: projectsError } = await supabaseClient
                .from('project_financials')
                .select('amount_owed')
                .gt('amount_owed', 0);

            if (projectsError) throw projectsError;

            const clientsOweUs = (projectsData || []).reduce((sum, p) => sum + parseFloat(p.amount_owed || 0), 0);

            // We owe contractors
            const { data: pendingPayments, error: pendingError } = await supabaseClient
                .from('transactions')
                .select('amount')
                .eq('payment_status', 'Pending')
                .in('type', ['Dev Payment', 'Salary']);

            if (pendingError) throw pendingError;

            const weOweContractors = (pendingPayments || []).reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

            return {
                clientsOweUs,
                weOweContractors
            };
        },

        async getRecentTransactions(limit = 5) {
            const { data, error } = await supabaseClient
                .from('transactions')
                .select('*, projects(project_name), people(name)')
                .order('date', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        }
    },

    // =========================================
    // REPORTS
    // =========================================
    reports: {
        async getMonthlySummary(year) {
            const { data, error } = await supabaseClient
                .from('monthly_summary')
                .select('*')
                .gte('month', `${year}-01-01`)
                .lte('month', `${year}-12-31`)
                .order('month');

            if (error) throw error;
            return data || [];
        },

        async getMonthlyData(year) {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;

            const { data, error } = await supabaseClient
                .from('transactions')
                .select('*')
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date');

            if (error) throw error;
            return data || [];
        },

        async getTopClients(year, limit = 5) {
            const { data, error } = await supabaseClient
                .from('client_financials')
                .select('*')
                .order('total_revenue', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        },

        async getTopProjects(year, limit = 5) {
            const { data, error } = await supabaseClient
                .from('project_financials')
                .select('*')
                .order('total_received', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        }
    }
};

// =============================================
// EXPORT FOR GLOBAL USE
// =============================================
window.db = db;
window.supabaseClient = supabaseClient;

// Log connection status
console.log('✓ Supabase connected:', SUPABASE_URL);
