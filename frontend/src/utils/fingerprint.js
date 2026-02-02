// Compute a stable fingerprint (sha256 hex) from a metadata object.
export async function computeFingerprint(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  try {
    const ordered = Object.keys(metadata).sort().reduce((o, k) => { o[k] = metadata[k]; return o; }, {});
    const json = JSON.stringify(ordered);
    const enc = new TextEncoder().encode(json);
    const hashBuf = await crypto.subtle.digest('SHA-256', enc);
    const hashArray = Array.from(new Uint8Array(hashBuf));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return null;
  }
}
