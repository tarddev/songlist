import { getSupabaseAdmin } from './supabase.js'

// Fetches a poll + its options. Lazily closes the poll if closes_at has passed.
// Returns null if not found.
export async function fetchPollWithOptions(pollId) {
  const supabase = getSupabaseAdmin()

  const { data: poll, error: pErr } = await supabase
    .from('polls')
    .select('id, question, created_at, closes_at, closed_at')
    .eq('id', pollId)
    .maybeSingle()
  if (pErr) throw pErr
  if (!poll) return null

  let closedAt = poll.closed_at
  if (closedAt === null && poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now()) {
    const { data: updated, error: uErr } = await supabase
      .from('polls')
      .update({ closed_at: poll.closes_at })
      .eq('id', poll.id)
      .is('closed_at', null)
      .select('closed_at')
      .maybeSingle()
    if (uErr) throw uErr
    if (updated?.closed_at) closedAt = updated.closed_at
  }

  const { data: options, error: oErr } = await supabase
    .from('poll_options')
    .select('option_index, song, artist, genre, mood, language, nominated_at')
    .eq('poll_id', poll.id)
    .order('option_index', { ascending: true })
  if (oErr) throw oErr

  return {
    id: poll.id,
    question: poll.question,
    createdAt: poll.created_at,
    closesAt: poll.closes_at,
    closedAt,
    isActive: closedAt === null,
    options: (options || []).map((o) => ({
      optionIndex: o.option_index,
      song: o.song,
      artist: o.artist,
      genre: o.genre,
      mood: o.mood,
      language: o.language,
      nominatedAt: o.nominated_at,
    })),
  }
}

export async function fetchTallies(pollId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('poll_votes')
    .select('option_index')
    .eq('poll_id', pollId)
  if (error) throw error
  const counts = {}
  for (const row of data || []) {
    counts[row.option_index] = (counts[row.option_index] || 0) + 1
  }
  return counts
}
