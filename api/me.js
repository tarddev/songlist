import { readSessionFromCookies } from '../lib/session.js'

export default function handler(req, res) {
  const session = readSessionFromCookies(req.headers.cookie)
  return res.status(200).json({ authenticated: Boolean(session) })
}
