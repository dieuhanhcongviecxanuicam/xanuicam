import React, { useState, useEffect } from 'react';

const PasswordExportModal = ({ isOpen, onClose, onConfirm, format, quota }) => {
    const [mfaCode, setMfaCode] = useState('');
    useEffect(() => { if (!isOpen) setMfaCode(''); }, [isOpen]);
    if (!isOpen) return null;
    const remaining = quota ? quota.remaining : null;
    const limit = quota ? quota.limit : 5;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
                <h3 className="text-lg font-semibold mb-2">Xác nhận xuất báo cáo</h3>
                <p className="text-sm text-slate-600 mb-4">Bạn đang yêu cầu xuất báo cáo dưới dạng <strong>{format.toUpperCase()}</strong>.</p>
                {remaining !== null && (
                    <p className="text-sm mb-4">Số lần đã dùng hôm nay: <strong>{limit - remaining}</strong> / {limit}. <span className="text-sm text-slate-500">(còn lại {remaining} lần)</span></p>
                )}
                <label className="block text-sm font-medium text-slate-700">Mã Authenticator</label>
                <input type="password" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} className="mt-1 mb-4 input-style no-native-arrows w-full" placeholder="6 chữ số" inputMode="numeric" maxLength={6} />
                <div className="flex justify-end gap-2">
                    <button className="btn-secondary" onClick={onClose}>Hủy</button>
                    <button className="btn-primary" onClick={() => onConfirm(mfaCode)}>Xác nhận</button>
                </div>
            </div>
        </div>
    );
};

export default PasswordExportModal;
