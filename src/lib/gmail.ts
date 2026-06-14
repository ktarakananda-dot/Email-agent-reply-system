import { google, gmail_v1 } from 'googleapis'

function createAuthClient(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return auth
}

function getGmailClient(accessToken: string): gmail_v1.Gmail {
  const auth = createAuthClient(accessToken)
  return google.gmail({ version: 'v1', auth })
}

function decodeBase64Url(data: string): string {
  // Base64URL -> Base64 -> UTF-8 string
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function extractBodyText(payload: gmail_v1.Schema$MessagePart): string {
  // If the part itself has body data and is text/plain
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  // If it's multipart, recurse into parts
  if (payload.parts) {
    // Prefer text/plain over text/html
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain')
    if (textPart) return extractBodyText(textPart)

    // Fallback to text/html
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html')
    if (htmlPart) return extractBodyText(htmlPart)

    // Recursively search deeper
    for (const part of payload.parts) {
      const text = extractBodyText(part)
      if (text) return text
    }
  }

  return ''
}

export interface InboxMessage {
  id: string
  threadId: string
  from: string
  subject: string
  snippet: string
  date: string
  labelIds: string[]
}

export interface FullMessage extends InboxMessage {
  to: string
  cc: string
  body: string
  bodyHtml?: string
  /** RFC 2822 Message-Id header for reply threading */
  rfcMessageId?: string
}

/**
 * Create a base64url-encoded RFC 2822 reply message.
 */
function createReplyMime(params: {
  to: string
  from: string
  subject: string
  body: string
  inReplyTo?: string
  references?: string
}): string {
  const subject = params.subject.toLowerCase().startsWith('re:')
    ? params.subject
    : `Re: ${params.subject}`

  const date = new Date().toUTCString()

  let headers = `From: ${params.from}\r\n` +
    `To: ${params.to}\r\n` +
    `Subject: ${subject}\r\n` +
    `Date: ${date}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n` +
    `Content-Transfer-Encoding: 8bit\r\n`

  if (params.inReplyTo) {
    headers += `In-Reply-To: ${params.inReplyTo}\r\n`
  }
  if (params.references) {
    headers += `References: ${params.references}\r\n`
  }

  const mime = headers + '\r\n' + params.body
  return Buffer.from(mime, 'utf-8').toString('base64url')
}

/**
 * Send a reply via the Gmail API.
 */
export async function sendReply(
  accessToken: string,
  params: {
    to: string
    from: string
    subject: string
    body: string
    threadId: string
    rfcMessageId?: string
  }
): Promise<{ id: string; threadId: string }> {
  const gmail = getGmailClient(accessToken)

  const raw = createReplyMime({
    to: params.to,
    from: params.from,
    subject: params.subject,
    body: params.body,
    inReplyTo: params.rfcMessageId,
    references: params.rfcMessageId,
  })

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw,
      threadId: params.threadId,
    },
  })

  return {
    id: response.data.id!,
    threadId: response.data.threadId!,
  }
}

/**
 * Fetch a list of messages from the Gmail Primary inbox.
 */
export async function listInboxMessages(
  accessToken: string,
  maxResults = 20
): Promise<InboxMessage[]> {
  const gmail = getGmailClient(accessToken)

  // List message IDs from Primary inbox
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    q: 'in:inbox category:primary',
    maxResults,
  })

  const messageIds = (listResponse.data.messages ?? []).filter(m => m.id)
  if (messageIds.length === 0) return []

  // Fetch metadata for each message in parallel
  const messages = await Promise.all(
    messageIds.map(msg =>
      gmail.users.messages
        .get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        })
        .then(res => res.data)
    )
  )

  return messages.map(msg => ({
    id: msg.id!,
    threadId: msg.threadId!,
    from: getHeader(msg.payload?.headers, 'from'),
    subject: getHeader(msg.payload?.headers, 'subject'),
    snippet: msg.snippet ?? '',
    date: getHeader(msg.payload?.headers, 'date'),
    labelIds: msg.labelIds ?? [],
  }))
}

/**
 * Fetch the full message including decoded body.
 */
export async function getMessageDetails(
  accessToken: string,
  messageId: string
): Promise<FullMessage> {
  const gmail = getGmailClient(accessToken)

  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  })

  const payload = msg.data.payload!
  const headers = payload.headers

  const body = extractBodyText(payload)

  // Also try to get HTML body for rich content
  let bodyHtml = ''
  if (payload.parts) {
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html')
    if (htmlPart) {
      const htmlData = htmlPart.body?.data
      if (htmlData) {
        bodyHtml = decodeBase64Url(htmlData)
      }
    }
  }

  return {
    id: msg.data.id!,
    threadId: msg.data.threadId!,
    from: getHeader(headers, 'from'),
    to: getHeader(headers, 'to'),
    cc: getHeader(headers, 'cc'),
    subject: getHeader(headers, 'subject'),
    snippet: msg.data.snippet ?? '',
    date: getHeader(headers, 'date'),
    labelIds: msg.data.labelIds ?? [],
    body,
    bodyHtml: bodyHtml || undefined,
    rfcMessageId: getHeader(headers, 'message-id') || undefined,
  }
}
