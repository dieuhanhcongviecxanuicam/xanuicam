import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import PasswordModal from './PasswordModal';

describe('PasswordModal', () => {
  test('renders when open and calls callbacks', () => {
    const onChange = jest.fn();
    const onCancel = jest.fn();
    const onConfirm = jest.fn();

    render(
      <PasswordModal
        open={true}
        title="Test Modal"
        description="Enter password"
        value=""
        onChange={onChange}
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Confirm"
      />
    );

    // title and description present
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Enter password')).toBeInTheDocument();

    // input exists and typing triggers onChange
    const input = screen.getByLabelText('Mật khẩu');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalled();

    // click confirm
    const confirmBtn = screen.getByRole('button', { name: /Confirm/i });
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalled();

    // click cancel
    const cancelBtn = screen.getByRole('button', { name: /Hủy/i });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();
  });
});
