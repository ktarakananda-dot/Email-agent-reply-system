'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const handleLogin = async () => {
    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send email profile'
        },
      })
      if (error) throw error
    } catch (error) {
      console.error('Error logging in:', error)
      setIsLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ padding: '3rem', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>Gmail AI Agent</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
          Sign in with your Google account to access your AI-powered inbox.
        </p>
        
        <button 
          onClick={handleLogin} 
          disabled={isLoading}
          className="btn btn-primary" 
          style={{ width: '100%', gap: '0.5rem' }}
        >
          {isLoading ? 'Connecting...' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  )
}
