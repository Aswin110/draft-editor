import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  listPropertyTemplates,
  createPropertyTemplate,
  updatePropertyTemplate,
  deletePropertyTemplate,
} from "../models/property-template.server";
import type {
  CustomAttribute,
  PropertyTemplate,
  TemplateTarget,
} from "../types/draft-order";
import {
  TEMPLATE_TARGETS,
  TEMPLATE_TARGET_LABELS,
  TEMPLATE_TARGET_DESCRIPTIONS,
  isTemplateTarget,
} from "../types/draft-order";
import { PropertyRowsEditor } from "../components/PropertyRowsEditor";

const MODAL_ID = "property-template-modal";
const DELETE_MODAL_ID = "property-template-delete-modal";

/** Below this many templates the list is short enough to scan without filtering. */
const SEARCH_THRESHOLD = 5;

/** Longer property lists collapse to a "+N more" badge so rows stay one-glance. */
const MAX_VISIBLE_PROPERTIES = 6;

interface LoaderData {
  templates: PropertyTemplate[];
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const templates = await listPropertyTemplates(session.shop);
  return { templates };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "delete") {
    const id = formData.get("id") as string;
    if (id) await deletePropertyTemplate(session.shop, id);
    return { success: true };
  }

  const name = ((formData.get("name") as string) || "").trim();
  const rawTarget = formData.get("target");
  const rowsJson = (formData.get("rows") as string) || "[]";

  if (!name) {
    return { success: false, error: "Template name is required" };
  }

  if (!isTemplateTarget(rawTarget)) {
    return { success: false, error: "Choose where the template applies" };
  }
  const target: TemplateTarget = rawTarget;

  let rows: CustomAttribute[] = [];
  try {
    rows = JSON.parse(rowsJson);
  } catch {
    return { success: false, error: "Invalid template rows" };
  }

  if (!rows.some((r) => (r.key || "").trim() !== "")) {
    return { success: false, error: "Add at least one property with a key" };
  }

  if (intent === "update") {
    const id = formData.get("id") as string;
    await updatePropertyTemplate(session.shop, id, name, target, rows);
  } else {
    await createPropertyTemplate(session.shop, name, target, rows);
  }

  return { success: true };
};

type EditorMode = "create" | "edit" | "duplicate";

interface EditorState {
  mode: EditorMode;
  id: string | null;
  name: string;
  target: TemplateTarget;
  properties: CustomAttribute[];
}

const emptyEditor = (
  target: TemplateTarget = "LINE_ITEM_PROPERTY",
): EditorState => ({
  mode: "create",
  id: null,
  name: "",
  target,
  properties: [{ key: "", value: "" }],
});

const EDITOR_HEADINGS: Record<EditorMode, string> = {
  create: "Create template",
  edit: "Edit template",
  duplicate: "Duplicate template",
};

/** Chip label per property: just the key, or `key: value` when a default is set. */
const propertyLabels = (template: PropertyTemplate): string[] =>
  template.properties
    .filter((p) => p.key)
    .map((p) => (p.value ? `${p.key}: ${p.value}` : p.key));

/** Row indexes whose key repeats one used by an earlier row. */
const duplicateKeyErrors = (rows: CustomAttribute[]): Record<number, string> => {
  const seen = new Set<string>();
  const errors: Record<number, string> = {};
  rows.forEach((row, index) => {
    const key = row.key.trim().toLowerCase();
    if (!key) return;
    if (seen.has(key)) errors[index] = "Already used above";
    else seen.add(key);
  });
  return errors;
};

const matchesSearch = (template: PropertyTemplate, query: string): boolean =>
  template.name.toLowerCase().includes(query) ||
  template.properties.some(
    (p) =>
      p.key.toLowerCase().includes(query) ||
      p.value.toLowerCase().includes(query),
  );

/**
 * s-stack has no wrap control, so a long property list would overflow its card.
 * A plain flex container keeps the chips on as many lines as they need.
 */
const chipRowStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "0.25rem",
};

/** Rows fade while their delete is in flight rather than vanishing abruptly. */
const deletingRowStyle = {
  opacity: 0.4,
  pointerEvents: "none" as const,
};

