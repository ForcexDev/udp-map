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

    // Helper to race a promise against a timeout
    const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
        ]);
    };

    // Build User object from Supabase session
    const buildUserFromSession = useCallback(async (session: Session): Promise<User | null> => {
        const { user: authUser } = session;
        const email = authUser.email || '';
        const role = getRole(email);
        const fallbackName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split('@')[0];

        try {
            const { data: profile, error } = await withTimeout(
                getProfile(authUser.id),
                3500,
                'getProfile'
            );
            console.log('[Auth] getProfile result:', { profile: !!profile, error: error?.message });

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

        // Si falla o no existe el perfil, por defecto usamos un fallback rápido para no bloquear
        return {
            id: authUser.id,
            email,
            name: fallbackName,
            isAdmin: role === 'admin',
            role
        };
    }, []);

    useEffect(() => {
        let mounted = true;
        console.log('[Auth] Effect mounted. Starting session checks...');

        const initSession = async () => {
            try {
                console.log('[Auth] Calling getSession()');
                const { data: { session }, error } = await withTimeout(
                    supabase.auth.getSession(),
                    3000,
                    'getSession'
                );

                if (!mounted) return;

                console.log('[Auth] getSession result:', { hasSession: !!session, error: error?.message });

                if (session) {
                    const userData = await buildUserFromSession(session);
                    if (!mounted) return;

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
                if (mounted) setLoading(false);
            }
        };

        initSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[Auth] onAuthStateChange:', event);
            if (!mounted) return;

            if (event === 'INITIAL_SESSION') return;

            if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
                try {
                    const userData = await buildUserFromSession(session);
                    if (!mounted) return;

                    if (userData) {
                        setUser(userData);
                        setNeedsProfileSetup(false);
                        setPendingSession(null);
                    } else {
                        setPendingSession(session);
                        setNeedsProfileSetup(true);
                    }
                } catch (err) {
                    console.error('[Auth] onAuthStateChange error:', err);
                } finally {
                    if (mounted) setLoading(false);
                }
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setPendingSession(null);
                setNeedsProfileSetup(false);
                setLoading(false);
            }
        });

        const safetyTimeout = setTimeout(() => {
            if (mounted && loading) {
                console.warn('[Auth] Safety timeout forced loading=false. Supabase took too long.');
                setLoading(false);
            }
        }, 5000);

        return () => {
            console.log('[Auth] Effect sweeping up (unmounted)');
            mounted = false;
            subscription.unsubscribe();
            clearTimeout(safetyTimeout);
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
