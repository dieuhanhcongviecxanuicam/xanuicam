import React from 'react';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

const AccessDeniedPage = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 text-center">
            <Lock className="w-24 h-24 text-red-500 mb-4" />
            <h1 className="text-4xl font-bold text-slate-800">Truy Cập Bị Từ Chối</h1>
            <p className="text-slate-600 mt-2">Bạn không có quyền truy cập vào trang này.</p>
            <Link 
                to="/" 
                className="mt-6 px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
                Quay về Trang chủ
            </Link>
        </div>
    );
};

export default AccessDeniedPage;