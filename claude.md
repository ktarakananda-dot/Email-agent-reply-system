# Gmail AI Email Reply Agent - Project Specification

## Overview
This project involves building an intelligent email reply agent for Gmail. The agent will fetch emails from the primary inbox and draft contextual replies using an LLM (OpenAI or Gemini API). It utilizes a Retrieval-Augmented Generation (RAG) architecture powered by a Supabase vector database to ensure replies accurately reference specific course and program information.

## Core Features & Requirements

### 1. Authentication & Gmail Integration
- **Google Login**: Implement authentication using Google Login to ensure that only the owner of the email account has access to the system.
- **Inbox Fetching**: Use the Gmail API to fetch all emails specifically from the primary inbox.

### 2. AI Reply Generation & RAG System
- **LLM Integration**: Use either the OpenAI API or Gemini API to craft email replies.
- **Knowledge Base (Vector Database)**:
  - Convert an existing knowledge base (provided as a CSV file in the working directory) into vector embeddings.
  - Store these embeddings in a Supabase vector database.
- **RAG Implementation**: When generating a reply, perform a similarity search (RAG) to fetch relevant course or program information from the vector database. The crafted reply must accurately refer to this retrieved document information.

### 3. Review & Approval Workflow (Human-in-the-loop)
- **No Autonomous Sending**: The system must **never** send an email automatically.
- **Editing Capabilities**: The user must have the ability to review and modify the AI-drafted email before it is sent.
- **One-Click Approval**: The user must explicitly approve the sending of the email via a single button click.

### 4. Data Storage, Tracking & Feedback (Supabase)
- **Draft Tracking**: Store both the original email drafted by the AI and the final version that the user actually sent (after any modifications).
- **Feedback Mechanism**: For every email replied to, provide the user with an option to give a star rating and textual feedback. Store this feedback in Supabase for future model/prompt improvements.

### 5. Infrastructure & Deployment
- **Frontend**: Deploy the frontend application on **Vercel**.
- **Backend**: If separate backend functions or services are required, deploy them on **Railway**.
- **Database**: Use **Supabase** for relational data, vector storage, and potentially authentication.

## Implementation Strategy
The implementation must happen in structured phases:
1. **Planning Phase**: First, outline a detailed implementation plan and ask the user for any specific preferences regarding UI/UX, tech stack nuances (e.g., Next.js vs React, specific LLM preference), and database schema.
2. **Execution Phases**: Only after the plan and preferences are approved should the execution begin, rolling out the project phase by phase.
