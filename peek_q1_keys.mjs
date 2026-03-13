import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

try {
    const buf = readFileSync('./2026 k.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName] || {});
    const allKeys = new Set();
    rows.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
    console.log("All unique columns in Q1 2026 import file:", [...allKeys]);
} catch (e) {
    console.error("Error reading 2026 k.xlsx:", e);
}
