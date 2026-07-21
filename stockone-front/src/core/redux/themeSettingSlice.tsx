import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  dataTheme:      "default",
  dataLayout:     "default",
  dataNavStyle:   "default",
  dataTopbarColor:"#F97316",
  dataSidebarColor:"#1a1a1a",
};

const themeSettingSlice = createSlice({
  name: "themeSetting",
  initialState,
  reducers: {
    setDataTheme:      (state, { payload }) => { state.dataTheme      = payload; },
    setDataLayout:     (state, { payload }) => { state.dataLayout     = payload; },
    setDataNavStyle:   (state, { payload }) => { state.dataNavStyle   = payload; },
    setDataTopbarColor:(state, { payload }) => { state.dataTopbarColor= payload; },
  },
});

export const { setDataTheme, setDataLayout, setDataNavStyle, setDataTopbarColor } = themeSettingSlice.actions;
export default themeSettingSlice.reducer;
