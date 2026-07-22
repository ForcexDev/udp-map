import { describe, expect, it } from 'vitest'
import { applyVoteTransition } from './vote'

describe('transiciones de votos', () => {
  it('agrega un único like cuando el usuario todavía no ha votado', () => {
    expect(applyVoteTransition(null, 1, 4, 2)).toEqual({
      votesUp: 5,
      votesDown: 2,
      userVote: 1,
    })
  })

  it('quita el voto cuando se pulsa nuevamente la misma opción', () => {
    expect(applyVoteTransition(1, 1, 5, 2)).toEqual({
      votesUp: 4,
      votesDown: 2,
      userVote: null,
    })
  })

  it('cambia de like a dislike sin duplicar votos', () => {
    expect(applyVoteTransition(1, -1, 5, 2)).toEqual({
      votesUp: 4,
      votesDown: 3,
      userVote: -1,
    })
  })

  it('nunca produce contadores negativos al reparar datos inconsistentes', () => {
    expect(applyVoteTransition(-1, -1, 0, 0)).toEqual({
      votesUp: 0,
      votesDown: 0,
      userVote: null,
    })
  })
})
