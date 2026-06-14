import { createClient } from '@/lib/supabase/server'
import { getMessageDetails } from '@/lib/gmail'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.provider_token) {
    return Response.json(
      { error: 'Not authenticated with Gmail. Please sign in again.' },
      { status: 401 }
    )
  }

  try {
    const message = await getMessageDetails(session.provider_token, messageId)
    return Response.json({ message })
  } catch (error: any) {
    console.error('Failed to fetch message:', error)

    if (error?.message?.includes('Token expired') || error?.status === 401) {
      return Response.json(
        { error: 'Gmail session expired. Please sign in again.' },
        { status: 401 }
      )
    }

    return Response.json(
      { error: 'Failed to fetch message details.' },
      { status: 500 }
    )
  }
}
