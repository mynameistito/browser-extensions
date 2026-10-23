import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

const TABS = [
  { label: "Blacklist", to: "/settings/blacklist" },
  { label: "Whitelist", to: "/settings/whitelist" },
  { label: "Cleanup", to: "/settings/cleanup" },
] as const;

const SettingsLayout = () => (
  <div className="flex h-full flex-col">
    <div className="border-border dark:border-border flex items-center gap-1 border-b px-4">
      {TABS.map((t) => (
        <Link
          activeProps={{
            className:
              "border-primary text-foreground dark:border-border dark:text-foreground",
          }}
          className="text-muted-foreground hover:text-foreground dark:hover:text-foreground border-b-2 border-transparent px-3 py-3 text-sm"
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

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
});
