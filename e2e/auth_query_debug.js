const pool = require('../backend/src/db');
(async()=>{
  try{
    const identifier = process.env.E2E_USER || '000000000001';
    const q = `
      SELECT 
      u.id, u.password_hash, u.is_active, u.failed_attempts,
      u.is_superadmin, u.must_reset_password,
      u.mfa_enabled, u.mfa_secret_encrypted,
      u.full_name, u.username, u.cccd, u.birth_date, 
          u.phone_number, u.email, u.avatar,
          r.id as role_id, r.role_name, r.color as role_color, r.level as role_level,
          d.name as department_name,
          ARRAY_AGG(p.permission_name) FILTER (WHERE p.permission_name IS NOT NULL) as permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE (u.cccd = $1 OR u.username = $1)
      GROUP BY u.id, r.id, d.id, u.failed_attempts
    `;
    const res = await pool.query(q, [identifier]);
    console.log('ROWS', JSON.stringify(res.rows,null,2));
  }catch(e){ console.error('ERR', e && e.message ? e.message : e); }
  finally{ try{ await pool.end(); }catch(e){} }
})();
