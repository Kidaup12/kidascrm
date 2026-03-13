import fs from 'fs';
import { db } from './src/lib/supabase.js';

// Simple CSV Parser
function parseCSV(content) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;
    for (let pos = 0; pos < content.length; pos++) {
        const c = content[pos];
        if (inQuotes) {
            if (c === '"') {
                if (pos + 1 < content.length && content[pos + 1] === '"') {
                    currentCell += '"'; pos++;
                } else {
                    inQuotes = false;
                }
            } else { currentCell += c; }
        } else {
            if (c === '"') { inQuotes = true; }
            else if (c === ',') { currentRow.push(currentCell.trim()); currentCell = ''; }
            else if (c === '\r' || c === '\n') {
                if (c === '\r' && pos + 1 < content.length && content[pos + 1] === '\n') pos++;
                currentRow.push(currentCell.trim());
                rows.push(currentRow);
                currentRow = []; currentCell = '';
            } else { currentCell += c; }
        }
    }
    if (currentRow.length || currentCell) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }
    return rows;
}

const parseAmt = (a) => a ? parseFloat(a.replace(/[$,]/g, '')) : 0;
const parseDate = (d) => {
    const [day, month] = d.split('-');
    const m = { "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6, "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12 }[month];
    return `2025-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

async function main() {
    console.log('Loading database reference data...');
    const [clients, projects, people] = await Promise.all([
        db.clients.getAll(),
        db.projects.getAll(),
        db.people.getAll()
    ]);

    // Ensure Frech exists
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

    const csvData = fs.readFileSync('./october.csv', 'utf-8');
    const rows = parseCSV(csvData);

    let idx = 0;
    for (const row of rows) {
        if (idx++ === 0) continue; // Skip header
        if (!row[0] || row[0] === 'Total' || row[0] === 'Earnings') break; // End of data

        const [dateStr, earningsStr, clientName, withdrawalsStr, paidDaveStr, paidRandyStr, debtsStr, debtByStr, clearedStr, expensesStr, expNameStr, connectsStr] = row;
        const date = parseDate(dateStr);

        try {
            // 1. Earnings (Revenue)
            const earnings = parseAmt(earningsStr);
            if (earnings > 0) {
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

                const isKes = earnings > 4000;
                const amount = isKes ? +(earnings / 128).toFixed(2) : earnings;
                
                await db.transactions.create({
                    date,
                    type: 'Revenue',
                    account: 'Upwork',
                    amount,
                    currency: isKes ? 'KES' : 'USD',
                    original_amount: isKes ? earnings : null,
                    payment_status: 'Completed',
                    project_id: projectId,
                    description: `Imported revenue for ${clientName}`,
                    billing_type: 'One-off'
                });
                console.log(`[${date}] + Revenue: $${amount}`);
            }

            // 2. Withdrawals
            const paidDave = parseAmt(paidDaveStr);
            if (paidDave > 0 && dave) {
                await db.transactions.create({
                    date,
                    type: 'Founder Withdrawal',
                    account: 'Upwork',
                    amount: paidDave,
                    currency: 'USD',
                    payment_status: 'Completed',
                    person_id: dave.id,
                    description: 'Imported withdrawal'
                });
                console.log(`[${date}] - Dave Withdrawal: $${paidDave}`);
            }

            const paidRandy = parseAmt(paidRandyStr);
            if (paidRandy > 0 && randy) {
                await db.transactions.create({
                    date,
                    type: 'Founder Withdrawal',
                    account: 'Upwork',
                    amount: paidRandy,
                    currency: 'USD',
                    payment_status: 'Completed',
                    person_id: randy.id,
                    description: 'Imported withdrawal'
                });
                console.log(`[${date}] - Randy Withdrawal: $${paidRandy}`);
            }

            // 3. Expenses
            const expenses = parseAmt(expensesStr);
            if (expenses > 0) {
                const isKes = expenses > 4000;
                const amount = isKes ? +(expenses / 128).toFixed(2) : expenses;
                const lowerExp = expNameStr ? expNameStr.toLowerCase() : '';
                
                let type = 'Tool Cost';
                let personId = null;

                if (lowerExp.includes('frech') && frech) { type = 'Dev Payment'; personId = frech.id; }
                else if (lowerExp.includes('marto') && marto) { type = 'Dev Payment'; personId = marto.id; }
                else if ((lowerExp.includes('ian') || lowerExp.includes('gichachi')) && ian) { type = 'Dev Payment'; personId = ian.id; }

                const account = ['frech', 'marto', 'ian', 'gichachi'].some(p => lowerExp.includes(p)) ? 'Wise' : 'Bank';

                await db.transactions.create({
                    date,
                    type,
                    account,
                    amount,
                    currency: isKes ? 'KES' : 'USD',
                    original_amount: isKes ? expenses : null,
                    payment_status: 'Completed',
                    person_id: personId,
                    description: expNameStr,
                    billing_type: type === 'Tool Cost' ? 'Recurring' : 'One-off'
                });
                console.log(`[${date}] - Expense (${type}): $${amount} - ${expNameStr}`);
            }

            // 4. Connects
            const connects = parseAmt(connectsStr);
            if (connects > 0) {
                await db.transactions.create({
                    date,
                    type: 'Ads',
                    account: 'Upwork',
                    amount: connects,
                    currency: 'USD',
                    payment_status: 'Completed',
                    description: 'Upwork Connects',
                    billing_type: 'One-off'
                });
                console.log(`[${date}] - Connects: $${connects}`);
            }
        } catch (err) {
            console.error(`Failed on row ${dateStr}:`, err.message || err);
        }
    }

    console.log('October Data Import Complete.');
}

main().catch(console.error);
