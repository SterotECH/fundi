import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
}: Readonly<ModalProps>) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      className="app-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
        }
      }}
      ref={dialogRef}
    >
      <div className="app-dialog-header">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">{title}</h2>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
          ) : null}
        </div>

        <button
          aria-label="Close dialog"
          className="app-dialog-close"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {children ? <div className="app-dialog-body">{children}</div> : null}
      {footer ? <div className="app-dialog-footer">{footer}</div> : null}
    </dialog>
  );
}
