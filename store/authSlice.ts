import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  userId: string | null;
  name: string;
  role: string;
  email: string;
  avatarColor: string;
  initials: string;
  /** True until AuthSync has run at least once; UI should render a skeleton. */
  loaded: boolean;
}

/**
 * No hardcoded identity. UI must render a skeleton (or block) until
 * AuthSync.load() either dispatches a real user payload or signs the user
 * out. Previously this seeded `Jake Rivera / owner / jake@txsteelfab.com`
 * which leaked into every brand-new customer's sidebar on signin/signout.
 */
const emptyState: AuthState = {
  userId: null,
  name: "",
  role: "",
  email: "",
  avatarColor: "#94A3B8",
  initials: "",
  loaded: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState: emptyState,
  reducers: {
    setUser: (state, action: PayloadAction<Partial<AuthState>>) => {
      return { ...state, ...action.payload, loaded: true };
    },
    clearUser: () => ({ ...emptyState, loaded: true }),
  },
});

export const { setUser, clearUser } = authSlice.actions;
export default authSlice.reducer;
