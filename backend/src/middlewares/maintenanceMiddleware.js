const pool = require('../db');

const maintenanceMiddleware = async (req, res, next) => {
    try {
        // Fast-pass for public static asset requests and root so the SPA can
        // be served even if DB connectivity is impaired. This avoids locking
        // the whole site when background DB-dependent workers fail.
        if (req.method === 'GET') {
            const p = req.path || req.url || '/';
            if (p === '/' || p === '/index.html' || p.startsWith('/static/') || p.startsWith('/favicon') || p.startsWith('/manifest') || p.startsWith('/console-warning.js')) {
                return next();
            }
            // also allow common asset extensions
            if (p.match(/\.(js|css|png|jpg|jpeg|svg|ico|json|txt)$/i)) return next();
        }
        // Try once, if transient DB error occurs retry once after a short delay
        let settingsRes;
        try {
            settingsRes = await pool.query("SELECT value FROM system_settings WHERE key = 'maintenance_mode'");
        } catch (firstErr) {
            console.warn('maintenanceMiddleware: first DB read failed, retrying once:', firstErr && firstErr.message ? firstErr.message : firstErr);
            await new Promise(r => setTimeout(r, 500));
            settingsRes = await pool.query("SELECT value FROM system_settings WHERE key = 'maintenance_mode'");
        }
        const maintenanceConfig = settingsRes.rows[0]?.value || { enabled: false };

        // If not enabled -> allow
        if (!maintenanceConfig.enabled) return next();

        // Allow internal off-maintenance endpoint so whitelist can login to turn it off
        if (req.path && req.path.startsWith('/off-maintenance')) return next();

        // Allow users with full access permission
        if (req.user && Array.isArray(req.user.permissions) && req.user.permissions.includes('full_access')) return next();

        // Check whitelist (array of usernames or user ids)
        const whitelist = Array.isArray(maintenanceConfig.whitelist) ? maintenanceConfig.whitelist : [];
        if (req.user) {
            const uid = String(req.user.id);
            const uname = String(req.user.username || '').toLowerCase();
            if (whitelist.map(w=>String(w).toLowerCase()).includes(uid) || whitelist.map(w=>String(w).toLowerCase()).includes(uname)) {
                return next();
            }
        }

        // If start_time/end_time present, check active window
        if (maintenanceConfig.start_time || maintenanceConfig.end_time) {
            const now = new Date();
            let start = maintenanceConfig.start_time ? new Date(maintenanceConfig.start_time) : null;
            let end = maintenanceConfig.end_time ? new Date(maintenanceConfig.end_time) : null;
            if (start && now < start) return next(); // not started yet
            if (end && now > end) return next(); // already ended
        }

        // Respond with 503 and include config for client display
        return res.status(503).json({ 
            message: maintenanceConfig.detailed_message || maintenanceConfig.message || "Hệ thống đang được bảo trì. Vui lòng quay lại sau.",
            title: maintenanceConfig.main_title || maintenanceConfig.title || "Hệ thống bảo trì",
            sub_title: maintenanceConfig.sub_title || null,
            start_time: maintenanceConfig.start_time || null,
            end_time: maintenanceConfig.end_time || null
        });

    } catch (error) {
        // Nếu có lỗi khi kiểm tra CSDL, mặc định cho phép truy cập để tránh khóa toàn bộ hệ thống
        console.error("Lỗi middleware bảo trì:", error);
        next();
    }
};

module.exports = maintenanceMiddleware;