require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase.from('people').select('id, name, role');
    console.log("People data:", data);
    if(error) console.error(error);
    
    for (const p of data || []) {
        if ((String(p.name).toLowerCase().includes('dave') || String(p.name).toLowerCase().includes('randy'))) {
            if (p.role !== 'Founder') {
                console.log('Fixing role for:', p.name);
                await supabase.from('people').update({ role: 'Founder' }).eq('id', p.id);
            }
        }
    }
}
run();
