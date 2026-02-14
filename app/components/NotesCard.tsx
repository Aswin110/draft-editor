interface NotesCardProps {
  note: string | null;
}

export const NotesCard = ({ note }: NotesCardProps) => {
  if (!note) return null;

  return (
    <s-section>
      <s-heading>Notes</s-heading>
      <s-text>{note}</s-text>
    </s-section>
  );
};
