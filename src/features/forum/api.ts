import { supabase } from '@/shared/lib/supabase'
import type { ForumThread, ForumComment } from '@/shared/types/database'
import { applyVoteTransition } from '@/shared/utils/vote'
import { demoForumDb } from './demoStore'

const nowIso = () => new Date().toISOString()

type ForumThreadRow = ForumThread & {
  forum_comments?: { count?: number | null }[] | null
}

type PublicProfile = { name?: string | null; avatar_url?: string | null }

// profiles_public: RLS solo deja leer el perfil propio o el de un admin en la
// tabla base, así que el autor de contenido ajeno se resuelve aparte via vista.
async function fetchAuthorProfiles(authorIds: (string | null | undefined)[]): Promise<Map<string, PublicProfile>> {
  const ids = [...new Set(authorIds.filter((id): id is string => !!id))]
  if (!supabase || ids.length === 0) return new Map()

  const { data, error } = await supabase
    .from('profiles_public')
    .select('id, name, avatar_url')
    .in('id', ids)

  if (error) throw error
  return new Map((data || []).map((p) => [p.id as string, p as PublicProfile]))
}

function mapThread(row: ForumThreadRow, profile: PublicProfile | undefined): ForumThread {
  const { forum_comments, ...thread } = row
  return {
    ...thread,
    author_name: profile?.name || 'Estudiante UDP',
    author_avatar_url: profile?.avatar_url ?? null,
    comment_count: forum_comments?.[0]?.count ?? 0,
  }
}

function demoThreadWithCount(thread: ForumThread): ForumThread {
  return {
    ...thread,
    comment_count: demoForumDb.comments.filter((comment) => comment.thread_id === thread.id).length,
  }
}

// ── Hilos (Threads) ──

export async function fetchThreads(
  facultyId: string | null,
  sortBy: 'recent' | 'top' = 'recent'
): Promise<ForumThread[]> {
  if (!supabase) {
    const list = demoForumDb.threads
      .filter((t) => t.faculty_id === facultyId)
      .map(demoThreadWithCount)
    // Ordenar: Pinned van primero siempre
    list.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      
      if (sortBy === 'top') {
        return (b.votes_up - b.votes_down) - (a.votes_up - a.votes_down)
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
    return list
  }

  // Consulta en Supabase
  let query = supabase
    .from('forum_threads')
    .select('*, forum_comments(count)')

  if (facultyId) {
    query = query.eq('faculty_id', facultyId)
  } else {
    query = query.is('faculty_id', null)
  }

  const { data, error } = await query

  if (error) throw error

  const rows = (data || []) as unknown as ForumThreadRow[]
  const profiles = await fetchAuthorProfiles(rows.map((r) => r.author_id))
  const threads = rows.map((thread) => mapThread(thread, profiles.get(thread.author_id)))

  // Ordenamos en memoria
  threads.sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    
    if (sortBy === 'top') {
      return (b.votes_up - b.votes_down) - (a.votes_up - a.votes_down)
    } else {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  })

  return threads
}

export async function fetchThreadById(threadId: string): Promise<ForumThread | null> {
  if (!supabase) {
    const thread = demoForumDb.threads.find((t) => t.id === threadId)
    return thread ? demoThreadWithCount(thread) : null
  }

  const { data, error } = await supabase
    .from('forum_threads')
    .select('*, forum_comments(count)')
    .eq('id', threadId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }

  const row = data as unknown as ForumThreadRow
  const profiles = await fetchAuthorProfiles([row.author_id])
  return mapThread(row, profiles.get(row.author_id))
}

export interface CreateThreadInput {
  title: string
  content: string
  tags: string[]
  facultyId: string | null
  authorId: string
  isOfficial?: boolean
  officialEntityName?: string | null
}

export async function createThread(input: CreateThreadInput): Promise<ForumThread> {
  if (!supabase) {
    const newThread: ForumThread = {
      id: crypto.randomUUID(),
      faculty_id: input.facultyId,
      author_id: input.authorId,
      title: input.title,
      content: input.content,
      tags: input.tags,
      votes_up: 0,
      votes_down: 0,
      is_pinned: false,
      is_official: input.isOfficial ?? false,
      official_entity_name: input.officialEntityName ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
      author_name: 'Yo',
      comment_count: 0,
    }
    demoForumDb.threads.unshift(newThread)
    return newThread
  }

  const { data, error } = await supabase
    .from('forum_threads')
    .insert({
      title: input.title,
      content: input.content,
      tags: input.tags,
      faculty_id: input.facultyId,
      author_id: input.authorId,
      is_official: input.isOfficial ?? false,
      official_entity_name: input.officialEntityName ?? null,
    })
    .select('*, profiles:author_id(name, avatar_url)')
    .single()

  if (error) throw error

  return {
    ...data,
    author_name: data.profiles?.name || 'Estudiante UDP',
    author_avatar_url: data.profiles?.avatar_url ?? null,
    comment_count: 0,
  } as ForumThread
}

