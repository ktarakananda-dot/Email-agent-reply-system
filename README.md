# Gmail AI Email Reply Agent

**Konapala Tarakananda** — M.Tech Artificial Intelligence @ IIT Patna · GATE CSE AIR 1475

---

A secure, human-in-the-loop RAG email assistant that drafts contextual replies using a vector knowledge base. **Emails are fetched live from Gmail (never mirrored) and no message is ever sent without explicit human approval.**

---

## Tech Stack

`Next.js` · `Supabase pgvector` · `Hugging Face all-MiniLM-L6-v2` · `Gemini 2.5` · `Gmail API`

---

## Workflow

1. **Authenticate** — Single-click Google OAuth login via Supabase Auth
2. **Browse Inbox** — Live fetch from Gmail Primary inbox (no database storage)
3. **Draft with RAG** — Embed incoming email → query vectorised course database → inject relevant context into the LLM prompt for grounded, hallucination-free replies
4. **Review & Send** — Editable AI draft → one-click Gmail API send → optional star-rating feedback

> **Security constraint:** Sending requires an explicit button click. No background jobs, no auto-responders, no scheduled sends.

---

## Quick Start

```bash
git clone https://github.com/ktarakananda-dot/Email-agent-reply-system.git
cd Email-agent-reply-system
npm install

# Create .env.local (see .env.example for all required variables)
cp .env.example .env.local

# Run the database schema against your Supabase SQL editor (database_schema.sql)
# Then seed the vector knowledge base
npm run seed:kb

# Start the dev server
npm run dev
```

Visit `http://localhost:3000` and sign in with Google.
