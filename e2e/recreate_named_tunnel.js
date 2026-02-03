const fetch = globalThis.fetch || require('node-fetch');
const fs = require('fs');
const path = require('path');

const API_TOKEN = process.env.CF_API_TOKEN || '';
const ACCOUNT_ID = '098cc7413caf44c89e5c837e182c0bbc';
const TUNNEL_NAME = 'ubndxanuicam-dev';

(async () => {
  try {
    console.log('Listing tunnels to find existing with name', TUNNEL_NAME);
    const listRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel`, {
      headers: { Authorization: 'Bearer ' + API_TOKEN }
    });
    const listJson = await listRes.json();
    if (!listJson || !listJson.result) {
      console.error('Failed to list tunnels', JSON.stringify(listJson, null, 2));
      process.exit(2);
    }
    const existing = (listJson.result || []).find(t => t.name === TUNNEL_NAME);
    if (existing) {
      console.log('Found existing tunnel:', existing.id, 'status:', existing.status);
      console.log('Deleting existing tunnel', existing.id);
      const delRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel/${existing.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + API_TOKEN }
      });
      const delJson = await delRes.json();
      console.log('Delete status:', delRes.status);
      console.log(JSON.stringify(delJson, null, 2));
      if (!delJson || !delJson.success) {
        console.error('Failed to delete existing tunnel');
        process.exit(3);
      }
    } else {
      console.log('No existing tunnel with that name');
    }

    console.log('Creating new tunnel', TUNNEL_NAME);
    const createRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + API_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: TUNNEL_NAME })
    });
    const createJson = await createRes.json();
    console.log('Create status:', createRes.status);
    console.log(JSON.stringify(createJson, null, 2));
    if (!createJson || !createJson.result) {
      console.error('Tunnel creation failed');
      process.exit(4);
    }
    const tunnel = createJson.result;
    const tunnelId = tunnel.id;
    if (tunnel && (tunnel.credentials || tunnel.credentials_file)) {
      const creds = tunnel.credentials || tunnel.credentials_file;
      const cloudflaredDir = path.join(process.cwd(), '.cloudflared');
      if (!fs.existsSync(cloudflaredDir)) fs.mkdirSync(cloudflaredDir);
      const credsPath = path.join(cloudflaredDir, `${tunnelId}.json`);
      fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));
      console.log('Saved credentials to', credsPath);
    } else {
      console.log('No credentials in response; but creation succeeded. The API may not return credentials for re-created tunnels.');
    }
    console.log('New tunnel id:', tunnelId);
    console.log('Token (if returned):', tunnel.token || '(none)');
  } catch (e) {
    console.error('Error', e);
    process.exit(1);
  }
})();
