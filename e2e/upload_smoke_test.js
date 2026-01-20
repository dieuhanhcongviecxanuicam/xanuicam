const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TOKEN; // set TOKEN env var to a valid Bearer token
const CF_COOKIE = process.env.CF_COOKIE; // or set CF_COOKIE to use CF_Authorization cookie value
const URL = process.env.URL || 'https://dev.xanuicam.vn/room-bookings';

const fetch = globalThis.fetch || require('node-fetch');
const FormData = globalThis.FormData || require('form-data');

(async () => {
    if (!TOKEN && !CF_COOKIE) {
        console.error('No TOKEN or CF_COOKIE provided. Export a valid JWT as TOKEN or set CF_COOKIE to CF_Authorization and rerun. Example:');
        console.error('PowerShell: $env:CF_COOKIE="nSjSs..."; node e2e/upload_smoke_test.js');
        process.exit(1);
    }
    try {
        const form = new FormData();
        form.append('room_name', 'Phòng họp lầu 2');
        form.append('title', 'E2E test upload ' + new Date().toISOString());
        form.append('start_time', new Date().toISOString());
        form.append('end_time', new Date(Date.now() + 3600 * 1000).toISOString());
        // attach a small repo file
        const sample = path.resolve(__dirname, '..', 'README.md');
        form.append('attachments', fs.createReadStream(sample));
        // include a relative path example
        form.append('attachments_relative_paths[]', 'test-folder/README.md');

        const headers = {};
        if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
        if (CF_COOKIE) headers['Cookie'] = 'CF_Authorization=' + CF_COOKIE;

        const res = await fetch(URL, {
            method: 'POST',
            headers,
            body: form
        });
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text);
    } catch (e) {
        console.error('Error during upload test:', e);
    }
})();
