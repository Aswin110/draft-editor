import { useState, useCallback } from "react";
import { NoteEditModal } from "./NoteEditModal";

interface NotesCardProps {
  note: string | null;
  onChange: (note: string) => void;
  readOnly?: boolean;
}

export const NotesCard = ({ note, onChange, readOnly = false }: NotesCardProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpen = useCallback(() => setIsModalOpen(true), []);
  const handleClose = useCallback(() => setIsModalOpen(false), []);

  return (
    <s-section>
      <s-stack
        direction="inline"
        justifyContent="space-between"
        alignItems="center"
      >
        <s-heading>Notes</s-heading>
        {!readOnly && (
          <s-button
            variant="tertiary"
            icon="edit"
            onClick={handleOpen}
            accessibilityLabel="Edit note"
          ></s-button>
        )}
      </s-stack>
      {note ? (
        <s-text>{note}</s-text>
      ) : (
        <s-text color="subdued">No notes</s-text>
      )}
      <NoteEditModal
        open={isModalOpen}
        note={note || ""}
        onClose={handleClose}
        onSave={onChange}
      />
    </s-section>
  );
};
