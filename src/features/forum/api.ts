import { supabase } from '@/shared/lib/supabase'
import type { ForumThread, ForumComment } from '@/shared/types/database'
import { demoForumDb } from './demoStore'

const nowIso = () => new Date().toISOString()

// ── Hilos (Threads) ──

export async function fetchThreads(
  facultyId: string | null,
  sortBy: 'recent' | 'top' = 'recent'
): Promise<ForumThread[]> {
  if (!supabase) {
    const list = demoForumDb.threads.filter((t) => t.faculty_id === facultyId)
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
    .select('*, profiles:author_id(name)')
    
  if (facultyId) {
    query = query.eq('faculty_id', facultyId)
  } else {
    query = query.is('faculty_id', null)
  }

  const { data, error } = await query

  if (error) throw error

  const threads = (data || []).map((t: Record<string, unknown> & { profiles?: { name?: string } }) => ({
    ...(t as unknown as ForumThread),
    author_name: t.profiles?.name || 'Estudiante UDP',
  })) as ForumThread[]

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
    return thread || null
  }

  const { data, error } = await supabase
    .from('forum_threads')
    .select('*, profiles:author_id(name)')
    .eq('id', threadId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }

  return {
    ...data,
    author_name: data.profiles?.name || 'Estudiante UDP',
  } as ForumThread
}

export interface CreateThreadInput {
  title: string
  content: string
  tags: string[]
  facultyId: string | null
  authorId: string
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
      created_at: nowIso(),
      updated_at: nowIso(),
      author_name: 'Yo',
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
    })
    .select('*, profiles:author_id(name)')
    .single()

  if (error) throw error

  return {
    ...data,
    author_name: data.profiles?.name || 'Estudiante UDP',
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
    .select('*, profiles:author_id(name)')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((c: Record<string, unknown> & { profiles?: { name?: string } }) => ({
    ...(c as unknown as ForumComment),
    author_name: c.profiles?.name || 'Estudiante UDP',
  })) as ForumComment[]
}

export interface CreateCommentInput {
  threadId: string
  parentCommentId: string | null
  content: string
  authorId: string
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
      author_name: 'Yo',
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
    .select('*, profiles:author_id(name)')
    .single()

  if (error) throw error

  return {
    ...data,
    author_name: data.profiles?.name || 'Estudiante UDP',
  } as ForumComment
}

export async function deleteComment(commentId: string): Promise<void> {
  if (!supabase) {
    demoForumDb.comments = demoForumDb.comments.filter((c) => c.id !== commentId)
    return
  }

  const { error } = await supabase
    .from('forum_comments')
    .delete()
    .eq('id', commentId)

  if (error) throw error
}

// ── Votos (Votes) ──

export async function voteThread(threadId: string, value: 1 | -1): Promise<void> {
  if (!supabase) {
    const thread = demoForumDb.threads.find((t) => t.id === threadId)
    if (thread) {
      let votesMap = demoForumDb.votes.get(threadId)
      if (!votesMap) {
        votesMap = new Map()
        demoForumDb.votes.set(threadId, votesMap)
      }
      votesMap.set('me', value)
      
      // Recalcular
      let up = 0
      let down = 0
      votesMap.forEach((v) => (v === 1 ? up++ : down++))
      thread.votes_up = up
      thread.votes_down = down
    }
    return
  }

  const { error } = await supabase.rpc('vote_thread', {
    p_thread: threadId,
    p_value: value,
  })

  if (error) throw error
}

export async function fetchUserVoteOnThread(threadId: string, userId: string): Promise<1 | -1 | null> {
  if (!supabase) {
    const votesMap = demoForumDb.votes.get(threadId)
    return votesMap?.get('me') || null
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
