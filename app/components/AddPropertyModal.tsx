import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { CustomAttribute, PropertyTemplate } from "../types/draft-order";
import { PropertyRowsEditor } from "./PropertyRowsEditor";

interface AddPropertyModalProps {
  id: string;
  templates: PropertyTemplate[];
  onAdd: (properties: CustomAttribute[]) => void;
}

const emptyRow = (): CustomAttribute => ({ key: "", value: "" });

export const AddPropertyModal = ({
  id,
  templates,
  onAdd,
}: AddPropertyModalProps) => {
  const modalRef = useRef<HTMLElement | null>(null);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<CustomAttribute[]>([emptyRow()]);

  const reset = useCallback(() => {
    setSearch("");
    setRows([emptyRow()]);
  }, []);

  // Reset the form whenever the modal is dismissed (Add, Cancel, X, or Escape).
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    el.addEventListener("hide", reset);
    return () => el.removeEventListener("hide", reset);
  }, [reset]);

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(query));
  }, [search, templates]);

  const handleSearch = useCallback((e: Event) => {
    setSearch((e.currentTarget as HTMLInputElement).value);
  }, []);

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
      heading="Add properties"
    >
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small">
          <s-text-field
            label="Search templates"
            labelAccessibilityVisibility="exclusive"
            icon="search"
            placeholder="Search property templates..."
            value={search}
            onInput={handleSearch}
            autocomplete="off"
          ></s-text-field>
          {templates.length === 0 ? (
            <s-text color="subdued">
              No saved templates. Create some on the Property Templates page.
            </s-text>
          ) : matches.length === 0 ? (
            <s-text color="subdued">No templates match your search.</s-text>
          ) : (
            <s-stack direction="block" gap="small">
              {matches.map((template) => (
                <s-box
                  key={template.id}
                  border="base"
                  borderRadius="base"
                  padding="small-300"
                >
                  <s-stack
                    direction="inline"
                    justifyContent="space-between"
                    alignItems="center"
                    gap="base"
                  >
                    <s-stack direction="block" gap="small-300">
                      <s-text type="strong">{template.name}</s-text>
                      <s-text color="subdued">
                        {template.properties
                          .map((p) => p.key)
                          .filter(Boolean)
                          .join(", ")}
                      </s-text>
                    </s-stack>
                    <s-button
                      variant="secondary"
                      icon="plus"
                      onClick={() => handleApplyTemplate(template)}
                      accessibilityLabel={`Add ${template.name}`}
                    >
                      Add
                    </s-button>
                  </s-stack>
                </s-box>
              ))}
            </s-stack>
          )}
        </s-stack>

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
