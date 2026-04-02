import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  userId: string | null;
  name: string;
  role: string;
  email: string;
  avatarColor: string;
  initials: string;
}

const initialState: AuthState = {
  userId: null,
  name: "Jake Rivera",
  role: "owner",
  email: "jake@txsteelfab.com",
  avatarColor: "#4F46E5",
  initials: "JR",
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<Partial<AuthState>>) => {
      return { ...state, ...action.payload };
    },
    clearUser: () => initialState,
  },
});

export const { setUser, clearUser } = authSlice.actions;
export default authSlice.reducer;
