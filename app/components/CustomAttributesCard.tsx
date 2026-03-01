import { useCallback } from "react";
import type { CustomAttribute } from "../types/draft-order";

interface CustomAttributesCardProps {
  attributes: CustomAttribute[];
  onChange: (attributes: CustomAttribute[]) => void;
  readOnly?: boolean;
}

export const CustomAttributesCard = ({
  attributes,
  onChange,
  readOnly = false,
}: CustomAttributesCardProps) => {
  const handleKeyChange = useCallback(
    (index: number, e: Event) => {
      const value = (e.currentTarget as HTMLInputElement).value;
      const updated = [...attributes];
      updated[index] = { ...updated[index], key: value };
      onChange(updated);
    },
    [attributes, onChange],
  );

  const handleValueChange = useCallback(
    (index: number, e: Event) => {
      const value = (e.currentTarget as HTMLInputElement).value;
      const updated = [...attributes];
      updated[index] = { ...updated[index], value: value };
      onChange(updated);
    },
    [attributes, onChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(attributes.filter((_, i) => i !== index));
    },
    [attributes, onChange],
  );

  const handleAdd = useCallback(() => {
    onChange([...attributes, { key: "", value: "" }]);
  }, [attributes, onChange]);

  return (
    <s-section>
      <s-stack direction="inline" justifyContent="space-between" alignItems="center">
        <s-heading>Custom attributes</s-heading>
        {!readOnly && (
          <s-button
            variant="tertiary"
            icon="plus"
            onClick={handleAdd}
            accessibilityLabel="Add custom attribute"
          >
            Add
          </s-button>
        )}
      </s-stack>
      {attributes.length === 0 ? (
        <s-text color="subdued">No custom attributes</s-text>
      ) : readOnly ? (
        <s-stack direction="block" gap="base">
          {attributes.map((attr, index) => (
            <s-stack key={index} direction="inline" gap="small">
              <s-text type="strong">{attr.key}:</s-text>
              <s-text>{attr.value}</s-text>
            </s-stack>
          ))}
        </s-stack>
      ) : (
        <s-stack direction="block" gap="base">
          {attributes.map((attr, index) => (
            <s-grid key={index} gridTemplateColumns="1fr auto" gap="small" alignItems="start">
              <s-stack direction="block" gap="small">
                <s-text-field
                  label="Key"
                  labelAccessibilityVisibility="exclusive"
                  value={attr.key}
                  onInput={(e: Event) => handleKeyChange(index, e)}
                  placeholder="Key"
                  autocomplete="off"
                ></s-text-field>
                <s-text-field
                  label="Value"
                  labelAccessibilityVisibility="exclusive"
                  value={attr.value}
                  onInput={(e: Event) => handleValueChange(index, e)}
                  placeholder="Value"
                  autocomplete="off"
                ></s-text-field>
              </s-stack>
              <s-button
                variant="tertiary"
                icon="delete"
                onClick={() => handleRemove(index)}
                accessibilityLabel={`Remove attribute ${attr.key || index + 1}`}
              ></s-button>
            </s-grid>
          ))}
        </s-stack>
      )}
    </s-section>
  );
};
