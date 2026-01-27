import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CreateTaskModal from '../CreateTaskModal';
import apiService from '../../../services/apiService';

jest.mock('../../../services/apiService');

afterEach(() => jest.resetAllMocks());

test('filters assignees by selected department', async () => {
  apiService.getUsers.mockResolvedValue({ data: [
    { id: 1, full_name: 'Alice', department_id: 10 },
    { id: 2, full_name: 'Bob', department_id: 20 },
  ]});
  apiService.getDepartments.mockResolvedValue([{ id: 10, name: 'Dept X' }, { id: 20, name: 'Dept Y' }]);

  render(<CreateTaskModal isOpen={true} onClose={() => {}} onTaskCreated={() => {}} />);

  // wait for department select to be populated
  await waitFor(() => screen.getByText(/Chọn phòng ban/));

  const deptLabel = screen.getByText(/Chọn phòng ban/);
  const deptSelect = deptLabel.parentElement.querySelector('select');
  fireEvent.change(deptSelect, { target: { value: '10' } });

  // assignee select should only show Alice (dept 10)
  await waitFor(() => screen.getByText('Alice'));
  expect(screen.queryByText('Bob')).toBeNull();
});
