import { useMemo, useState, useCallback } from "react";
import type { PropertyTemplate } from "../types/draft-order";

interface TemplateSearchListProps {
  templates: PropertyTemplate[];
  onApply: (template: PropertyTemplate) => void;
  emptyMessage: string;
}

/** Summary line under a template name: the keys it will add. */
const summarize = (template: PropertyTemplate): string =>
  template.properties
    .map((p) => p.key)
    .filter(Boolean)
    .join(", ");

/** Searchable list of saved templates, each with an Add button. */
export const TemplateSearchList = ({
  templates,
  onApply,
  emptyMessage,
}: TemplateSearchListProps) => {
  const [search, setSearch] = useState("");

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(query));
  }, [search, templates]);

  const handleSearch = useCallback((e: Event) => {
    setSearch((e.currentTarget as HTMLInputElement).value);
  }, []);

  return (
    <s-stack direction="block" gap="small">
      <s-text-field
        label="Search templates"
        labelAccessibilityVisibility="exclusive"
        icon="search"
        placeholder="Search templates..."
        value={search}
        onInput={handleSearch}
        autocomplete="off"
      ></s-text-field>
      {templates.length === 0 ? (
        <s-text color="subdued">{emptyMessage}</s-text>
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
                  <s-text color="subdued">{summarize(template)}</s-text>
                </s-stack>
                <s-button
                  variant="secondary"
                  icon="plus"
                  onClick={() => onApply(template)}
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
  );
};
