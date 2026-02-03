#!/usr/bin/env node
// Backfill script to set audit_logs.target_user_id based on patterns in the details
// This is best-effort: it will attempt to extract usernames from details and resolve
// them to user ids. Run with caution and review results before committing to prod.

const pool = require('../src/db');

// Heuristics to find candidate target user from details
const findCandidateUserId = async (details) => {
  if (!details) return null;
  // Look for quoted phrases which may be full names
  const quotedMatches = details.match(/\"([^\"]{3,100})\"/g) || [];
  for (const qm of quotedMatches) {
    const phrase = qm.replace(/\"/g, '').trim();
    if (phrase.length < 3) continue;
    // try exact full_name first
    let r = await pool.query('SELECT id FROM users WHERE full_name = $1 LIMIT 1', [phrase]);
    if (r.rows.length) return r.rows[0].id;
    // try fuzzy match (ILIKE)
    r = await pool.query('SELECT id FROM users WHERE full_name ILIKE $1 LIMIT 1', [`%${phrase}%`]);
    if (r.rows.length) return r.rows[0].id;
  }

  // Look for username tokens (explicit keys)
  const tokenMatch = details.match(/username\s*[:=]\s*([A-Za-z0-9_\.\-@]+)/i) || details.match(/tên đăng nhập\s*[:=]\s*([A-Za-z0-9_\.\-@]+)/i);
  if (tokenMatch && tokenMatch[1]) {
    const key = tokenMatch[1];
    let r = await pool.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [key]);
    if (r.rows.length) return r.rows[0].id;
    // also try email or phone fallback
    r = await pool.query('SELECT id FROM users WHERE email = $1 OR phone_number = $1 LIMIT 1', [key]);
    if (r.rows.length) return r.rows[0].id;
  }

  // As a last resort, try to find a full_name token inside the details even without quotes
  const words = details.split(/[\n\r,;:\(\)\[\]]+/).map(s => s.trim()).filter(Boolean);
  for (const w of words) {
    if (w.length < 3 || w.length > 80) continue;
    // exact match
    let r = await pool.query('SELECT id FROM users WHERE full_name = $1 LIMIT 1', [w]);
    if (r.rows.length) return r.rows[0].id;
    // fuzzy
    r = await pool.query('SELECT id FROM users WHERE full_name ILIKE $1 LIMIT 1', [`%${w}%`]);
    if (r.rows.length) return r.rows[0].id;
  }

  // Look for CCCD/ID numbers (9-12 digits) and try to match cccd column
  const idMatch = details.match(/(\d{9,12})/g);
  if (idMatch) {
    for (const num of idMatch) {
      const r = await pool.query('SELECT id FROM users WHERE cccd = $1 LIMIT 1', [num]);
      if (r.rows.length) return r.rows[0].id;
    }
  }
  return null;
};

// Batch backfill loop
 (async () => {
  try {
    console.log('Starting backfill for audit_logs.target_user_id (batch mode) ...');
    const batchSize = 1000;
    let offset = 0;
    let totalUpdated = 0;
    let loopCount = 0;
    while (true) {
      loopCount++;
      if (loopCount > 10000) { console.warn('Backfill loop limit reached, aborting'); break; }
      const rows = await pool.query("SELECT id, details FROM audit_logs WHERE target_user_id IS NULL AND details IS NOT NULL ORDER BY id LIMIT $1 OFFSET $2", [batchSize, offset]);
      if (!rows.rows || rows.rows.length === 0) break;
      console.log(`Processing batch offset=${offset} size=${rows.rows.length}`);
      for (const r of rows.rows) {
        try {
          const candidate = await findCandidateUserId(r.details);
          if (candidate) {
            await pool.query('UPDATE audit_logs SET target_user_id = $1 WHERE id = $2', [candidate, r.id]);
            totalUpdated++;
            console.log(`Backfilled audit ${r.id} => user ${candidate}`);
          }
        } catch (e) {
          console.error(`Failed to process audit ${r.id}:`, e && e.message ? e.message : e);
        }
      }
      // short pause to avoid DB overload
      await new Promise(res => setTimeout(res, 100));
      offset += batchSize;
    }
    console.log(`Backfill completed. Total rows updated: ${totalUpdated}`);
    process.exit(0);
  } catch (e) {
    console.error('Backfill failed:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();
