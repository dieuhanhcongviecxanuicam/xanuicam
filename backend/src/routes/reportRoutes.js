const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, hasPermission } = require('../middlewares/authMiddleware');

// Tất cả các route báo cáo đều yêu cầu đăng nhập và có quyền xem báo cáo
router.use(verifyToken, hasPermission(['view_reports']));

// GET: Lấy các số liệu thống kê tổng quan (cho các card trên cùng)
router.get('/overview-stats', reportController.getOverviewStats);

// GET: Lấy danh sách phòng ban và người dùng để làm bộ lọc
router.get('/filters', reportController.getReportFilters);

// GET: Lấy danh sách công việc chi tiết dựa trên bộ lọc
router.get('/detailed-tasks', reportController.getDetailedTaskReport);

// GET: Lấy thống kê chi tiết theo từng người dùng
router.get('/by-user', reportController.getTasksByUser);

// GET: Lấy thống kê chi tiết theo từng phòng ban
router.get('/by-department', reportController.getTasksByDepartment);

// GET: KPI aggregated scores per user (supports CSV via ?format=csv)
router.get('/kpi-scores', reportController.getKpiScores);


module.exports = router;