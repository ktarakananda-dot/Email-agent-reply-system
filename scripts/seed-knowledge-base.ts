import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleGenAI } from '@google/genai'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import dotenv from 'dotenv'

// Load .env.local for local script execution
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

// ── Types ──────────────────────────────────────────────────────────────────

interface Course {
  name: string
  link: string
  description: string
  price: number
  startDate: string
  format: string
  lessons: number
  durationHours: number
  targetAudience: string
}

interface Chunk {
  content: string
  metadata: Record<string, unknown>
}

interface EmbeddingResult {
  content: string
  metadata: Record<string, unknown>
  embedding: number[]
}

// ── CSV Parser ─────────────────────────────────────────────────────────────

function parseCsvRow(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())
  return values
}

function parseCourses(csvPath: string): Course[] {
  const raw = readFileSync(csvPath, 'utf-8').trim()
  const lines = raw.split('\n')
  const headers = parseCsvRow(lines[0])

  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line)
    const course: Record<string, string> = {}
    headers.forEach((h, i) => {
      course[h.trim()] = values[i] ?? ''
    })
    return {
      name: course['Course Name'] ?? '',
      link: course['Course Link'] ?? '',
      description: course['Course Description'] ?? '',
      price: parseInt(course['Price'] ?? '0', 10),
      startDate: course['Starting Date'] ?? '',
      format: course['Whether it is live or self-paced'] ?? '',
      lessons: parseInt(course['Number of Lessons'] ?? '0', 10),
      durationHours: parseInt(course['Total Duration in Hours'] ?? '0', 10),
      targetAudience: course['Who the course is meant for'] ?? '',
    }
  })
}

// ── Chunking ───────────────────────────────────────────────────────────────

function createChunks(courses: Course[]): Chunk[] {
  return courses.map((c) => ({
    content: [
      `Course: ${c.name}`,
      `Description: ${c.description}`,
      `Price: ₹${c.price.toLocaleString('en-IN')}`,
      `Format: ${c.format}`,
      `Duration: ${c.durationHours} hours across ${c.lessons} lessons`,
      `Target Audience: ${c.targetAudience}`,
      `Starts: ${c.startDate}`,
    ].join('\n'),
    metadata: {
      course_name: c.name,
      course_link: c.link,
      price: c.price,
      format: c.format,
      lessons: c.lessons,
      duration_hours: c.durationHours,
      target_audience: c.targetAudience,
      start_date: c.startDate,
    },
  }))
}

// ── Embedding via Gemini API ──────────────────────────────────────────────

const BATCH_SIZE = 10

async function generateEmbeddings(chunks: Chunk[]): Promise<EmbeddingResult[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  const results: EmbeddingResult[] = []

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE)

    let attempt = 0
    const maxRetries = 5

    while (attempt < maxRetries) {
      try {
        console.log(`Embedding batch ${batchNum}/${totalBatches} (${batch.length} texts)...`)

        const response = await ai.models.embedContent({
          model: 'gemini-embedding-2',
          contents: batch.map((c) => ({
            parts: [{ text: c.content }],
          })),
          config: { outputDimensionality: 768 },
        })

        response.embeddings!.forEach((embedding, j) => {
          results.push({
            content: batch[j].content,
            metadata: batch[j].metadata,
            embedding: embedding.values ?? [],
          })
        })

        break // success, exit retry loop
      } catch (err: unknown) {
        attempt++
        const message = err instanceof Error ? err.message : String(err)

        // Check if it's a rate-limit (429) error
        if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
          // Try to parse the retry delay from the error message
          const retryMatch = message.match(/retry in ([\d.]+)s/i)
          const waitMs = retryMatch
            ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000
            : 60_000 // default 60s if no retry time found

          console.log(`  ⏳ Rate limited. Waiting ${Math.round(waitMs / 1000)}s before retry (attempt ${attempt}/${maxRetries})...`)
          await new Promise((r) => setTimeout(r, waitMs))
        } else {
          throw err // non-rate-limit error, bail out
        }
      }
    }

    if (attempt >= maxRetries) {
      console.error(`Failed to embed batch ${batchNum} after ${maxRetries} attempts`)
      throw new Error(`Rate limit persisted after ${maxRetries} retries`)
    }

    // Small delay between batches
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  return results
}

// ── Storage ────────────────────────────────────────────────────────────────

async function storeChunks(supabase: ReturnType<typeof createAdminClient>, embedded: EmbeddingResult[]) {
  console.log('Clearing existing knowledge base...')
  const { error: deleteError } = await supabase
    .from('knowledge_chunks')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (deleteError) {
    console.error('Error clearing knowledge_chunks:', deleteError.message)
    return
  }

  for (let i = 0; i < embedded.length; i += BATCH_SIZE) {
    const batch = embedded.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(embedded.length / BATCH_SIZE)
    console.log(`Inserting batch ${batchNum}/${totalBatches}...`)

    const { error } = await supabase.from('knowledge_chunks').insert(
      batch.map((e) => ({
        content: e.content,
        embedding: e.embedding,
        metadata: e.metadata,
      }))
    )

    if (error) {
      console.error(`Error inserting batch ${batchNum}:`, error.message)
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Starting Knowledge Base seed...\n')

  // 1. Parse CSV
  const csvPath = join(process.cwd(), 'vizuara_150_courses_dataset.csv')
  console.log('Reading CSV...')
  const courses = parseCourses(csvPath)
  console.log(`Found ${courses.length} courses\n`)

  // 2. Create chunks
  console.log('Creating chunks...')
  const chunks = createChunks(courses)
  console.log(`Created ${chunks.length} chunks\n`)

  // 3. Generate embeddings with Gemini
  console.log('Generating embeddings with Gemini gemini-embedding-2 (768d)...')
  const embedded = await generateEmbeddings(chunks)
  console.log(`Generated ${embedded.length} embeddings\n`)

  // 4. Store in Supabase
  const supabase = createAdminClient()
  console.log('Storing in Supabase pgvector...')
  await storeChunks(supabase, embedded)

  // 5. Verify
  const { count, error: countError } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('Error verifying:', countError.message)
  } else {
    console.log(`\n✅ Knowledge base seeded successfully! ${count} chunks stored.`)
  }
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
