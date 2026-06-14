'use client'

import { useState } from 'react'

interface FeedbackModalProps {
  draftId: string
  onClose: () => void
  onSubmit: (rating: number, text: string) => Promise<void>
}

export default function FeedbackModal({ draftId, onSubmit, onClose }: FeedbackModalProps) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) return
    setSubmitting(true)
    try {
      await onSubmit(rating, text.trim())
      setSubmitted(true)
      // Brief success state, then close
      setTimeout(() => onClose(), 800)
    } catch {
      setSubmitting(false)
    }
  }

  const handleSkip = () => {
    onClose()
  }

  // Success state inside the modal before closing
  if (submitted) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          animation: 'feedbackFadeIn 0.2s ease',
        }}
      >
        <div
          style={{
            background: 'var(--surface-glass)',
            border: '1px solid var(--border-glass)',
            borderRadius: '16px',
            padding: '2.5rem 3rem',
            textAlign: 'center',
            animation: 'feedbackScaleIn 0.25s ease',
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--success)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: '1rem' }}
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--success)' }}>
            Thanks for your feedback!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        animation: 'feedbackFadeIn 0.2s ease',
      }}
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) handleSkip()
      }}
    >
      <div
        style={{
          background: 'var(--surface-glass)',
          border: '1px solid var(--border-glass)',
          borderRadius: '16px',
          padding: '2rem 2.25rem',
          maxWidth: '420px',
          width: '90%',
          animation: 'feedbackScaleIn 0.25s ease',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
          }}
        >
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Rate this AI reply
          </h3>
          <button
            onClick={handleSkip}
            disabled={submitting}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Skip"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Prompt */}
        <p
          style={{
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            marginBottom: '1rem',
            lineHeight: 1.5,
          }}
        >
          How well did the AI capture the course details and context from your knowledge base?
        </p>

        {/* Star Rating */}
        <div
          style={{
            display: 'flex',
            gap: '0.4rem',
            justifyContent: 'center',
            marginBottom: '1.25rem',
          }}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = star <= (hover || rating)
            return (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                disabled={submitting}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: submitting ? 'default' : 'pointer',
                  padding: '4px',
                  transition: 'transform 0.15s ease',
                  transform: filled ? 'scale(1.15)' : 'scale(1)',
                  opacity: submitting ? 0.6 : 1,
                }}
                title={`${star} star${star > 1 ? 's' : ''}`}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill={filled ? '#f59e0b' : 'none'}
                  stroke={filled ? '#f59e0b' : 'var(--text-secondary)'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transition: 'fill 0.15s ease, stroke 0.15s ease',
                  }}
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            )
          })}
        </div>

        {/* Text area — appears once a star is selected */}
        {rating > 0 && (
          <div style={{ animation: 'feedbackSlideIn 0.2s ease' }}>
            <textarea
              placeholder="Any additional feedback? (optional)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              disabled={submitting}
              className="input-glass"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                fontSize: '0.85rem',
                lineHeight: 1.5,
                resize: 'none',
                marginBottom: '1rem',
              }}
            />

            {/* Buttons */}
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={handleSkip}
                disabled={submitting}
                className="btn btn-glass"
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                }}
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn btn-primary"
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? (
                  <>
                    <div
                      style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff',
                        borderRadius: '50%',
                        animation: 'feedbackSpin 0.8s linear infinite',
                      }}
                    />
                    Submitting...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Empty state when no star is selected yet — still show skip */}
        {rating === 0 && (
          <div style={{ textAlign: 'right' }}>
            <button
              onClick={handleSkip}
              className="btn btn-glass"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              Skip
            </button>
          </div>
        )}

        {/* Animations */}
        <style>{`
          @keyframes feedbackFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes feedbackScaleIn {
            from { opacity: 0; transform: scale(0.92); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes feedbackSlideIn {
            from { opacity: 0; transform: translateY(-6px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes feedbackSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}
