import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

const CATEGORY_ICONS = [
  '🏠', '🛡️', '💡', '💧', '🔥', '🗑️', '♻️', '🌐', '🔧', '🏗️', '🍳',
  '⛽', '🔌', '🚇', '🚌', '🚆', '🛒', '🏡', '🍽️', '🍔', '☕', '🩺',
  '🦷', '👁️', '💊', '📋', '💉', '🏋️', '⚽', '🧘', '✂️', '🧴', '💄',
  '🧖', '👕', '👟', '💍', '🧹', '🍲', '🖼️', '☁️', '💻', '📺', '📚',
  '🎬', '🎮', '🎵', '✈️', '🏨', '🎢', '🚬', '💰', '💼', '📈', '🏘️',
  '💵', '🔄', '📊', '📦', '🎯', '🎨', '📷', '🐾', '🎁', '🎉', '🧩',
  '🍕', '🥗', '🥤', '🛁', '🏥', '🚗', '🚕', '🛵', '🚲', '⚡', '🎓',
  '📝', '🖥️', '📱', '🎤', '🏡', '🌿', '🌊', '🌞', '❄️', '🔑', '🏦',
];

export default function EmojiPickerPopover({ isOpen, onSelect, onClose, triggerRef }) {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ top: -9999, left: -9999 });
  const [visible, setVisible] = useState(false);

  const calculatePosition = useCallback(() => {
    if (!triggerRef?.current || !popoverRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverEl = popoverRef.current;
    const popoverRect = popoverEl.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const gap = 8;

    let top = triggerRect.bottom + gap;
    let left = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2;

    // Clamp horizontally
    if (left < 8) left = 8;
    if (left + popoverRect.width > viewportW - 8) left = viewportW - popoverRect.width - 8;

    // Flip above if not enough space below
    if (top + popoverRect.height > viewportH - 8) {
      top = triggerRect.top - popoverRect.height - gap;
    }

    // Never go off the top
    if (top < 8) top = 8;

    setPosition({ top, left });
    setVisible(true);
  }, [triggerRef]);

  useEffect(() => {
    if (isOpen) {
      setVisible(false);
      setPosition({ top: -9999, left: -9999 });
      // Double RAF: first frame mounts the element, second frame it is painted
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          calculatePosition();
        });
        return () => cancelAnimationFrame(raf2);
      });
      window.addEventListener('resize', calculatePosition);
      window.addEventListener('scroll', calculatePosition, true);
      return () => {
        cancelAnimationFrame(raf1);
        window.removeEventListener('resize', calculatePosition);
        window.removeEventListener('scroll', calculatePosition, true);
      };
    } else {
      setVisible(false);
    }
  }, [isOpen, calculatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        triggerRef?.current && !triggerRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const popover = (
    <div
      ref={popoverRef}
      className="emoji-picker-popover"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 99999,
        opacity: visible ? 1 : 0,
        animation: visible ? 'emojiPopoverIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards' : 'none',
        transformOrigin: 'top center',
        // Isolation prevents parent stacking context issues
        isolation: 'isolate',
      }}
    >
      <style>{`
        @keyframes emojiPopoverIn {
          from { opacity: 0; transform: scale(0.92) translateY(-6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .emoji-picker-popover {
          background: rgba(15, 23, 42, 0.96);
          backdrop-filter: blur(24px) saturate(1.4);
          -webkit-backdrop-filter: blur(24px) saturate(1.4);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 18px;
          padding: 10px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06) inset;
          box-sizing: border-box;
          overflow: hidden;
          width: 272px;
          max-height: 320px;
        }
        .emoji-picker-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
          overflow-y: auto;
          max-height: 296px;
        }
        .emoji-picker-grid::-webkit-scrollbar {
          width: 4px;
        }
        .emoji-picker-grid::-webkit-scrollbar-track {
          background: transparent;
        }
        .emoji-picker-grid::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.18);
          border-radius: 4px;
        }
        .emoji-picker-item {
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.15rem;
          border: none;
          background: transparent;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.16,1,0.3,1);
          position: relative;
        }
        .emoji-picker-item:hover {
          background: rgba(255,255,255,0.14);
          transform: scale(1.2);
          z-index: 1;
        }
        .emoji-picker-item:active {
          transform: scale(1.05);
        }
      `}</style>
      <div className="emoji-picker-grid">
        {CATEGORY_ICONS.map((icon, i) => (
          <button
            key={`${icon}-${i}`}
            type="button"
            className="emoji-picker-item"
            onClick={() => { onSelect(icon); onClose(); }}
            title={icon}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );

  // Portal to document.body: escapes any ancestor stacking context
  // (backdrop-filter on .glass-card creates a new stacking context that
  // would otherwise trap position:fixed children)
  return ReactDOM.createPortal(popover, document.body);
}
