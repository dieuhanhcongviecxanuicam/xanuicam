// ubndxanuicam/frontend/src/pages/FeedbackPage.jsx
// VERSION 3.0 - ADDED FEEDBACK HISTORY VIEW

import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Send, CheckCircle, Clock, MessageCircle, User } from 'lucide-react';
import apiService from '../services/apiService';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import Spinner from '../components/common/Spinner';

const FeedbackPage = () => {
    // State cho form gửi
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // State cho lịch sử góp ý
    const [myFeedback, setMyFeedback] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    const fetchMyFeedback = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const data = await apiService.getMyFeedback();
            setMyFeedback(data);
        } catch (err) {
            console.error("Lỗi khi tải lịch sử góp ý:", err);
            setError("Không thể tải lịch sử góp ý của bạn.");
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMyFeedback();
    }, [fetchMyFeedback]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            await apiService.submitFeedback({ title, content, isAnonymous });
            setLoading(false);
            setIsSubmitted(true);
            setTitle('');
            setContent('');
            setIsAnonymous(false);
            // Tải lại lịch sử sau khi gửi thành công
            fetchMyFeedback(); 
        } catch (err) {
            setError(String(err) || 'Gửi góp ý thất bại. Vui lòng thử lại.');
            setLoading(false);
        }
    };
    
    const getStatusClass = (status) => {
        switch (status) {
            case 'Mới': return 'bg-blue-100 text-blue-800';
            case 'Đã giải quyết': return 'bg-green-100 text-green-800';
            default: return 'bg-yellow-100 text-yellow-800';
        }
    };

    if (isSubmitted) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-white rounded-lg shadow-lg p-12 text-center">
                <CheckCircle className="w-24 h-24 text-green-500 mb-6" />
                <h1 className="text-3xl font-bold text-slate-800">Gửi góp ý thành công!</h1>
                <p className="text-slate-600 mt-3 max-w-md">
                    Cảm ơn bạn đã đóng góp ý kiến. Bạn có thể theo dõi phản hồi trong mục "Lịch sử góp ý" bên dưới.
                </p>
                <button 
                    onClick={() => setIsSubmitted(false)} 
                    className="mt-8 btn-primary"
                >
                    Tiếp tục gửi góp ý
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <div className="flex items-center mb-6">
                    <MessageSquare className="w-8 h-8 text-purple-600 mr-4" />
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Góp ý & Cải thiện</h1>
                        <p className="mt-1 text-slate-500">Chúng tôi luôn lắng nghe ý kiến của bạn để cải thiện hệ thống.</p>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-lg shadow-lg max-w-3xl mx-auto">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-slate-700">Tiêu đề</label>
                            <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1 input-style" placeholder="Ví dụ: Cần cải thiện tốc độ tải trang" />
                        </div>
                        <div>
                            <label htmlFor="content" className="block text-sm font-medium text-slate-700">Nội dung chi tiết</label>
                            <textarea id="content" rows="6" value={content} onChange={(e) => setContent(e.target.value)} required className="mt-1 input-style" placeholder="Vui lòng mô tả rõ ràng ý kiến đóng góp hoặc vấn đề bạn gặp phải..." />
                        </div>
                        <div className="flex items-center">
                            <input id="anonymous" type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                            <label htmlFor="anonymous" className="ml-2 block text-sm text-slate-900">Gửi ẩn danh</label>
                        </div>
                        <div className="text-right">
                            <button type="submit" disabled={loading} className="btn-primary">
                                <Send size={16} className="mr-2"/>
                                {loading ? 'Đang gửi...' : 'Gửi góp ý'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Lịch sử góp ý của bạn</h2>
                <div className="bg-white p-4 rounded-lg shadow-lg max-w-3xl mx-auto">
                    {historyLoading ? <div className="py-10 flex justify-center"><Spinner /></div> : (
                        <div className="space-y-4">
                            {myFeedback.length > 0 ? myFeedback.map(item => (
                                <details key={item.id} className="group bg-slate-50 rounded-lg">
                                    <summary className="p-4 cursor-pointer flex justify-between items-center font-medium text-slate-800">
                                        <span>{item.title}</span>
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(item.status)}`}>
                                            {item.status}
                                        </span>
                                    </summary>
                                    <div className="p-4 border-t border-slate-200">
                                        <div className="mb-4">
                                            <h4 className="font-semibold text-sm flex items-center mb-2"><MessageCircle size={14} className="mr-2"/>Nội dung của bạn</h4>
                                            <p className="text-sm text-slate-600 whitespace-pre-wrap p-3 bg-white rounded-md">{item.content}</p>
                                            <p className="text-xs text-slate-400 mt-1 flex items-center"><Clock size={12} className="mr-1.5"/>Gửi lúc: {format(new Date(item.created_at), 'HH:mm, dd/MM/yyyy', { locale: vi })}</p>
                                        </div>
                                        
                                        {item.response_content && (
                                            <div>
                                                <h4 className="font-semibold text-sm flex items-center mb-2 text-green-700"><User size={14} className="mr-2"/>Phản hồi từ Quản trị viên</h4>
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap p-3 bg-green-50 rounded-md">{item.response_content}</p>
                                                <p className="text-xs text-slate-400 mt-1 flex items-center"><Clock size={12} className="mr-1.5"/>Phản hồi lúc: {format(new Date(item.responded_at), 'HH:mm, dd/MM/yyyy', { locale: vi })} bởi {item.responder_name}</p>
                                            </div>
                                        )}
                                    </div>
                                </details>
                            )) : (
                                <p className="text-center text-slate-500 py-10">Bạn chưa gửi góp ý nào.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FeedbackPage;