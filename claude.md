# Gmail AI Email Reply Agent — Project Specification

## Project Overview

Build an AI-powered email reply agent integrated with Gmail. The system fetches emails from the primary inbox, generates contextual replies using a RAG pipeline grounded in a Supabase vector knowledge base, and presents drafts to the user for review and one-click approval before sending.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js — deployed on **Vercel** |
| Backend | Next.js API Routes or serverless — deployed on **Railway** |
| Database | **Supabase** (PostgreSQL + pgvector) |
| Auth | **Google OAuth** (Supabase Auth or NextAuth.js) |
| Email | **Gmail API** |
| AI/LLM | **OpenAI** or **Gemini** (confirm with user) |
| Vector Search | **Supabase pgvector** |

---

## Core Features

### 1. Google Authentication
- Login via Google OAuth only.
- Only the Gmail account owner gets access.
- All routes are protected; redirect unauthenticated users to login.

### 2. Gmail Inbox Fetching
- Use Gmail API to fetch emails from the Primary inbox only.
- Store sender, subject, body, timestamp, and thread ID in Supabase.

### 3. RAG Knowledge Base
- Convert the existing CSV file in the project directory into vector embeddings.
- Store chunks and embeddings in Supabase using pgvector.
- On each reply, embed the incoming email and retrieve top-k relevant chunks.
- Inject retrieved context into the LLM prompt for grounded, accurate replies.

### 4. AI Reply Drafting
- Generate a draft reply using the retrieved context + original email.
- Display draft in an editable text area for user review.
- Store the AI draft in Supabase before sending.

### 5. Human Review & One-Click Send
- **NEVER send automatically.** A human must always approve.
- User can freely edit the AI draft.
- A single "Send" button triggers the Gmail API send call.
- Record both the AI draft and the final sent version in Supabase.

### 6. Feedback System
- After each sent reply, show a feedback prompt.
- User can give a 1-5 star rating and optional text comment.
- Store all feedback in Supabase for future improvements.

---

## Supabase Schema

```sql
-- Emails fetched from Gmail
emails (id, gmail_thread_id, sender, subject, body, received_at, status)

-- AI draft and final sent reply
reply_drafts (id, email_id, ai_draft, final_sent_reply, sent_at, was_modified)

-- User feedback per reply
feedback (id, reply_draft_id, star_rating, text_feedback, created_at)

-- Vectorized knowledge base
knowledge_chunks (id, content, embedding vector, metadata jsonb, created_at)
```

---

## Implementation Phases

> Always present the plan and confirm user preferences before starting each phase.

1. **Phase 1 — Setup & Auth**: Next.js init, Google OAuth, Supabase tables, Gmail API credentials.
2. **Phase 2 — Knowledge Base**: Parse CSV, generate embeddings, store in Supabase pgvector.
3. **Phase 3 — Email Fetching**: Gmail API integration, inbox dashboard UI.
4. **Phase 4 — RAG & Draft Generation**: Similarity search + LLM prompt + editable draft UI.
5. **Phase 5 — Review & Send**: One-click send flow, store final reply, update email status.
6. **Phase 6 — Feedback & Polish**: Feedback modal, error handling, loading states, UI polish.
7. **Phase 7 — Deployment**: Frontend to Vercel, backend to Railway, configure env variables.

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GMAIL_REDIRECT_URI=
OPENAI_API_KEY=
GEMINI_API_KEY=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

---

## Rules & Constraints

1. No autonomous email sending — ever.
2. Every AI reply must be grounded in the RAG knowledge base.
3. Store both AI draft and final sent reply in Supabase.
4. Execute in phases; confirm preferences with user before each phase.
5. Single-owner app — no multi-tenancy required.
