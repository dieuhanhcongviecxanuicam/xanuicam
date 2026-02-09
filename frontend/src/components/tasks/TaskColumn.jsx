import React from 'react';
import TaskCard from './TaskCard';

const TaskColumn = ({ title, tasks, onTaskClick }) => {
    return (
            <div className="bg-slate-50 rounded-none sm:rounded-lg p-0 sm:p-4 h-full min-h-[500px]">
                <h3 className="font-semibold text-slate-700 mb-4 px-4 sm:px-0">{title} ({tasks.length})</h3>
            <div className="space-y-4">
                {tasks.length > 0 ? (
                    tasks.map(task => (
                        <TaskCard 
                            key={task.id} 
                            task={task} 
                            onClick={() => onTaskClick(task)}
                        />
                    ))
                ) : (
                    <p className="text-sm text-slate-400 text-center py-4">Không có công việc nào</p>
                )}
            </div>
        </div>
    );
};

export default TaskColumn;