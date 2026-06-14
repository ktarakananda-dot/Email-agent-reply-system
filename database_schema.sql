-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Reply drafts with embedded email reference (only created when a reply is drafted)
-- Emails are fetched live from the Gmail API — no bulk inbox mirror in Supabase.
CREATE TABLE reply_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT,
  sender TEXT NOT NULL,
  subject TEXT,
  ai_draft TEXT,
  final_sent_reply TEXT,
  sent_at TIMESTAMPTZ,
  was_modified BOOLEAN DEFAULT FALSE,
  ai_provider TEXT CHECK (ai_provider IN ('openai', 'gemini', 'huggingface')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User feedback per reply
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_draft_id UUID REFERENCES reply_drafts(id) ON DELETE CASCADE,
  star_rating INT CHECK (star_rating BETWEEN 1 AND 5),
  text_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vectorized knowledge base (from CSV course data)
-- Uses Google gemini-embedding-2 → 768-dimensional vectors
DROP TABLE IF EXISTS knowledge_chunks CASCADE;
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding VECTOR(768),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Similarity search function
DROP FUNCTION IF EXISTS match_knowledge_chunks(VECTOR(768), INT);
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding VECTOR(768),
  match_count INT DEFAULT 5
) RETURNS TABLE (id UUID, content TEXT, metadata JSONB, similarity FLOAT)
LANGUAGE SQL STABLE AS $$
  SELECT id, content, metadata, 1 - (embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
