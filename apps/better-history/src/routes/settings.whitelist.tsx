import { createFileRoute } from "@tanstack/react-router";
import { RulesEditor } from "@/features/domains/rules-editor";
import { useRules } from "@/features/domains/use-rules";

export const Route = createFileRoute("/settings/whitelist")({
  component: WhitelistPage,
});

function WhitelistPage() {
  const { data, isPending, save } = useRules("whitelist");
  if (isPending) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }
  return (
    <RulesEditor onChange={save} rules={data ?? []} title="Domain Whitelist" />
  );
}
