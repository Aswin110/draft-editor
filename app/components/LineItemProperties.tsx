import { useState, useCallback } from "react";
import type { CustomAttribute } from "../types/draft-order";

interface LineItemPropertiesProps {
  properties: CustomAttribute[];
  onChange: (properties: CustomAttribute[]) => void;
}

export const LineItemProperties = ({
  properties,
  onChange,
}: LineItemPropertiesProps) => {
  const [expanded, setExpanded] = useState(properties.length > 0);

  const handleKeyChange = useCallback(
    (index: number, e: Event) => {
      const value = (e.currentTarget as HTMLInputElement).value;
      const updated = [...properties];
      updated[index] = { ...updated[index], key: value };
      onChange(updated);
    },
    [properties, onChange],
  );

  const handleValueChange = useCallback(
    (index: number, e: Event) => {
      const value = (e.currentTarget as HTMLInputElement).value;
      const updated = [...properties];
      updated[index] = { ...updated[index], value: value };
      onChange(updated);
    },
    [properties, onChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = properties.filter((_, i) => i !== index);
      onChange(updated);
      if (updated.length === 0) {
        setExpanded(false);
      }
    },
    [properties, onChange],
  );

  const handleAdd = useCallback(() => {
    onChange([...properties, { key: "", value: "" }]);
    setExpanded(true);
  }, [properties, onChange]);

  return (
    <s-stack direction="block" gap="small">
      {expanded && properties.length > 0 && (
        <s-stack direction="block" gap="small">
          {properties.map((prop, index) => (
            <s-grid
              key={index}
              gridTemplateColumns="1fr 1fr auto"
              gap="small"
              alignItems="start"
            >
              <s-text-field
                label="Key"
                labelAccessibilityVisibility="exclusive"
                value={prop.key}
                onInput={(e: Event) => handleKeyChange(index, e)}
                placeholder="Key"
              ></s-text-field>
              <s-text-field
                label="Value"
                labelAccessibilityVisibility="exclusive"
                value={prop.value}
                onInput={(e: Event) => handleValueChange(index, e)}
                placeholder="Value"
              ></s-text-field>
              <s-button
                variant="tertiary"
                icon="delete"
                onClick={() => handleRemove(index)}
                accessibilityLabel={`Remove property ${prop.key || index + 1}`}
              ></s-button>
            </s-grid>
          ))}
        </s-stack>
      )}
      {!expanded && properties.length > 0 && (
        <s-button
          variant="tertiary"
          onClick={() => setExpanded(true)}
          accessibilityLabel="Show properties"
        >
          Properties ({properties.length})
        </s-button>
      )}
      <s-box>
        <s-button
          variant="tertiary"
          icon="plus"
          onClick={handleAdd}
          accessibilityLabel="Add property"
        >
          Add property
        </s-button>
      </s-box>
    </s-stack>
  );
};
