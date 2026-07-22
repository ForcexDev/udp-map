export type VoteValue = 1 | -1

export interface VoteTransition {
  votesUp: number
  votesDown: number
  userVote: VoteValue | null
}

/** Calcula una transición idempotente de voto sin permitir contadores negativos. */
export function applyVoteTransition(
  currentVote: VoteValue | null | undefined,
  requestedVote: VoteValue,
  votesUp: number,
  votesDown: number,
): VoteTransition {
  const nextVote = currentVote === requestedVote ? null : requestedVote
  let nextVotesUp = votesUp
  let nextVotesDown = votesDown

  if (currentVote === 1) nextVotesUp = Math.max(0, nextVotesUp - 1)
  if (currentVote === -1) nextVotesDown = Math.max(0, nextVotesDown - 1)
  if (nextVote === 1) nextVotesUp += 1
  if (nextVote === -1) nextVotesDown += 1

  return { votesUp: nextVotesUp, votesDown: nextVotesDown, userVote: nextVote }
}
