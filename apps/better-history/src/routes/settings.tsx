import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
});

const TABS = [
  { to: "/settings/blacklist", label: "Blacklist" },
  { to: "/settings/whitelist", label: "Whitelist" },
  { to: "/settings/cleanup", label: "Cleanup" },
] as const;

function SettingsLayout() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-zinc-200 border-b px-4 dark:border-zinc-800">
        {TABS.map((t) => (
          <Link
            activeProps={{
              className:
                "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100",
            }}
            className="border-transparent border-b-2 px-3 py-3 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            key={t.to}
            to={t.to}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <div className="overflow-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}
