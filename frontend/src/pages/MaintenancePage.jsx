import React, { useEffect, useState } from 'react';
import { HardHat } from 'lucide-react';

const Countdown = ({ to }) => {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);
    if (!to) return null;
    const diff = new Date(to).getTime() - now;
    if (isNaN(diff)) return null;
    if (diff <= 0) return <div className="text-lg font-medium text-green-600">Dự kiến hoàn thành</div>;
    const sec = Math.floor(diff / 1000) % 60;
    const min = Math.floor(diff / (1000 * 60)) % 60;
    const hr = Math.floor(diff / (1000 * 60 * 60)) % 24;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return (
        <div className="text-xl font-semibold text-slate-800 mt-4">
            {days>0? `${days} ngày `: ''}{String(hr).padStart(2,'0')}:{String(min).padStart(2,'0')}:{String(sec).padStart(2,'0')}
        </div>
    );
};

const MaintenancePage = () => {
    const [payload, setPayload] = useState(null);
    useEffect(() => {
        try {
            const raw = localStorage.getItem('maintenance_payload');
            if (raw) setPayload(JSON.parse(raw));
        } catch (e) { /* ignore */ }
    }, []);

    const title = payload?.title || 'HỆ THỐNG ĐANG ĐƯỢC BẢO TRÌ';
    const sub = payload?.sub_title || null;
    const msg = payload?.message || payload?.detailed_message || 'Hệ thống đang được bảo trì để nâng cấp. Vui lòng quay lại sau.';
    const start = payload?.start_time || null;
    const end = payload?.end_time || null;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 text-center p-4">
            <HardHat className="w-28 h-28 text-orange-500 mb-6" />
            <h1 className="text-4xl font-extrabold text-slate-800">{title}</h1>
            {sub && <h2 className="text-xl text-orange-600 mt-2 font-semibold">{sub}</h2>}
            <div className="mt-4 max-w-2xl">
                <p className="text-slate-600 text-center whitespace-pre-line leading-relaxed" style={{fontSize: '1.05rem'}}>
                    {msg}
                </p>
                {(start || end) && (
                    <div className="mt-4 text-center">
                        <div className="text-sm text-slate-500">Thời gian dự kiến</div>
                        <div className="text-lg font-medium text-slate-800 mt-1">{start? new Date(start).toLocaleString() : ''} {start && end ? ' đến ' : ''} {end? new Date(end).toLocaleString() : ''}</div>
                        <Countdown to={end} />
                    </div>
                )}
                <div className="mt-6">
                    <a href="/off-maintenance" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md">Đăng nhập (Off-maintenance)</a>
                </div>
            </div>
            <p className="mt-6 text-sm text-slate-500">
                Trân trọng cảm ơn!
            </p>
        </div>
    );
};

export default MaintenancePage;