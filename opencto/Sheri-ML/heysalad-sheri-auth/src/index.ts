/**
 * HeySalad Sheri ML Authentication Service
 *
 * Endpoints:
 * - POST /auth/register - Register new user
 * - POST /auth/login - Login and get token
 * - GET /auth/me - Get current user info
 * - POST /auth/logout - Logout (invalidate token)
 * - POST /auth/token/generate - Generate new API token
 * - POST /auth/token/revoke - Revoke API token
 */

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  TOKEN_EXPIRY_DAYS: string;
}

// Types
interface User {
  id: string;
  email: string;
  plan: 'free' | 'pro' | 'enterprise';
  created_at: number;
}

interface AuthToken {
  token: string;
  user_id: string;
  expires_at: number;
}

// Utility functions
function generateId(): string {
  return crypto.randomUUID();
}

function generateToken(): string {
  // Generate hsa_<32-hex-chars> token
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `hsa_${hex}`;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function errorResponse(message: string, status: number = 400): Response {
  return jsonResponse({ error: message }, status);
}

function isJsWhitespace(char: string): boolean {
  switch (char) {
    case ' ':
    case '\f':
    case '\n':
    case '\r':
    case '\t':
    case '\v':
    case '\u00a0':
    case '\u1680':
    case '\u2028':
    case '\u2029':
    case '\u202f':
    case '\u205f':
    case '\u3000':
    case '\ufeff':
      return true;
    default:
      return char >= '\u2000' && char <= '\u200a';
  }
}

// Same acceptance as ^[^\s@]+@[^\s@]+\.[^\s@]+$ without polynomial backtracking.
function isPlausibleEmail(email: string): boolean {
  const at = email.indexOf('@');
  if (at <= 0 || email.indexOf('@', at + 1) !== -1) return false;
  for (let i = 0; i < email.length; i++) {
    if (isJsWhitespace(email[i])) return false;
  }
  const domain = email.slice(at + 1);
  for (let i = 1; i < domain.length - 1; i++) {
    if (domain.charCodeAt(i) === 46) return true;
  }
  return false;
}

// Route handlers
async function handleRegister(request: Request, env: Env): Promise<Response> {
  try {
    const { email, password } = await request.json() as { email: string; password: string };

    if (!email || !password) {
      return errorResponse('Email and password required', 400);
    }

    // Validate email format without a backtracking regular expression.
    if (!isPlausibleEmail(email)) {
      return errorResponse('Invalid email format', 400);
    }

    // Check if user exists
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      return errorResponse('User already exists', 409);
    }

    // Create user
    const userId = generateId();
    const passwordHash = await hashPassword(password);

    await env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, plan) VALUES (?, ?, ?, ?)'
    ).bind(userId, email, passwordHash, 'free').run();

    // Generate token
    const token = generateToken();
    const expiryDays = parseInt(env.TOKEN_EXPIRY_DAYS || '90');
    const expiresAt = Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60);

    await env.DB.prepare(
      'INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(token, userId, expiresAt).run();

    return jsonResponse({
      user: {
        id: userId,
        email,
        plan: 'free',
      },
      token,
      expires_at: expiresAt,
    }, 201);
  } catch (error: any) {
    console.error('Register error:', error);
    return errorResponse('Internal server error', 500);
  }
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    const { email, password } = await request.json() as { email: string; password: string };

    if (!email || !password) {
      return errorResponse('Email and password required', 400);
    }

    // Get user
    const user = await env.DB.prepare(
      'SELECT id, email, password_hash, plan FROM users WHERE email = ?'
    ).bind(email).first() as any;

    if (!user) {
      return errorResponse('Invalid credentials', 401);
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return errorResponse('Invalid credentials', 401);
    }

    // Generate new token
    const token = generateToken();
    const expiryDays = parseInt(env.TOKEN_EXPIRY_DAYS || '90');
    const expiresAt = Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60);

    await env.DB.prepare(
      'INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(token, user.id, expiresAt).run();

    return jsonResponse({
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
      },
      token,
      expires_at: expiresAt,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return errorResponse('Internal server error', 500);
  }
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Authorization header required', 401);
    }

    const token = authHeader.substring(7);

    // Validate token
    const tokenData = await env.DB.prepare(
      'SELECT user_id, expires_at FROM auth_tokens WHERE token = ?'
    ).bind(token).first() as any;

    if (!tokenData) {
      return errorResponse('Invalid token', 401);
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (tokenData.expires_at < now) {
      return errorResponse('Token expired', 401);
    }

    // Update last_used_at
    await env.DB.prepare(
      'UPDATE auth_tokens SET last_used_at = ? WHERE token = ?'
    ).bind(now, token).run();

    // Get user
    const user = await env.DB.prepare(
      'SELECT id, email, plan, created_at FROM users WHERE id = ?'
    ).bind(tokenData.user_id).first() as any;

    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Get today's usage
    const today = new Date().toISOString().split('T')[0];
    const usage = await env.DB.prepare(
      'SELECT requests, tokens_used FROM usage WHERE user_id = ? AND date = ?'
    ).bind(user.id, today).first() as any;

    // Plan limits
    const limits = {
      free: { requests: 100, tokens: 50000 },
      pro: { requests: 2000, tokens: 500000 },
      enterprise: { requests: -1, tokens: -1 }, // unlimited
    };

    return jsonResponse({
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        created_at: user.created_at,
      },
      usage: {
        today: {
          requests: usage?.requests || 0,
          tokens: usage?.tokens_used || 0,
        },
        limits: limits[user.plan as keyof typeof limits],
      },
    });
  } catch (error: any) {
    console.error('Me error:', error);
    return errorResponse('Internal server error', 500);
  }
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Authorization header required', 401);
    }

    const token = authHeader.substring(7);

    // Delete token
    await env.DB.prepare(
      'DELETE FROM auth_tokens WHERE token = ?'
    ).bind(token).run();

    return jsonResponse({ message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout error:', error);
    return errorResponse('Internal server error', 500);
  }
}

