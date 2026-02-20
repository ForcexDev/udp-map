import { useState, useEffect, useCallback, useRef } from 'react';
import { User, UserRole } from '../config/types';
import { supabase, getProfile, upsertProfile } from '../services/supabaseService';
import { ADMIN_EMAILS } from '../config/constants';
import type { Session } from '@supabase/supabase-js';

const getRole = (email: string): UserRole => {
    if (ADMIN_EMAILS.includes(email)) return 'admin';
    if (email.endsWith('@mail.udp.cl') || email.endsWith('@udp.cl')) return 'student';
    return 'guest';
};

export const useUserSession = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
    const [pendingSession, setPendingSession] = useState<Session | null>(null);
    const didInit = useRef(false);

    // Build User object from Supabase session
    const buildUserFromSession = useCallback(async (session: Session): Promise<User | null> => {
        const { user: authUser } = session;
        const email = authUser.email || '';
        const role = getRole(email);
        const fallbackName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split('@')[0];

        try {
            const { data: profile, error } = await getProfile(authUser.id);
            console.log('[Auth] getProfile result:', { profile, error: error?.message });

            if (profile && profile.name) {
                return {
                    id: authUser.id,
                    email,
                    name: profile.name || fallbackName,
                    isAdmin: role === 'admin',
                    role
                };
            }
        } catch (err) {
            console.error('[Auth] getProfile threw:', err);
        }

        // No profile yet — needs setup
        return null;
    }, []);

    useEffect(() => {
        // Prevent double-init in StrictMode
        if (didInit.current) return;
        didInit.current = true;

        console.log('[Auth] Initializing session...');

        const initSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                console.log('[Auth] getSession result:', {
                    hasSession: !!session,
                    email: session?.user?.email,
                    error: error?.message
                });

                if (session) {
                    const userData = await buildUserFromSession(session);
                    console.log('[Auth] buildUser result:', userData ? 'has profile' : 'needs setup');

                    if (userData) {
                        setUser(userData);
                    } else {
                        setPendingSession(session);
                        setNeedsProfileSetup(true);
                    }
                }
            } catch (err) {
                console.error('[Auth] initSession error:', err);
            } finally {
                console.log('[Auth] Setting loading=false');
                setLoading(false);
            }
        };

        initSession();

        // Listen for auth changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[Auth] onAuthStateChange:', event);

            // Skip initial — handled by initSession above
            if (event === 'INITIAL_SESSION') return;

            if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
                try {
                    const userData = await buildUserFromSession(session);
                    if (userData) {
                        setUser(userData);
                        setNeedsProfileSetup(false);
                        setPendingSession(null);
                    } else {
                        setPendingSession(session);
                        setNeedsProfileSetup(true);
                    }
                } catch (err) {
                    console.error('[Auth] onAuthStateChange handler error:', err);
                }
                setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setPendingSession(null);
                setNeedsProfileSetup(false);
                setLoading(false);
            }
        });

        // Safety timeout — if nothing resolves in 5s, stop loading
        const timeout = setTimeout(() => {
            console.warn('[Auth] Safety timeout — forcing loading=false');
            setLoading(false);
        }, 5000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(timeout);
        };
    }, [buildUserFromSession]);

    const login = useCallback(async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            }
        });
    }, []);

    const completeProfile = useCallback(async (customName: string) => {
        if (!pendingSession) return;
        const { user: authUser } = pendingSession;
        const email = authUser.email || '';
        const role = getRole(email);

        const finalUser: User = {
            id: authUser.id,
            email,
            name: customName,
            isAdmin: role === 'admin',
            role
        };

        await upsertProfile({
            id: finalUser.id,
            email: finalUser.email,
            name: finalUser.name,
            isAdmin: finalUser.isAdmin,
            role: finalUser.role,
        });

        setUser(finalUser);
        setNeedsProfileSetup(false);
        setPendingSession(null);
    }, [pendingSession]);

    const logout = useCallback(async () => {
        await supabase.auth.signOut();
        setUser(null);
        localStorage.removeItem('udp_onboarding_done');
    }, []);

    return {
        user,
        loading,
        needsProfileSetup,
        pendingSession,
        login,
        completeProfile,
        logout
    };
};
