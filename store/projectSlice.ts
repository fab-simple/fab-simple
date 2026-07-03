import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const LS_KEY = "fab:selectedProjectId";

function readFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(LS_KEY); }
  catch { return null; }
}

interface ProjectState {
  selectedProjectId: string | null;
  selectedProjectName: string | null;
  selectedProjectNumber: string | null;
}

const initialState: ProjectState = {
  selectedProjectId: null,
  selectedProjectName: null,
  selectedProjectNumber: null,
};

const projectSlice = createSlice({
  name: "project",
  initialState,
  reducers: {
    setGlobalProject: (
      state,
      action: PayloadAction<{ id: string; name: string; number: string | null }>
    ) => {
      state.selectedProjectId = action.payload.id;
      state.selectedProjectName = action.payload.name;
      state.selectedProjectNumber = action.payload.number;
      try { localStorage.setItem(LS_KEY, action.payload.id); } catch { /* noop */ }
    },
    clearGlobalProject: (state) => {
      state.selectedProjectId = null;
      state.selectedProjectName = null;
      state.selectedProjectNumber = null;
      try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
    },
    /** Called on app boot to rehydrate from localStorage, once projects list is available. */
    rehydrateProject: (
      state,
      action: PayloadAction<{ id: string; name: string; number: string | null } | null>
    ) => {
      if (action.payload) {
        state.selectedProjectId = action.payload.id;
        state.selectedProjectName = action.payload.name;
        state.selectedProjectNumber = action.payload.number;
      }
    },
  },
});

export const { setGlobalProject, clearGlobalProject, rehydrateProject } = projectSlice.actions;
export { readFromStorage as readProjectFromStorage };
export default projectSlice.reducer;