async function handleGenerateToken(request: Request, env: Env): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Authorization header required', 401);
    }

    const currentToken = authHeader.substring(7);

    // Get user from current token
    const tokenData = await env.DB.prepare(
      'SELECT user_id, expires_at FROM auth_tokens WHERE token = ?'
    ).bind(currentToken).first() as any;

    if (!tokenData) {
      return errorResponse('Invalid token', 401);
    }

    const now = Math.floor(Date.now() / 1000);
    if (tokenData.expires_at < now) {
      return errorResponse('Token expired', 401);
    }

    // Generate new token
    const newToken = generateToken();
    const expiryDays = parseInt(env.TOKEN_EXPIRY_DAYS || '90');
    const expiresAt = Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60);

    await env.DB.prepare(
      'INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(newToken, tokenData.user_id, expiresAt).run();

    return jsonResponse({
      token: newToken,
      expires_at: expiresAt,
      message: 'New token generated successfully',
    });
  } catch (error: any) {
    console.error('Generate token error:', error);
    return errorResponse('Internal server error', 500);
  }
}

async function handleRevokeToken(request: Request, env: Env): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Authorization header required', 401);
    }

    const currentToken = authHeader.substring(7);
    const { token } = await request.json() as { token: string };

    if (!token) {
      return errorResponse('Token to revoke required', 400);
    }

    // Verify current token belongs to user
    const currentTokenData = await env.DB.prepare(
      'SELECT user_id FROM auth_tokens WHERE token = ?'
    ).bind(currentToken).first() as any;

    if (!currentTokenData) {
      return errorResponse('Invalid token', 401);
    }

    // Verify token to revoke belongs to same user
    const revokeTokenData = await env.DB.prepare(
      'SELECT user_id FROM auth_tokens WHERE token = ?'
    ).bind(token).first() as any;

    if (!revokeTokenData || revokeTokenData.user_id !== currentTokenData.user_id) {
      return errorResponse('Token not found or unauthorized', 403);
    }

    // Delete token
    await env.DB.prepare(
      'DELETE FROM auth_tokens WHERE token = ?'
    ).bind(token).run();

    return jsonResponse({ message: 'Token revoked successfully' });
  } catch (error: any) {
    console.error('Revoke token error:', error);
    return errorResponse('Internal server error', 500);
  }
}

