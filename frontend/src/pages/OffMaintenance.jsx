import React, { useState } from 'react';
import apiService from '../services/apiService';

const OffMaintenancePage = () => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            await apiService.login({ identifier, password });
            // on success redirect to admin settings where user can turn off maintenance
            window.location.href = '/admin/settings';
        } catch (err) {
            setMessage(err && err.message ? err.message : 'Đăng nhập thất bại');
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100">
            <div className="bg-white rounded-lg p-8 shadow-md w-full max-w-md">
                <h2 className="text-2xl font-semibold mb-4">Đăng nhập - Off-maintenance</h2>
                {message && <div className="text-red-600 mb-2">{message}</div>}
                <form onSubmit={handleSubmit}>
                    <label className="block text-sm font-medium">Tên đăng nhập hoặc ID</label>
                    <input className="mt-1 input-style w-full" value={identifier} onChange={(e)=>setIdentifier(e.target.value)} />
                    <label className="block text-sm font-medium mt-3">Mật khẩu</label>
                    <input type="password" className="mt-1 input-style w-full" value={password} onChange={(e)=>setPassword(e.target.value)} />
                    <div className="mt-6">
                        <button type="submit" disabled={loading} className="w-full px-4 py-2 bg-blue-600 text-white rounded-md">{loading? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OffMaintenancePage;
