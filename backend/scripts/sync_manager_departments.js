const pool = require('../src/db');

/**
 * One-off script to synchronize departments.manager_id -> users.department_id.
 *
 * For every department that has a non-null manager_id, this will set
 * users.department_id = departments.id for that user, but only if the
 * user's department_id is different or null. It will run inside a
 * transaction and log changes to console.
 *
 * Usage: from backend/ run `npm run sync:manager-departments`
 */

async function sync() {
    const client = await pool.connect();
    try {
        console.log('Starting sync_manager_departments...');
        await client.query('BEGIN');

        const res = await client.query('SELECT id, manager_id FROM departments WHERE manager_id IS NOT NULL');
        console.log(`Found ${res.rows.length} departments with manager assigned.`);

        let updated = 0;
        for (const row of res.rows) {
            const deptId = row.id;
            const managerId = row.manager_id;

            // Check current user's department
            const ures = await client.query('SELECT department_id FROM users WHERE id = $1', [managerId]);
            if (ures.rows.length === 0) {
                console.warn(`User id=${managerId} not found; skipping department id=${deptId}`);
                continue;
            }
            const currentDept = ures.rows[0].department_id;
            if (currentDept === deptId) continue;

            await client.query('UPDATE users SET department_id = $1 WHERE id = $2', [deptId, managerId]);
            console.log(`Set user id=${managerId}.department_id = ${deptId}`);
            updated++;
        }

        await client.query('COMMIT');
        console.log(`Sync completed. Updated ${updated} user(s).`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Sync failed:', err);
        process.exitCode = 1;
    } finally {
        client.release();
        process.exit();
    }
}

sync();
