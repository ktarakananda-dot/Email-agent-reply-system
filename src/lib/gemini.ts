import { GoogleGenAI } from '@google/genai'
import type { RetrievedChunk } from './rag'

/**
 * Generate a contextual email reply using Gemini 2.5 Flash,
 * grounded in the retrieved knowledge base chunks.
 */
export async function generateReply(
  emailFrom: string,
  emailSubject: string,
  emailBody: string,
  contextChunks: RetrievedChunk[]
): Promise<{ draft: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  // Build the knowledge context string
  const knowledgeContext = contextChunks
    .map(
      (chunk, i) =>
        `[Reference ${i + 1}]\n${chunk.content}\n`
    )
    .join('\n')

  const systemPrompt = `You are a helpful AI assistant that drafts email replies on behalf of the user. \
Your task is to write professional, concise, and accurate replies to incoming emails.

You have access to a knowledge base about Vizaura's courses. Use the provided references to \
answer questions accurately. If the email asks about courses, pricing, schedules, or other \
information covered in the references, use that information to provide a detailed and accurate \
response. If the email is about something not covered in the references, respond helpfully \
based on general knowledge.

Rules:
- Keep the tone professional and friendly.
- Do NOT mention that you are an AI or that you used references to generate the reply.
- Do NOT include placeholders like [Your Name] or [Company Name].
- Sign off naturally as if written directly by the user.
- Be concise but thorough — answer all questions raised in the incoming email.
- If you don't know something specific, suggest the user follow up rather than making up information.

Formatting rules (CRITICAL):
- Generate ONLY the raw email body text. Do NOT include a subject line in the body.
- Do NOT use any markdown formatting. No asterisks (* or **), no underscores, no backticks, no markdown headers, no markdown lists.
- Use plain text only. If you need a list, use plain numbers or dashes without any markdown symbols.
- Do not use bold, italic, or any special formatting characters.
- The entire reply should be clean, plain text suitable for sending as a raw email body.`

  const userPrompt = `Here is the email I received:

From: ${emailFrom}
Subject: ${emailSubject}

Body:
${emailBody}

${knowledgeContext ? `\nRelevant references from our knowledge base:\n\n${knowledgeContext}\n` : ''}

Please write a draft reply to this email.`

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: systemPrompt }],
      },
      {
        role: 'model',
        parts: [{ text: 'Understood. I will draft replies professionally using the provided knowledge when relevant. Send me the email and I will write the reply.' }],
      },
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    config: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  })

  const draft = response.text?.trim()
  if (!draft) {
    throw new Error('Gemini returned an empty response')
  }

  return { draft }
}
