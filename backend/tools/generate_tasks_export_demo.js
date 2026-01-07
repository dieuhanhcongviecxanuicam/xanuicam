const pool = require('../src/db');
const ExcelJS = require('exceljs');
const fs = require('fs');

(async ()=>{
  try{
    const { rows } = await pool.query(`SELECT t.*, creator.full_name as creator_name, assignee.full_name as assignee_name FROM tasks t JOIN users creator ON t.creator_id = creator.id LEFT JOIN users assignee ON t.assignee_id = assignee.id ORDER BY t.created_at DESC LIMIT 1000`);
    const pad = (n) => String(n).padStart(2,'0');
    const d = new Date();
    const dd = pad(d.getDate()); const mm = pad(d.getMonth()+1); const yyyy = d.getFullYear();
    const hh = pad(d.getHours()); const min = pad(d.getMinutes()); const ss = pad(d.getSeconds());
    const dateOnly = `${dd}${mm}${yyyy}`;
    const datetime = `${dd}${mm}${yyyy}${hh}${min}${ss}`;
    const filenameBase = `xanuicam_tasks_${datetime}`;

    const wb = new ExcelJS.Workbook();
    const sheetName = (`xanuicam_tasks_${dateOnly}`).substring(0,31);
    const ws = wb.addWorksheet(sheetName);
    const cols = [
      { header: 'ID', key: 'id' }, { header: 'Tiêu đề', key: 'title' }, { header: 'Mô tả', key: 'description' },
      { header: 'Trạng thái', key: 'status' }, { header: 'Độ ưu tiên', key: 'priority' }, { header: 'Người tạo', key: 'creator_name' },
      { header: 'Người thực hiện', key: 'assignee_name' }, { header: 'Hạn chót', key: 'due_date' }, { header: 'Thời gian tạo', key: 'created_at' },
      { header: 'Thời gian cập nhật', key: 'updated_at' }, { header: 'KPI', key: 'kpi_score' }
    ];
    ws.columns = cols;
    for (const r of rows) {
      ws.addRow({
        id: r.id,
        title: r.title || '',
        description: r.description || '',
        status: r.status || '',
        priority: r.priority || '',
        creator_name: r.creator_name || '',
        assignee_name: r.assignee_name || '',
        due_date: r.due_date ? r.due_date.toISOString() : '',
        created_at: r.created_at ? r.created_at.toISOString() : '',
        updated_at: r.updated_at ? r.updated_at.toISOString() : '',
        kpi_score: r.kpi_score || ''
      });
    }
    const out = `${filenameBase}.xlsx`;
    await wb.xlsx.writeFile(out);
    console.log('Wrote', out);
    process.exit(0);
  }catch(e){
    console.error('Demo export failed', e);
    process.exit(1);
  }
})();
