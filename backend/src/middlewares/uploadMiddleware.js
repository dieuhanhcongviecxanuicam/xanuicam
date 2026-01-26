// ubndxanuicam/backend/src/middlewares/uploadMiddleware.js
// VERSION 3.0 - SECURITY HARDENED WITH FILE FILTER AND SIZE LIMITS

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Startup marker to help identify deployed middleware version at runtime
try {
    console.error('[uploadMiddleware] LOADED v3.0');
} catch (e) {
    // ignore
}

// --- Cấu hình các loại tệp được phép ---
const ALLOWED_IMAGE_TYPES = /jpeg|jpg|png|gif|webp/;
// Allow common office and archive formats as attachments as well
const ALLOWED_ATTACHMENT_TYPES = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx|txt|csv|ppt|pptx|rtf|odt|zip|rar|7z/;
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
    // Additional mimetype tokens to accept for common office/archive formats
    const extraMimeTokens = ['officedocument', 'vnd.ms-excel', 'vnd.ms-powerpoint', 'openxmlformats', 'zip', 'vnd.oasis.opendocument', 'msword', 'pdf'];
    return (req, file, cb) => {
        const originalName = Buffer.from(file.originalname || '', 'latin1').toString('utf8');
        const ext = path.extname(originalName || '').toLowerCase().replace(/^\./, '');

            // Explicit blacklist for known dangerous executable/script extensions
            const DISALLOWED_EXTENSIONS = new Set(['exe','scr','dll','com','bat','sh','php','jsp','jar','ps1','py','pl','bin','cmd','cpl']);
            if (ext && DISALLOWED_EXTENSIONS.has(ext)) {
                try {
                    const info = { originalName, ext, mimetype: file.mimetype, fieldname: file.fieldname, url: req.originalUrl || req.url };
                    const persistentLog = process.env.UPLOAD_REJECTION_LOG || '/var/log/upload_rejections.log';
                    try { fs.appendFileSync(persistentLog, JSON.stringify(info) + '\n'); } catch(e) { /* best-effort */ }
                } catch (e) { /* ignore logging errors */ }
                const err = new Error('Loại tệp không được hỗ trợ');
                err.code = 'UNSUPPORTED_FILE_TYPE';
                err.statusCode = 415;
                return cb(err, false);
            }

        // Primary check: extension matches allowed list
        const extOk = !!(ext && allowedTypesRegex.test(ext));

        // Secondary check: mimetype contains a known token OR matches regex
        const mimetype = (file.mimetype || '').toLowerCase();
        const mimeOk = !!(mimetype && (allowedTypesRegex.test(mimetype) || extraMimeTokens.some(t => mimetype.includes(t))));

        // STRONGER POLICY: require both extension and mimetype to look valid, to avoid cases where
        // a harmless extension is paired with an executable/malicious mimetype (or vice versa).
        // Exception: allow `pdf` and `docx` by extension alone because many clients send nonstandard mimetypes.
        const allowByExtensionOnly = ext && (ext === 'pdf' || ext === 'docx');

        // Reject files with double extensions where an inner extension is disallowed, e.g. "shell.php.jpg"
        const parts = originalName.split('.').map(p => p.toLowerCase()).filter(Boolean);
        if (parts.length > 2) {
            // check all intermediate extensions (excluding the final one)
            const inner = parts.slice(0, parts.length - 1);
            for (const p of inner) {
                if (DISALLOWED_EXTENSIONS.has(p)) {
                    try {
                        const info = { originalName, ext, mimetype: file.mimetype, fieldname: file.fieldname, url: req.originalUrl || req.url };
                        const persistentLog = process.env.UPLOAD_REJECTION_LOG || '/var/log/upload_rejections.log';
                        try { fs.appendFileSync(persistentLog, JSON.stringify(info) + '\n'); } catch(e) { /* best-effort */ }
                    } catch (e) { /* ignore logging errors */ }
                    const err = new Error('Loại tệp không được hỗ trợ');
                    err.code = 'UNSUPPORTED_FILE_TYPE';
                    err.statusCode = 415;
                    return cb(err, false);
                }
            }
        }

        if ((extOk && mimeOk) || (extOk && allowByExtensionOnly)) return cb(null, true);

        // IMPORTANT: do NOT accept arbitrary extensions — only allow explicitly allowed types.
        // Previous fallback that accepted any short alpha-numeric extension was too permissive
        // and allowed executables like .exe through. We intentionally reject here.

        // Log rejected file details for debugging (filename and mimetype)
        try {
            const info = {
                originalName,
                ext,
                mimetype,
                fieldname: file.fieldname,
                url: req.originalUrl || req.url,
                ip: req.ip || (req.headers && (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'])),
                userAgent: req.headers && req.headers['user-agent']
            };
            console.error('[uploadMiddleware] Rejected file', info);
            // Also write a compact JSON line to a temp file for reliable capture on the server.
            // Prefer a deploy-local tmp path so the service user can own it: /root/ubndxanuicam_deploy/backend/tmp
                try {
                    // Allow overriding the persistent log location via env. Default to /var/log/upload_rejections.log
                    const persistentLog = process.env.UPLOAD_REJECTION_LOG || '/var/log/upload_rejections.log';
                    const deployTmp = '/root/ubndxanuicam_deploy/backend/tmp';
                    const deployLog = deployTmp + '/upload_rejections.log';
                    const fallbackLog = '/tmp/upload_rejections.log';

                    // Use synchronous append to ensure the line is on disk before process returns
                    const appendLineSync = (filePath) => {
                        try {
                            const dir = path.dirname(filePath);
                            if (!fs.existsSync(dir)) {
                                fs.mkdirSync(dir, { recursive: true });
                            }
                            fs.appendFileSync(filePath, JSON.stringify(info) + '\n');
                            return true;
                        } catch (e) {
                            console.error('[uploadMiddleware] appendLineSync error', filePath, e);
                            return false;
                        }
                    };

                    // Try persistent system log, then deploy-local, then /tmp
                    if (!appendLineSync(persistentLog)) {
                        if (!appendLineSync(deployLog)) {
                            appendLineSync(fallbackLog);
                        }
                    }
                } catch (w) {
                    console.error('[uploadMiddleware] Failed to append rejection log', w);
                }
        } catch (e) {
            console.error('[uploadMiddleware] Rejected file - failed to collect info', e);
        }

        const err = new Error('Loại tệp không được hỗ trợ');
        err.code = 'UNSUPPORTED_FILE_TYPE';
        err.statusCode = 415;
        return cb(err, false);
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