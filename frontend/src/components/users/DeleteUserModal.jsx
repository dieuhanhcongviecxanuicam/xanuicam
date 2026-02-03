import React, { useState } from 'react';
import apiService from '../../services/apiService';
import { AlertTriangle } from 'lucide-react';
import ModalWrapper from '../common/ModalWrapper';

const DeleteUserModal = ({ isOpen, onClose, onUserDeleted, user }) => {
    const [mfaToken, setMfaToken] = useState('');
    const [busy, setBusy] = useState(false);

    if (!isOpen || !user) return null;

    const handleDelete = async () => {
        if (!mfaToken || mfaToken.trim().length === 0) {
            alert('Vui lòng nhập mã Authenticator (6 chữ số)');
            return;
        }
        setBusy(true);
        try {
            await apiService.deleteUser(user.id, { mfaToken: mfaToken.trim() });
            if (onUserDeleted) onUserDeleted(user.id);
            onClose();
        } catch (err) {
            console.error('delete user', err);
            alert('Không thể xóa người dùng: ' + (err?.response?.data?.message || err?.message || 'Lỗi'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Xóa tài khoản</h3>
                    <div className="mt-2">
                        <p className="text-sm text-gray-500">Bạn có chắc chắn muốn xóa tài khoản <span className="font-bold">{user.full_name}</span>? Hành động này sẽ lưu bản ghi vào kho lưu trữ và tự động bị xóa vĩnh viễn sau 7 ngày.</p>
                    </div>
                </div>
            </div>

            <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Nhập mã Authenticator</label>
                <input
                    className="mt-1 block w-full border rounded p-2 no-native-arrows"
                    value={mfaToken}
                    onChange={e => setMfaToken(e.target.value)}
                    placeholder="6 chữ số"
                    inputMode="numeric"
                    maxLength={6}
                    disabled={busy}
                />
            </div>

            <div className="mt-4 flex justify-end gap-2">
                <button className="btn-secondary" onClick={onClose} disabled={busy}>Hủy</button>
                <button className="btn-danger" onClick={handleDelete} disabled={busy}>Xóa</button>
            </div>
        </ModalWrapper>
    );
};

export default DeleteUserModal;