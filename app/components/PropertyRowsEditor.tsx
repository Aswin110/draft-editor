import { useCallback } from "react";
import type { CustomAttribute } from "../types/draft-order";

interface PropertyRowsEditorProps {
  rows: CustomAttribute[];
  onChange: (rows: CustomAttribute[]) => void;
  addLabel?: string;
  /** Renders column headers above the rows. Off by default. */
  showHeaders?: boolean;
  keyHeader?: string;
  valueHeader?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  /** Validation message per row index, shown under that row's key field. */
  keyErrors?: Record<number, string>;
}

const ROW_COLUMNS = "1fr 1fr auto";

/**
 * Shared editor for a list of key/value property rows.
 * Always keeps at least one row so there is something to type into.
 */
export const PropertyRowsEditor = ({
  rows,
  onChange,
  addLabel = "Add property",
  showHeaders = false,
  keyHeader = "Key",
  valueHeader = "Value",
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  keyErrors,
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

  // Removing the only row would just replace it with another blank one.
  const canRemove =
    rows.length > 1 || rows[0]?.key !== "" || rows[0]?.value !== "";

  return (
    <s-stack direction="block" gap="small">
      {showHeaders && (
        <s-grid gridTemplateColumns={ROW_COLUMNS} gap="small">
          <s-text color="subdued">{keyHeader}</s-text>
          <s-text color="subdued">{valueHeader}</s-text>
          <s-box></s-box>
        </s-grid>
      )}
      {rows.map((row, index) => (
        <s-grid
          key={index}
          gridTemplateColumns={ROW_COLUMNS}
          gap="small"
          alignItems="start"
        >
          <s-text-field
            label={keyHeader}
            labelAccessibilityVisibility="exclusive"
            value={row.key}
            onInput={(e: Event) => handleFieldChange(index, "key", e)}
            placeholder={keyPlaceholder}
            error={keyErrors?.[index]}
            autocomplete="off"
          ></s-text-field>
          <s-text-field
            label={valueHeader}
            labelAccessibilityVisibility="exclusive"
            value={row.value}
            onInput={(e: Event) => handleFieldChange(index, "value", e)}
            placeholder={valuePlaceholder}
            autocomplete="off"
          ></s-text-field>
          <s-button
            variant="tertiary"
            icon="delete"
            disabled={!canRemove}
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
