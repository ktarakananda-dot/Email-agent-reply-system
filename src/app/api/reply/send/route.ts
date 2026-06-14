import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReply } from '@/lib/gmail'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.provider_token) {
    return Response.json(
      { error: 'Not authenticated with Gmail. Please sign in again.' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { draftId, finalReply, to, subject, threadId, rfcMessageId, wasModified } = body

    if (!finalReply || !to || !threadId) {
      return Response.json(
        { error: 'Missing required fields: finalReply, to, and threadId are required.' },
        { status: 400 }
      )
    }

    // Get the user's email address from their session
    const userEmail = session.user.email
    if (!userEmail) {
      return Response.json(
        { error: 'Could not determine your email address.' },
        { status: 400 }
      )
    }

    // Send the reply via Gmail API
    const sent = await sendReply(session.provider_token, {
      to,
      from: userEmail,
      subject,
      body: finalReply,
      threadId,
      rfcMessageId,
    })

    // Update the draft record if we have a draftId
    if (draftId) {
      const admin = createAdminClient()
      const { error: updateError } = await admin
        .from('reply_drafts')
        .update({
          final_sent_reply: finalReply,
          sent_at: new Date().toISOString(),
          was_modified: wasModified,
        })
        .eq('id', draftId)

      if (updateError) {
        console.error('Error updating draft record:', updateError.message)
        // Non-fatal — the email was already sent
      }
    }

    return Response.json({
      success: true,
      messageId: sent.id,
      threadId: sent.threadId,
    })
  } catch (error: any) {
    console.error('Failed to send reply:', error)

    if (error?.message?.includes('Token expired') || error?.status === 401) {
      return Response.json(
        { error: 'Gmail session expired. Please sign in again.' },
        { status: 401 }
      )
    }

    // Extract meaningful error from Google API error responses
    const apiError = error?.errors?.[0]?.message
    return Response.json(
      { error: apiError || error.message || 'Failed to send reply.' },
      { status: 500 }
    )
  }
}
