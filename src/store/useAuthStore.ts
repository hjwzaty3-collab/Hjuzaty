import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  pendingPhone: string | null;
  pendingUser: User | null;
  setAuth: (user: User | null) => void;
  setPendingPhone: (phone: string | null) => void;
  setPendingUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      pendingPhone: null,
      pendingUser: null,
      setAuth: (user) => set({ user, isAuthenticated: !!user, pendingPhone: null, pendingUser: null }),
      setPendingPhone: (phone) => set({ pendingPhone: phone }),
      setPendingUser: (user) => set({ pendingUser: user }),
      logout: () => set({ user: null, isAuthenticated: false, pendingPhone: null, pendingUser: null }),
    }),
    {
      name: 'hjuzati-auth',          // localStorage key
      partialize: (state) => ({      // only persist what's needed
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
