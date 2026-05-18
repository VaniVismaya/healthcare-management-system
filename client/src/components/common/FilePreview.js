import React from 'react';

const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

const getPreviewUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiBase}/${String(path).replace(/^\/+/, '')}`;
};

const getExtension = (path) => {
  const clean = String(path || '').split('?')[0];
  const idx = clean.lastIndexOf('.');
  return idx >= 0 ? clean.slice(idx + 1).toLowerCase() : '';
};

export default function FilePreview({ path, label = 'Document', imageHeight = 120 }) {
  if (!path) return null;

  const url = getPreviewUrl(path);
  const ext = getExtension(path);
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext);

  return (
    <div style={{ marginTop: 8 }}>
      <div className="form-hint" style={{ marginBottom: 6 }}>
        Current {label}
      </div>
      {isImage ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={label}
            style={{
              width: 'auto',
              maxWidth: '100%',
              height: imageHeight,
              borderRadius: 12,
              objectFit: 'cover',
              border: '1px solid var(--border-color)',
            }}
          />
        </a>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="btn btn-outline btn-sm" href={url} target="_blank" rel="noreferrer">
            View {label}
          </a>
          <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer" download>
            Download
          </a>
        </div>
      )}
    </div>
  );
}
