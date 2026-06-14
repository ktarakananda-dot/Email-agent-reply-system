import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { retrieveRelevantChunks } from '@/lib/rag'
import { generateReply } from '@/lib/gemini'
import { getMessageDetails } from '@/lib/gmail'

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
    const { messageId } = await request.json()

    if (!messageId) {
      return Response.json(
        { error: 'messageId is required' },
        { status: 400 }
      )
    }

    // 1. Fetch full email from Gmail
    const email = await getMessageDetails(session.provider_token, messageId)

    // 2. Retrieve relevant knowledge chunks via RAG
    const chunks = await retrieveRelevantChunks(
      email.subject,
      email.body
    )

    // 3. Generate AI reply draft
    const { draft } = await generateReply(
      email.from,
      email.subject,
      email.body,
      chunks
    )

    // Build the full prompt context for transparency
    const knowledgeContext = chunks
      .map(
        (chunk, i) =>
          `[Reference ${i + 1}] (similarity: ${(chunk.similarity * 100).toFixed(1)}%)\n${chunk.content}\n`
      )
      .join('\n')

    const ragContext = {
      emailFrom: email.from,
      emailSubject: email.subject,
      emailBody: email.body,
      knowledgeChunks: chunks.map((c) => ({
        content: c.content,
        similarity: c.similarity,
        metadata: c.metadata,
      })),
      knowledgeContext,
      chunksUsed: chunks.length,
    }

    // 4. Store the draft in Supabase
    const admin = createAdminClient()
    const { data: draftRecord, error: insertError } = await admin
      .from('reply_drafts')
      .insert({
        gmail_message_id: messageId,
        gmail_thread_id: email.threadId,
        sender: email.from,
        subject: email.subject,
        ai_draft: draft,
        ai_provider: 'gemini',
        was_modified: false,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error storing draft:', insertError.message)
      // Non-fatal — still return the draft to the user
    }

    return Response.json({
      draft,
      draftId: draftRecord?.id ?? null,
      ragContext,
    })
  } catch (error: any) {
    console.error('Failed to generate draft:', error)

    if (error?.message?.includes('Token expired') || error?.status === 401) {
      return Response.json(
        { error: 'Gmail session expired. Please sign in again.' },
        { status: 401 }
      )
    }

    return Response.json(
      { error: error.message || 'Failed to generate reply draft.' },
      { status: 500 }
    )
  }
}
