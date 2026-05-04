import { fetchPollWithOptions, fetchTallies } from '../../../lib/polls.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const id = req.query?.id
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Missing poll id' })
  }

  try {
    const poll = await fetchPollWithOptions(id)
    if (!poll) return res.status(404).json({ error: 'Poll not found' })
    const tallies = await fetchTallies(poll.id)
    return res.status(200).json({
      id: poll.id,
      isActive: poll.isActive,
      closedAt: poll.closedAt,
      tallies,
    })
  } catch (e) {
    console.error('results fetch error', e)
    return res.status(500).json({ error: 'Failed to load results' })
  }
}
