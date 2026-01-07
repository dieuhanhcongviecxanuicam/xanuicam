// ubndxanuicam/backend/src/middlewares/validationMiddleware.js
const { body, validationResult } = require('express-validator');

const validateUserCreation = [
    // THAY ĐỔI: Bỏ required, chỉ validate khi có giá trị
    body('cccd').optional({ checkFalsy: true }).isLength({ min: 12, max: 12 }).withMessage('CCCD phải có đúng 12 chữ số.').isNumeric().withMessage('CCCD chỉ được chứa số.'),
    
    // BẮT BUỘC
    body('fullName').trim().notEmpty().withMessage('Họ và tên không được để trống.'),
    body('username').trim().notEmpty().withMessage('Tên đăng nhập không được để trống.').isAlphanumeric().withMessage('Tên đăng nhập chỉ được chứa chữ và số.'),
    body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự.'),

    // BẮT BUỘC: role_id là cần thiết khi tạo người dùng
    body('role_id').notEmpty().withMessage('Vai trò không được để trống.').isInt({ gt: 0 }).withMessage('Vai trò không hợp lệ.'),
    body('department_id').optional({ checkFalsy: true }).isInt({ gt: 0 }).withMessage('Phòng ban không hợp lệ.'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email không hợp lệ.'),
    body('phone_number').optional({ checkFalsy: true }).isMobilePhone('vi-VN').withMessage('Số điện thoại không hợp lệ.')
];

// Validation cho việc cập nhật người dùng
// Make update validations optional so admins can perform partial updates.
const validateUserUpdate = [
    body('fullName').optional({ checkFalsy: true }).trim().notEmpty().withMessage('Họ và tên không được để trống.'),
    // role_id intentionally omitted from update validation to allow partial updates
    body('department_id').optional({ checkFalsy: true }).isInt({ gt: 0 }).withMessage('Phòng ban không hợp lệ.'),
    body('username').optional({ checkFalsy: true }).isAlphanumeric().withMessage('Tên đăng nhập chỉ được chứa chữ và số.'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email không hợp lệ.'),
    body('phone_number').optional({ checkFalsy: true }).isMobilePhone('vi-VN').withMessage('Số điện thoại không hợp lệ.')
];

// Validation cho việc tạo công việc
const validateTaskCreation = [
    body('title').trim().notEmpty().withMessage('Tên công việc không được để trống.'),
    body('assignee_id').isInt({ gt: 0 }).withMessage('Người thực hiện không hợp lệ.'),
    body('due_date').isISO8601().toDate().withMessage('Ngày hết hạn không hợp lệ.'),
    body('priority').isIn(['Thấp', 'Trung bình', 'Cao']).withMessage('Độ ưu tiên không hợp lệ.'),
];

// Validation cho việc đổi mật khẩu
const validatePasswordChange = [
    body('oldPassword').notEmpty().withMessage('Mật khẩu cũ không được để trống.'),
    body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới phải có ít nhất 6 ký tự.'),
];

// Validation cho phòng ban
const validateDepartment = [
    body('name').trim().notEmpty().withMessage('Tên phòng ban không được để trống.'),
];

// Validation cho vai trò
const validateRole = [
    body('role_name').trim().notEmpty().withMessage('Tên vai trò không được để trống.'),
    body('level').isInt({ min: 1 }).withMessage('Cấp bậc phải là một số nguyên dương.'),
    body('permissions').isArray().withMessage('Danh sách quyền không hợp lệ.'),
    body('permissions.*').isInt({ gt: 0 }).withMessage('Mã quyền không hợp lệ.')
];

// Middleware trung gian để kiểm tra kết quả validation
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }
    // Lấy lỗi đầu tiên và gửi về cho client
    const firstError = errors.array({ onlyFirstError: true })[0];
    return res.status(422).json({ message: firstError.msg });
};

module.exports = {
    validateUserCreation,
    validateUserUpdate,
    validateTaskCreation,
    validatePasswordChange,
    validateDepartment,
    validateRole,
    validate,
};