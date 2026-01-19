jest.mock('date-fns', () => ({ format: jest.fn(() => '01/01/2026'), formatDistanceToNow: jest.fn(() => '1 ngày trước') }));
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeletedTasksPage from '../pages/DeletedTasksPage';
import AuthContext from '../context/AuthContext';
// mock react-router-dom navigation used by the page
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn()
}), { virtual: true });

jest.mock('../services/apiService', () => ({
  __esModule: true,
  default: {
    getDeletedTasks: jest.fn(() => Promise.resolve([{ id: 1, title: 'T-A', assignee_name: 'A', deleted_at: new Date().toISOString() }])),
    restoreDeletedTask: jest.fn(() => Promise.resolve()),
    permanentlyDeleteTask: jest.fn(() => Promise.resolve()),
  }
}));

describe('DeletedTasksPage', () => {
  beforeEach(() => {
    window.confirm = jest.fn(() => true);
    // ensure the api mock returns a predictable deleted task list for assertions
    const api = require('../services/apiService').default;
    api.getDeletedTasks.mockResolvedValue([{ id: 1, title: 'T-A', assignee_name: 'A', deleted_at: new Date().toISOString() }]);
  });

  it('lists deleted tasks and can restore', async () => {
    render(
      <AuthContext.Provider value={{ user: { permissions: ['task_management'] } }}>
        <DeletedTasksPage />
      </AuthContext.Provider>
    );
    await waitFor(() => expect(screen.getByText('T-A')).toBeInTheDocument());
    const restoreBtn = screen.getByText('Khôi phục');
    fireEvent.click(restoreBtn);
    const api = require('../services/apiService').default;
    await waitFor(() => expect(api.restoreDeletedTask).toHaveBeenCalledWith(1));
  });

  it('performs permanent delete when password provided', async () => {
    render(
      <AuthContext.Provider value={{ user: { permissions: ['task_management'] } }}>
        <DeletedTasksPage />
      </AuthContext.Provider>
    );
    await waitFor(() => expect(screen.getByText('T-A')).toBeInTheDocument());
    const permBtn = screen.getByText('Xóa vĩnh viễn');
    fireEvent.click(permBtn);
    // password input appears
    const pwd = screen.getByPlaceholderText('Mật khẩu');
    fireEvent.change(pwd, { target: { value: 'secret' } });
    // click the confirm delete button (last with same text)
    const buttons = screen.getAllByText('Xóa vĩnh viễn');
    const last = buttons[buttons.length - 1];
    fireEvent.click(last);
    const api = require('../services/apiService').default;
    await waitFor(() => expect(api.permanentlyDeleteTask).toHaveBeenCalled());
  });
});
