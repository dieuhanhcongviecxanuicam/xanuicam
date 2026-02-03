// ubndxanuicam/frontend/src/components/tasks/TaskCard.jsx
import React from 'react';
import { format, differenceInDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Star } from 'lucide-react';

const TaskCard = ({ task, onClick }) => {
    const dueDate = new Date(task.due_date);
    const now = new Date();
    // Bỏ phần giờ, phút, giây để so sánh ngày chính xác hơn
    const startOfDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const remainingDays = differenceInDays(startOfDueDate, startOfNow);
    const isOverdue = remainingDays < 0 && task.status !== 'Hoàn thành';

    let deadlineText;
    let deadlineColor = 'text-slate-500';

    if (task.status === 'Hoàn thành') {
        deadlineText = 'Đã hoàn thành';
        deadlineColor = 'text-green-600';
    } else if (isOverdue) {
        deadlineColor = 'text-red-600 font-semibold';
        deadlineText = `Quá hạn ${Math.abs(remainingDays)} ngày, đề nghị báo cáo`;
    } else if (remainingDays === 0) {
        deadlineColor = 'text-yellow-600 font-semibold';
        deadlineText = 'Hạn chót hôm nay, đề nghị báo cáo';
    } else {
        deadlineText = <>Còn lại <strong className="font-bold">{remainingDays}</strong> ngày</>;
        if (remainingDays <= 3) {
            deadlineColor = 'text-orange-600';
        }
    }
    
    const priorityClasses = {
        'Cao': 'bg-red-100 text-red-800',
        'Trung bình': 'bg-yellow-100 text-yellow-800',
        'Thấp': 'bg-blue-100 text-blue-800'
    };
    
    return (
        <div 
            onClick={onClick}
            className="bg-white rounded-none sm:rounded-md shadow-sm p-3 sm:p-4 border border-slate-200 hover:shadow-md hover:border-blue-500 cursor-pointer transition-all w-full"
            style={{ boxSizing: 'border-box' }}
        >
            <div className="flex justify-between items-start">
                <h4 className="font-semibold text-slate-800 text-sm mb-2 pr-2">{task.title}</h4>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${priorityClasses[task.priority] || priorityClasses['Trung bình']}`}>
                    {task.priority}
                </span>
            </div>
            <div className="flex items-center justify-between border-t pt-2 mt-2">
                <p className="text-xs text-slate-500">Người thực hiện: <span className="font-medium text-slate-600">{task.assignee_name}</span></p>

                <p className={`text-xs text-center mx-4 font-medium ${deadlineColor}`}>
                    {deadlineText}
                </p>

                <div className="flex items-center gap-3">
                    {task.kpi_score > 0 && (
                        <div className="flex items-center">
                            {[...Array(task.kpi_score)].map((_, i) => (
                                <Star key={i} size={14} className="text-yellow-400 fill-current" />
                            ))}
                        </div>
                    )}
                    <p className={`text-xs font-medium ${deadlineColor}`}>
                        Hạn: {format(dueDate, 'dd/MM/yyyy', { locale: vi })}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TaskCard;