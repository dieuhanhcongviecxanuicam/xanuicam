import React, { useState, useEffect, useCallback } from 'react';
import ModalWrapper from '../common/ModalWrapper';
import apiService from '../../services/apiService';
import { X, ListChecks } from 'lucide-react';
import Spinner from '../common/Spinner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const UserTasksModal = ({ isOpen, userId, userName, onClose, onTaskSelect }) => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchUserTasks = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const res = await apiService.getUserTasks(userId);
            setTasks(res);
        } catch (error) {
            console.error(`Lỗi khi tải công việc của người dùng ${userId}:`, error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (isOpen) {
            fetchUserTasks();
        }
    }, [isOpen, fetchUserTasks]);

    const getStatusClass = (status, due_date) => {
        if (status === 'Hoàn thành') return 'bg-green-100 text-green-800';
        if (new Date(due_date) < new Date() && status !== 'Hoàn thành') return 'bg-red-100 text-red-800';
        return 'bg-blue-100 text-blue-800';
    };
    
    if (!isOpen) return null;

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl" className="max-h-[90vh] flex flex-col p-0" coverHeader={true}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center">
                        <ListChecks className="mr-3 text-blue-600"/>
                        Công việc của {userName}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X /></button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-4">
                    {loading ? <div className="flex justify-center items-center h-full"><Spinner /></div> : (
                        <div className="space-y-3">
                            {tasks.length > 0 ? tasks.map(task => (
                                <div 
                                    key={task.id} 
                                    onClick={() => onTaskSelect(task)}
                                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                >
                                    <div className="flex justify-between items-start">
                                        <p className="font-semibold text-slate-800">{task.title}</p>
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusClass(task.status, task.due_date)}`}>
                                            {task.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Hạn chót: {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: vi })}
                                    </p>
                                </div>
                            )) : (
                                <p className="text-center text-slate-500 py-10">Người dùng này chưa được giao công việc nào.</p>
                            )}
                        </div>
                    )}
                </div>
        </ModalWrapper>
    );
};

export default UserTasksModal;