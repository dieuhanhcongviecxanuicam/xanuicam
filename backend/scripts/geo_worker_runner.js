const { runOnce } = require('./geo_worker');

const INTERVAL = process.env.GEO_WORKER_INTERVAL_MS ? parseInt(process.env.GEO_WORKER_INTERVAL_MS) : 5 * 60 * 1000;
console.log('Starting geo worker runner. Interval(ms):', INTERVAL);
setInterval(() => {
  runOnce().catch(e => console.error('Geo worker error', e));
}, INTERVAL);
// Run immediately
runOnce().catch(e => console.error('Geo worker error', e));
