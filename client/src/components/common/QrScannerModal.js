import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QrScannerModal({ open, onClose, onScan }) {
  const scannerRef = useRef(null);
  const stoppingRef = useRef(false);
  const mountedRef = useRef(true);
  const [error, setError] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    if (!open) return;
    let active = true;
    const html5QrCode = new Html5Qrcode('qr-reader');
    scannerRef.current = html5QrCode;
    setError('');
    stoppingRef.current = false;
    const safeStop = async () => {
      try {
        await html5QrCode.stop();
      } catch {
        // Ignore stop errors when the scanner is already stopped or not yet running.
      }
    };

    html5QrCode
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (!active) return;
          active = false;
          stoppingRef.current = true;
          safeStop().finally(() => {
            stoppingRef.current = false;
          });
          onScan(decodedText);
        },
        () => {}
      )
      .catch((err) => {
        if (mountedRef.current) {
          setError(err?.message || 'Camera access failed');
        }
      });

    return () => {
      active = false;
      mountedRef.current = false;
      const safeClear = async () => {
        try {
          if (!stoppingRef.current) {
            stoppingRef.current = true;
            await safeStop();
            stoppingRef.current = false;
          }
        } finally {
          try {
            await html5QrCode.clear?.();
          } catch {
            // ignore clear errors
          }
        }
      };
      safeClear();
    };
  }, [open, onScan]);

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Scan Patient QR</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>X</button>
        </div>
        <div className="modal-body">
          <div id="qr-reader" style={{ width: '100%' }} />
          {error && <div style={{ color: 'var(--danger)', marginTop: 10 }}>{error}</div>}
          {!error && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
              Point the camera at the patient QR code to check them in.
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
