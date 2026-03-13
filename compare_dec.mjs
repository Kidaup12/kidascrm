import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { db } from './src/lib/supabase.js';

// Safe string utility
const str = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const parseAmt = (a) => a ? parseFloat(String(a).replace(/[$,]/g, '')) : 0;

async function main() {
    console.log('Reading decds.xlsx...');
    const buf = readFileSync('./decds.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const excelRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName] || {});

    console.log(`Found ${excelRows.length} rows in Excel.`);

    console.log('Fetching December transactions from database...');
    const allTxs = await db.transactions.getAll();
    const decTxs = allTxs.filter(t => t.date && t.date.startsWith('2025-12'));
    console.log(`Found ${decTxs.length} December transactions in DB.`);

    // Very basic conflict checking
    let conflicts = [];
    let unmatchedExcel = [];
    let dbMatched = new Set();

    // Map DB transactions for easier lookup (rough matching on amount and type)
    const dbTxMap = decTxs.map(t => ({...t, matched: false}));

    for (const r of excelRows) {
        if (!r.Date || r.Date === 'Total') continue;

        let dateStr = r.Date;
        if (typeof dateStr === 'number') {
            const d = new Date((dateStr - 25569) * 86400000);
            dateStr = d.toISOString().split('T')[0];
        } else {
            // Rough parsing if it's string like '1-Dec'
            const parts = String(dateStr).split('-');
            if(parts.length >= 2) {
                const day = parts[0].padStart(2, '0');
                dateStr = `2025-12-${day}`;
            }
        }

        const earnings = parseAmt(r.Earnings);
        const expenses = parseAmt(r.Expenses);
        const dave = parseAmt(r['Paid to Dave'] || r['Dave']);
        const randy = parseAmt(r['Paid to Randy'] || r['Randy']);

        if (earnings > 0) {
            const match = dbTxMap.find(t => !t.matched && t.type === 'Revenue' && Math.abs(t.amount - earnings) < 1);
            if (match) { match.matched = true; } 
            else { unmatchedExcel.push({ date: dateStr, type: 'Revenue', amount: earnings, client: r.Client }); }
        }
        if (expenses > 0) {
            const match = dbTxMap.find(t => !t.matched && ['Dev Payment', 'Tool Cost', 'Misc Expense'].includes(t.type) && Math.abs(t.amount - expenses) < 1);
            if (match) { match.matched = true; }
            else { unmatchedExcel.push({ date: dateStr, type: 'Expense', amount: expenses, desc: r['Expenses Name'] }); }
        }
        if (dave > 0) {
            const match = dbTxMap.find(t => !t.matched && t.type === 'Founder Withdrawal' && Math.abs(t.amount - dave) < 1); // rough person match ignored for now
            if (match) { match.matched = true; }
        }
        if (randy > 0) {
            const match = dbTxMap.find(t => !t.matched && t.type === 'Founder Withdrawal' && Math.abs(t.amount - randy) < 1);
            if (match) { match.matched = true; }
        }
    }

    const unmatchedDb = dbTxMap.filter(t => !t.matched);

    console.log('\n--- CONFLICT REPORT ---');
    console.log('Unmatched items in Excel (not in DB):', unmatchedExcel.length);
    if(unmatchedExcel.length > 0) console.log(unmatchedExcel.slice(0, 5), '...');

    console.log('Unmatched items in DB (not in Excel):', unmatchedDb.length);
    if(unmatchedDb.length > 0) console.log(unmatchedDb.slice(0, 5).map(t => ({ date: t.date, type: t.type, amount: t.amount, desc: t.description })), '...');

    console.log('\nDifferences generally mean either dates shift slightly, amounts shifted due to currency conversion, or records are missing in one place.');
}

main().catch(console.error);
