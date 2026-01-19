// Intercept console.error in tests to suppress known benign JSDOM/network warnings
const originalConsoleError = console.error.bind(console);

// Provide Headless UI animation polyfills synchronously so hooks can be registered
try {
  const { mockAnimationsApi } = require('jsdom-testing-mocks');
  if (typeof mockAnimationsApi === 'function') mockAnimationsApi();
} catch (e) {
  // ignore when package not installed
}

// Lightweight DOM API shims for jsdom test environment
if (typeof window !== 'undefined') {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
  if (typeof window.alert !== 'function') window.alert = () => {};
  if (typeof window.confirm !== 'function') window.confirm = () => true;
}

beforeAll(() => {
  console.error = (...args) => {
    try {
      const first = args[0];
      const text = (first && first.message) ? first.message : String(first || '');
      // Suppress fetch/preview related noisy messages from JSDOM mocks or intentional fallbacks
      const suppressedPatterns = [
        /Preview fetch error/i,
        /resp\.blob is not a function/i,
        /resp\.text is not a function/i,
        /Cannot read properties of null/i,
        /Failed to fetch/i,
        /401 \(Unauthorized\)/i,
        /404/i,
        /TypeError: .* is not a function/i,
        /Failed to execute 'createObjectURL'/i,
        /Unexpected token/i,
        /The Fetch API cannot load/i
      ];
      for (const p of suppressedPatterns) {
        if (p.test(text)) return;
      }
    } catch (e) {
      // fallthrough to default logger
    }
    originalConsoleError(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Provide a light canvas getContext polyfill to avoid jspdf/png requiring it in tests
beforeAll(() => {
  // Use jsdom-testing-mocks to polyfill animation APIs used by Headless UI
  if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.getContext) {
    HTMLCanvasElement.prototype.getContext = function () {
      return {
        getImageData: () => ({ data: [] }),
        putImageData: () => {},
        createImageData: () => [],
        setTransform: () => {},
        drawImage: () => {},
        save: () => {},
        restore: () => {},
      };
    };
  }

  // Prevent jsdom navigation errors by stubbing location setters to no-op
  try {
    const current = window.location && { ...window.location };
    // delete and reassign to allow overriding in Node/JSDOM
    // eslint-disable-next-line no-undef
    delete window.location;
    window.location = {
      ...(current || {}),
      assign: (url) => { /* noop in tests */ },
      replace: (url) => { /* noop in tests */ },
      set href(v) { /* ignore attempts to navigate */ },
      get href() { return (current && current.href) || '' },
    };
  } catch (e) {
    // ignore if location can't be redefined
  }
});
