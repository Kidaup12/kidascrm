import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { db } from './src/lib/supabase.js';

const parseAmt = (a) => a ? parseFloat(String(a).replace(/[$,]/g, '')) : 0;

// Convert amounts from KES to USD (user specified all are in KES)
const toUSD = (kesAmt) => kesAmt ? +(kesAmt / 128).toFixed(2) : 0;

async function main() {
    console.log('Loading database reference data...');
    const [clients, projects, people] = await Promise.all([
        db.clients.getAll(),
        db.projects.getAll(),
        db.people.getAll()
    ]);

    let frech = people.find(p => p.name.toLowerCase() === 'frech');
    if (!frech) {
        console.log('Creating person "Frech"...');
        await db.people.create({ name: 'Frech', role: 'Contractor', payment_type: 'Per Project', is_active: true });
        frech = (await db.people.getAll()).find(p => p.name.toLowerCase() === 'frech');
    }

    const dave = people.find(p => p.name.toLowerCase() === 'dave' && p.role === 'Founder');
    const randy = people.find(p => p.name.toLowerCase() === 'randy' && p.role === 'Founder');
    const marto = people.find(p => p.name.toLowerCase() === 'marto');
    const ian = people.find(p => p.name.toLowerCase() === 'gichachi' || p.name.toLowerCase() === 'ian');

    console.log('Reading 2026 k.xlsx...');
    const buf = readFileSync('./2026 k.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName] || {});

    for (const r of rows) {
        let dateStr = r[' 202'] || r['Date'];
        if (!dateStr || String(dateStr).trim() === 'Total' || String(dateStr).trim() === 'Earnings') continue; // End/summary row

        let date;
        if (typeof dateStr === 'number') {
            const d = new Date((dateStr - 25569) * 86400000);
            date = d.toISOString().split('T')[0];
        } else {
            // Very rough string parse assuming "1-Jan" formats.
            dateStr = String(dateStr).trim();
            const parts = dateStr.split('-');
            if (parts.length >= 2) {
                const day = parts[0];
                const monthName = parts[1].substring(0, 3);
                const m = { "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6, "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12 }[monthName] || 1;
                // Since it's Q1 2026
                date = `2026-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            } else {
                date = `2026-01-01`; // Fallback
            }
        }

        try {
            const clientName = r['Client'] ? String(r['Client']) : '';
            let clientId = null, projectId = null;
            if (clientName) {
                const cNameMatch = clientName.split(' ')[0].toLowerCase();
                const mappedClient = clients.find(c => c.client_name.toLowerCase().includes(cNameMatch));
                if (mappedClient) {
                    clientId = mappedClient.id;
                    const mappedProj = projects.find(p => p.client_id === clientId);
                    if (mappedProj) projectId = mappedProj.id;
                }
            }

            const descName = r['Description'] ? String(r['Description']) : '';
            const expName = r['Expenses Name'] ? String(r['Expenses Name']) : '';

            // 1. Wise Earnings
            const wiseEarnings = parseAmt(r['Wise Earnings']);
            if (wiseEarnings > 0) {
                const amount = toUSD(wiseEarnings);
                try {
                    await db.transactions.create({
                        date, type: 'Revenue', account: 'Wise', amount, currency: 'KES', original_amount: wiseEarnings, payment_status: 'Completed', project_id: projectId, description: `Wise Revenue: ${clientName}`, billing_type: 'One-off'
                    });
                    console.log(`[${date}] + Wise Revenue: $${amount}`);
                } catch(e) {}
            }

            // 2. Upwork Earnings
            const uwEarnings = parseAmt(r['Upwork Earnings']);
            if (uwEarnings > 0) {
                const amount = toUSD(uwEarnings);
                try {
                    await db.transactions.create({
                        date, type: 'Revenue', account: 'Upwork', amount, currency: 'KES', original_amount: uwEarnings, payment_status: 'Completed', project_id: projectId, description: `Upwork Revenue: ${clientName}`, billing_type: 'One-off'
                    });
                    console.log(`[${date}] + Upwork Revenue: $${amount}`);
                } catch(e) {}
            }

            // 3. Founder Withdrawals
            const paidDave = parseAmt(r['Paid to Dave']);
            const paidRandy = parseAmt(r['Paid to Randy']);
            // Try to infer account based on which withdrawal column has a value
            let wdAccount = 'Wise'; // default
            if (parseAmt(r['Upwork Withdrawals']) > 0) wdAccount = 'Upwork';

            if (paidDave > 0 && dave) {
                const amount = toUSD(paidDave);
                try {
                    await db.transactions.create({
                        date, type: 'Founder Withdrawal', account: wdAccount, amount, currency: 'KES', original_amount: paidDave, payment_status: 'Completed', person_id: dave.id, description: 'Imported withdrawal'
                    });
                    console.log(`[${date}] - Dave Withdrawal (${wdAccount}): $${amount}`);
                } catch(e) {}
            }

            if (paidRandy > 0 && randy) {
                const amount = toUSD(paidRandy);
                try {
                    await db.transactions.create({
                        date, type: 'Founder Withdrawal', account: wdAccount, amount, currency: 'KES', original_amount: paidRandy, payment_status: 'Completed', person_id: randy.id, description: 'Imported withdrawal'
                    });
                    console.log(`[${date}] - Randy Withdrawal (${wdAccount}): $${amount}`);
                } catch(e) {}
            }

            // 4. Expenses (Wise & Upwork)
            const processExpense = async (expAmtKes, account) => {
                const amount = toUSD(expAmtKes);
                const lowerExp = expName.toLowerCase();
                let type = 'Tool Cost';
                let personId = null;

                if (lowerExp.includes('frech') && frech) { type = 'Dev Payment'; personId = frech.id; }
                else if (lowerExp.includes('marto') && marto) { type = 'Dev Payment'; personId = marto.id; }
                else if ((lowerExp.includes('ian') || lowerExp.includes('gichachi')) && ian) { type = 'Dev Payment'; personId = ian.id; }

                try {
                    await db.transactions.create({
                        date, type, account, amount, currency: 'KES', original_amount: expAmtKes, payment_status: 'Completed', person_id: personId, description: expName || descName, billing_type: type === 'Tool Cost' ? 'Recurring' : 'One-off'
                    });
                    console.log(`[${date}] - Expense (${account} - ${type}): $${amount} - ${expName || descName}`);
                } catch(e) {}
            };

            const wiseExpenses = parseAmt(r['Wise Expense']);
            if (wiseExpenses > 0) await processExpense(wiseExpenses, 'Wise');

            const uwExpenses = parseAmt(r['Upwork Expenses']);
            if (uwExpenses > 0) await processExpense(uwExpenses, 'Upwork');

            // 5. Connects
            const connects = parseAmt(r['Connects']);
            if (connects > 0) {
                const amount = toUSD(connects);
                try {
                    await db.transactions.create({
                        date, type: 'Ads', account: 'Upwork', amount, currency: 'KES', original_amount: connects, payment_status: 'Completed', description: 'Upwork Connects', billing_type: 'One-off'
                    });
                    console.log(`[${date}] - Connects: $${amount}`);
                } catch(e) {}
            }
            
        } catch (err) {
            console.error(`Failed on row ${dateStr}:`, err.message || err);
        }
    }

    console.log('Q1 Data Import Complete.');
}

main().catch(console.error);
