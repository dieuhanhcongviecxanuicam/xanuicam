const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const loginPath = path.join(__dirname, '..', 'logs', 'login_response_full.json');
if (!fs.existsSync(loginPath)) { console.error('Login response not found:', loginPath); process.exit(1); }
const data = JSON.parse(fs.readFileSync(loginPath, 'utf8'));
const token = data.token;

function runCurl(args) {
  return new Promise((resolve, reject) => {
    const c = spawn('curl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out=''; let err='';
    c.stdout.on('data', d => out += d.toString());
    c.stderr.on('data', d => err += d.toString());
    c.on('close', code => resolve({ code, out, err }));
  });
}

(async () => {
  const tmpPdf = path.join(__dirname, '..', 'tmp', 'test.pdf');
  const calendarArgs = [
    '-v', '-X', 'POST', 'http://localhost:5000/api/calendar',
    '-H', `Authorization: Bearer ${token}`,
    '-F', `title=Auto event`,
    '-F', `start_time=2025-12-25T09:00:00`,
    '-F', `end_time=2025-12-25T10:00:00`,
    '-F', `description=uploaded via node`,
    '-F', `attachment=@${tmpPdf}`
  ];

  console.log('Running calendar upload...');
  const res1 = await runCurl(calendarArgs);
  fs.writeFileSync(path.join(__dirname, '..', 'logs', 'create_event_curl_stdout.txt'), res1.out);
  fs.writeFileSync(path.join(__dirname, '..', 'logs', 'create_event_curl_stderr.txt'), res1.err);
  console.log('Calendar exit', res1.code);

  const roomArgs = [
    '-v', '-X', 'POST', 'http://localhost:5000/api/room-bookings',
    '-H', `Authorization: Bearer ${token}`,
    '-F', `room_name=Main Hall`,
    '-F', `title=Auto Room Booking`,
    '-F', `start_time=2025-12-26T09:00:00`,
    '-F', `end_time=2025-12-26T10:00:00`,
    // leave department_id empty to avoid FK constraint if departments table is empty
    '-F', `department_id=`,
    '-F', `attendees_count=10`,
    '-F', `has_led=true`,
    '-F', `attachment=@${tmpPdf}`
  ];
  console.log('Running room booking upload...');
  const res2 = await runCurl(roomArgs);
  fs.writeFileSync(path.join(__dirname, '..', 'logs', 'create_room_curl_stdout.txt'), res2.out);
  fs.writeFileSync(path.join(__dirname, '..', 'logs', 'create_room_curl_stderr.txt'), res2.err);
  console.log('Room booking exit', res2.code);
})();
