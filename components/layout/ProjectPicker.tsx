"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FolderOpen, X, Search, Check } from "lucide-react";
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

export function ProjectPicker() {
  const dispatch = useAppDispatch();
  const { selectedProjectId, selectedProjectName, selectedProjectNumber, selectProject, clearProject } =
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

  const filtered = (projects.data ?? [])
    .filter((p) => p.status !== "awarded_setup")
    .filter((p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.number ?? "").toLowerCase().includes(search.toLowerCase())
    );

  const activeLabel = selectedProjectId
    ? `${selectedProjectNumber ? `${selectedProjectNumber} · ` : ""}${selectedProjectName}`
    : "All Projects";

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      {/* Trigger button */}
      <button
        id="global-project-picker"
        onClick={() => { setOpen((v) => !v); setSearch(""); }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 8,
          border: selectedProjectId
            ? "1px solid var(--primary-bd)"
            : "1px solid var(--border)",
          background: selectedProjectId ? "var(--primary-bg)" : "var(--bg-muted)",
          color: selectedProjectId ? "var(--primary)" : "var(--muted)",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          maxWidth: 220,
          transition: "all 0.15s ease",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
        title={activeLabel}
      >
        <FolderOpen size={13} style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
          {activeLabel}
        </span>
        {selectedProjectId ? (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); clearProject(); }}
            style={{
              marginLeft: 2,
              display: "flex",
              alignItems: "center",
              color: "var(--primary)",
              flexShrink: 0,
              opacity: 0.7,
            }}
            title="Clear project filter"
          >
            <X size={11} />
          </span>
        ) : (
          <ChevronDown size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 200,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "var(--shadow-lg)",
            minWidth: 280,
            maxWidth: 340,
            overflow: "hidden",
            animation: "fadeInDown 0.12s ease",
          }}
        >
          {/* Search */}
          <div style={{ padding: "10px 10px 6px", borderBottom: "1px solid var(--border)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 8px",
                background: "var(--bg)",
                borderRadius: 6,
                border: "1px solid var(--border)",
              }}
            >
              <Search size={11} style={{ color: "var(--muted)", flexShrink: 0 }} />
              <input
                autoFocus
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 12,
                  color: "var(--text)",
                  flex: 1,
                  minWidth: 0,
                }}
              />
            </div>
          </div>

          {/* "All Projects" option */}
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            <button
              onClick={() => { clearProject(); setOpen(false); setSearch(""); }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 12px",
                background: !selectedProjectId ? "var(--primary-bg)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                color: !selectedProjectId ? "var(--primary)" : "var(--text-2)",
                textAlign: "left",
                borderBottom: "1px solid var(--border)",
                fontWeight: !selectedProjectId ? 600 : 400,
              }}
            >
              <FolderOpen size={13} style={{ flexShrink: 0, opacity: 0.5 }} />
              <span style={{ flex: 1 }}>All Projects</span>
              {!selectedProjectId && <Check size={12} style={{ color: "var(--primary)" }} />}
            </button>

            {/* Project list */}
            {projects.isLoading && (
              <div style={{ padding: "16px 12px", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
                Loading…
              </div>
            )}
            {filtered.length === 0 && !projects.isLoading && (
              <div style={{ padding: "16px 12px", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
                No projects found
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
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: isSelected ? "var(--primary-bg)" : "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    fontSize: 12,
                    color: isSelected ? "var(--primary)" : "var(--text)",
                    textAlign: "left",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: isSelected ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </div>
                    {p.number && (
                      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>
                        #{p.number}
                        {p.status && p.status !== "active" && (
                          <span style={{ marginLeft: 6, textTransform: "capitalize", opacity: 0.8 }}>
                            · {p.status}
                          </span>
                        )}
                      </div>
                    )}
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
