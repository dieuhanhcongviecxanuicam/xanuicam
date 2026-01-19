import { useEffect } from 'react';

// Hook: call `handler` when click occurs outside `ref` or when Escape pressed
const useOutsideClick = (ref, handler, enabled = true) => {
  useEffect(() => {
    if (!enabled) return;
    const onDoc = (e) => {
      try {
        if (!ref || !ref.current) return;
        if (!ref.current.contains(e.target)) handler(e);
      } catch (err) { /* ignore */ }
    };
    const onKey = (e) => { if (e.key === 'Escape') handler(e); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, handler, enabled]);
};

export default useOutsideClick;
