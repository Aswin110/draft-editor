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
  isTemplateTarget,
} from "../types/draft-order";
import { PropertyRowsEditor } from "../components/PropertyRowsEditor";

const MODAL_ID = "property-template-modal";

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

interface EditorState {
  id: string | null;
  name: string;
  target: TemplateTarget;
  properties: CustomAttribute[];
}

const emptyEditor = (): EditorState => ({
  id: null,
  name: "",
  target: "LINE_ITEM_PROPERTY",
  properties: [{ key: "", value: "" }],
});

/** Chip label per property: just the key, or `key: value` when a default is set. */
const propertyLabels = (template: PropertyTemplate): string[] =>
  template.properties
    .filter((p) => p.key)
    .map((p) => (p.value ? `${p.key}: ${p.value}` : p.key));

/**
 * s-stack has no wrap control, so a long property list would overflow its card.
 * A plain flex container keeps the chips on as many lines as they need.
 */
const chipRowStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "0.25rem",
};

const PropertyTemplatesPage = () => {
  const { templates } = useLoaderData<LoaderData>();
  const fetcher = useFetcher<{ success: boolean; error?: string }>();
  const shopify = useAppBridge();
  const navigate = useNavigate();

  const modalRef = useRef<HTMLElement | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const isSaving = fetcher.state !== "idle";

  const grouped = useMemo(
    () =>
      TEMPLATE_TARGETS.map((target) => ({
        target,
        items: templates.filter((t) => t.target === target),
      })).filter((group) => group.items.length > 0),
    [templates],
  );

  const hideModal = useCallback(() => {
    (
      modalRef.current as unknown as { hideOverlay?: () => void } | null
    )?.hideOverlay?.();
  }, []);

  // Close the modal and refresh once a save succeeds.
  useEffect(() => {
    if (pendingRef.current && fetcher.state === "idle") {
      pendingRef.current = false;
      if (fetcher.data?.success) {
        hideModal();
        shopify.toast.show("Template saved");
      } else if (fetcher.data?.error) {
        setError(fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data, hideModal, shopify]);

  const startCreate = useCallback(() => {
    setEditor(emptyEditor());
    setError(null);
  }, []);

  const startEdit = useCallback((template: PropertyTemplate) => {
    setEditor({
      id: template.id,
      name: template.name,
      target: template.target,
      properties:
        template.properties.length > 0
          ? template.properties.map((p) => ({ ...p }))
          : [{ key: "", value: "" }],
    });
    setError(null);
  }, []);

  const handleNameChange = useCallback((e: Event) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    setEditor((prev) => ({ ...prev, name: value }));
  }, []);

  const handleTargetChange = useCallback((e: Event) => {
    const value = (e.currentTarget as HTMLSelectElement).value;
    if (!isTemplateTarget(value)) return;
    setEditor((prev) => ({ ...prev, target: value }));
  }, []);

  const handlePropertiesChange = useCallback((properties: CustomAttribute[]) => {
    setEditor((prev) => ({ ...prev, properties }));
  }, []);

  const handleSave = useCallback(() => {
    if (!editor.name.trim()) {
      setError("Template name is required");
      return;
    }

    if (!editor.properties.some((p) => p.key.trim() !== "")) {
      setError("Add at least one property with a key");
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.append("intent", editor.id ? "update" : "create");
    if (editor.id) formData.append("id", editor.id);
    formData.append("name", editor.name);
    formData.append("target", editor.target);
    formData.append("rows", JSON.stringify(editor.properties));
    pendingRef.current = true;
    fetcher.submit(formData, { method: "post" });
  }, [editor, fetcher]);

  const handleDelete = useCallback(
    (id: string) => {
      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("id", id);
      fetcher.submit(formData, { method: "post" });
    },
    [fetcher],
  );

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
        onClick={startCreate}
      >
        Create template
      </s-button>

      {templates.length === 0 ? (
        <s-section padding="none">
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
                onClick={startCreate}
              >
                Create template
              </s-button>
            </s-stack>
          </s-box>
        </s-section>
      ) : (
        grouped.map((group) => (
          <s-section
            key={group.target}
            heading={TEMPLATE_TARGET_LABELS[group.target]}
          >
            <s-stack direction="block" gap="none">
              {group.items.map((template, index) => (
                <Fragment key={template.id}>
                  {index > 0 && <s-divider></s-divider>}
                  <s-box padding="base none">
                    <s-grid
                      gridTemplateColumns="1fr auto"
                      gap="base"
                      alignItems="center"
                    >
                      <s-stack direction="block" gap="small-300">
                        <s-text type="strong">{template.name}</s-text>
                        <div style={chipRowStyle}>
                          {propertyLabels(template).map((label, i) => (
                            <s-badge key={i} tone="neutral">
                              {label}
                            </s-badge>
                          ))}
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
                          tone="critical"
                          icon="delete"
                          onClick={() => handleDelete(template.id)}
                          accessibilityLabel={`Delete ${template.name}`}
                        ></s-button>
                      </s-stack>
                    </s-grid>
                  </s-box>
                </Fragment>
              ))}
            </s-stack>
          </s-section>
        ))
      )}

      <s-modal
        ref={(el) => {
          modalRef.current = el;
        }}
        id={MODAL_ID}
        heading={editor.id ? "Edit template" : "Create template"}
      >
        <s-stack direction="block" gap="large">
          {error && <s-banner tone="critical">{error}</s-banner>}

          <s-text-field
            label="Template name"
            value={editor.name}
            onInput={handleNameChange}
            placeholder="e.g. Engraving"
            autocomplete="off"
            required
          ></s-text-field>

          <s-select
            label="Applies to"
            details="Where this template can be added from."
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
              Leave a value blank to fill it in on the draft order.
            </s-text>
            <PropertyRowsEditor
              rows={editor.properties}
              onChange={handlePropertiesChange}
              addLabel="Add property"
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
          Save
        </s-button>
      </s-modal>
    </s-page>
  );
};

export default PropertyTemplatesPage;
