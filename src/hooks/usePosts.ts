import { useState, useEffect } from 'react';
import { supabase, getPosts, updatePost, deletePost } from '../services/supabaseService';
import { Post, ChatMessage } from '../config/types';

export const usePosts = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});
    const [lastNewPostTitle, setLastNewPostTitle] = useState<string | null>(null);;

    useEffect(() => {
        const loadInitialData = async () => {
            const { data: postsData } = await getPosts();
            if (postsData) setPosts(postsData);

            const savedVotes = localStorage.getItem('udp_user_votes_v2');
            if (savedVotes) setUserVotes(JSON.parse(savedVotes));
        };

        loadInitialData();

        const postsSub = supabase.channel('posts-all')
            .on(
                'postgres_changes' as any,
                { event: '*', table: 'posts' },
                async (payload: any) => {
                    if (payload.eventType === 'INSERT') {
                        const newPost = payload.new as Post;
                        setPosts(prev => [newPost, ...prev]);
                        setLastNewPostTitle(newPost.title);
                    } else if (payload.eventType === 'DELETE') {
                        setPosts(prev => prev.filter(p => p.id !== payload.old.id));
                    } else if (payload.eventType === 'UPDATE') {
                        setPosts(prev => prev.map(p => p.id === payload.new.id ? (payload.new as Post) : p));
                    }
                }
            )
            .subscribe();

        const chatSub = supabase.channel('chat-all')
            .on(
                'postgres_changes' as any,
                { event: 'INSERT', table: 'chat' },
                (payload: any) => {
                    setChatMessages(prev => [...prev, payload.new as ChatMessage]);
                }
            )
            .subscribe();

        return () => {
            postsSub.unsubscribe();
            chatSub.unsubscribe();
        };
    }, []);

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
        if (error) alert("Error al actualizar pin: " + error.message);
    };

    const handleDeletePost = async (postId: string) => {
        if (window.confirm("¿Eliminar publicación permanentemente?")) {
            await deletePost(postId);
        }
    };

    return {
        posts,
        chatMessages,
        userVotes,
        lastNewPostTitle,
        handleVote,
        handleTogglePin,
        handleDeletePost
    };
};
