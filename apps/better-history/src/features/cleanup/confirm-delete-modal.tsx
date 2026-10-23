import { useEffect, useId, useRef, useState } from "react";

interface ConfirmDeleteModalProps {
  body: string;
  confirmLabel: string;
  isBusy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}

/**
 * Ask the user to type a confirmation word before destructive cleanup.
 * @param props - Modal labels, state, and close/confirm callbacks.
 * @returns The confirmation dialog.
 */
export const ConfirmDeleteModal = ({
  body,
  confirmLabel,
  isBusy = false,
  onClose,
  onConfirm,
  title,
}: ConfirmDeleteModalProps) => {
  const [value, setValue] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
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
    const dialog = dialogRef.current;

    if (dialog !== null && !dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog !== null && dialog.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      onCancel={(event) => {
        if (isBusy) {
          event.preventDefault();

          return;
        }

        onClose();
      }}
      ref={dialogRef}
      aria-describedby={bodyId}
      aria-labelledby={titleId}
      className="bg-card text-foreground backdrop:bg-foreground/45 m-auto w-full max-w-md rounded-2xl border p-0 shadow-2xl"
    >
      <form
        className="border-border dark:border-border w-full rounded-2xl border p-5"
        onSubmit={handleSubmit}
      >
        <div className="space-y-2">
          <p className="tracking-eyebrow text-destructive text-xs font-semibold uppercase">
            Destructive cleanup
          </p>
          <h2 className="text-xl font-semibold" id={titleId}>
            {title}
          </h2>
          <p
            className="text-muted-foreground dark:text-muted-foreground text-sm leading-6"
            id={bodyId}
          >
            {body}
          </p>
        </div>

        <label className="mt-5 block space-y-2 text-sm">
          <span className="font-medium">Type “delete” to confirm</span>
          <input
            autoFocus
            className="border-border focus-visible:border-ring focus-visible:ring-ring/50 dark:border-border w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-sm transition outline-none focus:ring-2"
            onChange={(event) => {
              setValue(event.target.value);
            }}
            value={value}
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="border-border hover:bg-muted dark:border-border dark:hover:bg-muted rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="bg-destructive text-primary-foreground hover:bg-destructive/90 rounded-lg px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canConfirm}
            type="submit"
          >
            {isBusy ? "Working…" : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
};
