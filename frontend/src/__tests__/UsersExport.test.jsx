import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock heavy child components to keep UsersPage test lightweight
jest.mock('../hooks/useAuth', () => () => ({ hasPermission: () => true }));
// react-router-dom is not available in the test harness, mock useNavigate
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn()
}), { virtual: true });
jest.mock('../components/users/CreateUserModal', () => () => <div data-testid="create-modal" />);
jest.mock('../components/users/EditUserModal', () => () => <div data-testid="edit-modal" />);
jest.mock('../components/users/DeleteUserModal', () => () => <div data-testid="delete-modal" />);
jest.mock('../components/users/UserTasksModal', () => () => <div data-testid="tasks-modal" />);
jest.mock('../components/tasks/TaskDetailModal', () => () => <div data-testid="task-detail" />);
jest.mock('../components/common/Spinner', () => () => <div data-testid="spinner" />);
jest.mock('../components/common/Pagination', () => ({ summary }) => <div data-testid="pagination">{summary && summary.total}</div>);

// Keep PasswordExportModal real to exercise modal + confirm

// Mock apiService
jest.mock('../services/apiService', () => ({
  getExportQuota: jest.fn(),
  exportUsersRaw: jest.fn(),
  getUsers: jest.fn(),
  getDepartments: jest.fn()
}));

// Ensure API base URL is defined for components that compute backend URLs
process.env.REACT_APP_API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost/api';

import apiService from '../services/apiService';
import UsersPage from '../pages/UsersPage';

beforeEach(() => {
  jest.clearAllMocks();
  // ensure createObjectURL and revoke are available
  global.URL.createObjectURL = jest.fn(() => 'blob:mock');
  global.URL.revokeObjectURL = jest.fn();
  // stub anchor click
  HTMLAnchorElement.prototype.click = jest.fn();
});

// Polyfill ResizeObserver used by headlessui in the test environment
global.ResizeObserver = global.ResizeObserver || class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

test('export success downloads file and refreshes quota', async () => {
  apiService.getUsers.mockResolvedValue({ data: [], pagination: { currentPage: 1, totalPages: 1 } });
  apiService.getDepartments.mockResolvedValue({ data: [] });
  apiService.getExportQuota.mockResolvedValue({ usedToday: 1, limit: 5, remaining: 4 });

  const blob = new Blob(['xlsxcontent'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const headers = { get: (k) => k === 'content-disposition' ? 'attachment; filename="xanuicam_users_31122025.xlsx"' : null };
  apiService.exportUsersRaw.mockResolvedValue({ data: blob, headers });

  render(<UsersPage />);

  // wait for initial load
  await waitFor(() => expect(apiService.getUsers).toHaveBeenCalled());

  // open export menu
  const exportBtn = screen.getByText(/Xuất báo cáo/i);
  fireEvent.click(exportBtn);

  // click Export Excel
  const excelBtn = await screen.findByText('Xuất Excel');
  fireEvent.click(excelBtn);

  // modal should appear
  expect(await screen.findByText('Xác nhận xuất báo cáo')).toBeInTheDocument();

  // enter password and confirm (find password input directly)
  const input = document.querySelector('input[type="password"]');
  expect(input).toBeTruthy();
  fireEvent.change(input, { target: { value: 'password123' } });
  const confirmBtn = screen.getByText('Xác nhận');
  fireEvent.click(confirmBtn);

  await waitFor(() => expect(apiService.exportUsersRaw).toHaveBeenCalled());
  // ensure download invoked
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  // quota was refreshed at least once
  expect(apiService.getExportQuota).toHaveBeenCalled();
});

test('export rate-limited shows error and refreshes quota', async () => {
  apiService.getUsers.mockResolvedValue({ data: [], pagination: { currentPage: 1, totalPages: 1 } });
  apiService.getDepartments.mockResolvedValue({ data: [] });
  apiService.getExportQuota.mockResolvedValue({ usedToday: 5, limit: 5, remaining: 0 });

  const err = { message: 'Đã vượt quá giới hạn xuất báo cáo trong ngày (5 lần/ngày).', retry_after_seconds: 3600 };
  apiService.exportUsersRaw.mockRejectedValue(err);

  render(<UsersPage />);
  await waitFor(() => expect(apiService.getUsers).toHaveBeenCalled());

  const exportBtn = screen.getByText(/Xuất báo cáo/i);
  fireEvent.click(exportBtn);
  const excelBtn = await screen.findByText('Xuất Excel');
  fireEvent.click(excelBtn);

  expect(await screen.findByText('Xác nhận xuất báo cáo')).toBeInTheDocument();
  const input = document.querySelector('input[type="password"]');
  expect(input).toBeTruthy();
  fireEvent.change(input, { target: { value: 'bad' } });
  const confirmBtn = screen.getByText('Xác nhận');
  fireEvent.click(confirmBtn);

  await waitFor(() => expect(apiService.exportUsersRaw).toHaveBeenCalled());
  // quota should be refreshed after rate-limit
  await waitFor(() => expect(apiService.getExportQuota).toHaveBeenCalled());
  // error notification should appear (Notification is real but simple); check for message
  expect(await screen.findByText(/Đã vượt quá giới hạn xuất báo cáo/i)).toBeInTheDocument();
});

test('export connection error shows generic error', async () => {
  apiService.getUsers.mockResolvedValue({ data: [], pagination: { currentPage: 1, totalPages: 1 } });
  apiService.getDepartments.mockResolvedValue({ data: [] });
  apiService.getExportQuota.mockResolvedValue({ usedToday: 0, limit: 5, remaining: 5 });

  apiService.exportUsersRaw.mockRejectedValue(new Error('Network Error'));

  render(<UsersPage />);
  await waitFor(() => expect(apiService.getUsers).toHaveBeenCalled());

  const exportBtn = screen.getByText(/Xuất báo cáo/i);
  fireEvent.click(exportBtn);
  const excelBtn = await screen.findByText('Xuất Excel');
  fireEvent.click(excelBtn);

  const input = document.querySelector('input[type="password"]');
  expect(input).toBeTruthy();
  fireEvent.change(input, { target: { value: 'pass' } });
  const confirmBtn = screen.getByText('Xác nhận');
  fireEvent.click(confirmBtn);

  await waitFor(() => expect(apiService.exportUsersRaw).toHaveBeenCalled());
  // generic error message should appear (either localized or raw network error)
  expect(await screen.findByText(/Lỗi khi xuất báo cáo|Network Error/i)).toBeInTheDocument();
});
