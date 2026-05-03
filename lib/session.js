import crypto from 'node:crypto'

const COOKIE_NAME = 'site_session'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function getSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')
  return secret
}

export function signSession(payload = {}) {
  const body = { ...payload, exp: Date.now() + MAX_AGE_MS }
  const data = Buffer.from(JSON.stringify(body)).toString('base64url')
  const sig = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifySession(token) {
  if (!token) return null
  const [data, sig] = token.split('.')
  if (!data || !sig) return null
  const expected = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length) return null
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
    if (!payload.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function buildSetCookie(token) {
  const attrs = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`,
  ]
  if (process.env.NODE_ENV === 'production') attrs.push('Secure')
  return attrs.join('; ')
}

export function buildClearCookie() {
  const attrs = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ]
  if (process.env.NODE_ENV === 'production') attrs.push('Secure')
  return attrs.join('; ')
}

export function readSessionFromCookies(cookieHeader) {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').map((c) => c.trim())
  const target = cookies.find((c) => c.startsWith(`${COOKIE_NAME}=`))
  if (!target) return null
  return verifySession(target.slice(COOKIE_NAME.length + 1))
}
