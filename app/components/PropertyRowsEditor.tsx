import { useCallback } from "react";
import type { CustomAttribute } from "../types/draft-order";

interface PropertyRowsEditorProps {
  rows: CustomAttribute[];
  onChange: (rows: CustomAttribute[]) => void;
  addLabel?: string;
}

/**
 * Shared editor for a list of key/value property rows.
 * Always keeps at least one row so there is something to type into.
 */
export const PropertyRowsEditor = ({
  rows,
  onChange,
  addLabel = "Add property",
}: PropertyRowsEditorProps) => {
  const handleFieldChange = useCallback(
    (index: number, field: "key" | "value", e: Event) => {
      const value = (e.currentTarget as HTMLInputElement).value;
      const updated = [...rows];
      updated[index] = { ...updated[index], [field]: value };
      onChange(updated);
    },
    [rows, onChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = rows.filter((_, i) => i !== index);
      onChange(updated.length > 0 ? updated : [{ key: "", value: "" }]);
    },
    [rows, onChange],
  );

  const handleAdd = useCallback(() => {
    onChange([...rows, { key: "", value: "" }]);
  }, [rows, onChange]);

  return (
    <s-stack direction="block" gap="small">
      {rows.map((row, index) => (
        <s-grid
          key={index}
          gridTemplateColumns="1fr 1fr auto"
          gap="small"
          alignItems="start"
        >
          <s-text-field
            label="Key"
            labelAccessibilityVisibility="exclusive"
            value={row.key}
            onInput={(e: Event) => handleFieldChange(index, "key", e)}
            placeholder="Key"
            autocomplete="off"
          ></s-text-field>
          <s-text-field
            label="Value"
            labelAccessibilityVisibility="exclusive"
            value={row.value}
            onInput={(e: Event) => handleFieldChange(index, "value", e)}
            placeholder="Value"
            autocomplete="off"
          ></s-text-field>
          <s-button
            variant="tertiary"
            icon="delete"
            onClick={() => handleRemove(index)}
            accessibilityLabel={`Remove property ${row.key || index + 1}`}
          ></s-button>
        </s-grid>
      ))}
      <s-box>
        <s-button
          variant="tertiary"
          icon="plus"
          onClick={handleAdd}
          accessibilityLabel={addLabel}
        >
          {addLabel}
        </s-button>
      </s-box>
    </s-stack>
  );
};
