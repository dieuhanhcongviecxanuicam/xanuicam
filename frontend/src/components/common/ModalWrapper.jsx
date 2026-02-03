import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import modalStack from './modalStack';

// A robust modal wrapper that guarantees hooks run in the same order
// across renders and provides a stable portal host per modal instance.
const ModalWrapper = ({ isOpen = true, onClose = () => {}, maxWidth = 'max-w-3xl', children, className = '', coverHeader = false }) => {
    const hostRef = useRef(typeof document !== 'undefined' ? (() => {
        const el = document.createElement('div');
        el.className = 'modal-portal-container';
        return el;
    })() : null);
    const modalRef = useRef(null);
    const idRef = useRef(null);
    const [isMobile, setIsMobile] = useState(false);

    // Create portal host once on client
    useEffect(() => {
        if (typeof document === 'undefined') return;
        try {
            if (!hostRef.current) {
                hostRef.current = document.createElement('div');
                hostRef.current.className = 'modal-portal-container';
            }
            if (!document.body.contains(hostRef.current)) document.body.appendChild(hostRef.current);
        } catch (e) {}
        return () => {
            try { if (hostRef.current && document.body.contains(hostRef.current)) document.body.removeChild(hostRef.current); } catch (e) {}
        };
    }, []);

    // stable id for modal stack
    if (!idRef.current) idRef.current = Symbol('modal');

    // track mobile state
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(max-width:640px)');
        const onChange = () => setIsMobile(mq.matches);
        onChange();
        try { mq.addEventListener('change', onChange); } catch (e) { mq.addListener(onChange); }
        return () => { try { mq.removeEventListener('change', onChange); } catch (e) { mq.removeListener(onChange); } };
    }, []);

    // manage modal stacking z-index
    useEffect(() => {
        if (!isOpen) return undefined;
        const z = modalStack.push(idRef.current);
        if (hostRef.current) hostRef.current.dataset.modalZ = z;
        return () => modalStack.pop(idRef.current);
    }, [isOpen]);

    // keyboard / outside click
    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        const ignoreNext = { current: true };
        const onClick = (e) => {
            if (ignoreNext.current) { ignoreNext.current = false; return; }
            if (!modalRef.current) return;
            if (!modalRef.current.contains(e.target)) onClose();
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('click', onClick);
        const t = setTimeout(() => { ignoreNext.current = false; }, 0);
        return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick); };
    }, [isOpen, onClose]);

    if (!isOpen || !hostRef.current) return null;

    const modalZ = modalStack.getZFor(idRef.current) || modalStack.topZ();
    const mobileTopOffset = 64;

    const modal = (
        <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: modalZ - 1 }}>
            <div className={`absolute inset-0 bg-black ${coverHeader ? 'bg-opacity-60' : 'bg-opacity-50'}`} onClick={onClose} style={{ zIndex: modalZ - 1 }} />
            {isMobile ? (
                <div className={`flex justify-center ${coverHeader ? 'items-stretch' : 'items-start'} min-h-screen`} style={{ zIndex: modalZ }}>
                    <div
                        ref={modalRef}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        className={`relative bg-white w-full ${className} overflow-y-auto ${coverHeader ? 'h-full rounded-none' : ''}`}
                        style={{ zIndex: modalZ + 1, top: coverHeader ? 0 : mobileTopOffset, position: coverHeader ? 'fixed' : 'absolute', left: 0, right: 0, bottom: 0, borderRadius: 0 }}
                    >
                        {children}
                    </div>
                </div>
            ) : (
                <div className="flex justify-center items-start p-4 min-h-screen" style={{ zIndex: modalZ }}>
                    <div
                        ref={modalRef}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        className={`relative bg-white ${coverHeader ? 'h-full rounded-none shadow-xl' : 'rounded-lg shadow-xl'} w-full ${maxWidth} ${className} ${coverHeader ? 'max-h-full' : 'max-h-[90vh]'} overflow-y-auto`}
                        style={{ zIndex: modalZ + 1 }}
                    >
                        {children}
                    </div>
                </div>
            )}
        </div>
    );

    return createPortal(modal, hostRef.current);
};

export default ModalWrapper;
