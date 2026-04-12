import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type AlertDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  tone?: "default" | "danger";
  children?: ReactNode;
};

export function AlertDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmLoading = false,
  onCancel,
  onConfirm,
  tone = "default",
  children,
}: Readonly<AlertDialogProps>) {
  return (
    <Modal
      description={description}
      footer={
        <>
          <Button onClick={onCancel} type="button" variant="secondary">
            {cancelLabel}
          </Button>
          <Button
            leadingIcon={<AlertTriangle className="h-4 w-4" />}
            loading={confirmLoading}
            onClick={onConfirm}
            type="button"
            variant={tone === "danger" ? "danger" : "primary"}
          >
            {confirmLabel}
          </Button>
        </>
      }
      onClose={onCancel}
      open={open}
      title={title}
    >
      {children}
    </Modal>
  );
}
