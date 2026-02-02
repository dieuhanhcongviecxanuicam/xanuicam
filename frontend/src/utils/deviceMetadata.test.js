import { collectDeviceMetadata } from './deviceMetadata';

// Simple unit test that mocks essential browser APIs so collectDeviceMetadata
// runs in Jest/jsdom environment.

describe('collectDeviceMetadata', () => {
  beforeAll(() => {
    // Basic navigator mocks
    Object.defineProperty(global.navigator, 'userAgent', { value: 'UnitTestAgent/1.0', configurable: true });
    Object.defineProperty(global.navigator, 'platform', { value: 'UnitTestPlatform', configurable: true });
    Object.defineProperty(global.navigator, 'language', { value: 'vi-VN', configurable: true });
    Object.defineProperty(global.navigator, 'languages', { value: ['vi-VN','en-US'], configurable: true });
    // connection
    global.navigator.connection = { effectiveType: '4g' };
    // screen
    global.screen = { width: 1024, height: 768 };
    global.window.devicePixelRatio = 1;
    Object.defineProperty(global.navigator, 'hardwareConcurrency', { configurable: true, value: 4 });
    Object.defineProperty(global.navigator, 'deviceMemory', { configurable: true, value: 8 });
    // crypto.subtle.digest mock
    if (!global.crypto) global.crypto = {};
    if (!global.crypto.subtle) {
      global.crypto.subtle = {
        digest: async (alg, data) => {
          // return a dummy 32-byte ArrayBuffer
          return new Uint8Array(32).buffer;
        }
      };
    }
    // RTCPeerConnection mock to avoid real network
    global.RTCPeerConnection = function() {
      this.createDataChannel = () => ({});
      this.setLocalDescription = async () => {};
      this.createOffer = async () => ({ sdp: '' });
      this.onicecandidate = null;
      this.close = () => {};
      // simulate candidate firing
      setTimeout(() => {
        if (this.onicecandidate) this.onicecandidate({ candidate: { candidate: 'candidate:0 1 UDP 2122260223 192.168.1.5 56143 typ host' } });
        if (this.onicecandidate) this.onicecandidate({ candidate: null });
      }, 10);
    };
    // minimal canvas mock
    const canvasProto = {
      getContext: () => ({
        textBaseline: '',
        font: '',
        fillStyle: '',
        fillRect: () => {},
        fillText: () => {},
        toDataURL: () => 'data:image/png;base64,AAA'
      }),
      width: 200, height: 50
    };
    global.document.createElement = (name) => {
      if (name === 'canvas') return { ...canvasProto };
      const el = { style: {}, offsetWidth: 100, remove: () => {} };
      return el;
    };
    // navigator.plugins
    Object.defineProperty(global.navigator, 'plugins', { configurable: true, value: [{ name: 'TestPlugin', description: 'v1' }] });
    // intl timezone
    global.Intl = { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'Asia/Ho_Chi_Minh' }) }) };
  });

  test('returns metadata and fingerprint', async () => {
    const { metadata, fingerprint } = await collectDeviceMetadata();
    expect(metadata).toBeDefined();
    expect(metadata.ua).toBe('UnitTestAgent/1.0');
    expect(metadata.language).toBe('vi-VN');
    expect(Array.isArray(metadata.webrtcLocalIps)).toBe(true);
    expect(fingerprint).toBeDefined();
  }, 10000);
});
