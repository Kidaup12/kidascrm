import { db } from './src/lib/supabase.js';

async function test() {
    try {
        const id = crypto.randomUUID();
        await db.people.create({
            name: 'Test Salary Person',
            role: 'Employee',
            payment_type: 'Salary'
        });
        console.log('Success - no constraint violation.');
        
        const all = await db.people.getAll();
        const created = all.find(p => p.name === 'Test Salary Person');
        if (created) { await db.people.delete(created.id); }
    } catch (e) {
        console.error('Failed to insert Salary:', e);
    }
}
test();
