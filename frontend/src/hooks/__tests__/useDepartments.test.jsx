import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import useDepartments from '../useDepartments';
import apiService from '../../services/apiService';

jest.mock('../../services/apiService');

afterEach(() => {
  jest.resetAllMocks();
});

function TestComponent() {
  const { departments, departmentsMap } = useDepartments();
  return (
    <div>
      <div data-testid="count">{departments.length}</div>
      <div data-testid="map">{Object.keys(departmentsMap).join(',')}</div>
      <div data-testid="names">{Object.values(departmentsMap).join(',')}</div>
    </div>
  );
}

test('useDepartments fetches list and builds map', async () => {
  apiService.getDepartments.mockResolvedValue([{ id: 1, name: 'Dept A' }, { id: 2, department_name: 'Dept B' }]);

  render(<TestComponent />);

  await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
  expect(screen.getByTestId('map').textContent).toContain('1');
  expect(screen.getByTestId('map').textContent).toContain('2');
  expect(screen.getByTestId('names').textContent).toContain('Dept A');
  expect(screen.getByTestId('names').textContent).toContain('Dept B');
});
