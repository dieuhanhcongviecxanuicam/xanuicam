const { spawnSync } = require('child_process');
const path = require('path');

const TOKEN = 'eyJhIjoiMDk4Y2M3NDEzY2FmNDRjODllNWM4MzdlMTgyYzBiYmMiLCJ0IjoiMDNkOTRhYmMtOWIzNS00YzU2LWEzN2MtZTEyMzgxMGI0MTJlIiwicyI6Ik56TTJPRGMyTTJNdE1ERTBaaTAwT1Roa0xUaGpObVV0WkRZNU9UWmhNakZpTUdFMCJ9';
const URL = 'https://dev.xanuicam.vn/room-bookings';

const script = path.join(__dirname, 'upload_smoke_test.js');
console.log('Running upload smoke test with URL=', URL);
const res = spawnSync('node', [script], {
  env: Object.assign({}, process.env, { TOKEN, URL }),
  stdio: 'inherit'
});
if (res.error) {
  console.error('Spawn error', res.error);
  process.exit(1);
}
process.exit(res.status);
