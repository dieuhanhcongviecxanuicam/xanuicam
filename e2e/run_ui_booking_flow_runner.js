// Runner to set env variables reliably then run the UI E2E script
process.env.E2E_BASE = process.env.E2E_BASE || 'http://localhost:3001';
process.env.E2E_USER = process.env.E2E_USER || 'auto_e2e_admin';
process.env.E2E_PASS = process.env.E2E_PASS || 'AutoE2E!234';
// Allow the script to be required (it self-executes)
require('./run_ui_booking_flow_clean_v2.js');
