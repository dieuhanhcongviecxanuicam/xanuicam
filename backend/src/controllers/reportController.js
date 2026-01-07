const pool = require('../db');
const ExcelJS = require('exceljs');
const { format } = require('date-fns');

// Hàm trợ giúp để xây dựng câu truy vấn lọc động
const buildFilterClause = (queryParams) => {
    const { userId, departmentId, startDate, endDate, status, isOverdue } = queryParams;
    let baseQuery = 'FROM tasks t JOIN users u ON t.assignee_id = u.id';
    const params = [];
    let paramIndex = 1;
    let whereClauses = ['1=1'];

    if (userId) {
        whereClauses.push(`t.assignee_id = $${paramIndex++}`);
        params.push(userId);
    }
    if (departmentId) {
        whereClauses.push(`u.department_id = $${paramIndex++}`);
        params.push(departmentId);
    }
    if (startDate) {
        whereClauses.push(`t.created_at >= $${paramIndex++}`);
        params.push(startDate);
    }
    if (endDate) {
        whereClauses.push(`t.created_at <= $${paramIndex++}`);
        params.push(endDate);
    }
     if (status) {
        if (status === 'Mới') {
            whereClauses.push(`t.status IN ('Mới tạo', 'Tiếp nhận', 'Yêu cầu làm lại')`);
        } else {
            whereClauses.push(`t.status = $${paramIndex++}`);
            params.push(status);
        }
    }
    if (isOverdue === 'true') {
        whereClauses.push(`t.due_date < NOW() AND t.status != 'Hoàn thành'`);
    }

    const whereClauseString = `WHERE ${whereClauses.join(' AND ')}`;
    return { baseQuery, whereClauseString, params };
};

