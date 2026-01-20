const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    // load backend .env if exists, else use example
    const envPath = path.resolve(__dirname, '..', 'backend', '.env');
    let secret = process.env.JWT_SECRET;
    if (!secret) {
      try {
        const ev = fs.readFileSync(envPath, 'utf8');
        const m = ev.match(/JWT_SECRET=(.+)/);
        if (m) secret = m[1].trim();
      } catch (e) {
        // try example
        try {
          const ex = fs.readFileSync(path.resolve(__dirname, '..', 'backend', '.env.example'), 'utf8');
          const m2 = ex.match(/JWT_SECRET=(.+)/);
          if (m2) secret = m2[1].trim();
        } catch (e2) {}
      }
    }
    if (!secret) secret = 'dev-temp-secret';
    process.env.JWT_SECRET = process.env.JWT_SECRET || secret;
    const jwtHelper = require('../backend/src/utils/jwtHelper');
    const user = { id: 1, permissions: ['full_access'], fullName: 'E2E Test' };
    const token = jwtHelper.sign({ user }, { expiresIn: '1h' });
    const api = axios.create({ baseURL: 'http://localhost:5000/api', headers: { Authorization: `Bearer ${token}` } });

    console.log('Creating booking...');
    const now = new Date();
    const start = new Date(now.getTime() + 5*60*1000); // +5min
    const end = new Date(start.getTime() + 60*60*1000); // +1h
    const payload = {
      room_name: 'Hội trường UBND',
      title: 'E2E Test Booking',
      description: 'Created by automated test',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      attendees_count: 5,
      has_led: true
    };

    const createRes = await api.post('/room-bookings', payload);
    console.log('Create response status:', createRes.status);
    const booking = createRes.data;
    console.log('Created booking id:', booking.id);

    console.log('Updating booking title...');
    const updateRes = await api.put(`/room-bookings/${booking.id}`, { title: 'E2E Updated Title' });
    console.log('Update response status:', updateRes.status, 'title now:', updateRes.data.title || updateRes.data);

    console.log('Patch status to Đã duyệt...');
    const statusRes = await api.patch(`/room-bookings/${booking.id}/status`, { status: 'Đã duyệt' });
    console.log('Status response:', statusRes.status, statusRes.data.status || statusRes.data);

    console.log('Deleting booking...');
    const delRes = await api.delete(`/room-bookings/${booking.id}`);
    console.log('Delete response:', delRes.status, delRes.data.message || delRes.data);

    console.log('E2E API checks completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('E2E test failed:', err.response ? { status: err.response.status, data: err.response.data } : err.message || err);
    process.exit(2);
  }
})();
