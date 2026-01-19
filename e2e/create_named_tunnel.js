const fetch = globalThis.fetch || require('node-fetch');
const fs = require('fs');
const path = require('path');

const API_TOKEN = process.env.CF_API_TOKEN || '';
const ACCOUNT_ID = '098cc7413caf44c89e5c837e182c0bbc';
const ZONE_ID = 'b7c18a00a58d453f117a74fe148113d5';
const ZONE_NAME = 'xanuicam.vn';
const TUNNEL_NAME = 'ubndxanuicam-dev';
const HOSTNAME = 'dev.xanuicam.vn';

(async () => {
    try {
        console.log('Creating tunnel...');
        const createRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + API_TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: TUNNEL_NAME })
        });
        const createJson = await createRes.json();
        console.log('Create response status:', createRes.status);
        console.log(JSON.stringify(createJson, null, 2));

        if (!createJson || !createJson.result) {
            console.error('Tunnel creation failed or returned unexpected payload');
            process.exit(2);
        }

        const tunnel = createJson.result;
        const tunnelId = tunnel.id || tunnel.tunnel_id || tunnel.uuid || tunnel.tunnel || null;
        const credentials = tunnel.credentials || tunnel.client_secret || tunnel.secret || tunnel.credentials_file || null;

        console.log('Tunnel id detected:', tunnelId);

        // Save credentials if present
        const cloudflaredDir = path.join(process.cwd(), '.cloudflared');
        if (!fs.existsSync(cloudflaredDir)) fs.mkdirSync(cloudflaredDir);
        if (createJson.result) {
            const creds = createJson.result.credentials || createJson.result.credentials_file || null;
            if (creds) {
                const credsPath = path.join(cloudflaredDir, `${tunnelId}.json`);
                fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));
                console.log('Saved credentials to', credsPath);
            }
        }

        // Create DNS CNAME pointing to <tunnelId>.cfargotunnel.com
        if (!tunnelId) {
            console.error('No tunnel id returned; cannot create DNS record');
            return;
        }
        const cnameTarget = `${tunnelId}.cfargotunnel.com`;
        console.log('Creating DNS CNAME record for', HOSTNAME, '->', cnameTarget);
        const dnsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + API_TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'CNAME', name: HOSTNAME, content: cnameTarget, ttl: 120, proxied: true })
        });
        const dnsJson = await dnsRes.json();
        console.log('DNS create status:', dnsRes.status);
        console.log(JSON.stringify(dnsJson, null, 2));

        console.log('Done. If credentials were returned, you can run:');
        console.log(`cloudflared tunnel run ${TUNNEL_NAME} --credentials-file .cloudflared/${tunnelId}.json`);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
})();
