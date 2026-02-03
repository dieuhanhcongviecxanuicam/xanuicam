import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider } from '../context/AuthContext';
import useAuth from '../hooks/useAuth';

jest.mock('jwt-decode', () => ({ jwtDecode: jest.fn() }));
jest.mock('../services/apiService', () => ({ getUserById: jest.fn() }));

const TestConsumer = () => {
  const { user, login, logout, hasPermission } = useAuth();
  return (
    <div>
      <div data-testid="user">{user ? user.fullName || user.id : 'no-user'}</div>
      <button onClick={() => login('tok-mock')}>login</button>
      <button onClick={() => logout()}>logout</button>
      <div data-testid="perm">{hasPermission(['perm1']) ? 'yes' : 'no'}</div>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('login stores token and updates user, logout clears it', async () => {
    const { jwtDecode } = require('jwt-decode');
    jwtDecode.mockReturnValue({ user: { id: 42, fullName: 'Test User', role: 'Admin - Cấp 1', permissions: ['perm1'] }, exp: Math.floor(Date.now()/1000) + 3600 });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('user')).toHaveTextContent('no-user');

    await act(async () => {
      screen.getByText('login').click();
    });

    expect(localStorage.getItem('token')).toBe('tok-mock');
    expect(screen.getByTestId('user')).toHaveTextContent('Test User');

    await act(async () => {
      screen.getByText('logout').click();
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  });
});
