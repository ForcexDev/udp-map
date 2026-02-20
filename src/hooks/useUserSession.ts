import { useState } from 'react';
import { User } from '../config/types';

export const useUserSession = () => {
    const [user, setUser] = useState<User | null>(() => {
        const saved = localStorage.getItem('udp_map_user_session_v1');
        return saved ? JSON.parse(saved) : null;
    });

    const login = (userData: User) => {
        setUser(userData);
        localStorage.setItem('udp_map_user_session_v1', JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('udp_map_user_session_v1');
    };

    return {
        user,
        login,
        logout
    };
};
