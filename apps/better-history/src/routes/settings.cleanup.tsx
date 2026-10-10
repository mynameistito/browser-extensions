import { createFileRoute } from "@tanstack/react-router";
import { CleanupForm } from "@/features/cleanup/cleanup-form";

export const Route = createFileRoute("/settings/cleanup")({
  component: CleanupPage,
});

function CleanupPage() {
  return <CleanupForm />;
}
