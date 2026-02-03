import React, { useState } from 'react';
import apiService from '../../services/apiService';
import ModalWrapper from '../common/ModalWrapper';

const ChangePasswordModal = ({ isOpen, onClose }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError('Mật khẩu mới không khớp.');
            return;
        }
        if (newPassword.length < 6) {
            setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
            return;
        }

        try {
            const response = await apiService.changePassword({ oldPassword, newPassword });
            setSuccess(response.message);
            setTimeout(() => {
                handleClose();
            }, 2000);
        } catch (err) {
            setError(err || 'Đã xảy ra lỗi.');
        }
    };

    const handleClose = () => {
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        setSuccess('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <ModalWrapper isOpen={isOpen} onClose={handleClose} maxWidth="max-w-md" className="p-8">
                <h2 className="text-xl font-bold mb-4">Đổi mật khẩu</h2>
                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                {success && <p className="text-green-500 text-sm mb-4">{success}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Mật khẩu cũ</label>
                        <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required className="mt-1 input-style" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Mật khẩu mới</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="mt-1 input-style" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Xác nhận mật khẩu mới</label>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="mt-1 input-style" />
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <button type="button" onClick={handleClose} className="btn-secondary">Hủy</button>
                        <button type="submit" className="btn-primary">Lưu thay đổi</button>
                    </div>
                </form>
        </ModalWrapper>
    );
};

export default ChangePasswordModal;