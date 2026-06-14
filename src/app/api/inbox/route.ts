import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listInboxMessages } from '@/lib/gmail'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.provider_token) {
    return Response.json(
      { error: 'Not authenticated with Gmail. Please sign in again.' },
      { status: 401 }
    )
  }

  try {
    const maxResults = parseInt(
      request.nextUrl.searchParams.get('maxResults') ?? '20'
    )
    const messages = await listInboxMessages(session.provider_token, maxResults)
    return Response.json({ messages })
  } catch (error: any) {
    console.error('Failed to fetch inbox:', error)

    // If token expired, return 401 so client can prompt re-login
    if (error?.message?.includes('Token expired') || error?.status === 401) {
      return Response.json(
        { error: 'Gmail session expired. Please sign in again.' },
        { status: 401 }
      )
    }

    return Response.json(
      { error: 'Failed to fetch inbox. Please try again.' },
      { status: 500 }
    )
  }
}
