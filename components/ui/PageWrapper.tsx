"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/hooks/useAppRedux";
import { setPageTitle } from "@/store/uiSlice";

export function PageWrapper({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setPageTitle(title));
  }, [title, dispatch]);

  return <>{children}</>;
}
