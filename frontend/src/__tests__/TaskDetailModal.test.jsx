jest.mock('date-fns', () => ({ format: jest.fn(() => '01/01/2026'), formatDistanceToNow: jest.fn(() => '1 ngày trước') }));
jest.mock('date-fns/locale', () => ({ vi: {} }));
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskDetailModal from '../components/tasks/TaskDetailModal';

import AuthContext from '../context/AuthContext';
jest.mock('../services/apiService', () => ({
  __esModule: true,
  default: {
    getTaskHistory: jest.fn(() => Promise.resolve([])),
    getTaskComments: jest.fn(() => Promise.resolve([])),
    getTaskAttachments: jest.fn(() => Promise.resolve([])),
    getTask: jest.fn(async (id) => Promise.resolve({ id, title: 'T1', assignee_id: 2, creator_id: 1, due_date: new Date().toISOString(), description: 'd', kpi_score: 0 })),
    updateTaskStatus: jest.fn(() => Promise.resolve()),
  }
}));

describe('TaskDetailModal', () => {
  it('shows Xóa công việc button for assignee and calls API on confirm', async () => {
    const task = { id: 99, title: 'Task 99', assignee_id: 2, creator_id: 1, due_date: new Date().toISOString(), status: 'Mới tạo' };

    // mock global confirm
    window.confirm = jest.fn(() => true);

    render(
      <AuthContext.Provider value={{ user: { id: 2 }, hasPermission: () => false }}>
        <TaskDetailModal task={task} users={[]} onClose={jest.fn()} onUpdate={jest.fn()} />
      </AuthContext.Provider>
    );

    // wait for async fetchTaskDetails to complete
    await waitFor(() => expect(screen.getByText('Task 99')).toBeInTheDocument());

    const btn = screen.getByText('Xóa công việc');
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);

    const api = require('../services/apiService').default;
    await waitFor(() => expect(api.updateTaskStatus).toHaveBeenCalledWith(99, 'Đã hủy'));
  });
});
