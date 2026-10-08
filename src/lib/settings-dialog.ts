/** Keep the native settings dialog aligned with the requested open state. */
export const syncSettingsDialog = (
  dialog: HTMLDialogElement | null,
  open: boolean
): void => {
  if (!dialog) {
    return;
  }

  if (open && !dialog.open) {
    dialog.showModal();
  } else if (!open && dialog.open) {
    dialog.close();
  }
};
