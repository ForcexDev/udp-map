import type { ForumComment } from '@/shared/types/database'

export interface CommentNode extends ForumComment {
  replies: CommentNode[]
}

export function countNestedReplies(node: CommentNode): number {
  return node.replies.reduce(
    (total, reply) => total + 1 + countNestedReplies(reply),
    0,
  )
}

export function replyMention(authorName?: string | null): string {
  return `@${authorName?.trim() || 'Estudiante UDP'} `
}

export function buildReplyContent(text: string, authorName?: string | null): string {
  return `${replyMention(authorName)}${text.trim()}`
}

export function buildCommentTree(comments: ForumComment[]): CommentNode[] {
  const roots: CommentNode[] = []
  const rootMap = new Map<string, CommentNode>()
  const parentMap = new Map<string, ForumComment>()

  comments.forEach((c) => {
    parentMap.set(c.id, c)
  })

  // Primer paso: identificar nodos raíz (comentarios sin parent_comment_id)
  comments.forEach((c) => {
    if (!c.parent_comment_id) {
      const rootNode: CommentNode = { ...c, replies: [] }
      roots.push(rootNode)
      rootMap.set(c.id, rootNode)
    }
  })

  // Función para encontrar el ID del comentario raíz original
  const findRootId = (commentId: string): string | null => {
    let current = parentMap.get(commentId)
    while (current && current.parent_comment_id) {
      current = parentMap.get(current.parent_comment_id)
    }
    return current ? current.id : null
  }

  // Segundo paso: asociar todas las respuestas directamente a su comentario raíz (Nivel 1 Plano)
  comments.forEach((c) => {
    if (c.parent_comment_id) {
      const rootId = findRootId(c.id)
      if (rootId && rootMap.has(rootId)) {
        rootMap.get(rootId)!.replies.push({ ...c, replies: [] })
      } else {
        // En caso de que no se encuentre la raíz, tratarlo como raíz
        const rootNode: CommentNode = { ...c, replies: [] }
        roots.push(rootNode)
        rootMap.set(c.id, rootNode)
      }
    }
  })

  return roots
}
