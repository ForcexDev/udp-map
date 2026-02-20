import { useState, useEffect, useCallback } from 'react';
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
        } catch (err: any) {
            console.error('[Auth] getProfile threw:', err);
            // Si fue puramente un timeout, usamos un nombre temporal para no bloquearlo
            if (err?.message?.includes('timed out')) {
                return {
                    id: authUser.id,
                    email,
                    name: fallbackName + ' (Temporal)',
                    isAdmin: role === 'admin',
                    role
                };
            }
        }

        // Si terminó bien pero no tiene perfil en la BD, es un usuario nuevo: pide el nombre
        return null;
    }, []);

    useEffect(() => {
        let mounted = true;
        console.log('[Auth] Effect mounted. Starting session checks...');

        // Limpiar el feo Hash de la URL al volver de Google (por seguridad y estética)
        if (window.location.hash && window.location.hash.includes('access_token=')) {
            setTimeout(() => {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }, 100);
        }

        const loadSession = async () => {
            try {
                const { data: { session }, error } = await withTimeout(
                    supabase.auth.getSession(),
                    3000,
                    'getSession'
                );

                if (error) throw error;

                if (!mounted) return;

                if (session) {
                    const userData = await buildUserFromSession(session);
                    if (!mounted) return;

                    if (userData) {
                        setUser(userData);
                        setNeedsProfileSetup(false);
                    } else {
                        setPendingSession(session);
                        setNeedsProfileSetup(true);
                    }
                } else {
                    setUser(null);
                }
            } catch (err: any) {
                console.error('[Auth] loadSession error:', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        // Arrancamos con getSession primero para asegurar que recuperamos la sesión si existe
        loadSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[Auth] onAuthStateChange:', event);
            if (!mounted) return;

            // INITIAL_SESSION ya lo manejamos con loadSession() arriba para evitar race conditions
            if (event === 'INITIAL_SESSION') return;

            if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
                setLoading(true); // Forzamos loading al cambiar de cuenta para evitar parpadeos
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
                if (mounted) setLoading(false);
            }
        });

        const safetyTimeout = setTimeout(() => {
            if (mounted && loading) {
                console.warn('[Auth] Safety timeout forced loading=false. Supabase took too long.');
                setLoading(false);
            }
        }, 8000); // 8 segundos para casos extremos en móvil 3G

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
                queryParams: {
                    prompt: 'select_account' // Obliga a Google a mostrar la lista de cuentas siempre al iniciar
                }
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
        // Forzamos la limpieza absoluta del estado local
        setUser(null);
        setPendingSession(null);
        setNeedsProfileSetup(false);
        localStorage.removeItem('udp_onboarding_done');
        // Limpiamos rastros del storage de Supabase si quedaron huerfanos para no auto-loguearse
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                localStorage.removeItem(key);
            }
        }
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
