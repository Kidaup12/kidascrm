import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

try {
    const buf = readFileSync('./2026 k.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName] || {});
    
    // Find a row that has plenty of keys to get a good sense of headers
    const row = rows.find(r => Object.keys(r).length > 5) || rows[0];
    
    console.log("Headers detected in a populated row:");
    console.log(Object.keys(row));
    console.log("\nSample data from that row:");
    console.log(row);
} catch (e) {
    console.error("Error reading 2026 k.xlsx:", e);
}
