'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import FeedbackModal from './FeedbackModal'

interface KnowledgeChunk {
  content: string
  similarity: number
  metadata: Record<string, unknown>
}

interface RagContext {
  emailFrom: string
  emailSubject: string
  emailBody: string
  knowledgeChunks: KnowledgeChunk[]
  knowledgeContext: string
  chunksUsed: number
}

interface InboxMessage {
  id: string
  threadId: string
  from: string
  subject: string
  snippet: string
  date: string
  labelIds: string[]
}

interface FullMessage extends InboxMessage {
  to: string
  cc: string
  body: string
  bodyHtml?: string
  rfcMessageId?: string
}

type ViewState = 'loading' | 'empty' | 'error' | 'loaded'

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getInitials(name: string): string {
  const parts = name.split(/[<>@]/).filter(Boolean)
  const display = parts[0]?.trim() || name
  const words = display.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return display.slice(0, 2).toUpperCase()
}

function getAvatarColor(name: string): string {
  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#f97316', '#6366f1',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function formatEmailHeader(name: string): string {
  // "John Doe <john@example.com>" or just "john@example.com"
  const match = name.match(/^([^<]+)\s*<([^>]+)>$/)
  if (match) {
    return `${match[1].trim()} <${match[2]}>`
  }
  return name
}

