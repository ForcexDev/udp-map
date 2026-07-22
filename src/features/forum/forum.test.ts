import { describe, expect, it } from 'vitest'
import { buildCommentTree, buildReplyContent, replyMention } from './utils'
import type { ForumComment } from '@/shared/types/database'

describe('buildCommentTree (árbol de respuestas anidadas del foro)', () => {
  it('organiza comentarios planos en una estructura de árbol jerárquica', () => {
    const comments: ForumComment[] = [
      {
        id: 'c-1',
        thread_id: 't-1',
        parent_comment_id: null,
        author_id: 'u-1',
        content: 'Comentario raíz 1',
        created_at: new Date().toISOString(),
      },
      {
        id: 'c-2',
        thread_id: 't-1',
        parent_comment_id: 'c-1',
        author_id: 'u-2',
        content: 'Respuesta al raíz 1',
        created_at: new Date().toISOString(),
      },
      {
        id: 'c-3',
        thread_id: 't-1',
        parent_comment_id: 'c-2',
        author_id: 'u-1',
        content: 'Respuesta a la respuesta',
        created_at: new Date().toISOString(),
      },
      {
        id: 'c-4',
        thread_id: 't-1',
        parent_comment_id: null,
        author_id: 'u-3',
        content: 'Comentario raíz 2',
        created_at: new Date().toISOString(),
      },
    ]

    const tree = buildCommentTree(comments)

    // Debe haber exactamente 2 comentarios raíz en el nivel superior
    expect(tree).toHaveLength(2)
    expect(tree[0].id).toBe('c-1')
    expect(tree[1].id).toBe('c-4')

    // El primer comentario raíz debe tener una respuesta
    expect(tree[0].replies).toHaveLength(1)
    expect(tree[0].replies[0].id).toBe('c-2')

    // Esa respuesta a su vez debe tener su propia respuesta
    expect(tree[0].replies[0].replies).toHaveLength(1)
    expect(tree[0].replies[0].replies[0].id).toBe('c-3')
    expect(tree[0].replies[0].replies[0].replies).toHaveLength(0)

    // El segundo comentario raíz no debe tener respuestas
    expect(tree[1].replies).toHaveLength(0)
  })

  it('retorna un array vacío si no hay comentarios', () => {
    const tree = buildCommentTree([])
    expect(tree).toHaveLength(0)
  })
})

describe('menciones al responder', () => {
  it('crea automáticamente la mención del autor objetivo', () => {
    expect(replyMention('Cata M.')).toBe('@Cata M. ')
    expect(replyMention(null)).toBe('@Estudiante UDP ')
  })

  it('antepone la mención solo al construir la respuesta final', () => {
    expect(buildReplyContent('Gracias por avisar', 'Cata M.')).toBe('@Cata M. Gracias por avisar')
    expect(buildReplyContent('  Muchas gracias  ', 'Cata M.')).toBe('@Cata M. Muchas gracias')
  })
})
