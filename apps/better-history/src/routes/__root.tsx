import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { PRESET_LABELS, PRESETS } from "@/lib/ranges";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside className="flex w-56 shrink-0 flex-col border-zinc-200 border-r p-4 dark:border-zinc-800">
        <h1 className="mb-4 font-bold text-lg">Better History</h1>
        <nav className="flex flex-col gap-1 text-sm">
          {PRESETS.map((preset) => (
            <Link
              activeProps={{
                className: "bg-zinc-100 font-medium dark:bg-zinc-800",
              }}
              className="rounded-md px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              key={preset}
              search={{ preset, q: "" }}
              to="/"
            >
              {PRESET_LABELS[preset]}
            </Link>
          ))}
          <div className="mt-4 mb-1 px-2 font-semibold text-xs text-zinc-400 uppercase tracking-wide">
            Settings
          </div>
          <Link
            activeProps={{
              className: "bg-zinc-100 font-medium dark:bg-zinc-800",
            }}
            className="rounded-md px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            to="/settings/blacklist"
          >
            Blacklist
          </Link>
          <Link
            activeProps={{
              className: "bg-zinc-100 font-medium dark:bg-zinc-800",
            }}
            className="rounded-md px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            to="/settings/whitelist"
          >
            Whitelist
          </Link>
          <Link
            activeProps={{
              className: "bg-zinc-100 font-medium dark:bg-zinc-800",
            }}
            className="rounded-md px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            to="/settings/cleanup"
          >
            Cleanup
          </Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
