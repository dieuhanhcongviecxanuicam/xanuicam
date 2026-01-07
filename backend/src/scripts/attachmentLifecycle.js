const pool = require('../db');
const fs = require('fs');
const path = require('path');

// Script to:
// 1) Move attachments older than 14 days from room_booking_attachments into deleted_room_booking_attachments
//    - Physically move files under uploads/deleted-attachments/
//    - Update metadata and room_bookings.attachment_path to remove moved paths
// 2) Permanently delete archived attachments older than 7 days (from deleted_room_booking_attachments)

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');
const DELETED_DIR = path.join(UPLOADS_ROOT, 'deleted-attachments');

const ensureDeletedDir = () => {
    try { if (!fs.existsSync(DELETED_DIR)) fs.mkdirSync(DELETED_DIR, { recursive: true }); } catch (e) { console.error('Failed to ensure deleted dir', e); }
};

const moveOldToDeleted = async () => {
    console.log('Scanning for attachments older than 14 days...');
    // select attachments older than 14 days
    const q = `SELECT * FROM room_booking_attachments WHERE created_at <= NOW() - INTERVAL '14 days'`;
    try {
        const { rows } = await pool.query(q);
        if (!rows || rows.length === 0) { console.log('No attachments to archive.'); return; }
        ensureDeletedDir();
        for (const r of rows) {
            try {
                const oldPath = path.join(process.cwd(), r.file_path);
                if (!fs.existsSync(oldPath)) {
                    console.warn('File missing for attachment id', r.id, r.file_path);
                }
                // compute new path under uploads/deleted-attachments preserving filename
                const filename = path.basename(r.file_path);
                const newRel = path.join('uploads', 'deleted-attachments', `${Date.now()}_${filename}`).replace(/\\/g, '/');
                const newAbs = path.join(process.cwd(), newRel);
                // move file if exists
                if (fs.existsSync(oldPath)) {
                    fs.renameSync(oldPath, newAbs);
                }
                // insert into archive table
                await pool.query(`INSERT INTO deleted_room_booking_attachments (booking_id, user_id, file_path, file_name, file_size, file_ext, deleted_by, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`, [r.booking_id, r.user_id, newRel, r.file_name, r.file_size, r.file_ext, null]);
                // remove from live attachments
                await pool.query('DELETE FROM room_booking_attachments WHERE id = $1', [r.id]);
                // update room_bookings.attachment_path to remove this path
                try {
                    const { rows: bRows } = await pool.query('SELECT attachment_path FROM room_bookings WHERE id = $1', [r.booking_id]);
                    if (bRows.length > 0) {
                        let ap = bRows[0].attachment_path;
                        let paths = [];
                        try { if (ap) { if (typeof ap === 'string') { const parsed = JSON.parse(ap); paths = Array.isArray(parsed) ? parsed : [parsed]; } else if (Array.isArray(ap)) paths = ap; } } catch (e) { paths = []; }
                        // remove any occurrence of old path and add newRel (archive path) to archive table only
                        const newPaths = paths.filter(p => p !== r.file_path);
                        const val = newPaths.length > 0 ? JSON.stringify(newPaths) : null;
                        await pool.query('UPDATE room_bookings SET attachment_path = $1 WHERE id = $2', [val, r.booking_id]);
                    }
                } catch (e) { console.warn('Failed update room_bookings.attachment_path after archiving:', e); }
                console.log('Archived attachment', r.id, '->', newRel);
            } catch (e) {
                console.error('Failed to archive attachment row', r.id, e && e.message ? e.message : e);
            }
        }
    } catch (e) {
        console.error('Error scanning attachments for archiving:', e && e.message ? e.message : e);
    }
};

const purgeOldDeleted = async () => {
    console.log('Scanning for archived attachments older than 7 days to purge...');
    try {
        const { rows } = await pool.query("SELECT * FROM deleted_room_booking_attachments WHERE deleted_at <= NOW() - INTERVAL '7 days'");
        if (!rows || rows.length === 0) { console.log('No archived attachments to purge.'); return; }
        for (const r of rows) {
            try {
                // remove file
                const abs = path.join(process.cwd(), r.file_path);
                if (fs.existsSync(abs)) {
                    try { fs.unlinkSync(abs); } catch (e) { console.warn('Failed to unlink archived file', abs, e && e.message ? e.message : e); }
                }
                // delete metadata
                await pool.query('DELETE FROM deleted_room_booking_attachments WHERE id = $1', [r.id]);
                console.log('Purged archived attachment', r.id, r.file_path);
            } catch (e) {
                console.error('Failed to purge archived attachment row', r.id, e && e.message ? e.message : e);
            }
        }
    } catch (e) {
        console.error('Error scanning archived attachments for purge:', e && e.message ? e.message : e);
    }
};

const main = async () => {
    try {
        await moveOldToDeleted();
        await purgeOldDeleted();
    } catch (e) { console.error('Lifecycle script error:', e && e.message ? e.message : e); }
    process.exit(0);
};

if (require.main === module) main();

module.exports = { moveOldToDeleted, purgeOldDeleted };
