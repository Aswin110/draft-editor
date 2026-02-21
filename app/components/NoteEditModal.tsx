import { useState, useEffect } from "react";
import { Modal, TitleBar } from "@shopify/app-bridge-react";

interface NoteEditModalProps {
  open: boolean;
  note: string;
  onClose: () => void;
  onSave: (note: string) => void;
}

const MAX_NOTE_LENGTH = 5000;

export const NoteEditModal = ({
  open,
  note,
  onClose,
  onSave,
}: NoteEditModalProps) => {
  const [value, setValue] = useState(note);

  useEffect(() => {
    if (open) {
      setValue(note);
    }
  }, [open, note]);

  const handleInput = (e: Event) => {
    const input = (e.currentTarget as HTMLTextAreaElement).value;
    setValue(input.slice(0, MAX_NOTE_LENGTH));
  };

  const handleDone = () => {
    onSave(value);
    onClose();
  };

  return (
    <Modal id="note-edit-modal" open={open} onHide={onClose}>
      <TitleBar title="Edit note">
        <button onClick={onClose}>Cancel</button>
        <button variant="primary" onClick={handleDone}>
          Done
        </button>
      </TitleBar>
      <s-box padding="base">
        <s-text-area
          label="Note"
          labelAccessibilityVisibility="exclusive"
          value={value}
          onInput={handleInput}
          maxLength={MAX_NOTE_LENGTH}
          rows={4}
          details="To comment on a draft order or mention a staff member, use Timeline instead"
        ></s-text-area>
      </s-box>
    </Modal>
  );
};
