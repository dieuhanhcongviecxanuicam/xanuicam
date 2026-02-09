const axios = require('axios');

async function enrichIp(ip) {
  try {
    if (!ip) return null;
    // Use ip-api.com for simple geo + ISP enrichment (free tier, limited rate)
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city,lat,lon,timezone,isp,org,query`;
    const res = await axios.get(url, { timeout: 3000 });
    if (res.data && res.data.status === 'success') {
      return {
        ip: res.data.query || ip,
        country: res.data.country || null,
        city: res.data.city || null,
        latitude: res.data.lat || null,
        longitude: res.data.lon || null,
        timezone: res.data.timezone || null,
        isp: res.data.isp || res.data.org || null
      };
    }
    return null;
  } catch (e) {
    // non-fatal
    return null;
  }
}

module.exports = { enrichIp };
