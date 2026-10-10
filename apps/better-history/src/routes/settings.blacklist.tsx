import { createFileRoute } from "@tanstack/react-router";
import { RulesEditor } from "@/features/domains/rules-editor";
import { useRules } from "@/features/domains/use-rules";

export const Route = createFileRoute("/settings/blacklist")({
  component: BlacklistPage,
});

function BlacklistPage() {
  const { data, isPending, save } = useRules("blacklist");
  if (isPending) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }
  return (
    <RulesEditor onChange={save} rules={data ?? []} title="Domain Blacklist" />
  );
}
