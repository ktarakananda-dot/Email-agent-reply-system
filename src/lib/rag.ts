import { GoogleGenAI } from '@google/genai'
import { createAdminClient } from './supabase/admin'

/**
 * Embed a text string using Gemini embedding model and return the vector.
 */
async function embedQuery(text: string): Promise<number[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  const response = await ai.models.embedContent({
    model: 'gemini-embedding-2',
    contents: [{ parts: [{ text }] }],
    config: { outputDimensionality: 768 },
  })

  const values = response.embeddings?.[0]?.values
  if (!values) {
    throw new Error('No embedding returned from Gemini')
  }
  return values
}

interface RpcResult {
  id: string
  content: string
  metadata: Record<string, unknown>
  similarity: number
}

export interface RetrievedChunk {
  id: string
  content: string
  metadata: Record<string, unknown>
  similarity: number
}

/**
 * Retrieve the top-k most relevant knowledge chunks for a given email.
 * The email subject and body are combined to form the query.
 */
export async function retrieveRelevantChunks(
  subject: string,
  body: string,
  matchCount = 5
): Promise<RetrievedChunk[]> {
  // Build a query from the email content
  const query = `Subject: ${subject}\n\n${body}`

  // Embed the query
  const embedding = await embedQuery(query)

  // Search Supabase pgvector
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: embedding,
    match_count: matchCount,
  })

  if (error) {
    console.error('Error searching knowledge base:', error.message)
    throw new Error(`Failed to search knowledge base: ${error.message}`)
  }

  return ((data ?? []) as RpcResult[]).map((row) => ({
    id: row.id,
    content: row.content,
    metadata: row.metadata ?? {},
    similarity: row.similarity,
  }))
}
