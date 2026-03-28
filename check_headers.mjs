import XLSX from 'xlsx';
import { readFileSync } from 'fs';

try {
    const buf = readFileSync('./2026 k.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log('Headers:', JSON.stringify(json[0]));
    console.log('First data row:', JSON.stringify(json[1]));
} catch (e) {
    console.error(e);
}
