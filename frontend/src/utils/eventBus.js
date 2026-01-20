const listeners = {};

const on = (event, cb) => {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(cb);
  return () => {
    listeners[event] = listeners[event].filter(fn => fn !== cb);
  };
};

const emit = (event, payload) => {
  (listeners[event] || []).forEach(cb => {
    try { cb(payload); } catch (e) { console.error(e); }
  });
};

const eventBus = { on, emit };
export default eventBus;