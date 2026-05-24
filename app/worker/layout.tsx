// Mobile-only layout — no sidebar, no topbar. 375px target.
export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#0F172A", minHeight: "100vh" }}>{children}</div>;
}