export default function InboxContent({ userEmail }: { userEmail: string }) {
  const [viewState, setViewState] = useState<ViewState>('loading')
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<FullMessage | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [draftLoading, setDraftLoading] = useState(false)
  const [aiDraft, setAiDraft] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [sendLoading, setSendLoading] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [originalDraft, setOriginalDraft] = useState<string | null>(null)
  const [ragContext, setRagContext] = useState<RagContext | null>(null)
  const [ragContextOpen, setRagContextOpen] = useState(false)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  const fetchInbox = useCallback(async () => {
    setViewState('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/inbox')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch inbox')
      }
      const data = await res.json()
      if (data.messages.length === 0) {
        setViewState('empty')
      } else {
        setMessages(data.messages)
        setViewState('loaded')
      }
    } catch (err: any) {
      setErrorMsg(err.message)
      setViewState('error')
    }
  }, [])

  useEffect(() => {
    fetchInbox()
  }, [fetchInbox])

  const abortRef = useRef<AbortController | null>(null)

  const selectMessage = async (id: string) => {
    // Abort any in-flight request to avoid race conditions
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSelectedId(id)
    setDetailLoading(true)
    setSelectedMessage(null)
    setAiDraft(null)
    setDraftId(null)
    setDraftError(null)
    setDraftLoading(false)
    setSendSuccess(false)
    setSendError(null)
    setOriginalDraft(null)
    setRagContext(null)
    setRagContextOpen(false)
    try {
      const res = await fetch(`/api/inbox/${id}`, { signal: controller.signal })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch message')
      }
      const data = await res.json()
      // Only update if this request wasn't aborted
      if (!controller.signal.aborted) {
        setSelectedMessage(data.message)
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      console.error('Failed to load message:', err)
    } finally {
      if (!controller.signal.aborted) {
        setDetailLoading(false)
      }
    }
  }

  const generateDraft = async () => {
    if (!selectedId) return
    setDraftLoading(true)
    setDraftError(null)
    setAiDraft(null)
    setDraftId(null)
    try {
      const res = await fetch('/api/reply/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: selectedId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate draft')
      }
      const data = await res.json()
      setAiDraft(data.draft)
      setOriginalDraft(data.draft)
      setDraftId(data.draftId)
      setRagContext(data.ragContext)
      setRagContextOpen(false)
      setSendSuccess(false)
      setSendError(null)
    } catch (err: any) {
      setDraftError(err.message)
    } finally {
      setDraftLoading(false)
    }
  }

  const handleSend = async () => {
    if (!aiDraft || !selectedMessage) return

    setSendLoading(true)
    setSendError(null)
    setSendSuccess(false)

    try {
      const wasModified = originalDraft !== null && aiDraft !== originalDraft

      const res = await fetch('/api/reply/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          finalReply: aiDraft,
          to: selectedMessage.from,
          subject: selectedMessage.subject,
          threadId: selectedMessage.threadId,
          rfcMessageId: selectedMessage.rfcMessageId,
          wasModified,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send reply')
      }

      setSendSuccess(true)
      setSuccessToast('Reply sent successfully!')
      setTimeout(() => setSuccessToast(null), 4000)
    } catch (err: any) {
      setSendError(err.message)
    } finally {
      setSendLoading(false)
    }
  }

  const handleFeedbackModalSubmit = async (rating: number, text: string) => {
    if (!draftId) return

    const res = await fetch('/api/reply/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId,
        starRating: rating,
        textFeedback: text.trim() || null,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to submit feedback')
    }
  }

  const handleFeedbackModalClose = () => {
    setSendSuccess(false)
    setAiDraft(null)
    setDraftId(null)
    setOriginalDraft(null)
    setRagContext(null)
    setRagContextOpen(false)
    setSelectedMessage(null)
    setSelectedId(null)
    fetchInbox()
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      maxHeight: '100vh',
      overflow: 'hidden',
    }}>
      {/* Top Bar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid var(--border-glass)',
        background: 'rgba(10, 10, 12, 0.95)',
        backdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
            Gmail AI Agent
          </h1>
          <button
            onClick={fetchInbox}
            disabled={viewState === 'loading'}
            className="btn btn-glass"
            style={{
              padding: '0.4rem 0.75rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              opacity: viewState === 'loading' ? 0.6 : 1,
            }}
            title="Refresh inbox"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: viewState === 'loading' ? 'spin 1s linear infinite' : 'none' }}>
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            Refresh
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{userEmail}</span>
          <form action="/auth/signout" method="post">
            <button className="btn btn-glass" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
      }}>
        {/* Left Pane — Email List */}
        <div style={{
          width: '42%',
          minWidth: '320px',
          borderRight: '1px solid var(--border-glass)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* View states */}
          {viewState === 'loading' && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{
                  padding: '1rem',
                  borderBottom: '1px solid var(--border-glass)',
                  opacity: 1 - i * 0.12,
                }}>
                  <div style={{
                    height: '12px',
                    width: '60%',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: '4px',
                    marginBottom: '0.6rem',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                  <div style={{
                    height: '10px',
                    width: '85%',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '4px',
                    marginBottom: '0.4rem',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    animationDelay: '0.2s',
                  }} />
                  <div style={{
                    height: '10px',
                    width: '45%',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '4px',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    animationDelay: '0.4s',
                  }} />
                </div>
              ))}
              <style>{`
                @keyframes pulse {
                  0%, 100% { opacity: 0.3; }
                  50% { opacity: 0.6; }
                }
              `}</style>
            </div>
          )}

          {viewState === 'empty' && (
            <div style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <p style={{ fontSize: '1rem' }}>Inbox is empty</p>
              <p style={{ fontSize: '0.85rem' }}>No emails found in your Primary inbox.</p>
            </div>
          )}

          {viewState === 'error' && (
            <div style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p style={{ color: 'var(--danger)', fontSize: '0.95rem' }}>{errorMsg}</p>
              <button onClick={fetchInbox} className="btn btn-glass" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                Try Again
              </button>
            </div>
          )}

          {viewState === 'loaded' && messages.map(msg => (
            <button
              key={msg.id}
              onClick={() => selectMessage(msg.id)}
              style={{
                display: 'flex',
                gap: '0.75rem',
                padding: '0.85rem 1rem',
                border: 'none',
                borderBottom: '1px solid var(--border-glass)',
                background: selectedId === msg.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                textAlign: 'left',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                transition: 'background 0.15s ease',
                borderLeft: selectedId === msg.id ? '3px solid var(--accent)' : '3px solid transparent',
              }}
              onMouseEnter={e => {
                if (selectedId !== msg.id) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                }
              }}
              onMouseLeave={e => {
                if (selectedId !== msg.id) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: getAvatarColor(msg.from),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#fff',
                flexShrink: 0,
              }}>
                {getInitials(msg.from)}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.2rem',
                }}>
                  <span style={{
                    fontWeight: selectedId === msg.id ? 600 : 500,
                    fontSize: '0.85rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {msg.from.split('<')[0].trim() || msg.from}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    flexShrink: 0,
                    marginLeft: '0.5rem',
                  }}>
                    {getTimeAgo(msg.date)}
                  </span>
                </div>
                <div style={{
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  marginBottom: '0.15rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: selectedId === msg.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}>
                  {msg.subject || '(No subject)'}
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {msg.snippet}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Right Pane — Email Detail */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {!selectedId && viewState !== 'loading' && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              gap: '1rem',
              padding: '2rem',
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <p style={{ fontSize: '1rem' }}>Select an email to view</p>
              <p style={{ fontSize: '0.85rem' }}>Choose a message from the inbox list</p>
            </div>
          )}

          {detailLoading && (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: '2px solid var(--border-glass)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}

          {selectedMessage && !detailLoading && (
            <div style={{ padding: '1.5rem 2rem' }}>
              {/* Subject */}
              <h2 style={{
                fontSize: '1.35rem',
                fontWeight: 600,
                marginBottom: '1.25rem',
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
              }}>
                {selectedMessage.subject || '(No subject)'}
              </h2>

              {/* From / To / Date */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '10px',
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
                border: '1px solid var(--border-glass)',
              }}>
                {[
                  { label: 'From', value: formatEmailHeader(selectedMessage.from) },
                  { label: 'To', value: formatEmailHeader(selectedMessage.to) },
                  ...(selectedMessage.cc ? [{ label: 'Cc', value: formatEmailHeader(selectedMessage.cc) }] : []),
                  { label: 'Date', value: new Date(selectedMessage.date).toLocaleString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })},
                ].map(row => (
                  <div key={row.label} style={{
                    display: 'flex',
                    gap: '0.75rem',
                    padding: '0.25rem 0',
                    fontSize: '0.85rem',
                  }}>
                    <span style={{
                      color: 'var(--text-secondary)',
                      minWidth: '40px',
                      fontWeight: 500,
                    }}>
                      {row.label}:
                    </span>
                    <span style={{
                      color: 'var(--text-primary)',
                      wordBreak: 'break-all',
                    }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Email Body */}
              <div style={{
                padding: '0.25rem 0',
                lineHeight: 1.7,
                fontSize: '0.95rem',
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {selectedMessage.body || (
                  <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    border: '1px dashed var(--border-glass)',
                    borderRadius: '10px',
                  }}>
                    <p>This email contains rich HTML content that cannot be displayed in plain text view.</p>
                    {selectedMessage.bodyHtml && (
                      <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        HTML content is available but not rendered for security.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* AI Reply Section */}
              <div style={{
                borderTop: '1px solid var(--border-glass)',
                paddingTop: '1.5rem',
                marginTop: '1.5rem',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}>
                    AI Reply
                  </h3>
                  {!draftLoading && !aiDraft && (
                    <button
                      onClick={generateDraft}
                      className="btn btn-primary"
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      Generate AI Reply
                    </button>
                  )}
                </div>

                {/* Draft Loading */}
                {draftLoading && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '2rem',
                    color: 'var(--text-secondary)',
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid var(--border-glass)',
                      borderTopColor: 'var(--accent)',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    <p style={{ fontSize: '0.9rem' }}>Generating AI reply with RAG context...</p>
                  </div>
                )}

                {/* Draft Error */}
                {draftError && (
                  <div style={{
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    color: 'var(--danger)',
                    fontSize: '0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                  }}>
                    <span>{draftError}</span>
                    <button onClick={generateDraft} className="btn btn-glass" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', flexShrink: 0 }}>
                      Retry
                    </button>
                  </div>
                )}

                {/* Draft Textarea */}
                {aiDraft !== null && !draftLoading && (
                  <div>
                    <textarea
                      className="input-glass"
                      value={aiDraft}
                      onChange={(e) => setAiDraft(e.target.value)}
                      rows={8}
                      style={{ fontFamily: 'inherit', fontSize: '0.9rem', lineHeight: 1.6, resize: 'vertical' }}
                    />
                    <div style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '0.5rem',
                      marginTop: '0.75rem',
                    }}>
                      <button
                        onClick={generateDraft}
                        disabled={draftLoading || sendLoading}
                        className="btn btn-glass"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      >
                        Regenerate
                      </button>
                      <button
                        onClick={handleSend}
                        disabled={sendLoading || sendSuccess}
                        className="btn btn-primary"
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          opacity: sendLoading || sendSuccess ? 0.6 : 1,
                        }}
                      >
                        {sendLoading ? (
                          <>
                            <div style={{
                              width: '14px',
                              height: '14px',
                              border: '2px solid rgba(255,255,255,0.3)',
                              borderTopColor: '#fff',
                              borderRadius: '50%',
                              animation: 'spin 0.8s linear infinite',
                            }} />
                            Sending...
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="22" y1="2" x2="11" y2="13"/>
                              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                            Send
                          </>
                        )}
                      </button>
                    </div>

                    {/* RAG Context Panel */}
                    {ragContext && (
                      <div style={{
                        marginTop: '1rem',
                        borderTop: '1px solid var(--border-glass)',
                        paddingTop: '0.75rem',
                      }}>
                        <button
                          onClick={() => setRagContextOpen(!ragContextOpen)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.25rem 0',
                            fontFamily: 'inherit',
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                              transition: 'transform 0.2s ease',
                              transform: ragContextOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                            }}
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          View RAG context ({ragContext.chunksUsed} chunks used)
                        </button>

                        {ragContextOpen && (
                          <div style={{
                            marginTop: '0.5rem',
                            background: 'rgba(0,0,0,0.15)',
                            borderRadius: '8px',
                            padding: '0.75rem 1rem',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            fontSize: '0.75rem',
                            lineHeight: 1.6,
                            color: 'var(--text-secondary)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: 'monospace',
                            animation: 'fadeIn 0.2s ease',
                          }}>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                              RAG Context Passed to LLM
                            </div>
                            <div style={{ marginBottom: '0.5rem', opacity: 0.7 }}>
                              From: {ragContext.emailFrom}
                            </div>
                            <div style={{ marginBottom: '0.5rem', opacity: 0.7 }}>
                              Subject: {ragContext.emailSubject}
                            </div>
                            <div style={{ opacity: 0.7 }}>
                              {ragContext.knowledgeContext}
                            </div>
                            <style>{`
                              @keyframes fadeIn {
                                from { opacity: 0; transform: translateY(-4px); }
                                to { opacity: 1; transform: translateY(0); }
                              }
                            `}</style>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Send Error */}
                    {sendError && (
                      <div style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem 1rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        color: 'var(--danger)',
                        fontSize: '0.85rem',
                      }}>
                        {sendError}
                      </div>
                    )}


                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 1001,
            background: 'rgba(16, 185, 129, 0.15)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '10px',
            padding: '0.75rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            color: 'var(--success)',
            fontSize: '0.9rem',
            fontWeight: 500,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            animation: 'toastSlideIn 0.3s ease',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          {successToast}
          <style>{`
            @keyframes toastSlideIn {
              from { opacity: 0; transform: translateX(20px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>
        </div>
      )}

      {/* Feedback Modal */}
      {sendSuccess && draftId && (
        <FeedbackModal
          draftId={draftId}
          onSubmit={handleFeedbackModalSubmit}
          onClose={handleFeedbackModalClose}
        />
      )}
    </div>
  )
}
