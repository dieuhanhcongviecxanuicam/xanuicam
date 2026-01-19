import React from 'react';
import { HardHat } from 'lucide-react';

const MaintenancePage = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 text-center p-4">
            <HardHat className="w-28 h-28 text-orange-500 mb-6" />
            <h1 className="text-4xl font-bold text-slate-800">HỆ THỐNG ĐANG ĐƯỢC BẢO TRÌ</h1>
            <p className="text-slate-600 mt-3 max-w-lg">
                Hệ thống đang được bảo trì để nâng cấp! 
                Mọi hoạt động sẽ sớm trở lại bình thường. Xin cảm ơn sự thông cảm của bạn!
            </p>
            <p className="mt-6 text-sm text-slate-500">
                - Quản Trị viên (ADMIN) -
            </p>
        </div>
    );
};

export default MaintenancePage;