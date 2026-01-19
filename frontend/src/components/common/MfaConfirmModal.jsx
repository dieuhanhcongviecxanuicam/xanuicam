import React, { useState } from 'react'
import ModalWrapper from './ModalWrapper'

export default function MfaConfirmModal ({ isOpen, onClose, onConfirm, title = 'Xác thực MFA' }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const handleConfirm = async () => {
    if (!code || code.trim().length === 0) return alert('Vui lòng nhập mã Authenticator')
    setBusy(true)
    try {
      await onConfirm(code.trim())
      onClose()
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Lỗi xác thực')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">Mã Authenticator</label>
        <input
          className="mt-1 block w-full border rounded p-2"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="6 chữ số"
          inputMode="numeric"
          maxLength={6}
          disabled={busy}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <button className="btn btn-secondary mr-2" onClick={onClose} disabled={busy}>Hủy</button>
        <button className="btn btn-primary" onClick={handleConfirm} disabled={busy}>Xác nhận</button>
      </div>
    </ModalWrapper>
  )
}
