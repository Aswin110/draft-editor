import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { useState, useCallback, useRef, useEffect } from "react";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getDraftOrder,
  updateDraftOrderLineItems,
} from "../models/draft-order.server";
import {
  formatAddressLines,
  buildShopifyGid,
  extractNumericId,
} from "../utils/formatters";
import { AddressCard } from "../components/AddressCard";
import { CustomerCard } from "../components/CustomerCard";
import { LineItemRow } from "../components/LineItemRow";
import { NotesCard } from "../components/NotesCard";
import { CustomAttributesCard } from "../components/CustomAttributesCard";
import { PaymentSummary } from "../components/PaymentSummary";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type {
  DraftOrderDetail as DraftOrderDetailType,
  LineItem,
  CustomAttribute,
} from "../types/draft-order";

interface LoaderData {
  draftOrder: DraftOrderDetailType;
  readOnly: boolean;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { id } = params;

  const draftOrderGid = buildShopifyGid("DraftOrder", id!);

  const draftOrder = await getDraftOrder(admin, draftOrderGid);

  if (!draftOrder) {
    throw new Response("Draft order not found", { status: 404 });
  }

  return { draftOrder, readOnly: false };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { id } = params;

  const draftOrderGid = buildShopifyGid("DraftOrder", id!);

  const formData = await request.formData();
  const lineItemsJson = formData.get("lineItems") as string;
  const currencyCode = formData.get("currencyCode") as string;
  const customAttributesJson = formData.get("customAttributes") as string;
  const note = formData.get("note") as string | null;

  if (!lineItemsJson) {
    return { success: false, error: "No line items provided" };
  }

  const lineItems: {
    variantId: string | null;
    quantity: number;
    originalUnitPrice: string;
    currencyCode: string;
    customAttributes?: { key: string; value: string }[];
  }[] = JSON.parse(lineItemsJson).map(
    (item: {
      variantId: string | null;
      quantity: number;
      originalUnitPrice: string;
      customAttributes?: { key: string; value: string }[];
    }) => ({
      ...item,
      currencyCode: currencyCode || "USD",
    }),
  );

  const customAttributes: { key: string; value: string }[] =
    customAttributesJson
      ? JSON.parse(customAttributesJson).filter(
          (attr: { key: string; value: string }) => attr.key.trim() !== "",
        )
      : undefined;

  return updateDraftOrderLineItems(
    admin,
    draftOrderGid,
    lineItems,
    customAttributes,
    note ?? undefined,
  );
};

