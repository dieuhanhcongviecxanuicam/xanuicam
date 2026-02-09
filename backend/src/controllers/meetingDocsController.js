const pool = require('../db');
const path = require('path');
const fs = require('fs');

// List meeting documents for current user (and optional meeting_id)
exports.listDocs = async (req, res) => {
  try {
    const { meetingId } = req.query;
    const params = [req.user.id];
    let where = 'WHERE uploaded_by = $1';
    if (meetingId) {
      params.push(meetingId);
      where += ` AND meeting_id = $${params.length}`;
    }
    const { rows } = await pool.query(`SELECT id, meeting_id, original_name, stored_path, mime_type, size_bytes, doc_type, created_at FROM meeting_documents ${where} ORDER BY created_at DESC`, params);
    res.json({ data: rows });
  } catch (e) {
    console.error('meetingDocsController.listDocs error', e);
    res.status(500).json({ message: 'Lỗi máy chủ khi liệt kê tài liệu.' });
  }
};

// Download document by id (must be uploaded_by or allowed via permission)
exports.download = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const { rows } = await pool.query('SELECT * FROM meeting_documents WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy tệp.' });
    const doc = rows[0];
    if (doc.uploaded_by !== req.user.id && !(req.user && req.user.permissions && req.user.permissions.includes('meeting_management'))) {
      return res.status(403).json({ message: 'Không có quyền truy cập tệp này.' });
    }
    const filePath = path.join(__dirname, '..', '..', doc.stored_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Tệp không tồn tại trên server.' });
    try {
      // apply secure download headers before delegating to res.download
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store');
      res.setHeader('X-Download-Options', 'noopen');
    } catch (e) {}
    res.download(filePath, doc.original_name);
  } catch (e) {
    console.error('meetingDocsController.download error', e);
    res.status(500).json({ message: 'Lỗi khi tải tệp.' });
  }
};

// Upload a meeting document; enforces per-user daily limits: max 1 pdf and 1 docx per calendar day
exports.upload = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Không có tệp được tải lên.' });
    const file = req.file;
    const originalName = Buffer.from(file.originalname || '', 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase().replace('.', '');
    const docType = ext === 'pdf' ? 'pdf' : (ext === 'docx' ? 'docx' : 'other');

    if (docType === 'other') return res.status(400).json({ message: 'Chỉ chấp nhận tệp PDF hoặc DOCX.' });

    // Enforce docx size <= 20MB
    if (docType === 'docx' && file.size > 20 * 1024 * 1024) {
      // delete stored file
      try { fs.unlinkSync(file.path); } catch (e) {}
      return res.status(400).json({ message: 'Tệp DOCX vượt quá kích thước tối đa 20MB.' });
    }

    // Enforce per-user per-day size limits (sum of sizes per doc_type)
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const { rows: sizeRows } = await pool.query(
      `SELECT doc_type, COALESCE(SUM(size_bytes),0)::bigint as total_size FROM meeting_documents WHERE uploaded_by = $1 AND created_at >= $2 GROUP BY doc_type`,
      [req.user.id, todayStart]
    );
    const totals = {};
    sizeRows.forEach(r => { totals[r.doc_type] = parseInt(r.total_size, 10); });

    const PDF_LIMIT = 50 * 1024 * 1024; // 50MB per day
    const DOCX_LIMIT = 20 * 1024 * 1024; // 20MB per day

    const existing = totals[docType] || 0;
    const newTotal = existing + file.size;
    if ((docType === 'pdf' && newTotal > PDF_LIMIT) || (docType === 'docx' && newTotal > DOCX_LIMIT)) {
      try { fs.unlinkSync(file.path); } catch (e) {}
      return res.status(403).json({ message: `Giới hạn dung lượng hàng ngày cho ${docType.toUpperCase()} đã vượt quá. Tối đa: ${docType === 'pdf' ? '50MB' : '20MB'} mỗi ngày.` });
    }

    // store record
    const storedPath = path.join('backend', file.path).replace(/\\/g, '/');
    const insertQ = `INSERT INTO meeting_documents (meeting_id, uploaded_by, original_name, stored_path, mime_type, size_bytes, doc_type) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, created_at`;
    const params = [req.body.meeting_id || null, req.user.id, originalName, storedPath, file.mimetype, file.size, docType];
    const { rows } = await pool.query(insertQ, params);
    res.status(201).json({ id: rows[0].id, created_at: rows[0].created_at });
  } catch (e) {
    console.error('meetingDocsController.upload error', e);
    res.status(500).json({ message: 'Lỗi khi tải tệp.' });
  }
};
