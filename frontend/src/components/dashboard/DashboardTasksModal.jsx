// ubndxanuicam/frontend/src/components/dashboard/DashboardTasksModal.jsx
// VERSION 2.2 - REFINED CLICK HANDLER

import React from 'react';
import { X, ListChecks } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { vi } from 'date-fns/locale';
import ModalWrapper from '../common/ModalWrapper';
// Bỏ import TaskDetailModal vì component cha sẽ quản lý
// import TaskDetailModal from '../tasks/TaskDetailModal'; 

const DashboardTasksModal = ({ isOpen, onClose, title, tasks, users, onUpdate, onTaskClick }) => {
    if (!isOpen) return null;

    const getStatusClass = (status, due_date) => {
        if (status === 'Hoàn thành') return 'bg-green-100 text-green-800';
        if (isPast(new Date(due_date)) && status !== 'Hoàn thành') return 'bg-red-100 text-red-800';
        return 'bg-blue-100 text-blue-800';
    };

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl" className="max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center">
                        <ListChecks className="mr-3 text-blue-600"/>
                        {title}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X /></button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-4">
                    <div className="space-y-3">
                        {tasks.length > 0 ? tasks.map(task => (
                            <div 
                                key={task.id} 
                                onClick={() => onTaskClick(task)} // SỬA ĐỔI: Gọi prop onTaskClick từ cha
                                className="p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                            >
                                <div className="flex justify-between items-start">
                                    <p className="font-semibold text-slate-800">{task.title}</p>
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusClass(task.status, task.due_date)}`}>
                                        {task.status}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500 mt-1">
                                    Người thực hiện: <span className="font-medium">{task.assignee_name}</span>
                                </p>
                                <p className="text-sm text-slate-500">
                                    Hạn chót: {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: vi })}
                                </p>
                            </div>
                        )) : (
                            <p className="text-center text-slate-500 py-10">Không có công việc nào trong mục này.</p>
                        )}
                    </div>
                </div>
                 <div className="p-4 border-t bg-slate-50 flex justify-end">
                    <button type="button" onClick={onClose} className="btn-secondary">Đóng</button>
                </div>
        </ModalWrapper>
    );
};

export default DashboardTasksModal;