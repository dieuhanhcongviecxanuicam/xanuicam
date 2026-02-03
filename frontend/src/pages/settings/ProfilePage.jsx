import React, { useState, useEffect, useRef, useCallback } from 'react';
import useAuth from '../../hooks/useAuth';
import apiService from '../../services/apiService';
import Spinner from '../../components/common/Spinner';
import { Camera } from 'lucide-react';
import Notification from '../../components/common/Notification';
import defaultAvatar from '../../assets/images/default-avatar.png';
import ChangePasswordModal from '../../components/profile/ChangePasswordModal';
// Link removed: not used in this component

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
    const [retrySeconds, setRetrySeconds] = useState(0);
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
                    // Use backend-provided timestamp if present, otherwise fallback to localStorage
                    lastProfileUpdate: userData.profile_last_updated_at || userData.profile_updated_at || localStorage.getItem(`profile_last_update_${user.id}`) || null
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

    const validateOptional = () => {
        // phone, email validation when provided
        const phone = profile.phone_number?.trim();
        if (phone && !/^0\d{9}$/.test(phone)) return 'Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng 0.';
        const email = profile.email?.trim();
        if (email && email.indexOf('@') === -1) return 'Email không hợp lệ.';
        return null;
    };

    const canEditProfileNow = () => {
        // If user has user_management permission, allow editing all fields always (admin override)
        if (canEditAllFields) return true;
        // otherwise check lastProfileUpdate and allow only if null or older than 30 days
        const last = profile?.lastProfileUpdate;
        if (!last) return true;
        const lastTs = new Date(last).getTime ? new Date(last).getTime() : Date.parse(last);
        if (Number.isNaN(lastTs)) return true;
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        return (Date.now() - lastTs) >= thirtyDays;
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setNotification({ message: '', type: '' });

        if (!profile.fullName || !String(profile.fullName).trim()) return setNotification({ message: 'Họ và Tên là bắt buộc.', type: 'error' });
        const optErr = validateOptional();
        if (optErr) return setNotification({ message: optErr, type: 'error' });

        if (!canEditProfileNow() && !canEditAllFields) return setNotification({ message: 'Bạn chỉ có thể cập nhật thông tin cá nhân sau 30 ngày kể từ lần cập nhật trước.', type: 'error' });

        setLoading(true);
        try {
            const formData = new FormData();
            // append only non-empty optional fields
            if (profile.phone_number && String(profile.phone_number).trim() !== '') formData.append('phone_number', profile.phone_number.trim());
            if (profile.email && String(profile.email).trim() !== '') formData.append('email', profile.email.trim());
            if (profile.birth_date && String(profile.birth_date).trim() !== '') formData.append('birth_date', profile.birth_date);
            if (canEditAllFields) formData.append('fullName', profile.fullName);
            if (avatarFile) formData.append('avatar', avatarFile);

            const res = await apiService.updateProfile(formData);
            // update user context/token if returned
            if (res?.token) updateUserContext(res.token);
            setNotification({ message: res.message || 'Cập nhật thông tin thành công!', type: 'success' });
            setAvatarPreview(null);
            setAvatarFile(null);

            // persist last update timestamp (backend should ideally provide one)
            const ts = new Date().toISOString();
            localStorage.setItem(`profile_last_update_${user.id}`, ts);
            setProfile(p => ({ ...p, lastProfileUpdate: ts }));
        } catch (error) {
            // If backend returned a structured object (we now throw response.data), handle it
            if (error && typeof error === 'object') {
                // Server may send last_profile_update and next_allowed_date for 30-day lock
                if (error.last_profile_update && error.next_allowed_date) {
                    const lastDt = new Date(error.last_profile_update);
                    const nextDt = new Date(error.next_allowed_date);
                    const ldd = String(lastDt.getDate()).padStart(2, '0');
                    const lmm = String(lastDt.getMonth() + 1).padStart(2, '0');
                    const lyyyy = lastDt.getFullYear();
                    const ndd = String(nextDt.getDate()).padStart(2, '0');
                    const nmm = String(nextDt.getMonth() + 1).padStart(2, '0');
                    const nyyyy = nextDt.getFullYear();
                    const message = `Bạn đã chỉnh sửa thông tin vào ngày ${ldd}/${lmm}/${lyyyy}, bạn có thể chỉnh sửa lần kế tiếp vào ngày ${ndd}/${nmm}/${nyyyy}!`;
                    setNotification({ message, type: 'error' });
                    const secs = Math.max(0, Math.ceil((nextDt.getTime() - Date.now()) / 1000));
                    if (secs > 0) setRetrySeconds(secs);
                    return;
                }

                // Fallback: may include retry_after_seconds
                if (error.retry_after_seconds || error.retry_after_seconds === 0) {
                    const secs = Number(error.retry_after_seconds || 0);
                    if (!Number.isNaN(secs) && secs > 0) setRetrySeconds(secs);
                }
                setNotification({ message: error.message || String(error) || 'Bạn tạm thời không thể cập nhật.', type: 'error' });
            } else {
                setNotification({ message: error || 'Đã xảy ra lỗi khi cập nhật.', type: 'error' });
            }
        } finally {
             setLoading(false);
        }
    };

    // countdown effect for retrySeconds
    useEffect(() => {
        if (!retrySeconds || retrySeconds <= 0) return;
        const iv = setInterval(() => {
            setRetrySeconds(s => {
                if (s <= 1) {
                    clearInterval(iv);
                    return 0;
                }
                return s - 1;
            });
        }, 1000);
        return () => clearInterval(iv);
    }, [retrySeconds]);

    const formatSecs = (s) => {
        if (!s || s <= 0) return '';
        const hours = Math.floor(s / 3600);
        const minutes = Math.floor((s % 3600) / 60);
        const seconds = s % 60;
        const parts = [];
        if (hours) parts.push(`${hours} giờ`);
        if (minutes) parts.push(`${minutes} phút`);
        if (!hours && !minutes) parts.push(`${seconds} giây`);
        return parts.join(' ');
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
                    <div >
                        <label className="block text-sm font-medium text-slate-700">Số CCCD</label>
                        <input type="text" value={profile.cccd} disabled className="mt-1 input-style bg-slate-100 cursor-not-allowed" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Email</label>
                        <input type="email" name="email" value={profile.email || ''} onChange={handleChange} className="mt-1 input-style" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Số điện thoại</label>
                        <input type="tel" name="phone_number" value={profile.phone_number || ''} onChange={handleChange} className="mt-1 input-style" />
                    </div>
                    <div className="md:col-span-2 mt-4">
                            <div className="flex flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <button type="submit" disabled={loading || retrySeconds > 0} className="btn-primary">
                                    {loading ? 'Đang cập nhật...' : 'Cập nhật thông tin'}
                                </button>
                                {retrySeconds > 0 && (
                                    <div className="text-sm text-red-600">Bạn có thể cập nhật sau: {formatSecs(retrySeconds)}</div>
                                )}
                            </div>
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
