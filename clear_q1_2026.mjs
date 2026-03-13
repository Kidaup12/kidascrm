import { db } from './src/lib/supabase.js';

async function clearQ1() {
    console.log("Fetching transactions for Q1 2026...");
    const txs = await db.transactions.getAll();
    const q1Txs = txs.filter(t => t.date && (t.date.startsWith('2026-01') || t.date.startsWith('2026-02') || t.date.startsWith('2026-03')));
    
    console.log(`Found ${q1Txs.length} transactions. Deleting...`);
    
    // Serial delete to be safe on connections
    for (const t of q1Txs) {
        try {
            await db.transactions.delete(t.id);
            process.stdout.write('.');
        } catch (e) {
            console.error(`\nFailed to delete ${t.id}:`, e.message);
        }
    }
    console.log(`\nCleared Q1 2026 data.`);
}

clearQ1().catch(console.error);
