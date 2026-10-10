import { createFileRoute } from "@tanstack/react-router";

import { CleanupForm } from "@/features/cleanup/cleanup-form";

const CleanupPage = () => <CleanupForm />;

export const Route = createFileRoute("/settings/cleanup")({
  component: CleanupPage,
});
