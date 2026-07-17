"use client";

import { useAppSelector, useAppDispatch } from "@/hooks/useAppRedux";
import { setGlobalProject } from "@/store/projectSlice";

/**
 * Returns the globally-selected project ID (or null = "All Projects").
 * All pages that filter by project should use this instead of local state.
 *
 * @example
 *   const { selectedProjectId } = useGlobalProject();
 *   const filters = selectedProjectId ? { project_id: selectedProjectId } : {};
 */
export function useGlobalProject() {
  const dispatch = useAppDispatch();
  const { selectedProjectId, selectedProjectName, selectedProjectNumber } =
    useAppSelector((s) => s.project);

  function selectProject(id: string, name: string, number: string | null) {
    dispatch(setGlobalProject({ id, name, number }));
  }

  return { selectedProjectId, selectedProjectName, selectedProjectNumber, selectProject };
}
