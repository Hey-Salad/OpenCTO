import type { ChatMessageRecord, ChatSessionRecord, RequestContext } from './types'
import { BadRequestException, InternalServerException, NotFoundException, jsonResponse } from './errors'

type ChatRow = {
  id: string
  user_id: string
  title: string
  content_json: string
  created_at: string
  updated_at: string
}

let schemaReady = false

async function ensureSchema(ctx: RequestContext): Promise<void> {
  if (!ctx.env.DB) {
    throw new InternalServerException('D1 database binding is not configured for chat storage')
  }
  if (schemaReady) return
  await ctx.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run()
  await ctx.env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_chats_user_updated ON chats (user_id, updated_at DESC)',
  ).run()
  schemaReady = true
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeTitle(input: string | undefined, messages: ChatMessageRecord[]): string {
  const fromInput = (input ?? '').trim()
  if (fromInput) return fromInput.slice(0, 120)
  const firstUser = messages.find((m) => m.role === 'USER' && m.text.trim())
  if (firstUser) return firstUser.text.trim().slice(0, 120)
  return 'New chat'
}

function parseMessages(raw: string): ChatMessageRecord[] {
  try {
    const parsed = JSON.parse(raw) as ChatMessageRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// GET /api/v1/chats
export async function listChats(ctx: RequestContext): Promise<Response> {
  await ensureSchema(ctx)
  const result = await ctx.env.DB.prepare(
    'SELECT id, user_id, title, created_at, updated_at FROM chats WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100',
  ).bind(ctx.userId).all<{
    id: string
    user_id: string
    title: string
    created_at: string
    updated_at: string
  }>()

  return jsonResponse(
    (result.results ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  )
}

// GET /api/v1/chats/:id
export async function getChat(chatId: string, ctx: RequestContext): Promise<Response> {
  await ensureSchema(ctx)
  const row = await ctx.env.DB.prepare(
    'SELECT id, user_id, title, content_json, created_at, updated_at FROM chats WHERE id = ? AND user_id = ?',
  ).bind(chatId, ctx.userId).first<ChatRow>()

  if (!row) throw new NotFoundException('Chat not found')

  const record: ChatSessionRecord = {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    messages: parseMessages(row.content_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
  return jsonResponse(record)
}

// POST /api/v1/chats/save
export async function saveChat(
  payload: { id?: string; title?: string; messages?: ChatMessageRecord[] },
  ctx: RequestContext,
): Promise<Response> {
  await ensureSchema(ctx)

  const messages = Array.isArray(payload.messages) ? payload.messages : []
  if (messages.length === 0) throw new BadRequestException('messages are required')

  const id = (payload.id ?? '').trim() || crypto.randomUUID()
  const current = nowIso()
  const title = normalizeTitle(payload.title, messages)
  const contentJson = JSON.stringify(messages)

  await ctx.env.DB.prepare(
    `INSERT INTO chats (id, user_id, title, content_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       content_json = excluded.content_json,
       updated_at = excluded.updated_at
     WHERE chats.user_id = excluded.user_id`,
  ).bind(id, ctx.userId, title, contentJson, current, current).run()

  const saved: ChatSessionRecord = {
    id,
    userId: ctx.userId,
    title,
    messages,
    createdAt: current,
    updatedAt: current,
  }

  return jsonResponse(saved)
}
