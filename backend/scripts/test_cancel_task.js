const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const API = 'http://localhost:5000/api';
const SECRET = 'devtestsecret000000000000000000000000';

async function run() {
  try {
    const token = jwt.sign({ user: { id: 1, permissions: ['full_access'], fullName: 'Dev' } }, SECRET);
    console.log('Token:', token);

    const client = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${token}` } });

    console.log('Creating task...');
    const createRes = await client.post('/tasks', { title: 'Test task from script', description: 'created for cancel test' });
    console.log('Create response status:', createRes.status);
    const task = createRes.data;
    console.log('Created task id:', task.id);

    console.log('Patching status to Đã hủy...');
    const patchRes = await client.patch(`/tasks/${task.id}/status`, { status: 'Đã hủy', details: 'Hủy bởi script test' });
    console.log('Patch response status:', patchRes.status);
    console.log('Patch response data:', patchRes.data);
  } catch (err) {
    if (err.response) {
      console.error('Error status:', err.response.status);
      console.error('Error data:', err.response.data);
    } else {
      console.error('Request error:', err.message);
    }
    process.exit(1);
  }
}

run();
