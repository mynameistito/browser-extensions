import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { Cleanup } from "../../lib/schemas";
import {
  DEFAULT_CLEANUP,
  loadCleanupSettings,
  runCleanupAction,
} from "./cleanup-settings";
import type { CleanupAction } from "./cleanup-settings";

interface CleanupFormState {
  readonly draftOverride: Cleanup | null;
  readonly errorMessage: string | null;
  readonly isDirty: boolean;
  readonly isWorking: boolean;
  readonly pendingAction: CleanupAction | null;
  readonly status: string | null;
}

const INITIAL_FORM_STATE: CleanupFormState = {
  draftOverride: null,
  errorMessage: null,
  isDirty: false,
  isWorking: false,
  pendingAction: null,
  status: null,
};

/**
 * Owns cleanup settings loading, draft edits, and confirmed actions.
 * @returns Query data and the state transitions used by the cleanup form.
 */
export const useCleanupSettings = () => {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState(INITIAL_FORM_STATE);

  const query = useQuery({
    queryFn: loadCleanupSettings,
    queryKey: ["cleanup"],
  });

  const draft = formState.draftOverride ?? query.data ?? DEFAULT_CLEANUP;

  const updateDraft = (updater: (current: Cleanup) => Cleanup) => {
    setFormState((current) => ({
      ...current,
      draftOverride: updater(
        current.draftOverride ?? query.data ?? DEFAULT_CLEANUP
      ),
      isDirty: true,
    }));
  };

  const requestAction = (pendingAction: CleanupAction) => {
    setFormState((current) => ({ ...current, pendingAction }));
  };

  const closeModal = () => {
    if (!formState.isWorking) {
      setFormState((current) => ({ ...current, pendingAction: null }));
    }
  };

  const confirmAction = async () => {
    const action = formState.pendingAction;

    if (action === null) {
      return;
    }

    setFormState((current) => ({
      ...current,
      errorMessage: null,
      isWorking: true,
      status: null,
    }));

    const result = await runCleanupAction(action, draft, async () => {
      await queryClient.invalidateQueries({ queryKey: ["cleanup"] });
    });

    setFormState((current) => ({
      ...current,
      draftOverride:
        result.kind === "success" && result.saved
          ? null
          : current.draftOverride,
      errorMessage: result.kind === "error" ? result.message : null,
      isDirty:
        result.kind === "success" && result.saved ? false : current.isDirty,
      isWorking: false,
      pendingAction: result.kind === "success" ? null : current.pendingAction,
      status: result.kind === "success" ? result.message : null,
    }));
  };

  return {
    closeModal,
    confirmAction,
    draft,
    formState,
    query,
    requestAction,
    updateDraft,
  };
};
