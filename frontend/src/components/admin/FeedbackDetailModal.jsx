import React, { useState, useEffect } from 'react';
import apiService from '../../services/apiService';
import { User, Clock, Send } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import Spinner from '../common/Spinner';
import ModalWrapper from '../common/ModalWrapper';

const FeedbackDetailModal = ({ feedbackId, isOpen, onClose, onSuccess }) => {
    const [feedback, setFeedback] = useState(null);
    const [loading, setLoading] = useState(true);
    const [response, setResponse] = useState('');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && feedbackId) {
            const fetchDetails = async () => {
                setLoading(true);
                try {
                    const res = await apiService.getFeedbackById(feedbackId);
                    setFeedback(res);
                    setResponse(res.response_content || '');
                    setStatus(res.status || 'Mới');
                } catch (err) {
                    setError('Không thể tải chi tiết góp ý.');
                } finally {
                    setLoading(false);
                }
            };
            fetchDetails();
        }
    }, [isOpen, feedbackId]);

    const handleSubmitResponse = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await apiService.respondToFeedback(feedbackId, {
                response_content: response,
                status
            });
            onSuccess();
            onClose();
        } catch (err) {
            setError(err || 'Gửi phản hồi thất bại.');
        } finally {
            setLoading(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl" className="p-6 max-h-[90vh] flex flex-col">
                <h2 className="text-xl font-bold mb-4">Chi tiết Góp ý</h2>
                {loading ? <Spinner /> : feedback ? (
                    <>
                        <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                            <h3 className="font-bold text-lg text-slate-800">{feedback.title}</h3>
                            <div className="flex items-center text-sm text-slate-500 gap-4">
                                <span className="flex items-center"><User size={14} className="mr-1.5"/>{feedback.is_anonymous ? 'Ẩn danh' : feedback.submitter_name}</span>
                                <span className="flex items-center"><Clock size={14} className="mr-1.5"/>{format(new Date(feedback.created_at), 'HH:mm, dd/MM/yyyy', { locale: vi })}</span>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-md">
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{feedback.content}</p>
                            </div>
                            
                            <form onSubmit={handleSubmitResponse}>
                                <h4 className="font-semibold text-slate-800 mt-6 mb-2">Nội dung phản hồi</h4>
                                <textarea 
                                    rows="5"
                                    value={response}
                                    onChange={e => setResponse(e.target.value)}
                                    placeholder="Nhập nội dung phản hồi tại đây..."
                                    className="input-style w-full"
                                />
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-slate-700">Cập nhật trạng thái</label>
                                    <select value={status} onChange={e => setStatus(e.target.value)} className="mt-1 input-style">
                                        <option>Mới</option>
                                        <option>Đã xem</option>
                                        <option>Đang xử lý</option>
                                        <option>Đã giải quyết</option>
                                    </select>
                                </div>
                                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                                <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                                    <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
                                    <button type="submit" disabled={loading} className="btn-primary">
                                        <Send size={16} className="mr-2" />
                                        {loading ? 'Đang gửi...' : 'Gửi phản hồi'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </>
                ) : <p>{error}</p>}
            </ModalWrapper>
    );
};

export default FeedbackDetailModal;