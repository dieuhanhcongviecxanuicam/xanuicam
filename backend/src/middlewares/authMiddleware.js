// ubndxanuicam/backend/src/middlewares/authMiddleware.js
const jwtHelper = require('../utils/jwtHelper');
const logger = require('../utils/logger');

/**
 * @description Middleware để kiểm tra token (bắt buộc đăng nhập).
 * Nếu token hợp lệ, thông tin người dùng sẽ được gắn vào req.user.
 * Nếu không có token hoặc token không hợp lệ, trả về lỗi 401.
 */
const verifyToken = (req, res, next) => {
    const authHeader = req.header('Authorization');
    // Debug logging for MFA disable requests: log presence of Authorization
    // without exposing the full token. This aids debugging while limiting
    // sensitive output. We only enable this lightweight logging for the
    // specific endpoint used to disable MFA.
    try {
        const isMfaDisable = req.originalUrl && req.originalUrl.includes('/auth/mfa/disable');
        if (isMfaDisable) {
            const hasHeader = !!authHeader && authHeader.startsWith('Bearer ');
            // Do not record token fragments. Only record presence of Authorization header.
            logger.info({ event: 'mfa_disable_attempt', hasAuthorization: hasHeader, ip: req.ip || null, path: req.originalUrl || null, method: req.method || null });
        }
    } catch (logErr) {
        // swallow logging errors to avoid interfering with auth flow
    }
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Không có token, truy cập bị từ chối' });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Không có token, truy cập bị từ chối' });
    }
    try {
        const decoded = jwtHelper.verify(token);
        // Attach decoded user and session id (sid) for downstream handlers
        // decoded may have shape: { user: { ... }, sid: '<uuid>' }
        if (decoded && decoded.user) {
            req.user = decoded.user;
            if (decoded.sid) req.user.sid = decoded.sid;
        } else {
            req.user = decoded;
        }
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token không hợp lệ' });
    }
};

/**
 * @description Middleware để kiểm tra quyền hạn (permissions) của người dùng.
 * @param {string[]} requiredPermissions - Mảng các quyền yêu cầu để truy cập route.
 * @returns Trả về một hàm middleware.
 */
const hasPermission = (requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user || !req.user.permissions) {
            return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
        }
        
        // Admin (có quyền 'full_access') có thể truy cập mọi thứ.
        if (req.user.permissions.includes('full_access')) {
            return next();
        }

        // Kiểm tra xem người dùng có TẤT CẢ các quyền được yêu cầu hay không.
        const hasRequired = requiredPermissions.every(p => req.user.permissions.includes(p));
        
        if (!hasRequired) {
            return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
        }
        next();
    };
};

/**
 * @description Middleware để xác thực token (KHÔNG bắt buộc).
 * Cố gắng giải mã token nếu có. Nếu thành công, gắn req.user.
 * Nếu không có token hoặc token không hợp lệ, vẫn cho phép đi tiếp (next()) mà không báo lỗi.
 * Rất hữu ích cho các middleware cần kiểm tra thông tin người dùng nhưng không yêu cầu đăng nhập.
 */
const verifyTokenOptional = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(); // Không có header, đi tiếp
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return next(); // Không có token, đi tiếp
    }
    try {
        const decoded = jwtHelper.verify(token);
        req.user = decoded && decoded.user ? decoded.user : decoded; // Gắn thông tin người dùng nếu token hợp lệ
    } catch (err) {
        // Bỏ qua lỗi token không hợp lệ, chỉ đơn giản là không gắn req.user
    }
    next(); // Luôn đi tiếp
};

module.exports = {
    verifyToken,
    hasPermission,
    // new middleware: checks if user has ANY of the provided permissions
    hasAnyPermission: (requiredPermissions) => {
        return (req, res, next) => {
            if (!req.user || !req.user.permissions) return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
            if (req.user.permissions.includes('full_access')) return next();
            const hasAny = requiredPermissions.some(p => req.user.permissions.includes(p));
            if (!hasAny) return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
            next();
        };
    },
    verifyTokenOptional
};