const DraftOrderDetailPage = () => {
  const { draftOrder, readOnly } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const fetcher = useFetcher<{ success: boolean; error?: string }>();
  const shopify = useAppBridge();

  const [lineItems, setLineItems] = useState<LineItem[]>(draftOrder.lineItems);
  const [savedLineItems, setSavedLineItems] = useState<LineItem[]>(
    draftOrder.lineItems,
  );
  const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>(
    draftOrder.customAttributes,
  );
  const [savedCustomAttributes, setSavedCustomAttributes] = useState<
    CustomAttribute[]
  >(draftOrder.customAttributes);
  const [note, setNote] = useState<string>(draftOrder.note || "");
  const [savedNote, setSavedNote] = useState<string>(draftOrder.note || "");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const hasLineItemChanges =
    JSON.stringify(lineItems) !== JSON.stringify(savedLineItems);
  const hasAttributeChanges =
    JSON.stringify(customAttributes) !== JSON.stringify(savedCustomAttributes);
  const hasNoteChanges = note !== savedNote;
  const hasChanges =
    hasLineItemChanges || hasAttributeChanges || hasNoteChanges;

  const isSavingRef = useRef(false);

  useEffect(() => {
    if (
      isSavingRef.current &&
      fetcher.state === "idle" &&
      fetcher.data?.success
    ) {
      setSavedLineItems([...lineItems]);
      setSavedCustomAttributes([...customAttributes]);
      setSavedNote(note);
      isSavingRef.current = false;
      shopify.toast.show("Draft order updated");
    }
  }, [fetcher.state, fetcher.data, lineItems, customAttributes, note, shopify]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLineItems((items) => {
      const oldIndex = items.findIndex((it) => it.id === active.id);
      const newIndex = items.findIndex((it) => it.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  }, []);

  const handleAddProducts = useCallback(async () => {
    const selection = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      filter: {
        variants: true,
      },
    });

    if (selection && selection.length > 0) {
      const itemsToAdd: LineItem[] = [];

      selection.forEach((product) => {
        const typedProduct = product as unknown as {
          id: string;
          title: string;
          images?: Array<{ originalSrc?: string; url?: string }>;
          featuredImage?: { originalSrc?: string; url?: string } | null;
          variants?: Array<{
            id: string;
            title: string;
            price: string;
            sku: string | null;
            image?: { originalSrc?: string; url?: string } | null;
          }>;
        };

        const productImage =
          typedProduct.images?.[0]?.originalSrc ||
          typedProduct.images?.[0]?.url ||
          typedProduct.featuredImage?.originalSrc ||
          typedProduct.featuredImage?.url ||
          null;

        const variants = typedProduct.variants || [];

        if (variants.length === 0) {
          return;
        }

        variants.forEach((variant) => {
          const alreadyExists = lineItems.some(
            (li) => li.variantId === variant.id,
          );

          if (!alreadyExists) {
            const variantImage =
              variant.image?.originalSrc || variant.image?.url || productImage;

            itemsToAdd.push({
              id: `new-${variant.id}-${Date.now()}-${Math.random()}`,
              variantId: variant.id,
              title: typedProduct.title,
              variantTitle:
                variant.title !== "Default Title" &&
                variant.title !== typedProduct.title
                  ? variant.title
                  : null,
              quantity: 1,
              originalUnitPrice: variant.price || "0.00",
              sku: variant.sku || null,
              image: variantImage,
              customAttributes: [],
            });
          }
        });
      });

      if (itemsToAdd.length > 0) {
        setLineItems([...lineItems, ...itemsToAdd]);
      }
    }
  }, [shopify, lineItems]);

  const handleSave = useCallback(() => {
    isSavingRef.current = true;
    const formData = new FormData();
    formData.append(
      "lineItems",
      JSON.stringify(
        lineItems.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          originalUnitPrice: item.originalUnitPrice,
          customAttributes: item.customAttributes,
        })),
      ),
    );
    formData.append("currencyCode", draftOrder.currencyCode);
    formData.append("customAttributes", JSON.stringify(customAttributes));
    formData.append("note", note);
    fetcher.submit(formData, { method: "POST" });
  }, [lineItems, customAttributes, note, fetcher, draftOrder.currencyCode]);

  const handleDiscard = useCallback(() => {
    setLineItems(draftOrder.lineItems);
    setSavedLineItems(draftOrder.lineItems);
    setCustomAttributes(draftOrder.customAttributes);
    setSavedCustomAttributes(draftOrder.customAttributes);
    setNote(draftOrder.note || "");
    setSavedNote(draftOrder.note || "");
  }, [draftOrder.lineItems, draftOrder.customAttributes, draftOrder.note]);

  const handleRemoveItem = useCallback((itemId: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const handleQuantityChange = useCallback(
    (itemId: string, quantity: number) => {
      setLineItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
      );
    },
    [],
  );

  const handlePriceChange = useCallback((itemId: string, price: string) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, originalUnitPrice: price } : item,
      ),
    );
  }, []);

  const handlePropertiesChange = useCallback(
    (itemId: string, properties: CustomAttribute[]) => {
      setLineItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, customAttributes: properties } : item,
        ),
      );
    },
    [],
  );

  const handleOpenInShopify = useCallback(() => {
    const numericId = extractNumericId(draftOrder.id);
    window.open(`shopify://admin/draft_orders/${numericId}`, "_blank");
  }, [draftOrder.id]);

  const isSaving = fetcher.state === "submitting";

  return (
    <s-page heading={draftOrder.name}>
      <div slot="aside">
        <NotesCard note={note || null} onChange={setNote} readOnly={readOnly} />
        <CustomAttributesCard
          attributes={customAttributes}
          onChange={setCustomAttributes}
          readOnly={readOnly}
        />
        <CustomerCard customer={draftOrder.customer} />
        <AddressCard
          title="Shipping address"
          addressLines={formatAddressLines(draftOrder.shippingAddress)}
        />
        <AddressCard
          title="Billing address"
          addressLines={formatAddressLines(draftOrder.billingAddress)}
        />
      </div>
      <s-link slot="breadcrumb-actions" onClick={() => navigate("/app")}>
        Draft Orders
      </s-link>
      <s-button
        slot="secondary-actions"
        variant="secondary"
        onClick={handleOpenInShopify}
        accessibilityLabel="Open draft order in Shopify Admin"
        icon="external"
      >
        Open in Shopify
      </s-button>

      <SaveBar id="product-order-save-bar" open={hasChanges && !readOnly}>
        <button
          variant="primary"
          onClick={handleSave}
          disabled={isSaving}
          {...(isSaving ? { loading: "" } : {})}
        >
          Save
        </button>
        <button onClick={handleDiscard} disabled={isSaving}>
          Discard
        </button>
      </SaveBar>

      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack
            direction="inline"
            justifyContent="space-between"
            alignItems="center"
          >
            <s-heading>Products</s-heading>
            {!readOnly && (
              <s-stack direction="inline" gap="small" alignItems="center">
                {lineItems.length > 1 && (
                  <s-text color="subdued">Drag to reorder</s-text>
                )}
                <s-button
                  icon="plus"
                  onClick={handleAddProducts}
                  accessibilityLabel="Add products"
                >
                  Add Products
                </s-button>
              </s-stack>
            )}
          </s-stack>
          {fetcher.data?.error && (
            <s-banner tone="critical">{fetcher.data.error}</s-banner>
          )}
          {lineItems.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={lineItems.map((it) => it.id)}
                strategy={verticalListSortingStrategy}
              >
                <s-stack direction="block" gap="small-300">
                  {lineItems.map((item) => (
                    <LineItemRow
                      key={item.id}
                      item={item}
                      currencyCode={draftOrder.currencyCode}
                      readOnly={readOnly}
                      onRemove={() => handleRemoveItem(item.id)}
                      onQuantityChange={(qty) =>
                        handleQuantityChange(item.id, qty)
                      }
                      onPriceChange={(price) =>
                        handlePriceChange(item.id, price)
                      }
                      onPropertiesChange={(properties) =>
                        handlePropertiesChange(item.id, properties)
                      }
                    />
                  ))}
                </s-stack>
              </SortableContext>
            </DndContext>
          ) : (
            <s-box padding="base">
              <s-stack alignItems="center" gap="small">
                <s-text color="subdued">No products yet</s-text>
                {!readOnly && (
                  <s-button onClick={handleAddProducts} icon="plus">
                    Add products
                  </s-button>
                )}
              </s-stack>
            </s-box>
          )}
        </s-stack>
      </s-section>

      <PaymentSummary
        subtotalPrice={draftOrder.subtotalPrice}
        totalShippingPrice={draftOrder.totalShippingPrice}
        totalTax={draftOrder.totalTax}
        totalPrice={draftOrder.totalPrice}
        currencyCode={draftOrder.currencyCode}
      />
    </s-page>
  );
};
export default DraftOrderDetailPage;
