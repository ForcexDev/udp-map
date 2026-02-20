import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

if (supabaseUrl === 'https://placeholder.supabase.co') {
    console.warn('Supabase URL is missing. Set VITE_SUPABASE_URL in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- PROFILES ---
export const getProfile = async (id: string) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    return { data, error };
};

export const upsertProfile = async (profile: { id: string, email: string, name: string, isAdmin: boolean, role?: string }) => {
    const { data, error } = await supabase
        .from('profiles')
        .upsert(profile)
        .select()
        .single();
    return { data, error };
};

// --- POSTS ---
export const getPosts = async () => {
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('createdAt', { ascending: false });
    return { data, error };
};

export const createPost = async (post: any) => {
    const { data, error } = await supabase
        .from('posts')
        .insert(post)
        .select()
        .single();
    return { data, error };
};

export const updatePost = async (id: string, updates: any) => {
    const { data, error } = await supabase
        .from('posts')
        .update(updates)
        .eq('id', id);
    return { data, error };
};

export const deletePost = async (id: string) => {
    const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);
    return { error };
};

// Secure voting via RPC (bypasses restrictive UPDATE policy)
export const voteOnPost = async (postId: string, votesUp: number, votesDown: number, reports: number) => {
    const { error } = await supabase.rpc('vote_on_post', {
        post_id: postId,
        new_votes_up: votesUp,
        new_votes_down: votesDown,
        new_reports: reports
    });
    return { error };
};

// --- IMAGES ---
const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(blob || file);
                }, 'image/jpeg', 0.7);
            };
        };
    });
};

export const uploadImage = async (file: File) => {
    const compressedBlob = await compressImage(file);
    const fileName = `${Math.random()}.jpg`;
    const filePath = `post-images/${fileName}`;

    const { error } = await supabase.storage
        .from('udp-map-assets')
        .upload(filePath, compressedBlob);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
        .from('udp-map-assets')
        .getPublicUrl(filePath);

    return publicUrl;
};

// --- CHAT ---
export const getChatMessages = async (facultyId: string) => {
    const { data, error } = await supabase
        .from('chat')
        .select('*')
        .eq('facultyId', facultyId)
        .order('timestamp', { ascending: true });
    return { data, error };
};

export const sendChatMessage = async (msg: any) => {
    const { data, error } = await supabase
        .from('chat')
        .insert(msg);
    return { data, error };
};
