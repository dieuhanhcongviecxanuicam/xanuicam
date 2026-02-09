import React, { useState, useEffect, useRef, useCallback } from 'react';
import useAuth from '../hooks/useAuth';
import apiService from '../services/apiService';
import Spinner from '../components/common/Spinner';
import { Camera } from 'lucide-react';
import Notification from '../components/common/Notification';
import defaultAvatar from '../assets/images/default-avatar.png';
import ChangePasswordModal from '../components/profile/ChangePasswordModal';

const DateOfBirthSelector = ({ value, onChange, disabled = false }) => {
    const date = value ? new Date(value) : null;
    const day = date ? date.getUTCDate() : '';
    const month = date ? date.getUTCMonth() + 1 : '';
    const year = date ? date.getUTCFullYear() : '';

    const handleDateChange = (part, newValue) => {
        const currentYear = year || new Date().getFullYear();
        const currentMonth = month || 1;
        const currentDay = day || 1;

        let newYear = currentYear, newMonth = currentMonth, newDay = currentDay;

        if (part === 'day') newDay = parseInt(newValue, 10);
        if (part === 'month') newMonth = parseInt(newValue, 10);
        if (part === 'year') newYear = parseInt(newValue, 10);

        const daysInMonth = new Date(newYear, newMonth, 0).getDate();
        if (newDay > daysInMonth) {
            newDay = daysInMonth;
        }

        const newDate = new Date(Date.UTC(newYear, newMonth - 1, newDay));
        onChange({ target: { name: 'birth_date', value: newDate.toISOString().split('T')[0] } });
    };

    const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);
    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div className="grid grid-cols-3 gap-3">
            <select value={day} onChange={(e) => handleDateChange('day', e.target.value)} className="input-style" disabled={disabled}>
                <option value="">Ngày</option>
                {days.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={month} onChange={(e) => handleDateChange('month', e.target.value)} className="input-style" disabled={disabled}>
                <option value="">Tháng</option>
                {months.map(m => <option key={m} value={m}>Tháng {m}</option>)}
            </select>
            <select value={year} onChange={(e) => handleDateChange('year', e.target.value)} className="input-style" disabled={disabled}>
                <option value="">Năm</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
    );
};


const ProfilePage = () => {
    const { user, updateUserContext, hasPermission } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [profile, setProfile] = useState(null);
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const fileInputRef = useRef(null);
    const BACKEND_URL = process.env.REACT_APP_API_BASE_URL.replace('/api', '');
    
    const canEditAllFields = hasPermission(['user_management']);

    const fetchUserProfile = useCallback(async () => {
        if (user) {
            setLoading(true);
            try {
                const userData = await apiService.getUserById(user.id);
                setProfile({
                    fullName: userData.full_name || '',
                    cccd: userData.cccd || '',
                    username: userData.username || '',
                    birth_date: userData.birth_date ? new Date(userData.birth_date).toISOString().split('T')[0] : '',
                    phone_number: userData.phone_number || '',
                    email: userData.email || '',
                });
            } catch (error) {
                setNotification({ message: 'Không thể tải thông tin cá nhân.', type: 'error' });
            } finally {
                setLoading(false);
            }
        }
    }, [user]);

    useEffect(() => {
        fetchUserProfile();
    }, [fetchUserProfile]);

    const handleChange = (e) => {
        setProfile({...profile, [e.target.name]: e.target.value });
    }

    const handleAvatarChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setNotification({ message: '', type: '' });
        setLoading(true);

        const formData = new FormData();
        formData.append('phone_number', profile.phone_number || '');
        formData.append('email', profile.email || '');
        formData.append('birth_date', profile.birth_date || '');
        
        if (canEditAllFields) {
             formData.append('fullName', profile.fullName);
        }
        if (avatarFile) {
            formData.append('avatar', avatarFile);
        }
        
        try {
            const res = await apiService.updateProfile(formData);
            updateUserContext(res.token);
            setNotification({ message: res.message || 'Cập nhật thông tin thành công!', type: 'success' });
            setAvatarPreview(null);
            setAvatarFile(null);
        } catch (error) {
            setNotification({ message: error, type: 'error' });
        } finally {
             setLoading(false);
        }
    };

    if (loading || !profile) return <Spinner fullPage />;

    const displayAvatar = avatarPreview || (user.avatar ? `${BACKEND_URL}/${user.avatar}` : defaultAvatar);

    return (
        <div>
            <Notification 
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ message: '', type: '' })}
            />
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
                <div className="flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8">
                    <div className="relative">
                        <img src={displayAvatar} className="w-32 h-32 rounded-full object-cover border-4 border-slate-200" alt="Avatar"/>
                        <button 
                            onClick={() => fileInputRef.current.click()}
                            className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-all"
                            aria-label="Thay đổi ảnh đại diện"
                        >
                            <Camera size={18} />
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleAvatarChange} 
                            className="hidden" 
                            accept="image/*"
                        />
                    </div>
                    <div className="text-center md:text-left">
                        <h2 className="text-2xl font-bold text-slate-800">{profile.fullName}</h2>
                        <p className="text-slate-500 mt-1">{user.role}</p>
                        <p className="text-slate-500 text-sm">{user.department || 'Chưa thuộc phòng ban'}</p>
                    </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="mt-8 border-t pt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Họ và Tên</label>
                        <input type="text" name="fullName" value={profile.fullName} onChange={handleChange} disabled={!canEditAllFields} className={`mt-1 input-style ${!canEditAllFields && 'bg-slate-100 cursor-not-allowed'}`} />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Tên đăng nhập</label>
                        <input type="text" value={profile.username || 'N/A'} disabled className="mt-1 input-style bg-slate-100 cursor-not-allowed" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Ngày sinh</label>
                        <DateOfBirthSelector value={profile.birth_date} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Số điện thoại</label>
                        <input type="tel" name="phone_number" value={profile.phone_number || ''} onChange={handleChange} className="mt-1 input-style" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Email</label>
                        <input type="email" name="email" value={profile.email || ''} onChange={handleChange} className="mt-1 input-style" />
                    </div>
                     <div >
                        <label className="block text-sm font-medium text-slate-700">Số CCCD</label>
                        <input type="text" value={profile.cccd} disabled className="mt-1 input-style bg-slate-100 cursor-not-allowed" />
                    </div>
                
                    <div className="md:col-span-2 mt-4">
                        <div className="flex flex-wrap gap-4">
                            <button type="submit" disabled={loading} className="btn-primary">
                                {loading ? 'Đang cập nhật...' : 'Cập nhật thông tin'}
                            </button>
                            <button type="button" onClick={() => setIsModalOpen(true)} className="btn-secondary">
                                Đổi mật khẩu
                            </button>
                        </div>
                    </div>
                </form>
            </div>
            <ChangePasswordModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
};

export default ProfilePage;