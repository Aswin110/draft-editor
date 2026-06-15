import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  listPropertyTemplates,
  createPropertyTemplate,
  updatePropertyTemplate,
  deletePropertyTemplate,
} from "../models/property-template.server";
import type { CustomAttribute, PropertyTemplate } from "../types/draft-order";
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
  const propertiesJson = (formData.get("properties") as string) || "[]";

  if (!name) {
    return { success: false, error: "Template name is required" };
  }

  let properties: CustomAttribute[] = [];
  try {
    properties = JSON.parse(propertiesJson);
  } catch {
    return { success: false, error: "Invalid properties" };
  }

  if (!properties.some((p) => (p.key || "").trim() !== "")) {
    return { success: false, error: "Add at least one property with a key" };
  }

  if (intent === "update") {
    const id = formData.get("id") as string;
    await updatePropertyTemplate(session.shop, id, name, properties);
  } else {
    await createPropertyTemplate(session.shop, name, properties);
  }

  return { success: true };
};

interface EditorState {
  id: string | null;
  name: string;
  properties: CustomAttribute[];
}

const emptyEditor = (): EditorState => ({
  id: null,
  name: "",
  properties: [{ key: "", value: "" }],
});

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
        shopify.toast.show("Property template saved");
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
    formData.append("properties", JSON.stringify(editor.properties));
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
    <s-page heading="Line Item Property Templates">
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

      <s-section padding="none">
        {templates.length === 0 ? (
          <s-box padding="large-500">
            <s-stack direction="block" alignItems="center" gap="base">
              <s-icon type="catalog-product" tone="neutral"></s-icon>
              <s-heading>No property templates yet</s-heading>
              <s-paragraph color="subdued">
                Save groups of line item properties you reuse often, then add
                them to any draft order with one click.
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
        ) : (
          <s-stack direction="block" gap="base">
            {templates.map((template) => (
              <s-box
                key={template.id}
                border="base"
                borderRadius="base"
                padding="base"
              >
                <s-stack
                  direction="inline"
                  justifyContent="space-between"
                  alignItems="start"
                  gap="base"
                >
                  <s-stack direction="block" gap="small">
                    <s-text type="strong">{template.name}</s-text>
                    <s-stack direction="block" gap="small-300">
                      {template.properties.map((prop, i) => (
                        <s-text key={i} color="subdued">
                          {prop.key}
                          {prop.value ? `: ${prop.value}` : ""}
                        </s-text>
                      ))}
                    </s-stack>
                  </s-stack>
                  <s-stack direction="inline" gap="small">
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
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>

      <s-modal
        ref={(el) => {
          modalRef.current = el;
        }}
        id={MODAL_ID}
        heading={editor.id ? "Edit Template" : "Create New Template"}
      >
        <s-stack direction="block" gap="base">
          {error && <s-banner tone="critical">{error}</s-banner>}

          <s-text-field
            label="Template Name"
            value={editor.name}
            onInput={handleNameChange}
            placeholder="e.g. Engraving"
            autocomplete="off"
            required
          ></s-text-field>

          <PropertyRowsEditor
            rows={editor.properties}
            onChange={handlePropertiesChange}
            addLabel="Add Property"
          />
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