const PropertyTemplatesPage = () => {
  const { templates } = useLoaderData<LoaderData>();
  const saveFetcher = useFetcher<{ success: boolean; error?: string }>();
  const deleteFetcher = useFetcher<{ success: boolean }>();
  const shopify = useAppBridge();
  const navigate = useNavigate();

  const modalRef = useRef<HTMLElement | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [formError, setFormError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PropertyTemplate | null>(
    null,
  );
  const savePendingRef = useRef(false);
  const deletePendingRef = useRef(false);
  const isSaving = saveFetcher.state !== "idle";

  const showSearch = templates.length >= SEARCH_THRESHOLD;
  const query = search.trim().toLowerCase();

  const visible = useMemo(() => {
    if (!query) return templates;
    return templates.filter((t) => matchesSearch(t, query));
  }, [templates, query]);

  const grouped = useMemo(
    () =>
      TEMPLATE_TARGETS.map((target) => ({
        target,
        items: visible.filter((t) => t.target === target),
        total: templates.filter((t) => t.target === target).length,
      })),
    [visible, templates],
  );

  // Live validation for the open editor.
  const keyErrors = useMemo(
    () => duplicateKeyErrors(editor.properties),
    [editor.properties],
  );
  const hasDuplicateKeys = Object.keys(keyErrors).length > 0;

  const duplicateName = useMemo(() => {
    const name = editor.name.trim().toLowerCase();
    if (!name) return false;
    return templates.some(
      (t) =>
        t.id !== editor.id &&
        t.target === editor.target &&
        t.name.trim().toLowerCase() === name,
    );
  }, [templates, editor.id, editor.name, editor.target]);

  const deletingId =
    deleteFetcher.state !== "idle"
      ? (deleteFetcher.formData?.get("id") as string | null)
      : null;

  const hideModal = useCallback(() => {
    (
      modalRef.current as unknown as { hideOverlay?: () => void } | null
    )?.hideOverlay?.();
  }, []);

  // Close the editor and confirm once a save succeeds.
  useEffect(() => {
    if (savePendingRef.current && saveFetcher.state === "idle") {
      savePendingRef.current = false;
      if (saveFetcher.data?.success) {
        hideModal();
        shopify.toast.show("Template saved");
      } else if (saveFetcher.data?.error) {
        setFormError(saveFetcher.data.error);
      }
    }
  }, [saveFetcher.state, saveFetcher.data, hideModal, shopify]);

  useEffect(() => {
    if (deletePendingRef.current && deleteFetcher.state === "idle") {
      deletePendingRef.current = false;
      shopify.toast.show("Template deleted");
    }
  }, [deleteFetcher.state, shopify]);

  const resetErrors = useCallback(() => {
    setFormError(null);
    setNameError(null);
  }, []);

  const startCreate = useCallback(
    (target: TemplateTarget = "LINE_ITEM_PROPERTY") => {
      setEditor(emptyEditor(target));
      resetErrors();
    },
    [resetErrors],
  );

  const startEdit = useCallback(
    (template: PropertyTemplate) => {
      setEditor({
        mode: "edit",
        id: template.id,
        name: template.name,
        target: template.target,
        properties:
          template.properties.length > 0
            ? template.properties.map((p) => ({ ...p }))
            : [{ key: "", value: "" }],
      });
      resetErrors();
    },
    [resetErrors],
  );

  const startDuplicate = useCallback(
    (template: PropertyTemplate) => {
      setEditor({
        mode: "duplicate",
        id: null,
        name: `${template.name} copy`,
        target: template.target,
        properties:
          template.properties.length > 0
            ? template.properties.map((p) => ({ ...p }))
            : [{ key: "", value: "" }],
      });
      resetErrors();
    },
    [resetErrors],
  );

  const handleNameChange = useCallback((e: Event) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    setNameError(null);
    setEditor((prev) => ({ ...prev, name: value }));
  }, []);

  const handleTargetChange = useCallback((e: Event) => {
    const value = (e.currentTarget as HTMLSelectElement).value;
    if (!isTemplateTarget(value)) return;
    setEditor((prev) => ({ ...prev, target: value }));
  }, []);

  const handlePropertiesChange = useCallback((properties: CustomAttribute[]) => {
    setFormError(null);
    setEditor((prev) => ({ ...prev, properties }));
  }, []);

  const handleSearch = useCallback((e: Event) => {
    setSearch((e.currentTarget as HTMLInputElement).value);
  }, []);

  const handleSave = useCallback(() => {
    if (!editor.name.trim()) {
      setNameError("Template name is required");
      return;
    }

    if (!editor.properties.some((p) => p.key.trim() !== "")) {
      setFormError("Add at least one property with a key");
      return;
    }

    if (hasDuplicateKeys) {
      setFormError("Each property key can only be used once");
      return;
    }

    resetErrors();
    const formData = new FormData();
    formData.append("intent", editor.id ? "update" : "create");
    if (editor.id) formData.append("id", editor.id);
    formData.append("name", editor.name);
    formData.append("target", editor.target);
    formData.append("rows", JSON.stringify(editor.properties));
    savePendingRef.current = true;
    saveFetcher.submit(formData, { method: "post" });
  }, [editor, hasDuplicateKeys, resetErrors, saveFetcher]);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    const formData = new FormData();
    formData.append("intent", "delete");
    formData.append("id", pendingDelete.id);
    deletePendingRef.current = true;
    deleteFetcher.submit(formData, { method: "post" });
    setPendingDelete(null);
  }, [pendingDelete, deleteFetcher]);

  const renderTemplateRow = (template: PropertyTemplate) => {
    const labels = propertyLabels(template);
    const visibleLabels = labels.slice(0, MAX_VISIBLE_PROPERTIES);
    const overflow = labels.length - visibleLabels.length;

    return (
      <s-box padding="base none">
        <div style={deletingId === template.id ? deletingRowStyle : undefined}>
          <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
            <s-stack direction="block" gap="small-300">
              <s-text type="strong">{template.name}</s-text>
              <div style={chipRowStyle}>
                {visibleLabels.map((label, i) => (
                  <s-badge key={i} tone="neutral">
                    {label}
                  </s-badge>
                ))}
                {overflow > 0 && (
                  <s-badge tone="neutral">{`+${overflow} more`}</s-badge>
                )}
              </div>
            </s-stack>
            <s-stack direction="inline" gap="small-300">
              <s-button
                variant="tertiary"
                icon="edit"
                command="--show"
                commandFor={MODAL_ID}
                onClick={() => startEdit(template)}
                accessibilityLabel={`Edit ${template.name}`}
              ></s-button>
              <s-button
                variant="tertiary"
                icon="duplicate"
                command="--show"
                commandFor={MODAL_ID}
                onClick={() => startDuplicate(template)}
                accessibilityLabel={`Duplicate ${template.name}`}
              ></s-button>
              <s-button
                variant="tertiary"
                tone="critical"
                icon="delete"
                command="--show"
                commandFor={DELETE_MODAL_ID}
                onClick={() => setPendingDelete(template)}
                accessibilityLabel={`Delete ${template.name}`}
              ></s-button>
            </s-stack>
          </s-grid>
        </div>
      </s-box>
    );
  };

  return (
    <s-page heading="Property Templates">
      <s-link slot="breadcrumb-actions" onClick={() => navigate("/app")}>
        Draft Orders
      </s-link>
      <s-button
        slot="primary-action"
        variant="primary"
        command="--show"
        commandFor={MODAL_ID}
        onClick={() => startCreate()}
      >
        Create template
      </s-button>

      {templates.length === 0 ? (
        <s-section padding="none" accessibilityLabel="No templates yet">
          <s-box padding="large-500">
            <s-stack direction="block" alignItems="center" gap="base">
              <s-icon type="catalog-product" tone="neutral"></s-icon>
              <s-heading>No templates yet</s-heading>
              <s-paragraph color="subdued">
                Save groups of line item properties or order custom attributes
                you reuse often, then add them to any draft order with one
                click.
              </s-paragraph>
              <s-button
                variant="primary"
                command="--show"
                commandFor={MODAL_ID}
                onClick={() => startCreate()}
              >
                Create template
              </s-button>
            </s-stack>
          </s-box>
        </s-section>
      ) : (
        <>
          {showSearch && (
            <s-section accessibilityLabel="Filter templates">
              <s-search-field
                label="Search templates"
                labelAccessibilityVisibility="exclusive"
                placeholder="Search by name or property"
                value={search}
                onInput={handleSearch}
                onChange={handleSearch}
              ></s-search-field>
            </s-section>
          )}

          {grouped.map((group) => (
            <s-section
              key={group.target}
              heading={`${TEMPLATE_TARGET_LABELS[group.target]}${
                group.total > 0 ? ` (${group.total})` : ""
              }`}
            >
              <s-stack direction="block" gap="base">
                <s-text color="subdued">
                  {TEMPLATE_TARGET_DESCRIPTIONS[group.target]}
                </s-text>

                {group.items.length === 0 ? (
                  <s-box padding="base none">
                    {group.total > 0 ? (
                      <s-text color="subdued">
                        No templates here match your search.
                      </s-text>
                    ) : (
                      <s-stack direction="block" gap="small" alignItems="start">
                        <s-text color="subdued">
                          You haven’t saved any yet.
                        </s-text>
                        <s-button
                          variant="secondary"
                          icon="plus"
                          command="--show"
                          commandFor={MODAL_ID}
                          onClick={() => startCreate(group.target)}
                        >
                          Add template
                        </s-button>
                      </s-stack>
                    )}
                  </s-box>
                ) : (
                  <s-stack direction="block" gap="none">
                    {group.items.map((template, index) => (
                      <Fragment key={template.id}>
                        {index > 0 && <s-divider></s-divider>}
                        {renderTemplateRow(template)}
                      </Fragment>
                    ))}
                    <s-divider></s-divider>
                    <s-box padding="base none">
                      <s-stack direction="inline">
                        <s-button
                          variant="tertiary"
                          icon="plus"
                          command="--show"
                          commandFor={MODAL_ID}
                          onClick={() => startCreate(group.target)}
                        >
                          Add template
                        </s-button>
                      </s-stack>
                    </s-box>
                  </s-stack>
                )}
              </s-stack>
            </s-section>
          ))}
        </>
      )}

      <s-modal
        ref={(el) => {
          modalRef.current = el;
        }}
        id={MODAL_ID}
        heading={EDITOR_HEADINGS[editor.mode]}
      >
        <s-stack direction="block" gap="large">
          {formError && <s-banner tone="critical">{formError}</s-banner>}

          <s-text-field
            label="Template name"
            details="Shown when you pick a template on a draft order."
            value={editor.name}
            onInput={handleNameChange}
            placeholder="e.g. Engraving"
            error={nameError ?? undefined}
            autocomplete="off"
            required
          ></s-text-field>

          {duplicateName && (
            <s-banner tone="warning">
              Another {TEMPLATE_TARGET_LABELS[editor.target].toLowerCase()}{" "}
              template already uses this name.
            </s-banner>
          )}

          <s-select
            label="Applies to"
            details={TEMPLATE_TARGET_DESCRIPTIONS[editor.target]}
            value={editor.target}
            onChange={handleTargetChange}
          >
            {TEMPLATE_TARGETS.map((target) => (
              <s-option key={target} value={target}>
                {TEMPLATE_TARGET_LABELS[target]}
              </s-option>
            ))}
          </s-select>

          <s-stack direction="block" gap="small">
            <s-text type="strong">Properties</s-text>
            <s-text color="subdued">
              A default value is filled in automatically. Leave it blank to type
              the value on the draft order.
            </s-text>
            <PropertyRowsEditor
              rows={editor.properties}
              onChange={handlePropertiesChange}
              addLabel="Add property"
              showHeaders
              valueHeader="Default value"
              keyPlaceholder="e.g. Engraving text"
              valuePlaceholder="Optional"
              keyErrors={keyErrors}
            />
          </s-stack>
        </s-stack>

        <s-button slot="secondary-actions" command="--hide" commandFor={MODAL_ID}>
          Cancel
        </s-button>
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={handleSave}
          disabled={isSaving}
          loading={isSaving}
        >
          {editor.mode === "edit" ? "Save changes" : "Create template"}
        </s-button>
      </s-modal>

      <s-modal id={DELETE_MODAL_ID} heading="Delete template?">
        <s-paragraph>
          {pendingDelete
            ? `“${pendingDelete.name}” will be removed. Draft orders that already use its properties keep them.`
            : ""}
        </s-paragraph>
        <s-button
          slot="secondary-actions"
          command="--hide"
          commandFor={DELETE_MODAL_ID}
          onClick={() => setPendingDelete(null)}
        >
          Cancel
        </s-button>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          command="--hide"
          commandFor={DELETE_MODAL_ID}
          onClick={confirmDelete}
        >
          Delete
        </s-button>
      </s-modal>
    </s-page>
  );
};

export default PropertyTemplatesPage;
