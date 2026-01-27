import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import MeetingDetailModal from '../MeetingDetailModal';
import apiService from '../../../services/apiService';

jest.mock('../../../services/apiService');

afterEach(() => jest.resetAllMocks());

test('displays department name from hook when booking has only department_id', async () => {
  // apiService.getDepartments is used by useDepartments hook
  apiService.getDepartments.mockResolvedValue([{ id: 42, name: 'Phòng Kế hoạch' }]);
  apiService.getDepartmentById = jest.fn().mockResolvedValue({ id: 42, name: 'Phòng Kế hoạch' });

  const booking = { id: 1, title: 'Test', room_name: 'Phòng họp', start_time: new Date().toISOString(), end_time: new Date().toISOString(), department_id: 42 };

  render(<MeetingDetailModal isOpen={true} onClose={() => {}} booking={booking} />);

  await waitFor(() => expect(screen.queryByText('Phòng Kế hoạch')).not.toBeNull());
});
