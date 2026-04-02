import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UIState {
  sidebarOpen: boolean;
  notifPanelOpen: boolean;
  activeModal: string | null;
  pageTitle: string;
}

const initialState: UIState = {
  sidebarOpen: false,
  notifPanelOpen: false,
  activeModal: null,
  pageTitle: "Dashboard",
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar: (state) => { state.sidebarOpen = !state.sidebarOpen; },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => { state.sidebarOpen = action.payload; },
    toggleNotifPanel: (state) => { state.notifPanelOpen = !state.notifPanelOpen; },
    closeNotifPanel: (state) => { state.notifPanelOpen = false; },
    openModal: (state, action: PayloadAction<string>) => { state.activeModal = action.payload; },
    closeModal: (state) => { state.activeModal = null; },
    setPageTitle: (state, action: PayloadAction<string>) => { state.pageTitle = action.payload; },
  },
});

export const { toggleSidebar, setSidebarOpen, toggleNotifPanel, closeNotifPanel, openModal, closeModal, setPageTitle } = uiSlice.actions;
export default uiSlice.reducer;