async function handleListTokens(request: Request, env: Env): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Authorization header required', 401);
    }

    const currentToken = authHeader.substring(7);

    // Get user from current token
    const tokenData = await env.DB.prepare(
      'SELECT user_id, expires_at FROM auth_tokens WHERE token = ?'
    ).bind(currentToken).first() as any;

    if (!tokenData) {
      return errorResponse('Invalid token', 401);
    }

    const now = Math.floor(Date.now() / 1000);
    if (tokenData.expires_at < now) {
      return errorResponse('Token expired', 401);
    }

    // Get all tokens for user
    const tokens = await env.DB.prepare(
      'SELECT token, created_at, expires_at, last_used_at FROM auth_tokens WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(tokenData.user_id).all();

    return jsonResponse({
      tokens: tokens.results?.map((t: any) => ({
        token: t.token,
        created_at: t.created_at,
        expires_at: t.expires_at,
        last_used_at: t.last_used_at,
        is_current: t.token === currentToken,
        is_expired: t.expires_at < now,
      })) || [],
    });
  } catch (error: any) {
    console.error('List tokens error:', error);
    return errorResponse('Internal server error', 500);
  }
}

async function handleHealth(): Promise<Response> {
  return jsonResponse({ status: 'ok', service: 'heysalad-sheri-auth' });
}

async function handleMigrate(env: Env): Promise<Response> {
  try {
    // Create tables if they don't exist
    const migrations = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )`,
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
      `CREATE TABLE IF NOT EXISTS auth_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        last_used_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON auth_tokens(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tokens_expires_at ON auth_tokens(expires_at)`,
      `CREATE TABLE IF NOT EXISTS usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        requests INTEGER DEFAULT 0,
        tokens_used INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, date)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_usage_user_date ON usage(user_id, date)`,
      `CREATE INDEX IF NOT EXISTS idx_usage_date ON usage(date)`,
    ];

    const results = [];
    for (const sql of migrations) {
      try {
        await env.DB.prepare(sql).run();
        results.push({ sql: sql.substring(0, 50) + '...', success: true });
      } catch (error: any) {
        results.push({ sql: sql.substring(0, 50) + '...', success: false, error: error.message });
      }
    }

    return jsonResponse({
      message: 'Migrations completed',
      results,
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return errorResponse('Migration failed: ' + error.message, 500);
  }
}

// Main handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Health check
    if (url.pathname === '/health' || url.pathname === '/') {
      return handleHealth();
    }

    // Migration endpoint (POST to prevent accidental runs)
    if (url.pathname === '/migrate' && request.method === 'POST') {
      return handleMigrate(env);
    }

    // Route handlers
    if (url.pathname === '/auth/register' && request.method === 'POST') {
      return handleRegister(request, env);
    }

    if (url.pathname === '/auth/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }

    if (url.pathname === '/auth/me' && request.method === 'GET') {
      return handleMe(request, env);
    }

    if (url.pathname === '/auth/logout' && request.method === 'POST') {
      return handleLogout(request, env);
    }

    if (url.pathname === '/auth/token/generate' && request.method === 'POST') {
      return handleGenerateToken(request, env);
    }

    if (url.pathname === '/auth/token/revoke' && request.method === 'POST') {
      return handleRevokeToken(request, env);
    }

    if (url.pathname === '/auth/tokens' && request.method === 'GET') {
      return handleListTokens(request, env);
    }

    return errorResponse('Not found', 404);
  },
};