export async function deleteThread(threadId: string): Promise<void> {
  if (!supabase) {
    demoForumDb.threads = demoForumDb.threads.filter((t) => t.id !== threadId)
    demoForumDb.comments = demoForumDb.comments.filter((c) => c.thread_id !== threadId)
    return
  }

  const { error } = await supabase
    .from('forum_threads')
    .delete()
    .eq('id', threadId)

  if (error) throw error
}

export async function togglePinThread(threadId: string, isPinned: boolean): Promise<void> {
  if (!supabase) {
    const thread = demoForumDb.threads.find((t) => t.id === threadId)
    if (thread) thread.is_pinned = isPinned
    return
  }

  const { error } = await supabase
    .from('forum_threads')
    .update({ is_pinned: isPinned })
    .eq('id', threadId)

  if (error) throw error
}

// ── Comentarios (Comments) ──

export async function fetchComments(threadId: string): Promise<ForumComment[]> {
  if (!supabase) {
    return demoForumDb.comments.filter((c) => c.thread_id === threadId)
  }

  const { data, error } = await supabase
    .from('forum_comments')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  if (error) throw error

  const rows = (data || []) as unknown as ForumComment[]
  const profiles = await fetchAuthorProfiles(rows.map((c) => c.author_id))

  return rows.map((c) => ({
    ...c,
    author_name: profiles.get(c.author_id)?.name || 'Estudiante UDP',
    author_avatar_url: profiles.get(c.author_id)?.avatar_url ?? null,
  }))
}

export interface CreateCommentInput {
  threadId: string
  parentCommentId: string | null
  content: string
  authorId: string
  authorName?: string | null
  authorAvatarUrl?: string | null
}

export async function createComment(input: CreateCommentInput): Promise<ForumComment> {
  if (!supabase) {
    const newComment: ForumComment = {
      id: crypto.randomUUID(),
      thread_id: input.threadId,
      parent_comment_id: input.parentCommentId,
      author_id: input.authorId,
      content: input.content,
      created_at: nowIso(),
      author_name: input.authorName || 'Yo',
      author_avatar_url: input.authorAvatarUrl ?? null,
    }
    demoForumDb.comments.push(newComment)
    return newComment
  }

  const { data, error } = await supabase
    .from('forum_comments')
    .insert({
      thread_id: input.threadId,
      parent_comment_id: input.parentCommentId,
      content: input.content,
      author_id: input.authorId,
    })
    .select('*, profiles:author_id(name, avatar_url)')
    .single()

  if (error) throw error

  return {
    ...data,
    author_name: data.profiles?.name || 'Estudiante UDP',
    author_avatar_url: data.profiles?.avatar_url ?? input.authorAvatarUrl ?? null,
  } as ForumComment
}

export async function deleteComment(commentId: string): Promise<void> {
  if (!supabase) {
    const deletedIds = new Set([commentId])
    let foundDescendant = true
    while (foundDescendant) {
      foundDescendant = false
      for (const comment of demoForumDb.comments) {
        if (comment.parent_comment_id && deletedIds.has(comment.parent_comment_id) && !deletedIds.has(comment.id)) {
          deletedIds.add(comment.id)
          foundDescendant = true
        }
      }
    }
    demoForumDb.comments = demoForumDb.comments.filter((comment) => !deletedIds.has(comment.id))
    return
  }

  const { error } = await supabase
    .from('forum_comments')
    .delete()
    .eq('id', commentId)

  if (error) throw error
}

// ── Votos (Votes) ──

export interface ThreadVoteResult {
  votesUp: number
  votesDown: number
  userVote: 1 | -1 | null
}

export async function voteThread(threadId: string, value: 1 | -1): Promise<ThreadVoteResult | null> {
  if (!supabase) {
    const thread = demoForumDb.threads.find((t) => t.id === threadId)
    if (thread) {
      const userId = 'demo-current-user'
      let votesMap = demoForumDb.votes.get(threadId)
      if (!votesMap) {
        votesMap = new Map()
        demoForumDb.votes.set(threadId, votesMap)
      }
      const previousVote = votesMap.get(userId)
      const transition = applyVoteTransition(previousVote, value, thread.votes_up, thread.votes_down)
      if (transition.userVote === null) {
        votesMap.delete(userId)
      } else {
        votesMap.set(userId, transition.userVote)
      }
      thread.votes_up = transition.votesUp
      thread.votes_down = transition.votesDown
      return {
        ...transition,
      }
    }
    return null
  }

  const { data, error } = await supabase.rpc('vote_thread', {
    p_thread: threadId,
    p_value: value,
  })

  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    votesUp: Number(row.votes_up),
    votesDown: Number(row.votes_down),
    userVote: row.user_vote === 1 || row.user_vote === -1 ? row.user_vote : null,
  }
}

export async function fetchUserVoteOnThread(threadId: string, userId: string): Promise<1 | -1 | null> {
  if (!supabase) {
    const votesMap = demoForumDb.votes.get(threadId)
    return votesMap?.get('demo-current-user') || null
  }

  const { data, error } = await supabase
    .from('forum_votes')
    .select('value')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data ? (data.value as 1 | -1) : null
}
