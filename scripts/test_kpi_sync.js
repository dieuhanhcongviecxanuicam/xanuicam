/*
Small test script to PATCH task KPI then GET task to verify sync.
Usage:
  node scripts/test_kpi_sync.js <TASK_ID> <KPI_SCORE> <TOKEN> [API_BASE]
or set env vars:
  TASK_ID, KPI_SCORE, TOKEN, API_BASE

Examples:
  TASK_ID=123 KPI_SCORE=3 TOKEN=eyJ... node scripts/test_kpi_sync.js
  node scripts/test_kpi_sync.js 123 2 eyJ... http://localhost:5000/api

Notes:
- TOKEN must be a valid Bearer JWT for a user with permission to update KPI (approve_task or the task creator).
- API_BASE should include the /api prefix if your backend expects it (e.g. http://localhost:5000/api)
*/

const [,, argTaskId, argKpi, argToken, argApiBase] = process.argv;
const TASK_ID = process.env.TASK_ID || argTaskId;
const KPI_SCORE = process.env.KPI_SCORE || argKpi;
const TOKEN = process.env.TOKEN || argToken;
const API_BASE = process.env.API_BASE || argApiBase || 'http://localhost:5000/api';

if (!TASK_ID || !KPI_SCORE || !TOKEN) {
  console.error('Usage: node scripts/test_kpi_sync.js <TASK_ID> <KPI_SCORE> <TOKEN> [API_BASE]');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${TOKEN}`,
};

const patchKpi = async () => {
  const url = `${API_BASE.replace(/\/$/, '')}/tasks/${TASK_ID}/kpi`;
  const body = JSON.stringify({ kpi_score: Number(KPI_SCORE) });
  const res = await fetch(url, { method: 'PATCH', headers, body });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { json = text; }
  return { status: res.status, ok: res.ok, body: json };
};

const getTask = async () => {
  const url = `${API_BASE.replace(/\/$/, '')}/tasks/${TASK_ID}`;
  const res = await fetch(url, { method: 'GET', headers });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { json = text; }
  return { status: res.status, ok: res.ok, body: json };
};

(async function main(){
  try {
    console.log('Fetching current task...');
    const before = await getTask();
    console.log('GET /tasks/:id ->', before.status);
    console.log('Task.kpi_score (before):', before.body && before.body.kpi_score);

    console.log('\nPATCHing KPI...');
    const patch = await patchKpi();
    console.log('PATCH /tasks/:id/kpi ->', patch.status);
    console.log('PATCH response:', patch.body);

    console.log('\nFetching task after PATCH...');
    const after = await getTask();
    console.log('GET /tasks/:id ->', after.status);
    console.log('Task.kpi_score (after):', after.body && after.body.kpi_score);

    if (String(after.body && after.body.kpi_score) === String(KPI_SCORE)) {
      console.log('\nSUCCESS: KPI synchronized.');
      process.exit(0);
    } else {
      console.error('\nFAIL: KPI did not sync.');
      process.exit(2);
    }
  } catch (err) {
    console.error('Error during test:', err);
    process.exit(3);
  }
})();
