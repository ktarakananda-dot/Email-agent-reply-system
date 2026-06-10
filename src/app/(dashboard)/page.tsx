import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Inbox Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{user.email}</span>
          <form action="/auth/signout" method="post">
            <button className="btn btn-glass" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Sign out</button>
          </form>
        </div>
      </header>

      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p>This is the placeholder for the Inbox view (Phase 3).</p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>We will fetch emails from your primary inbox here.</p>
      </div>
    </div>
  )
}
