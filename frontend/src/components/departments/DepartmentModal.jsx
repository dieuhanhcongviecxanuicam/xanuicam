import React, { useState, useEffect, useRef } from 'react';
import apiService from '../../services/apiService';
import { Camera } from 'lucide-react';
import Notification from '../common/Notification';
import defaultAvatar from '../../assets/images/default-avatar.png';
import ModalWrapper from '../common/ModalWrapper';

const DepartmentModal = ({ isOpen, onClose, onSuccess, mode, departmentData, users }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        address: '',
        phone_number: '',
        manager_id: ''
    });
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const BACKEND_URL = process.env.REACT_APP_API_BASE_URL.replace('/api', '');

    const isEditMode = mode === 'edit';

    useEffect(() => {
        if (isOpen) {
            if (isEditMode && departmentData) {
                setFormData({
                    name: departmentData.name || '',
                    description: departmentData.description || '',
                    address: departmentData.address || '',
                    phone_number: departmentData.phone_number || '',
                    manager_id: departmentData.manager_id || ''
                });
                setAvatarPreview(departmentData.avatar ? `${BACKEND_URL}/${departmentData.avatar}` : defaultAvatar);
            } else {
                setFormData({ name: '', description: '', address: '', phone_number: '', manager_id: '' });
                setAvatarPreview(defaultAvatar);
            }
            setError('');
            setAvatarFile(null);
        }
    }, [isOpen, isEditMode, departmentData, BACKEND_URL]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAvatarChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        const payload = new FormData();
        payload.append('name', formData.name);
        payload.append('description', formData.description);
        payload.append('address', formData.address);
        payload.append('phone_number', formData.phone_number);
        if(formData.manager_id) payload.append('manager_id', formData.manager_id);
        if(avatarFile) payload.append('avatar', avatarFile);

        try {
            if (isEditMode) {
                await apiService.updateDepartment(departmentData.id, payload);
            } else {
                await apiService.createDepartment(payload);
            }
            setNotification({ message: isEditMode ? 'Cập nhật thành công!' : 'Tạo mới thành công!', type: 'success' });
            onSuccess();
            setTimeout(onClose, 1000);
        } catch (err) {
            setError(err || 'Đã có lỗi xảy ra.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <Notification 
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ message: '', type: '' })}
            />
            <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl" className="p-8 max-h-[90vh] overflow-y-auto">
                    <h2 className="text-xl font-bold mb-6">{isEditMode ? 'Chỉnh sửa Phòng ban' : 'Tạo Phòng ban mới'}</h2>
                    {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
                    
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            <img src={avatarPreview} className="w-24 h-24 rounded-full object-cover border-4 border-slate-200" alt="Avatar phòng ban"/>
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current.click()}
                                className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700"
                            >
                                <Camera size={16} />
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*"/>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Tên Phòng ban/Đơn vị</label>
                                <input name="name" type="text" value={formData.name} onChange={handleChange} required className="mt-1 block w-full input-style" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Người phụ trách</label>
                                <select name="manager_id" value={formData.manager_id} onChange={handleChange} className="mt-1 block w-full input-style">
                                    <option value="">-- Chọn người phụ trách --</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>{user.full_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Số điện thoại</label>
                                <input name="phone_number" type="tel" value={formData.phone_number} onChange={handleChange} className="mt-1 block w-full input-style" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Địa chỉ</label>
                                <input name="address" type="text" value={formData.address} onChange={handleChange} className="mt-1 block w-full input-style" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Mô tả (tùy chọn)</label>
                            <textarea name="description" rows="3" value={formData.description} onChange={handleChange} className="mt-1 block w-full input-style" />
                        </div>
                        <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
                            <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
                            <button type="submit" disabled={loading} className="btn-primary">
                                {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </form>
                </ModalWrapper>
        </>
    );
};

export default DepartmentModal;