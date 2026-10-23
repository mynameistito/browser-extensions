import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

import { PRESET_LABELS, PRESETS } from "@/lib/ranges";

const ACTIVE_NAV_CLASS = "bg-muted font-medium dark:bg-border";

const RootLayout = () => (
  <div className="bg-card text-foreground dark:bg-card dark:text-foreground flex h-screen">
    <aside className="border-border dark:border-border flex w-56 shrink-0 flex-col border-r p-4">
      <h1 className="mb-4 text-lg font-bold">Better History</h1>
      <nav className="flex flex-col gap-1 text-sm">
        {PRESETS.map((preset) => (
          <Link
            activeProps={{
              className: ACTIVE_NAV_CLASS,
            }}
            className="hover:bg-muted dark:hover:bg-muted rounded-md px-2 py-1.5"
            key={preset}
            search={{ preset, q: "" }}
            to="/"
          >
            {PRESET_LABELS[preset]}
          </Link>
        ))}
        <div className="text-muted-foreground mt-4 mb-1 px-2 text-xs font-semibold tracking-wide uppercase">
          Settings
        </div>
        <Link
          activeProps={{
            className: ACTIVE_NAV_CLASS,
          }}
          className="hover:bg-muted dark:hover:bg-muted rounded-md px-2 py-1.5"
          to="/settings/blacklist"
        >
          Blacklist
        </Link>
        <Link
          activeProps={{
            className: ACTIVE_NAV_CLASS,
          }}
          className="hover:bg-muted dark:hover:bg-muted rounded-md px-2 py-1.5"
          to="/settings/whitelist"
        >
          Whitelist
        </Link>
        <Link
          activeProps={{
            className: ACTIVE_NAV_CLASS,
          }}
          className="hover:bg-muted dark:hover:bg-muted rounded-md px-2 py-1.5"
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

export const Route = createRootRoute({
  component: RootLayout,
});
