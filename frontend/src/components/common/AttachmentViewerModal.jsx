// ubndxanuicam/frontend/src/components/common/AttachmentViewerModal.jsx
import React, { useEffect, useState } from 'react';
import ModalWrapper from './ModalWrapper';
import SmallButton from './SmallButton';
import Spinner from './Spinner';
import mammoth from 'mammoth';

const AttachmentViewerModal = ({ attachment, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [docxHtml, setDocxHtml] = useState(null);
  const [docxError, setDocxError] = useState(null);
  const [pdfObjectUrl, setPdfObjectUrl] = useState(null);
  const [pdfConversionAvailable, setPdfConversionAvailable] = useState(true);
  
  // compute derived values before any hooks to avoid conditional hook usage
  const BACKEND_URL = process.env.REACT_APP_API_BASE_URL ? process.env.REACT_APP_API_BASE_URL.replace('/api', '') : '';
  const safeAttachment = attachment || { file_path: '', file_name: '' };
  const rawPath = String(safeAttachment.file_path || '');
  const fileUrl = /^(https?:)?\/\//i.test(rawPath) ? rawPath : `${BACKEND_URL}/${rawPath.replace(/^\/+/, '')}`;
  const isImage = /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i.test(safeAttachment.file_name || '');
  const isPdf = /\.pdf$/i.test(safeAttachment.file_name || '') || /\.pdf$/i.test(fileUrl);
  const isDocx = /\.docx$/i.test(safeAttachment.file_name || '');

  useEffect(() => {
    setDocxHtml(null);
    setDocxError(null);
    setLoading(false);
    if (!attachment) return;
    if (!isDocx) return;

    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        // First try direct fetch of the raw .docx file and convert client-side with mammoth.
        try {
          const rawResp = await fetch(fileUrl, { credentials: 'include' });
          if (rawResp.ok) {
            const contentTypeRaw = rawResp.headers && rawResp.headers.get ? (rawResp.headers.get('content-type') || '') : '';
            // If content looks like a docx (or file name ends with .docx), convert it client-side
            if (contentTypeRaw.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') || safeAttachment.file_name.toLowerCase().endsWith('.docx')) {
              const arrayBuffer = await rawResp.arrayBuffer();
              const result = await mammoth.convertToHtml({ arrayBuffer });
              if (aborted) return;
              setDocxHtml((result && result.value) ? result.value : '<div>Không có nội dung hiển thị.</div>');
              return;
            }
            // if raw fetch returned something else, fall through to server preview
          }
        } catch (clientErr) {
          // ignore and try server preview endpoint next
        }

        // Ask backend to convert docx to sanitized HTML or PDF for preview
        const backendBase = process.env.REACT_APP_API_BASE_URL ? process.env.REACT_APP_API_BASE_URL.replace(/\/api\/?$/, '') : '';
        const encoded = encodeURIComponent(rawPath);
        const previewUrl = `${backendBase}/api/room-bookings/attachments/preview?path=${encoded}`;
        const resp = await fetch(previewUrl, { credentials: 'include' });
        if (!resp.ok) {
          // If backend refuses (401) or other error, throw to display fallback UI
          throw new Error(`Không thể lấy xem trước: ${resp.status}`);
        }

        // If backend returned something, inspect content-type and headers
        const contentType = resp.headers && resp.headers.get ? (resp.headers.get('content-type') || '') : '';
        const convHeader = resp.headers && resp.headers.get ? resp.headers.get('X-PDF-Conversion-Available') : null;
        if (convHeader === 'false') setPdfConversionAvailable(false);
        else if (convHeader === 'true') setPdfConversionAvailable(true);
        // If backend returned a PDF (we attempted LibreOffice conversion), render it as PDF
        if (contentType.includes('pdf') || contentType.includes('application/octet-stream')) {
          const blob = await resp.blob();
          if (aborted) return;
          try {
            const objUrl = window.URL.createObjectURL(blob);
            // revoke previous object URL if present
            setPdfObjectUrl(prev => {
              if (prev) {
                try { window.URL.revokeObjectURL(prev); } catch (e) {}
              }
              return objUrl;
            });
            // ensure docxHtml cleared
            setDocxHtml(null);
            return;
          } catch (e) {
            // continue to try HTML fallback
          }
        }

        let html = null;
        if (contentType.includes('text') || contentType.includes('html')) {
          html = await resp.text();
        } else if (contentType.includes('json')) {
          const j = await resp.json();
          html = typeof j === 'string' ? j : (j && (j.html || j.body || j.data)) || JSON.stringify(j);
        } else {
          // fallback: read as blob and get text
          const blob = await resp.blob();
          try { html = await blob.text(); } catch(e) { html = null; }
        }

        if (aborted) return;
        if (!html) throw new Error('Preview response empty');
        setDocxHtml(html);
      } catch (err) {
        if (aborted) return;
        console.error('Preview fetch error', err);
        setDocxError(String(err?.message || err));
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => { aborted = true; };
  }, [attachment, fileUrl, isDocx, rawPath]);

  useEffect(() => {
    let revoked = false;
    let createdObjUrl = null;
    // If PDF, fetch blob and create object URL so iframe can render even if backend sets attachment headers
    const doPdfFetch = async () => {
      if (!isPdf) return;
      try {
        setLoading(true);
        const resp = await fetch(fileUrl, { credentials: 'include' });
        if (!resp.ok) throw new Error(`Không thể lấy tệp: ${resp.status}`);
        const blob = await resp.blob();
        const objUrl = window.URL.createObjectURL(blob);
        if (revoked) return;
        createdObjUrl = objUrl;
        setPdfObjectUrl(objUrl);
      } catch (err) {
        console.error('PDF fetch error', err);
        // leave pdfObjectUrl null to trigger fallback
      } finally {
        if (!revoked) setLoading(false);
      }
    };
    doPdfFetch();
    return () => {
      revoked = true;
      if (createdObjUrl) {
        try { window.URL.revokeObjectURL(createdObjUrl); } catch (e) {}
        // clear state reference if it still matches
        setPdfObjectUrl(prev => (prev === createdObjUrl ? null : prev));
      }
    };
  }, [fileUrl, isPdf]);

  // ensure any pdf object URL created by preview is revoked on unmount or change
  useEffect(() => {
    return () => {
      try {
        if (pdfObjectUrl) window.URL.revokeObjectURL(pdfObjectUrl);
      } catch (e) {}
    };
  }, [pdfObjectUrl]);

  return (
    <ModalWrapper isOpen={!!attachment} onClose={onClose} maxWidth="max-w-6xl" coverHeader={true} className="p-0">
      <div className="bg-white rounded-lg shadow-xl w-full h-full max-h-[90vh] flex flex-col relative overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-slate-50">
          <h3 className="font-semibold text-slate-800 truncate pr-4">{decodeURIComponent(String(safeAttachment.file_name || 'Tệp đính kèm'))}</h3>
          <SmallButton variant="secondary" onClick={onClose} className="p-2 rounded-full">Đóng</SmallButton>
        </div>

        <div className="flex-grow p-2 overflow-auto flex items-center justify-center bg-slate-200">
          {isImage ? (
            <img src={fileUrl} alt={safeAttachment.file_name} className="max-w-full max-h-full object-contain" />
          ) : isPdf ? (
            loading && !pdfObjectUrl ? (
              <div className="flex items-center justify-center py-20"><Spinner /></div>
            ) : pdfObjectUrl ? (
              <iframe src={pdfObjectUrl} title={safeAttachment.file_name} className="w-full h-full" style={{ height: '80vh', border: 'none' }} />
            ) : (
              <iframe src={fileUrl} title={safeAttachment.file_name} className="w-full h-full" style={{ height: '80vh', border: 'none' }} />
            )
          ) : isDocx ? (
            <div className="w-full h-full overflow-auto p-2 bg-white rounded">
              {loading ? (
                <div className="flex items-center justify-center py-20"><Spinner /></div>
              ) : docxError ? (
                <div className="text-center">
                  <p className="text-lg text-slate-700">Không thể xem trước tệp .docx: {docxError}</p>
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block"><SmallButton variant="primary">Mở trong tab mới</SmallButton></a>
                </div>
              ) : docxHtml ? (
                    <div className="w-full h-full flex flex-col">
                      {/* If server-side PDF conversion wasn't available, inform user that HTML preview may differ */}
                      {!pdfConversionAvailable && (
                        <div className="bg-yellow-100 border-yellow-300 text-yellow-800 p-2 rounded mb-2 text-sm">
                          Xem trước PDF không khả dụng trên máy chủ; bản xem trước có thể khác so với Microsoft Word. <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="underline">Tải xuống</a>
                        </div>
                      )}
                      {/* Use an iframe with srcdoc to render converted HTML in isolation and preserve styles */}
                      <iframe title={safeAttachment.file_name} srcDoc={docxHtml} className="w-full h-full" style={{ height: '80vh', border: 'none' }} />
                    </div>
              ) : (
                <div className="text-center">
                  <p className="text-lg text-slate-700">Không có nội dung để hiển thị.</p>
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block"><SmallButton variant="primary">Mở trong tab mới</SmallButton></a>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center bg-white p-10 rounded-lg">
              <p className="text-lg text-slate-700">Không thể xem trước loại tệp này.</p>
              <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block"><SmallButton variant="primary">Mở trong tab mới</SmallButton></a>
            </div>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
};

export default AttachmentViewerModal;