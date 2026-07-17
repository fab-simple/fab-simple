"use client";

import { usePathname } from "next/navigation";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { useResourceList } from "@/hooks/useResource";
import { NAV_SECTIONS } from "@/lib/nav-config";
import { FolderKanban, Search, ArrowRight } from "lucide-react";
import { useState, useMemo } from "react";

interface Project {
  id: string;
  name: string;
  number: string | null;
  status: string;
  est_tonnage?: number;
  contract_value?: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: "#16A34A",
  on_hold: "#EAB308",
  completed: "#3B82F6",
  archived: "#94A3B8",
};

/**
 * Wraps dashboard page content. When the current route is project-scoped
 * and no project is selected, shows a full-screen overlay prompting
 * the user to pick a project.
 */
export function ProjectGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { selectedProjectId, selectProject } = useGlobalProject();
  const [search, setSearch] = useState("");

  const projects = useResourceList<Project>("projects", {
    limit: "200",
    order_by: "name",
    dir: "asc",
  });

  // Determine if the current path is project-scoped.
  const isProjectScoped = useMemo(() => {
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        if (item.projectScoped) {
          if (pathname === item.href || pathname.startsWith(item.href + "/")) {
            return true;
          }
        }
      }
    }
    return false;
  }, [pathname]);

  // If project is selected or page isn't project-scoped, render children normally.
  if (selectedProjectId || !isProjectScoped) {
    return <>{children}</>;
  }

  const allProjects = (projects.data ?? []).filter(
    (p) => p.status !== "awarded_setup"
  );
  const filtered = allProjects.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.number ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="project-gate">
      <div className="project-gate-card">
        {/* Header */}
        <div className="project-gate-header">
          <div className="project-gate-icon-wrap">
            <FolderKanban size={28} strokeWidth={1.5} />
          </div>
          <h2 className="project-gate-title">Select a Project to Continue</h2>
          <p className="project-gate-subtitle">
            This module requires an active project context. Choose a project below to get started.
          </p>
        </div>

        {/* Search */}
        {allProjects.length > 3 && (
          <div className="project-gate-search-wrap">
            <Search
              size={14}
              style={{ color: "var(--muted)", flexShrink: 0 }}
            />
            <input
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="project-gate-search-input"
              autoFocus
            />
          </div>
        )}

        {/* Project cards */}
        <div className="project-gate-list">
          {projects.isLoading && (
            <div className="project-gate-empty">
              <div className="project-gate-spinner" />
              <span>Loading projects…</span>
            </div>
          )}

          {!projects.isLoading && allProjects.length === 0 && (
            <div className="project-gate-empty">
              <FolderKanban size={32} style={{ opacity: 0.3 }} />
              <p style={{ margin: "8px 0 0", fontWeight: 500 }}>
                No projects yet
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: "var(--muted)",
                }}
              >
                Head to the <strong>Projects</strong> page to create your first
                project.
              </p>
            </div>
          )}

          {!projects.isLoading && filtered.length === 0 && allProjects.length > 0 && (
            <div className="project-gate-empty">
              No projects matching &quot;{search}&quot;
            </div>
          )}

          {filtered.map((p) => (
            <button
              key={p.id}
              className="project-gate-project-card"
              onClick={() => selectProject(p.id, p.name, p.number)}
            >
              <div
                className="project-gate-status-dot"
                style={{
                  background: STATUS_COLORS[p.status] ?? "#94A3B8",
                }}
              />
              <div className="project-gate-project-info">
                <div className="project-gate-project-name">{p.name}</div>
                <div className="project-gate-project-meta">
                  {p.number && <span>#{p.number}</span>}
                  {p.status && (
                    <span style={{ textTransform: "capitalize" }}>
                      {p.status.replace("_", " ")}
                    </span>
                  )}
                  {p.est_tonnage != null && p.est_tonnage > 0 && (
                    <span>{p.est_tonnage} tons</span>
                  )}
                </div>
              </div>
              <ArrowRight
                size={14}
                className="project-gate-arrow"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
