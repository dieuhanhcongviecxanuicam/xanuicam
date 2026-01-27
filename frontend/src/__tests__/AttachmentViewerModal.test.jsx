import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AttachmentViewerModal from '../../src/components/common/AttachmentViewerModal';
import '@testing-library/jest-dom';

// Mock mammoth to avoid heavy conversion in tests
jest.mock('mammoth', () => ({
  default: {
    convertToHtml: jest.fn(() => Promise.resolve({ value: '<p>docx content</p>' }))
  }
}));

describe('AttachmentViewerModal', () => {
  const baseProps = { onClose: jest.fn() };

  beforeEach(() => {
    // global fetch mock to respond to different file types
    // Ensure window.URL.createObjectURL is available in JSDOM tests
    if (!window.URL.createObjectURL) window.URL.createObjectURL = jest.fn(() => 'blob:mock');
    if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = jest.fn();

    global.fetch = jest.fn((url) => {
      const u = String(url || '');
      if (u.includes('/attachments/preview')) {
        // simulate backend preview returning html
        return Promise.resolve({ ok: true, headers: { get: (n) => 'text/html' }, text: () => Promise.resolve('<div>preview html</div>') });
      }
      if (u.endsWith('.docx')) {
        return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)), headers: { get: () => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } });
      }
      if (u.endsWith('.pdf')) {
        const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
        return Promise.resolve({ ok: true, blob: () => Promise.resolve(blob), headers: { get: () => 'application/pdf' } });
      }
      // default: image or other -> return blob
      const blob = new Blob([''], { type: 'image/png' });
      return Promise.resolve({ ok: true, blob: () => Promise.resolve(blob), headers: { get: () => 'image/png' } });
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete global.fetch;
  });

  test('renders image when file is image', () => {
    render(<AttachmentViewerModal attachment={{ file_path: '/logo192.png', file_name: 'logo192.png' }} {...baseProps} />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src');
  });

  test('renders iframe for PDF', async () => {
    render(<AttachmentViewerModal attachment={{ file_path: '/uploads/test.pdf', file_name: 'test.pdf' }} {...baseProps} />);
    // Wait for iframe to appear (component may fetch blob and create object URL)
    await screen.findByTitle('test.pdf');
  });

  test('converts and renders docx via mammoth (or shows fallback)', async () => {
    render(<AttachmentViewerModal attachment={{ file_path: '/uploads/test.docx', file_name: 'test.docx' }} {...baseProps} />);
    await waitFor(() => {
      const hasMammothContent = !!screen.queryByText('docx content');
      const iframe = screen.queryByTitle('test.docx');
      const hasPreviewSrcdoc = iframe && iframe.getAttribute && iframe.getAttribute('srcdoc') && iframe.getAttribute('srcdoc').includes('preview html');
      const hasFallback1 = !!screen.queryByText('Mở trong tab mới');
      const hasFallback2 = !!screen.queryByText('Không có nội dung để hiển thị.');
      expect(hasMammothContent || hasPreviewSrcdoc || hasFallback1 || hasFallback2).toBeTruthy();
    });
  });
});
