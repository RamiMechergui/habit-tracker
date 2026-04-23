import { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { Camera, X, Check, ZoomIn, ZoomOut } from 'lucide-react';
import { useHabits } from '../Store';

// Helper: draw the cropped area on a canvas and return a Blob
async function getCroppedBlob(imageSrc, croppedAreaPixels) {
  const image = await createImageBitmap(await (await fetch(imageSrc)).blob());
  const canvas = document.createElement('canvas');
  canvas.width = croppedAreaPixels.width;
  canvas.height = croppedAreaPixels.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height
  );
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
}

export default function AvatarUploader() {
  const { user, updateProfilePicture } = useHabits();
  const fileInputRef = useRef(null);
  const [rawSrc, setRawSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const avatarUrl = user?.profilePicture
    ? (user.profilePicture.startsWith('data:')
        ? user.profilePicture
        : `${user.profilePicture}?t=${Date.now()}`)
    : null;

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = () => setRawSrc(reader.result);
    reader.readAsDataURL(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  };

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setUploading(true);
    setError('');
    try {
      const blob = await getCroppedBlob(rawSrc, croppedAreaPixels);
      await updateProfilePicture(blob);
      setRawSrc(null);
    } catch (e) {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setRawSrc(null);
    setError('');
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  };

  return (
    <>
      {/* Avatar circle — click to open file picker */}
      <div
        className="avatar-wrapper"
        onClick={() => fileInputRef.current?.click()}
        title="Change profile picture"
        style={{
          position: 'relative',
          width: 52,
          height: 52,
          borderRadius: '50%',
          cursor: 'pointer',
          flexShrink: 0,
          overflow: 'hidden',
          border: '2px solid var(--accent-amber)',
          background: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Profile"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Camera size={22} style={{ color: 'var(--accent-amber)' }} />
        )}
        {/* Camera overlay on hover */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.2s',
          }}
          className="avatar-overlay"
        >
          <Camera size={16} style={{ color: '#fff' }} />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />

      {/* ── Crop Modal ── */}
      {rawSrc && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
          }}
        >
          <p style={{ color: '#fff', fontWeight: 600, fontSize: '1.1rem', margin: 0 }}>
            Crop your photo
          </p>

          {/* Cropper area */}
          <div
            style={{
              position: 'relative',
              width: 'min(90vw, 480px)',
              height: 'min(90vw, 480px)',
              borderRadius: '1rem',
              overflow: 'hidden',
              background: '#000',
            }}
          >
            <Cropper
              image={rawSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Zoom slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: 'min(90vw, 480px)' }}>
            <ZoomOut size={18} style={{ color: '#aaa' }} />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent-amber)' }}
            />
            <ZoomIn size={18} style={{ color: '#aaa' }} />
          </div>

          {error && (
            <p style={{ color: 'var(--color-bad)' }}>{error}</p>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleCancel}
              className="btn btn-secondary"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1.4rem', borderRadius: '0.5rem',
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              <X size={16} /> Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={uploading}
              className="btn"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1.4rem', borderRadius: '0.5rem',
                background: 'var(--accent-amber)', border: 'none',
                color: '#000', cursor: uploading ? 'wait' : 'pointer', fontWeight: 600,
              }}
            >
              <Check size={16} /> {uploading ? 'Uploading…' : 'Apply'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Inline style for avatar hover */}
      <style>{`
        .avatar-wrapper:hover .avatar-overlay { opacity: 1 !important; }
      `}</style>
    </>
  );
}
