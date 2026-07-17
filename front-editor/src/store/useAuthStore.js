import { create } from 'zustand';

export const useAuthStore = create((set) => ({
    token: localStorage.getItem('nodal_token') || null,
    username: localStorage.getItem('nodal_username') || null,
    login: (token, username) => {
        localStorage.setItem('nodal_token', token);
        localStorage.setItem('nodal_username', username);
        set({ token, username });
    },
    logout: () => {
        localStorage.removeItem('nodal_token');
        localStorage.removeItem('nodal_username');
        set({ token: null, username: null });
    }
}));
