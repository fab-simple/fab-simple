"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FolderOpen, Search, Check } from "lucide-react";
import { useResourceList } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { rehydrateProject, readProjectFromStorage } from "@/store/projectSlice";
import { useAppDispatch } from "@/hooks/useAppRedux";

interface Project {
  id: string;
  name: string;
  number: string | null;
  status: string;
}

/**
 * Sidebar-integrated project picker. Full-width, dark theme.
 * When no project is selected, shows a pulsing CTA.
 * Supports `forceOpen` prop so external components (e.g. locked nav items) can trigger it.
 */
export function ProjectPicker({ forceOpen, onForceOpenHandled }: {
  forceOpen?: boolean;
  onForceOpenHandled?: () => void;
}) {
  const dispatch = useAppDispatch();
  const { selectedProjectId, selectedProjectName, selectedProjectNumber, selectProject } =
    useGlobalProject();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const projects = useResourceList<Project>("projects", { limit: "200", order_by: "name", dir: "asc" });

  // Rehydrate from localStorage once the projects list has loaded.
  useEffect(() => {
    if (!projects.data || selectedProjectId) return;
    const storedId = readProjectFromStorage();
    if (!storedId) return;
    const found = projects.data.find((p) => p.id === storedId);
    if (found) {
      dispatch(rehydrateProject({ id: found.id, name: found.name, number: found.number }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.data]);

  // Handle forceOpen from parent (e.g. clicking a locked nav item).
  useEffect(() => {
    if (forceOpen && !open) {
      setOpen(true);
      setSearch("");
      onForceOpenHandled?.();
    }
  }, [forceOpen, open, onForceOpenHandled]);

  // Close on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = (projects.data ?? []).filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.number ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const hasProject = !!selectedProjectId;

  return (
    <div ref={ref} className="sidebar-project-picker">
      {/* Trigger button */}
      <button
        id="global-project-picker"
        onClick={() => { setOpen((v) => !v); setSearch(""); }}
        className={`sidebar-picker-btn ${hasProject ? "has-project" : "no-project"}`}
      >
        <div className="sidebar-picker-icon">
          <FolderOpen size={14} />
        </div>
        <div className="sidebar-picker-content">
          {hasProject ? (
            <>
              <span className="sidebar-picker-name">{selectedProjectName}</span>
              {selectedProjectNumber && (
                <span className="sidebar-picker-number">#{selectedProjectNumber}</span>
              )}
            </>
          ) : (
            <span className="sidebar-picker-cta">Select a Project</span>
          )}
        </div>
        <ChevronDown
          size={12}
          className="sidebar-picker-chevron"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="sidebar-picker-dropdown">
          {/* Search */}
          <div className="sidebar-picker-search-wrap">
            <div className="sidebar-picker-search">
              <Search size={11} style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <input
                autoFocus
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sidebar-picker-search-input"
              />
            </div>
          </div>

          {/* Project list */}
          <div className="sidebar-picker-list">
            {projects.isLoading && (
              <div className="sidebar-picker-empty">Loading…</div>
            )}
            {filtered.length === 0 && !projects.isLoading && (
              <div className="sidebar-picker-empty">
                {(projects.data ?? []).length === 0
                  ? "No projects yet — create one from the Projects page"
                  : "No matching projects"}
              </div>
            )}
            {filtered.map((p) => {
              const isSelected = p.id === selectedProjectId;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    selectProject(p.id, p.name, p.number);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`sidebar-picker-item ${isSelected ? "active" : ""}`}
                >
                  <div className="sidebar-picker-item-info">
                    <div className="sidebar-picker-item-name">{p.name}</div>
                    <div className="sidebar-picker-item-num">
                      {p.number ? (
                        <>
                          #{p.number}
                          {p.status && p.status !== "active" && (
                            <span style={{ marginLeft: 6, textTransform: "capitalize", opacity: 0.7 }}>
                              · {p.status.replace("_", " ")}
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: "#f59e0b", opacity: 0.9 }}>
                          Pending Job # {p.status ? `· ${p.status.replace("_", " ")}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check size={12} style={{ color: "var(--primary)", flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
