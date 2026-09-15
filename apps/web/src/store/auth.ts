import { create } from "zustand";

interface AuthState {
  memberId: string | null;
  name: string | null;
  email: string | null;
  set: (v: Partial<AuthState>) => void;
}

export const useAuth = create<AuthState>((set) => ({
  memberId: null,
  name: null,
  email: null,
  set: (v) => set(v),
}));
