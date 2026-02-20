import { useState, useEffect, useCallback } from 'react';
import { supabase, getPosts, getChatMessages, updatePost, deletePost } from '../services/supabaseService';
import { Post, ChatMessage } from '../config/types';

export const usePosts = (user: any) => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});
    const [lastNewPostTitle, setLastNewPostTitle] = useState<string | null>(null);

    // ... loadChat and addLocalMessage remain same ...
    const loadChat = useCallback(async (facultyId: string) => {
        const { data } = await getChatMessages(facultyId);
        if (data) setChatMessages(data);
    }, []);

    const addLocalMessage = useCallback((msg: ChatMessage) => {
        setChatMessages(prev => [...prev, msg]);
    }, []);

    // Initial data load
    useEffect(() => {
        const loadInitialData = async () => {
            const { data: postsData } = await getPosts();
            if (postsData) setPosts(postsData);

            const savedVotes = localStorage.getItem('udp_user_votes_v2');
            if (savedVotes) setUserVotes(JSON.parse(savedVotes));
        };
        loadInitialData();
    }, []);

    // Realtime Subscriptions - Re-subscribe when user changed (to use correct JWT)
    useEffect(() => {
        if (!user) return;

        console.log('[Realtime] Setting up subscriptions for user:', user.email);

        const postsChannel = supabase.channel('posts-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'posts' },
                (payload) => {
                    console.log('[Realtime] Posts event:', payload.eventType);
                    if (payload.eventType === 'INSERT') {
                        const newPost = payload.new as Post;
                        setPosts(prev => [newPost, ...prev]);
                        setLastNewPostTitle(newPost.title);
                    } else if (payload.eventType === 'DELETE') {
                        setPosts(prev => prev.filter(p => p.id !== (payload.old as any).id));
                    } else if (payload.eventType === 'UPDATE') {
                        setPosts(prev => prev.map(p => p.id === (payload.new as Post).id ? (payload.new as Post) : p));
                    }
                }
            )
            .subscribe((status, err) => {
                console.log('[Realtime] Posts subscription status:', status, err || '');
            });

        const chatChannel = supabase.channel('chat-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat' },
                (payload) => {
                    console.log('[Realtime] Chat event:', payload.eventType);
                    setChatMessages(prev => [...prev, payload.new as ChatMessage]);
                }
            )
            .subscribe((status, err) => {
                console.log('[Realtime] Chat subscription status:', status, err || '');
            });

        return () => {
            console.log('[Realtime] Cleaning up subscriptions');
            supabase.removeChannel(postsChannel);
            supabase.removeChannel(chatChannel);
        };
    }, [user?.id]); // Re-subscribe when user ID changes (login/logout)

    // ... rest of the functions ...
    const handleVote = async (postId: string, type: 'up' | 'down') => {
        if (userVotes[postId]) return;

        setPosts(prev => prev.map(p =>
            p.id === postId ? {
                ...p,
                votesUp: type === 'up' ? p.votesUp + 1 : p.votesUp,
                votesDown: type === 'down' ? p.votesDown + 1 : p.votesDown,
                reports: type === 'down' ? p.reports + 1 : p.reports
            } : p
        ));

        const postToUpdate = posts.find(p => p.id === postId);
        if (postToUpdate) {
            await updatePost(postId, {
                votesUp: type === 'up' ? postToUpdate.votesUp + 1 : postToUpdate.votesUp,
                votesDown: type === 'down' ? postToUpdate.votesDown + 1 : postToUpdate.votesDown,
                reports: type === 'down' ? postToUpdate.reports + 1 : postToUpdate.reports
            });
        }

        const newVotes = { ...userVotes, [postId]: type };
        setUserVotes(newVotes);
        localStorage.setItem('udp_user_votes_v2', JSON.stringify(newVotes));
    };

    const handleTogglePin = async (postId: string, isAdmin: boolean) => {
        if (!isAdmin) return;
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        const { error } = await updatePost(postId, { isPinned: !post.isPinned });
        if (error) {
            alert("Error al actualizar pin: " + error.message);
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (window.confirm("¿Eliminar publicación permanentemente?")) {
            setPosts(prev => prev.filter(p => p.id !== postId));

            const { error } = await deletePost(postId);
            if (error) {
                const { data: postsData } = await getPosts();
                if (postsData) setPosts(postsData);
                alert("Error al eliminar: " + error.message);
            }
        }
    };

    return {
        posts,
        chatMessages,
        userVotes,
        lastNewPostTitle,
        handleVote,
        handleTogglePin,
        handleDeletePost,
        loadChat,
        addLocalMessage
    };
};
