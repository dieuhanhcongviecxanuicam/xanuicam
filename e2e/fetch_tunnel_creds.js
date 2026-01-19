const fs = require('fs');
const path = require('path');

const API_TOKEN = process.env.CF_API_TOKEN || '';
const ACCOUNT_ID = '098cc7413caf44c89e5c837e182c0bbc';
const TUNNEL_ID = 'dd5a987a-e004-4344-8f05-9b8cdcc296e0';

(async () => {
  try {
    const res = await (globalThis.fetch || require('node-fetch'))(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}`,
      { headers: { Authorization: 'Bearer ' + API_TOKEN } }
    );
    const json = await res.json();
    console.log('status', res.status);
    console.log(JSON.stringify(json, null, 2));

    if (json && json.result) {
      const creds = json.result.credentials || json.result.credentials_file || null;
      if (!creds) {
        console.error('No credentials in tunnel result');
        process.exit(2);
      }
      const cloudflaredDir = path.join(process.cwd(), '.cloudflared');
      if (!fs.existsSync(cloudflaredDir)) fs.mkdirSync(cloudflaredDir);
      const credsPath = path.join(cloudflaredDir, `${TUNNEL_ID}.json`);
      fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));
      console.log('Saved credentials to', credsPath);
    } else {
      console.error('No tunnel found');
    }
  } catch (e) {
    console.error('Error', e);
    process.exit(1);
  }
})();