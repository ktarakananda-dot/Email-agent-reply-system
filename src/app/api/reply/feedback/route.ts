import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return Response.json(
      { error: 'Not authenticated.' },
      { status: 401 }
    )
  }

  try {
    const { draftId, starRating, textFeedback } = await request.json()

    if (!draftId) {
      return Response.json(
        { error: 'draftId is required.' },
        { status: 400 }
      )
    }

    if (typeof starRating !== 'number' || starRating < 1 || starRating > 5) {
      return Response.json(
        { error: 'starRating must be a number between 1 and 5.' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const { error: insertError } = await admin
      .from('feedback')
      .insert({
        reply_draft_id: draftId,
        star_rating: starRating,
        text_feedback: textFeedback || null,
      })

    if (insertError) {
      console.error('Error storing feedback:', insertError.message)
      return Response.json(
        { error: 'Failed to store feedback.' },
        { status: 500 }
      )
    }

    return Response.json({ success: true })
  } catch (error: any) {
    console.error('Failed to submit feedback:', error)
    return Response.json(
      { error: 'Failed to submit feedback.' },
      { status: 500 }
    )
  }
}
