/**
 * JoinRoomModal.jsx
 *
 * Fixes:
 * 1. Removed `import React` — not needed with Vite's JSX transform.
 * 2. Accepts `loading` prop — App.jsx was passing it but the original signature
 *    `{ isOpen, onClose, onJoin }` silently dropped it. Without this:
 *    - The Join button never showed a loading state while joinRoom() was pending
 *    - The button was still clickable during the async operation, allowing
 *      multiple simultaneous joinRoom() calls on slow connections
 *    - The Close/Cancel buttons could close the modal mid-join
 * 3. Added disabled guards to all interactive elements when loading is true.
 * 4. isOpen prop logic is already correct — this component expects to be
 *    always mounted with isOpen controlling visibility (not conditional render).
 *    App.jsx has been fixed to match: it now passes isOpen={showJoinModal}
 *    instead of conditionally rendering without passing isOpen at all.
 */

import { useState, useEffect, useRef } from 'react';
import './JoinRoomModal.css';

export default function JoinRoomModal({ isOpen, onClose, onJoin, loading = false }) {
  const [roomCode, setRoomCode] = useState('');
  const [error,    setError]    = useState('');
  const inputRef                = useRef(null);

  // Focus input and reset state when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setRoomCode('');
    setError('');
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Close on Escape — guard loading so Escape can't abort a pending join
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, loading]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Return null after effects so they always have a chance to run their cleanup
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !loading) onClose();
  };

  const handleChange = (e) => {
    setError('');
    setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    const trimmed = roomCode.trim();
    if (!trimmed) {
      setError('Please enter a room code.');
      inputRef.current?.focus();
      return;
    }
    if (trimmed.length < 4) {
      setError('Room code must be at least 4 characters.');
      inputRef.current?.focus();
      return;
    }
    onJoin(trimmed);
  };

  return (
    <div
      className="modal-overlay animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={handleOverlayClick}
    >
      <div className="modal-card glass-card animate-scale-in">

        {/* Header */}
        <div className="modal-card__header">
          <div className="modal-card__icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path
                d="M11 2a9 9 0 100 18A9 9 0 0011 2zm0 1.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15zm-.75 3.75a.75.75 0 011.5 0v5.19l2.47 2.47a.75.75 0 01-1.06 1.06l-2.75-2.75a.75.75 0 01-.22-.53V7.25z"
                fill="url(#modalIconGrad)"
              />
              <defs>
                <linearGradient id="modalIconGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--grad-pink)" />
                  <stop offset="100%" stopColor="var(--grad-purple)" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div>
            <h2 className="modal-card__title" id="modal-title">Join a Room</h2>
            <p className="modal-card__subtitle">Enter the code your partner shared with you.</p>
          </div>

          <button
            className="modal-card__close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close modal"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M12.854 3.146a.5.5 0 010 .708L8.707 8l4.147 4.146a.5.5 0 01-.708.708L8 8.707l-4.146 4.147a.5.5 0 01-.708-.708L7.293 8 3.146 3.854a.5.5 0 01.708-.708L8 7.293l4.146-4.147a.5.5 0 01.708 0z" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form className="modal-card__form" onSubmit={handleSubmit} noValidate>
          <div className="modal-card__field">
            <label htmlFor="room-code-input" className="modal-card__label">
              Room Code
            </label>
            <input
              ref={inputRef}
              id="room-code-input"
              type="text"
              className={`modal-card__input${error ? ' modal-card__input--error' : ''}`}
              placeholder="e.g. AB12CD"
              value={roomCode}
              onChange={handleChange}
              maxLength={8}
              autoComplete="off"
              spellCheck="false"
              disabled={loading}
              aria-describedby={error ? 'room-code-error' : undefined}
              aria-invalid={!!error}
            />
            {error && (
              <p
                id="room-code-error"
                className="modal-card__error"
                role="alert"
                aria-live="polite"
              >
                {error}
              </p>
            )}
          </div>

          <div className="modal-card__actions">
            <button
              type="submit"
              className="btn-primary modal-card__btn-join"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <svg
                  className="modal-card__spinner"
                  width="15"
                  height="15"
                  viewBox="0 0 15 15"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="7.5" cy="7.5" r="5.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="24"
                    strokeDashoffset="8"
                  />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" aria-hidden="true">
                  <path d="M7.5 1a6.5 6.5 0 100 13A6.5 6.5 0 007.5 1zm0 1a5.5 5.5 0 110 11A5.5 5.5 0 017.5 2zm-.5 3a.5.5 0 011 0v3.293l1.646-1.647a.5.5 0 01.708.708l-2.5 2.5a.5.5 0 01-.708 0l-2.5-2.5a.5.5 0 01.708-.708L7 9.293V5z" />
                </svg>
              )}
              {loading ? "Joining…" : "Join Room"}
            </button>

            <button
              type="button"
              className="btn-ghost modal-card__btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}