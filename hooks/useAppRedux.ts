"use client";

import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";

export const useAppSelector = <T>(selector: (state: RootState) => T): T =>
  useSelector(selector);

export const useAppDispatch = () => useDispatch<AppDispatch>();
