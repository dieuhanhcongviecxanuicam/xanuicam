// Collect richer device metadata: canvas/webgl/audio hashes, fonts, timezone, connection, incognito, webauthn support
import { computeFingerprint } from './fingerprint';

async function hashCanvas() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(125,1,62,20);
    ctx.fillStyle = '#069';
    ctx.fillText('ubnd_device_fp_test', 2, 2);
    const data = canvas.toDataURL();
    // simple hash using built-in subtle
    const enc = new TextEncoder().encode(data);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  } catch (e) { return null; }
}

function detectFonts(sampleFonts = ['Arial','Times New Roman','Courier New','Segoe UI','Roboto','Noto Sans']){
  try{
    const detected = [];
    const span = document.createElement('span');
    span.style.fontSize = '72px';
    span.innerText = 'mmmmmmmmmmlli';
    document.body.appendChild(span);
    const defaultWidth = span.offsetWidth;
    for (const f of sampleFonts) {
      span.style.fontFamily = f + ', monospace';
      if (span.offsetWidth !== defaultWidth) detected.push(f);
    }
    span.remove();
    return detected;
  } catch (e) { return null; }
}

async function detectWebgl() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null;
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null;
    const enc = new TextEncoder().encode(JSON.stringify({ vendor, renderer }));
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  } catch (e) { return null; }
}

async function detectAudioFingerprint(){
  try{
    // simple oscillator fingerprinting attempt (non-invasive)
    if (!window.OfflineAudioContext && !window.webkitOfflineAudioContext) return null;
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new Ctx(1, 44100, 44100);
    const osc = ctx.createOscillator();
    const analyser = ctx.createAnalyser();
    osc.type = 'sine';
    osc.connect(analyser);
    analyser.connect(ctx.destination);
    osc.start(0);
    const buffer = await ctx.startRendering();
    const channelData = buffer.getChannelData(0).slice(0,100);
    const enc = new TextEncoder().encode(channelData.join(','));
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  } catch (e){ return null; }
}

async function isIncognito(){
  try{
    // detection heuristic: quota estimate differs in private mode
    if (!navigator.storage || !navigator.storage.estimate) return null;
    const q = await navigator.storage.estimate();
    // In incognito, quota tends to be much smaller (heuristic)
    return q.quota && q.quota < 120000000 ? true : false;
  } catch(e){ return null; }
}

async function collectWebRTCLocalIps(timeout = 3000) {
  const ips = new Set();
  try {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.onicecandidate = (e) => {
      if (!e || !e.candidate) return;
      const parts = e.candidate.candidate.split(' ');
      for (const p of parts) {
        // candidate format: candidate:0 1 UDP 2122252543 192.168.1.2 53705 typ host
        if (/^(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]+)/.test(p)) ips.add(p);
      }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    // wait briefly for candidates
    await new Promise(res => setTimeout(res, timeout));
    pc.close();
  } catch (e) {
    // ignore
  }
  return Array.from(ips);
}

export async function collectDeviceMetadata(additional = {}){
  try{
    const ua = navigator.userAgent || null;
    const platform = navigator.platform || null;
    const language = navigator.language || null;
    const languages = navigator.languages || [];
    const connection = (navigator.connection && (navigator.connection.effectiveType || navigator.connection.type)) || null;
    const screenInfo = { width: (window.screen && window.screen.width) || null, height: (window.screen && window.screen.height) || null, pixelRatio: window.devicePixelRatio || 1 };
    const hwConcurrency = navigator.hardwareConcurrency || null;
    const deviceMemory = navigator.deviceMemory || null;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    const canvasHash = await hashCanvas();
    const webglHash = await detectWebgl();
    const audioHash = await detectAudioFingerprint();
    const fonts = detectFonts();
    const incognito = await isIncognito();
    const webauthn = !!(window.PublicKeyCredential);
    // Try to load FingerprintJS for robust device fingerprinting
    let fpjsId = null;
    let fpjsComponents = null;
    try {
      const FingerprintJS = await import('@fingerprintjs/fingerprintjs');
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      fpjsId = result.visitorId;
      fpjsComponents = result.components || null;
    } catch (e) {
      // library may not be installed in dev; ignore
      fpjsId = null;
      fpjsComponents = null;
    }

    const plugins = (() => {
      try {
        return Array.from(navigator.plugins || []).map(p => p.name + (p.description ? ' - ' + p.description : ''));
      } catch (e) { return null; }
    })();
    const battery = (async () => {
      try {
        if (navigator.getBattery) {
          const b = await navigator.getBattery();
          return { level: b.level, charging: b.charging };
        }
      } catch (e) {}
      return null;
    })();
    const webrtcLocalIps = await collectWebRTCLocalIps();

    const metadata = {
      ua, platform, language, languages, connectionType: connection, screen: screenInfo,
      hardwareConcurrency: hwConcurrency, deviceMemory, timezone,
      canvasHash, webglHash, audioHash, fonts, plugins, battery: await battery, incognito, webauthn, webrtcLocalIps, ...additional
    };
    if (fpjsId) metadata.fpjsId = fpjsId;
    if (fpjsComponents) metadata.fpjsComponents = fpjsComponents;

    const fingerprint = await computeFingerprint(metadata);

    return { metadata, fingerprint };
  } catch (e) {
    return { metadata: null, fingerprint: null };
  }
}

const deviceMetadata = { collectDeviceMetadata };
export default deviceMetadata;
