const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const rows = [
      { id: 1, full_name: 'Nguyễn Văn A', username: 'nguyena', config: { OS: 'Windows 10', RAM: '8GB' } },
      { id: 2, full_name: 'Trần Thị B', username: 'tranb', config: { OS: 'Ubuntu 22.04', RAM: '16GB' } }
    ];

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dd = pad(now.getDate());
    const mm = pad(now.getMonth() + 1);
    const yyyy = now.getFullYear();
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    const datetime = `${dd}${mm}${yyyy}${hh}${min}${ss}`;

    const workbook = new ExcelJS.Workbook();
    const sheetName = `xanuicam_test_${dd}${mm}${yyyy}`.substring(0, 31);
    const ws = workbook.addWorksheet(sheetName);
    ws.columns = [
      { header: 'Người dùng', key: 'user', width: 30 },
      { header: 'Trường', key: 'field', width: 40 },
      { header: 'Giá trị', key: 'value', width: 60 }
    ];

    rows.forEach(r => {
      const cfg = r.config || {};
      if (!cfg || Object.keys(cfg).length === 0) {
        ws.addRow({ user: `${r.full_name} (${r.username})`, field: '(Không có)', value: '' });
      } else {
        Object.entries(cfg).forEach(([k, v]) => {
          ws.addRow({ user: `${r.full_name} (${r.username})`, field: k, value: v === null || v === undefined ? '' : String(v) });
        });
      }
    });

    const outPath = path.join(__dirname, '..', '..', 'tmp', `quick_export_${datetime}.xlsx`);
    try { fs.mkdirSync(path.dirname(outPath), { recursive: true }); } catch (e) {}
    await workbook.xlsx.writeFile(outPath);
    console.log('Wrote sample XLSX to', outPath);
  } catch (e) {
    console.error('quick export failed', e && (e.stack || e));
    process.exit(1);
  }
})();
