// ubndxanuicam/backend/src/controllers/articleController.js
// VERSION 2.2 - FIXED FILENAME ENCODING ISSUE

const pool = require('../db');
const fs = require('fs');
const path = require('path');

// Hàm helper để xóa file an toàn
const deleteFile = (filePath) => {
    if (filePath) {
        fs.unlink(path.join(__dirname, '..', '..', filePath), (err) => {
            if (err) console.error(`Lỗi khi xóa tệp ${filePath}:`, err);
        });
    }
};

// Lấy danh sách các bài viết theo danh mục (media, handbook)
exports.getArticlesByCategory = async (req, res) => {
    const { category } = req.params;
    try {
        const query = `
            SELECT a.id, a.title, a.created_at, u.full_name as author_name
            FROM articles a
            LEFT JOIN users u ON a.author_id = u.id
            WHERE a.category = $1
            ORDER BY a.created_at DESC
        `;
        const { rows } = await pool.query(query, [category]);
        res.json(rows);
    } catch (error) {
        console.error(`Lỗi khi tải bài viết danh mục ${category}:`, error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

// Lấy chi tiết một bài viết
exports.getArticleById = async (req, res) => {
    const { id } = req.params;
    try {
        const articleQuery = `
            SELECT a.*, u.full_name as author_name
            FROM articles a
            LEFT JOIN users u ON a.author_id = u.id
            WHERE a.id = $1
        `;
        const attachmentsQuery = 'SELECT id, file_name, file_path FROM article_attachments WHERE article_id = $1';

        const articleRes = await pool.query(articleQuery, [id]);
        if (articleRes.rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
        }

        const attachmentsRes = await pool.query(attachmentsQuery, [id]);

        const article = articleRes.rows[0];
        article.attachments = attachmentsRes.rows;

        res.json(article);
    } catch (error)
    {
        console.error(`Lỗi khi tải chi tiết bài viết ${id}:`, error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

// Tạo bài viết mới
exports.createArticle = async (req, res) => {
    const { title, content, category } = req.body;
    const { id: author_id } = req.user;
    const files = req.files || [];
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const articleQuery = 'INSERT INTO articles (title, content, category, author_id) VALUES ($1, $2, $3, $4) RETURNING id';
        const articleRes = await client.query(articleQuery, [title, content, category, author_id]);
        const newArticleId = articleRes.rows[0].id;
        if (files.length > 0) {
            const attachmentInsertQuery = 'INSERT INTO article_attachments (article_id, file_name, file_path) VALUES ($1, $2, $3)';
            for (const file of files) {
                const filePath = file.path.replace(/\\/g, '/');
                // NÂNG CẤP: Giải mã tên tệp về đúng định dạng UTF-8
                const decodedFileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
                await client.query(attachmentInsertQuery, [newArticleId, decodedFileName, filePath]);
            }
        }
        await client.query('COMMIT');
        res.status(201).json({ id: newArticleId, title });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi tạo bài viết:", error);
        files.forEach(file => deleteFile(file.path));
        res.status(500).json({ message: 'Lỗi máy chủ khi tạo bài viết.' });
    } finally {
        client.release();
    }
};

// Cập nhật bài viết
exports.updateArticle = async (req, res) => {
    const { id } = req.params;
    const { title, content, deleted_attachments } = req.body;
    const files = req.files || [];
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const query = 'UPDATE articles SET title = $1, content = $2, updated_at = NOW() WHERE id = $3 RETURNING *';
        const { rows } = await client.query(query, [title, content, id]);
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy bài viết để cập nhật.' });
        }

        if (deleted_attachments) {
            const deletedIds = JSON.parse(deleted_attachments);
            if (Array.isArray(deletedIds) && deletedIds.length > 0) {
                const attachmentsToDelete = await client.query('SELECT file_path FROM article_attachments WHERE id = ANY($1::int[]) AND article_id = $2', [deletedIds, id]);
                attachmentsToDelete.rows.forEach(file => deleteFile(file.file_path));
                await client.query('DELETE FROM article_attachments WHERE id = ANY($1::int[])', [deletedIds]);
            }
        }

        if (files.length > 0) {
            const attachmentInsertQuery = 'INSERT INTO article_attachments (article_id, file_name, file_path) VALUES ($1, $2, $3)';
            for (const file of files) {
                const filePath = file.path.replace(/\\/g, '/');
                // NÂNG CẤP: Giải mã tên tệp về đúng định dạng UTF-8
                const decodedFileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
                await client.query(attachmentInsertQuery, [id, decodedFileName, filePath]);
            }
        }

        await client.query('COMMIT');
        res.json(rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi cập nhật bài viết:", error);
        files.forEach(file => deleteFile(file.path));
        res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật.' });
    } finally {
        client.release();
    }
};

// Xóa bài viết
exports.deleteArticle = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const attachmentsRes = await client.query('SELECT file_path FROM article_attachments WHERE article_id = $1', [id]);
        
        await client.query('DELETE FROM articles WHERE id = $1', [id]);

        for (const row of attachmentsRes.rows) {
            deleteFile(row.file_path);
        }

        await client.query('COMMIT');
        res.json({ message: 'Bài viết đã được xóa.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi xóa bài viết:", error);
        res.status(500).json({ message: 'Lỗi máy chủ khi xóa bài viết.' });
    } finally {
        client.release();
    }
};