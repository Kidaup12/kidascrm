import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

try {
    const buf = readFileSync('./2026 k.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName] || {});
    console.log("Q1 2026 Headers:", Object.keys(rows[0] || {}));
    console.log("Sample Row 1:", rows[0]);
    console.log("Sample Row 2:", rows[1]);
} catch (e) {
    console.error("Error reading 2026 k.xlsx:", e);
}
