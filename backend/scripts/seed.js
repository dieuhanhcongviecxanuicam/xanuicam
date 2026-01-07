// ubndxanuicam/backend/scripts/seed.js
// Script tự động hóa việc chèn dữ liệu ban đầu vào cơ sở dữ liệu.
// CÁCH DÙNG: node scripts/seed.js

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
// Đảm bảo script đọc đúng tệp .env ở thư mục gốc backend
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const seedData = {
  roles: [
    { id: 1, role_name: 'Admin', description: 'Quản trị viên hệ thống, có toàn quyền', color: '#ef4444', level: 1 },
    { id: 2, role_name: 'Lãnh đạo', description: 'Quản lý cấp cao, giao việc và duyệt công việc', color: '#f97316', level: 2 },
    { id: 3, role_name: 'Trưởng phòng', description: 'Quản lý công việc trong phòng ban', color: '#eab308', level: 3 },
    { id: 4, role_name: 'Chuyên viên', description: 'Nhân viên thực hiện công việc', color: '#22c55e', level: 4 }
  ],
  permissions: [
    { permission_name: 'full_access', description: 'Toàn quyền truy cập hệ thống (chỉ dành cho Admin)' },
    { permission_name: 'user_management', description: 'Quyền quản lý người dùng (tạo, sửa, khóa)' },
    { permission_name: 'department_management', description: 'Quyền quản lý phòng ban' },
    { permission_name: 'role_management', description: 'Quyền quản lý vai trò và phân quyền' },
    { permission_name: 'create_task', description: 'Quyền giao việc cho người khác' },
    { permission_name: 'edit_delete_task', description: 'Quyền chỉnh sửa và xóa các công việc' },
    { permission_name: 'approve_task', description: 'Quyền duyệt hoàn thành và yêu cầu làm lại công việc' },
    { permission_name: 'view_reports', description: 'Quyền xem báo cáo và thống kê toàn diện' },
    { permission_name: 'view_audit_log', description: 'Quyền xem nhật ký hệ thống' },
    { permission_name: 'export_audit_decrypted', description: 'Quyền xuất CSV chứa dữ liệu đã giải mã (nhạy cảm) - chỉ cho super-admin' },
    { permission_name: 'system_settings', description: 'Quyền truy cập cài đặt hệ thống (bảo trì,...)' },
    { permission_name: 'article_management', description: 'Quyền đăng và quản lý bài viết Cẩm nang/Truyền thông' },
    { permission_name: 'meeting_management', description: 'Quyền phê duyệt và quản lý lịch họp' },
    { permission_name: 'room_booking_management', description: 'Quyền phê duyệt và quản lý đăng ký phòng họp' },
    { permission_name: 'event_management', description: 'Quyền tạo và quản lý sự kiện trong Lịch làm việc' }
  ],
  adminUser: {
    cccd: '000000000001',
    password: 'password', // Mật khẩu mặc định, nên đổi ngay sau lần đăng nhập đầu tiên
    fullName: 'Quản Trị Viên',
    username: 'admin',
    role_id: 1, // ID của vai trò Admin
  },
  superAdminUser: {
    cccd: '000000000000',
    password: 'superpassword',
    fullName: 'Super Administrator',
    username: 'superadmin',
    role_id: 1
  },
  systemSettings: [
    { key: 'maintenance_mode', value: '{"enabled": false, "title": "Hệ thống đang bảo trì", "message": "Chúng tôi sẽ sớm quay trở lại. Vui lòng quay lại sau."}', description: 'Cấu hình chế độ bảo trì cho toàn bộ hệ thống.' }
  ]
};

const seedDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('🚀 Bắt đầu quá trình seed dữ liệu...');
    await client.query('BEGIN');

    // Dọn dẹp dữ liệu cũ để tránh trùng lặp
    console.log('🧹 Dọn dẹp dữ liệu cũ...');
    await client.query('TRUNCATE TABLE users, departments, roles, permissions, role_permissions, system_settings RESTART IDENTITY CASCADE');

    // 1. Seed Roles
    console.log('🌱 Seeding Roles...');
    for (const role of seedData.roles) {
      await client.query('INSERT INTO roles (id, role_name, description, color, level) VALUES ($1, $2, $3, $4, $5)', 
        [role.id, role.role_name, role.description, role.color, role.level]);
    }

    // 2. Seed Permissions và lấy lại ID
    console.log('🌱 Seeding Permissions...');
    const permissionMap = {};
    for (const perm of seedData.permissions) {
      const res = await client.query('INSERT INTO permissions (permission_name, description) VALUES ($1, $2) RETURNING id, permission_name', 
        [perm.permission_name, perm.description]);
      permissionMap[res.rows[0].permission_name] = res.rows[0].id;
    }

    // 3. Seed Role-Permissions
    console.log('🌱 Seeding Role-Permissions...');
    // Admin có mọi quyền
    for (const permId of Object.values(permissionMap)) {
        await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [1, permId]);
    }
    // Lãnh đạo có một số quyền
    const leaderPerms = ['user_management', 'department_management', 'create_task', 'approve_task', 'view_reports', 'view_audit_log', 'edit_delete_task', 'article_management', 'meeting_management', 'room_booking_management', 'event_management'];
    for (const pName of leaderPerms) {
        await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [2, permissionMap[pName]]);
    }
    // Trưởng phòng có một số quyền
     const managerPerms = ['create_task', 'view_reports', 'edit_delete_task'];
    for (const pName of managerPerms) {
        await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [3, permissionMap[pName]]);
    }
    
    // 4. Seed Admin User
    console.log('🌱 Seeding Admin User...');
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(seedData.adminUser.password, salt);
    await client.query(
      'INSERT INTO users (cccd, password_hash, full_name, username, role_id, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
      [seedData.adminUser.cccd, password_hash, seedData.adminUser.fullName, seedData.adminUser.username, seedData.adminUser.role_id, true]
    );

    // 4b. Seed Superadmin user (special flag `is_superadmin`)
    console.log('🌱 Seeding Superadmin User...');
    const salt2 = await bcrypt.genSalt(10);
    const superHash = await bcrypt.hash(seedData.superAdminUser.password, salt2);
    await client.query(
      'INSERT INTO users (cccd, password_hash, full_name, username, role_id, is_active, is_superadmin) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [seedData.superAdminUser.cccd, superHash, seedData.superAdminUser.fullName, seedData.superAdminUser.username, seedData.superAdminUser.role_id, true, true]
    );

    // 5. Seed System Settings
    console.log('🌱 Seeding System Settings...');
    for(const setting of seedData.systemSettings) {
        await client.query('INSERT INTO system_settings (key, value, description) VALUES ($1, $2, $3)',
        [setting.key, setting.value, setting.description]);
    }
    
    await client.query('COMMIT');
    console.log('✅ Quá trình seed dữ liệu đã hoàn tất thành công!');
    console.log(`👤 Tài khoản Admin:`);
    console.log(`   - Tên đăng nhập: ${seedData.adminUser.username}`);
    console.log(`   - Mật khẩu: ${seedData.adminUser.password}`);
    console.log(`👤 Tài khoản Superadmin (siêu quản trị, chỉ dùng khi cần):`);
    console.log(`   - Tên đăng nhập: ${seedData.superAdminUser.username}`);
    console.log(`   - Mật khẩu: ${seedData.superAdminUser.password}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Đã xảy ra lỗi, quá trình seed đã được rollback:', error);
  } finally {
    client.release();
    pool.end();
  }
};

seedDatabase();