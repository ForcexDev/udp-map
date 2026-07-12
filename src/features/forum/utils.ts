import type { ForumComment } from '@/shared/types/database'

export interface CommentNode extends ForumComment {
  replies: CommentNode[]
}

export function buildCommentTree(comments: ForumComment[]): CommentNode[] {
  const map = new Map<string, CommentNode>()
  const roots: CommentNode[] = []

  comments.forEach((c) => {
    map.set(c.id, { ...c, replies: [] })
  })

  comments.forEach((c) => {
    const node = map.get(c.id)!
    if (c.parent_comment_id) {
      const parent = map.get(c.parent_comment_id)
      if (parent) {
        parent.replies.push(node)
      } else {
        roots.push(node)
      }
    } else {
      roots.push(node)
    }
  })

  return roots
}
