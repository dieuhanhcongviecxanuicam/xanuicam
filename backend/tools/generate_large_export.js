// Simple stress script to simulate large export memory usage
// Usage: node tools/generate_large_export.js [rows] [fieldsPerRow]
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const rows = parseInt(process.argv[2] || '50000', 10); // default 50k rows
const fields = parseInt(process.argv[3] || '20', 10); // default 20 fields per user

(async () => {
  console.log('Generating large workbook rows=%s fields=%s', rows, fields);
  const start = Date.now();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('stress');
  ws.columns = [{ header: 'user', key: 'user', width: 30 }].concat(
    Array.from({ length: fields }).map((_, i) => ({ header: `f${i+1}`, key: `f${i+1}`, width: 30 }))
  );

  for (let i = 0; i < rows; i++) {
    const user = `user_${i}`;
    const obj = { user };
    for (let j = 0; j < fields; j++) obj[`f${j+1}`] = `val_${i}_${j}`;
    ws.addRow(obj);
    if (i % 10000 === 0) console.log('added', i);
  }

  const tmp = path.join(require('os').tmpdir(), `stress_export_${Date.now()}.xlsx`);
  await wb.xlsx.writeFile(tmp);
  const stat = fs.statSync(tmp);
  console.log('Wrote', tmp, 'size', stat.size, 'bytes in', (Date.now() - start)/1000, 's');
  console.log('Memory usage', process.memoryUsage());
})();
