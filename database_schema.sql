-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Fetched Gmail emails
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_thread_id TEXT UNIQUE NOT NULL,
  gmail_message_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  received_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'replied'))
);

-- AI drafts and final sent replies
CREATE TABLE reply_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  ai_draft TEXT,
  final_sent_reply TEXT,
  sent_at TIMESTAMPTZ,
  was_modified BOOLEAN DEFAULT FALSE,
  ai_provider TEXT CHECK (ai_provider IN ('openai', 'gemini')),
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

-- Vectorized knowledge base
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Similarity search function
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 5
) RETURNS TABLE (id UUID, content TEXT, metadata JSONB, similarity FLOAT)
LANGUAGE SQL STABLE AS $$
  SELECT id, content, metadata, 1 - (embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
