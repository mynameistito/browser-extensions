import { useEffect, useId, useState } from "react";

interface ConfirmDeleteModalProps {
  body: string;
  confirmLabel: string;
  isBusy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}

export function ConfirmDeleteModal({
  body,
  confirmLabel,
  isBusy = false,
  onClose,
  onConfirm,
  title,
}: ConfirmDeleteModalProps) {
  const [value, setValue] = useState("");
  const canConfirm = value.trim().toLowerCase() === "delete" && !isBusy;
  const titleId = useId();
  const bodyId = useId();

  const handleSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (canConfirm) {
      onConfirm();
    }
  };

  useEffect(() => {
    const onDocKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onDocKeyDown);
    return () => document.removeEventListener("keydown", onDocKeyDown);
  }, [isBusy, onClose]);

  return (
    <div
      aria-describedby={bodyId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/45 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <form
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        onSubmit={handleSubmit}
      >
        <div className="space-y-2">
          <p className="font-semibold text-red-600 text-xs uppercase tracking-[0.24em]">
            Destructive cleanup
          </p>
          <h2 className="font-semibold text-xl" id={titleId}>
            {title}
          </h2>
          <p
            className="text-sm text-zinc-600 leading-6 dark:text-zinc-400"
            id={bodyId}
          >
            {body}
          </p>
        </div>

        <label className="mt-5 block space-y-2 text-sm">
          <span className="font-medium">Type “delete” to confirm</span>
          <input
            autoFocus
            className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 font-mono text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-zinc-800"
            onChange={(event) => setValue(event.target.value)}
            value={value}
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:hover:bg-zinc-900"
            disabled={isBusy}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canConfirm}
            type="submit"
          >
            {isBusy ? "Working…" : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
