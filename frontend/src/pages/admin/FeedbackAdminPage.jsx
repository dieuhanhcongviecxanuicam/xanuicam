import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import { MessageSquare, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import Spinner from '../../components/common/Spinner';
import FeedbackDetailModal from '../../components/admin/FeedbackDetailModal'; // Import modal mới

const FeedbackAdminPage = () => {
    const [feedbackList, setFeedbackList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFeedbackId, setSelectedFeedbackId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const fetchFeedback = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/feedback');
            setFeedbackList(res.data);
        } catch (error) {
            console.error("Lỗi khi tải danh sách góp ý:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFeedback();
    }, [fetchFeedback]);
    
    const handleViewDetails = (id) => {
        setSelectedFeedbackId(id);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedFeedbackId(null);
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Mới': return 'bg-blue-100 text-blue-800';
            case 'Đã giải quyết': return 'bg-green-100 text-green-800';
            default: return 'bg-yellow-100 text-yellow-800';
        }
    };

    return (
        <>
            <FeedbackDetailModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                feedbackId={selectedFeedbackId}
                onSuccess={fetchFeedback}
            />
            <div>
                <div className="flex items-center mb-6">
                    <MessageSquare className="w-8 h-8 text-indigo-600 mr-4" />
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Quản lý Góp ý & Cải thiện</h1>
                    </div>
                </div>

                <div className="bg-white shadow-lg rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Tiêu đề</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Người gửi</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Thời gian</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Trạng thái</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-10"><Spinner /></td></tr>
                            ) : feedbackList.map((item) => (
                                <tr key={item.id}>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">{item.title}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{item.is_anonymous ? 'Ẩn danh' : item.submitter_name}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500">{format(new Date(item.created_at), 'HH:mm, dd/MM/yyyy', { locale: vi })}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(item.status)}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => handleViewDetails(item.id)} className="flex items-center text-sm text-blue-600 hover:text-blue-800">
                                            <Eye size={16} className="mr-1" /> Xem & Phản hồi
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};

export default FeedbackAdminPage;                     // Giả sử bạn có hàm sendNotification(userId, message) để gửi thông báo