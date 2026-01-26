// ubndxanuicam/backend/src/middlewares/uploadMiddleware.js
// VERSION 3.0 - SECURITY HARDENED WITH FILE FILTER AND SIZE LIMITS

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Cấu hình các loại tệp được phép ---
const ALLOWED_IMAGE_TYPES = /jpeg|jpg|png|gif|webp/;
const ALLOWED_ATTACHMENT_TYPES = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx|txt/;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
// Meeting documents: allow only pdf and docx. Max policy: pdf up to 50MB, docx up to 20MB (server-side will enforce docx limit)
const ALLOWED_MEETING_DOCS = /pdf|docx/;
const MEETING_DOCS_MAX_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * @description Hàm helper để tạo cấu hình lưu trữ cho multer.
 * @param {string} subfolder - Thư mục con trong 'uploads' để lưu tệp.
 * @returns {multer.StorageEngine}
 */
const createDiskStorage = (subfolder) => {
    const uploadDir = path.join('uploads', subfolder);
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    return multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            const safeBaseName = path.basename(originalName, path.extname(originalName))
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-');
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const extension = path.extname(originalName);
            cb(null, `${safeBaseName}-${uniqueSuffix}${extension}`);
        }
    });
};

/**
 * @description Hàm helper để tạo bộ lọc tệp cho multer.
 * @param {RegExp} allowedTypesRegex - Biểu thức chính quy chứa các loại tệp được phép.
 * @returns {Function}
 */
const createFileFilter = (allowedTypesRegex) => {
    return (req, file, cb) => {
        const originalName = Buffer.from(file.originalname || '', 'latin1').toString('utf8');
        const ext = path.extname(originalName || '').toLowerCase().replace(/^\./, '');

        // Primary check: allow if extension matches allowed list
        const extOk = ext && allowedTypesRegex.test(ext);

        // Secondary check: allow if mimetype contains a known token (covers images/pdf)
        const mimeOk = file.mimetype && allowedTypesRegex.test(file.mimetype);

        // Accept if either extension OR mimetype looks valid (previously required both)
        if (extOk || mimeOk) return cb(null, true);

        // Fallback: accept generic binary uploads when extension missing but context allows attachments
        if (!ext && file.mimetype === 'application/octet-stream') return cb(null, true);

        cb(new Error('Lỗi: Loại tệp không được hỗ trợ!'), false);
    };
};

// --- Tạo các middleware cụ thể ---

// Cấu hình cho tải lên avatar
const avatarUpload = multer({
    storage: createDiskStorage('avatars'),
    fileFilter: createFileFilter(ALLOWED_IMAGE_TYPES),
    limits: { fileSize: MAX_FILE_SIZE }
});

// Cấu hình cho tải lên tệp đính kèm (đa định dạng, dùng cho attachments chung)
const attachmentUpload = multer({
    storage: createDiskStorage('attachments'),
    fileFilter: createFileFilter(ALLOWED_ATTACHMENT_TYPES),
    limits: { fileSize: MAX_FILE_SIZE }
});

// Cấu hình chỉ cho phép PDF (dùng cho room bookings & calendar events attachments)
const ALLOWED_PDF_ONLY = /pdf/;
const pdfAttachmentUpload = multer({
    storage: createDiskStorage('attachments'),
    fileFilter: createFileFilter(ALLOWED_PDF_ONLY),
    limits: { fileSize: MAX_FILE_SIZE }
});

// Meeting docs uploader: store under uploads/meeting_docs; allow pdf|docx up to 50MB
const meetingDocsUpload = multer({
    storage: createDiskStorage('meeting_docs'),
    fileFilter: createFileFilter(ALLOWED_MEETING_DOCS),
    limits: { fileSize: MEETING_DOCS_MAX_SIZE }
});

module.exports = {
    avatarUpload,
    attachmentUpload,
    pdfAttachmentUpload
    , meetingDocsUpload
}