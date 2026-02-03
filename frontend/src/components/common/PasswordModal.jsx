import React, { useEffect, useRef } from 'react';
import SmallButton from './SmallButton';
import { motion, AnimatePresence } from 'framer-motion';

export default function PasswordModal({ open, title = 'Xác nhận', description, value, onChange, onCancel, onConfirm, confirmLabel = 'Xác nhận' }) {
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    // focus input when opened
    setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (onCancel) onCancel();
      }
      // simple focus trap: keep focus inside modal for tab key
      if (e.key === 'Tab') {
        const focusable = containerRef.current.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      try { prev && prev.focus(); } catch (e) {}
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center" role="presentation" aria-hidden="false" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black bg-opacity-40" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }} />
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-modal-title"
            className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6"
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <h3 id="password-modal-title" className="text-lg font-semibold mb-2">{title}</h3>
            {description && <p className="text-sm text-slate-600 mb-4">{description}</p>}
            <input
              ref={inputRef}
              name="logout-password"
              autoComplete="current-password"
              type="password"
              value={value}
              onChange={e => onChange(e.target.value)}
              className="input-style w-full mb-4"
              placeholder="Mật khẩu"
              aria-label="Mật khẩu"
            />
            <div className="flex justify-end gap-2">
              <SmallButton variant="secondary" onClick={onCancel} aria-label="Hủy">Hủy</SmallButton>
              <SmallButton variant="primary" onClick={onConfirm} aria-label={confirmLabel}>{confirmLabel}</SmallButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

