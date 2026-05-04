import { readSessionFromCookies } from '../lib/session.js'

export default async function handler(req, res) {
  const session = await readSessionFromCookies(req.headers.cookie)
  return res.status(200).json({ authenticated: Boolean(session) })
}
