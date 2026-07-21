import { useState, useEffect, useCallback, useRef } from "react";
import type { CustomAttribute, PropertyTemplate } from "../types/draft-order";
import { PropertyRowsEditor } from "./PropertyRowsEditor";
import { TemplateSearchList } from "./TemplateSearchList";

interface AddPropertyModalProps {
  id: string;
  /** Already filtered to the target this modal is adding to. */
  templates: PropertyTemplate[];
  onAdd: (properties: CustomAttribute[]) => void;
  heading?: string;
  emptyTemplatesMessage?: string;
}

const emptyRow = (): CustomAttribute => ({ key: "", value: "" });

export const AddPropertyModal = ({
  id,
  templates,
  onAdd,
  heading = "Add properties",
  emptyTemplatesMessage = "No saved templates. Create some on the Property Templates page.",
}: AddPropertyModalProps) => {
  const modalRef = useRef<HTMLElement | null>(null);
  const [rows, setRows] = useState<CustomAttribute[]>([emptyRow()]);

  const reset = useCallback(() => {
    setRows([emptyRow()]);
  }, []);

  // Reset the form whenever the modal is dismissed (Add, Cancel, X, or Escape).
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    el.addEventListener("hide", reset);
    return () => el.removeEventListener("hide", reset);
  }, [reset]);

  const handleApplyTemplate = useCallback((template: PropertyTemplate) => {
    const incoming = template.properties.map((p) => ({ ...p }));
    setRows((prev) => {
      // Drop a single leading blank row so applying into a fresh modal is clean.
      const base =
        prev.length === 1 && !prev[0].key && !prev[0].value ? [] : prev;
      return [...base, ...incoming];
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const cleaned = rows.filter((r) => r.key.trim() !== "");
    if (cleaned.length > 0) {
      onAdd(cleaned);
    }
  }, [rows, onAdd]);

  return (
    <s-modal
      ref={(el) => {
        modalRef.current = el;
      }}
      id={id}
      heading={heading}
    >
      <s-stack direction="block" gap="base">
        <TemplateSearchList
          templates={templates}
          onApply={handleApplyTemplate}
          emptyMessage={emptyTemplatesMessage}
        />

        <s-divider></s-divider>

        <s-stack direction="block" gap="small">
          <s-text type="strong">Properties to add</s-text>
          <PropertyRowsEditor rows={rows} onChange={setRows} />
        </s-stack>
      </s-stack>

      <s-button slot="secondary-actions" command="--hide" commandFor={id}>
        Cancel
      </s-button>
      <s-button
        slot="primary-action"
        variant="primary"
        command="--hide"
        commandFor={id}
        onClick={handleConfirm}
      >
        Add
      </s-button>
    </s-modal>
  );
};