// Lấy số liệu thống kê tổng quan
exports.getOverviewStats = async (req, res) => {
    const { baseQuery, whereClauseString, params } = buildFilterClause(req.query);
    try {
        const totalQuery = `SELECT COUNT(t.id) ${baseQuery} ${whereClauseString}`;
        const completedQuery = `SELECT COUNT(t.id) ${baseQuery} ${whereClauseString} AND t.status = 'Hoàn thành'`;
        const overdueQuery = `SELECT COUNT(t.id) ${baseQuery} ${whereClauseString} AND t.due_date < NOW() AND t.status != 'Hoàn thành'`;
        const inProgressQuery = `SELECT COUNT(t.id) ${baseQuery} ${whereClauseString} AND t.status = 'Đang thực hiện'`;

        const [totalRes, completedRes, overdueRes, inProgressRes] = await Promise.all([
            pool.query(totalQuery, params),
            pool.query(completedQuery, params),
            pool.query(overdueQuery, params),
            pool.query(inProgressQuery, params),
        ]);

        res.json({
            total: parseInt(totalRes.rows[0].count, 10),
            completed: parseInt(completedRes.rows[0].count, 10),
            overdue: parseInt(overdueRes.rows[0].count, 10),
            inProgress: parseInt(inProgressRes.rows[0].count, 10),
        });
    } catch (error) {
        console.error("Lỗi khi lấy thống kê tổng quan:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Lấy danh sách người dùng và phòng ban để làm bộ lọc
exports.getReportFilters = async (req, res) => {
    try {
        const [usersRes, departmentsRes] = await Promise.all([
            pool.query('SELECT id, full_name, department_id FROM users WHERE is_active = TRUE ORDER BY full_name'),
            pool.query('SELECT id, name FROM departments ORDER BY name')
        ]);
        res.json({
            users: usersRes.rows,
            departments: departmentsRes.rows
        });
    } catch (error) {
        console.error("Lỗi khi tải bộ lọc báo cáo:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Lấy báo cáo chi tiết công việc
exports.getDetailedTaskReport = async (req, res) => {
    const { baseQuery, whereClauseString, params } = buildFilterClause(req.query);
    // support pagination
    const page = parseInt(req.query.page, 10) || null;
    const pageSize = parseInt(req.query.pageSize, 10) || null;
    try {
        if (page && pageSize) {
            const offset = (page - 1) * pageSize;
            // include total_count via window function
            const pagedQuery = `
                SELECT t.id, t.title, t.status, t.priority, t.due_date, u.full_name as assignee_name, COUNT(*) OVER() as total_count
                ${baseQuery} ${whereClauseString}
                ORDER BY t.due_date DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
            `;
            const allParams = params.concat([pageSize, offset]);
            const { rows } = await pool.query(pagedQuery, allParams);
            const total = rows.length ? Number(rows[0].total_count) : 0;
            const items = rows.map(r => ({ id: r.id, title: r.title, status: r.status, priority: r.priority, due_date: r.due_date, assignee_name: r.assignee_name }));
            return res.json({ items, total });
        }

        const query = `
            SELECT t.id, t.title, t.status, t.priority, t.due_date, 
                   u.full_name as assignee_name
            ${baseQuery} ${whereClauseString}
            ORDER BY t.due_date DESC
        `;
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi khi lấy báo cáo chi tiết:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Thống kê công việc theo từng người dùng
exports.getTasksByUser = async (req, res) => {
    const { whereClauseString, params } = buildFilterClause(req.query);
    const query = `
        SELECT 
            u.id as user_id,
            u.full_name as user_name,
            COUNT(t.id) as total_tasks,
            AVG(t.kpi_score) FILTER (WHERE t.kpi_score > 0) as average_kpi
        FROM users u
        LEFT JOIN tasks t ON u.id = t.assignee_id
        ${whereClauseString}
        GROUP BY u.id
        ORDER BY total_tasks DESC
    `;
    try {
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi khi thống kê theo người dùng:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Thống kê công việc theo từng phòng ban
exports.getTasksByDepartment = async (req, res) => {
    const { whereClauseString, params } = buildFilterClause(req.query);
     const query = `
        SELECT 
            d.name as department_name,
            COUNT(t.id) as total_tasks,
            COUNT(CASE WHEN t.status = 'Hoàn thành' THEN 1 END) as completed_tasks
        FROM departments d
        LEFT JOIN users u ON d.id = u.department_id
        LEFT JOIN tasks t ON u.id = t.assignee_id
        ${whereClauseString}
        GROUP BY d.name
        ORDER BY total_tasks DESC
    `;
    try {
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi khi thống kê theo phòng ban:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Lấy điểm KPI tổng hợp theo người dùng (average, count)
exports.getKpiScores = async (req, res) => {
    // Accept both `userId` (legacy) and `accountId` (frontend new name)
    if (req.query.accountId && !req.query.userId) req.query.userId = req.query.accountId;
    const { whereClauseString, params } = buildFilterClause(req.query);
    try {
        // If filtering by userId, prefer to compare against u.id so users with zero tasks still appear
        let whereForQuery = whereClauseString;
        if (req.query.userId) {
            whereForQuery = whereForQuery.replace(/t\.assignee_id/g, 'u.id');
        }

        // support pagination for large datasets
        const page = parseInt(req.query.page, 10) || null;
        const pageSize = parseInt(req.query.pageSize, 10) || null;

        // base aggregation CTE
        const aggCte = `
            WITH agg AS (
                SELECT
                    u.id as user_id,
                    u.full_name as name,
                    u.department_id,
                    AVG(t.kpi_score) FILTER (WHERE t.kpi_score IS NOT NULL) as average,
                    COUNT(t.kpi_score) FILTER (WHERE t.kpi_score IS NOT NULL) as count
                FROM users u
                LEFT JOIN tasks t ON u.id = t.assignee_id
                ${whereForQuery}
                GROUP BY u.id, u.full_name, u.department_id
            )
        `;

        if (page && pageSize) {
            const offset = (page - 1) * pageSize;
            const pagedQuery = `${aggCte} SELECT user_id, name, department_id, average, count, COUNT(*) OVER() as total_count FROM agg ORDER BY average DESC NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            const allParams = params.concat([pageSize, offset]);
            const { rows } = await pool.query(pagedQuery, allParams);
            const total = rows.length ? Number(rows[0].total_count) : 0;
            const items = rows.map(r => ({ userId: r.user_id, name: r.name, department_id: r.department_id, average: r.average === null ? null : Number(r.average), count: Number(r.count) }));
            // CSV requested for the whole filtered set: if CSV requested and page set, still return paged CSV
            if (req.query.format === 'csv') {
                const header = 'user_id,name,department_id,average,count\n';
                const csv = rows.map(r => `${r.user_id},"${(r.name||'').replace(/"/g,'""')}",${r.department_id || ''},${r.average === null ? '' : Number(r.average).toFixed(2)},${r.count}\n`).join('');
                // Prepend UTF-8 BOM so Excel on Windows recognizes UTF-8 encoded CSV
                const bom = '\uFEFF';
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', 'attachment; filename="kpi_scores.csv"');
                try { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store'); res.setHeader('X-Download-Options', 'noopen'); } catch (e) {}
                return res.send(bom + header + csv);
            }
            return res.json({ points: items, total });
        }

        // no pagination: return full set (existing behavior)
        const query = `${aggCte} SELECT user_id, name, department_id, average, count FROM agg ORDER BY average DESC NULLS LAST`;
        const { rows } = await pool.query(query, params);
        if (req.query.format === 'csv' || req.query.format === 'xlsx') {
            // Build rows with department name if possible
            // Fetch department names for mapping
            const deptIds = Array.from(new Set(rows.map(r => r.department_id).filter(Boolean)));
            let deptMap = {};
            if (deptIds.length) {
                const { rows: deps } = await pool.query(`SELECT id, name FROM departments WHERE id = ANY($1::int[])`, [deptIds]);
                deptMap = deps.reduce((acc, d) => { acc[d.id] = d.name; return acc; }, {});
            }

            const formatted = rows.map(r => ({
                user_id: r.user_id,
                name: r.name || '',
                department_id: r.department_id || '',
                department_name: r.department_id ? (deptMap[r.department_id] || '') : '',
                average: r.average === null ? '' : Number(r.average).toFixed(2),
                count: r.count || 0
            }));

            const now = new Date();
            const datePart = format(now, 'ddMMyyyy');
            const timePart = format(now, 'HHmmss');
            const baseName = `xanuicam_kpi_${datePart}${timePart}`;

            if (req.query.format === 'csv') {
                const header = 'user_id,name,department_id,department_name,average,count\n';
                const csvBody = formatted.map(r => `${r.user_id},"${(r.name||'').replace(/"/g,'""')}","${r.department_id}","${(r.department_name||'').replace(/"/g,'""')}",${r.average},${r.count}\n`).join('');
                const bom = '\uFEFF';
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${baseName}.csv"`);
                try { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store'); res.setHeader('X-Download-Options', 'noopen'); } catch (e) {}
                return res.send(bom + header + csvBody);
            }

            // XLSX export using exceljs
            const workbook = new ExcelJS.Workbook();
            const sheetName = `xanuicam_kpi_${datePart}`;
            const ws = workbook.addWorksheet(sheetName);

            // Add header rows (title and subtitle similar to screenshot)
            ws.mergeCells('A1', 'F1');
            ws.getCell('A1').value = 'ỦY BAN NHÂN DÂN XÃ NÚI CẤM';
            ws.getCell('A1').alignment = { horizontal: 'center' };
            ws.getCell('A1').font = { bold: true };
            ws.mergeCells('A2', 'F2');
            ws.getCell('A2').value = 'HỆ THỐNG ĐIỀU HÀNH CÔNG VIỆC';
            ws.getCell('A2').alignment = { horizontal: 'center' };
            ws.mergeCells('A3', 'F3');
            ws.getCell('A3').value = `(Dữ liệu được trích xuất từ Biểu đồ KPI - Phân tích điểm KPI theo người dùng và phòng ban)  Ngày xuất: ${format(now, 'dd/MM/yyyy HH:mm:ss')}`;
            ws.getCell('A3').alignment = { horizontal: 'center' };

            // Column headers
            ws.addRow([]);
            const headerRow = ws.addRow(['Mã người dùng', 'Họ tên', 'Phòng ban', 'Department ID', 'Điểm trung bình', 'Số lần chấm']);
            headerRow.font = { bold: true };

            // Add data rows
            formatted.forEach(r => {
                ws.addRow([r.user_id, r.name, r.department_name || '', r.department_id || '', r.average, r.count]);
            });

            // Auto width
            ws.columns.forEach(col => {
                let maxLength = 10;
                col.eachCell({ includeEmpty: true }, cell => {
                    const v = cell.value ? String(cell.value) : '';
                    if (v.length > maxLength) maxLength = v.length;
                });
                col.width = Math.min(Math.max(maxLength + 2, 10), 50);
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${baseName}.xlsx"`);
            try { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store'); res.setHeader('X-Download-Options', 'noopen'); } catch (e) {}
            await workbook.xlsx.write(res);
            return res.end();
        }
        res.json({ points: rows.map(r => ({ userId: r.user_id, name: r.name, department_id: r.department_id, average: r.average === null ? null : Number(r.average), count: Number(r.count) })) });
    } catch (error) {
        console.error('Lỗi khi lấy KPI scores:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};