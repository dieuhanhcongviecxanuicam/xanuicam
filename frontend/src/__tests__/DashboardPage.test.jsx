jest.mock('date-fns', () => ({ format: jest.fn(() => '01/01/2026'), formatDistanceToNow: jest.fn(() => '1 ngày trước') }));
jest.mock('date-fns/locale', () => ({ vi: {} }));
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardPage from '../pages/DashboardPage';
import AuthContext from '../context/AuthContext';

jest.mock('../services/apiService', () => ({
  __esModule: true,
  default: {
    getTasks: jest.fn(() => []),
    getUsers: jest.fn(() => ({ data: [] })),
    getReportFilters: jest.fn(() => ({})),
    getOverviewStats: jest.fn(() => ({})),
    getDetailedTaskReport: jest.fn(() => ({ items: [{ id: 5, title: 'R1', assignee_name: 'A', due_date: null, status: 'Mới' }], total: 1 })),
  }
}));

describe.skip('DashboardPage report pagination', () => {
  it.skip('requests detailed report with page and pageSize and updates when per-page changes', async () => {
    const api = require('../services/apiService').default;
    render(
      <AuthContext.Provider value={{ user: { id: 1 } }}>
        <DashboardPage />
      </AuthContext.Provider>
    );

    await waitFor(() => expect(api.getDetailedTaskReport).toHaveBeenCalled());
    // initial call should include page=1 and pageSize=10
    expect(api.getDetailedTaskReport.mock.calls[0][0]).toEqual(expect.objectContaining({ page: 1, pageSize: 10 }));

    // change per-page selector to 5
    const select = screen.getByDisplayValue('10');
    fireEvent.change(select, { target: { value: '5' } });

    await waitFor(() => expect(api.getDetailedTaskReport).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 5, page: 1 }))); 
  });
});
