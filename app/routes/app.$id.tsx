import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  calculateLineItemPrices,
  getDraftOrder,
  updateDraftOrderLineItems,
  type CalculatedLinePrice,
  type UpdateLineItemsInput,
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
  LineItemDiscount,
  CustomAttribute,
  PropertyTemplate,
} from "../types/draft-order";
import { listPropertyTemplates } from "../models/property-template.server";
import { useReviewPrompt } from "../hooks/useReviewPrompt";

interface LoaderData {
  draftOrder: DraftOrderDetailType;
  readOnly: boolean;
  templates: PropertyTemplate[];
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const startedAt = Date.now();
  const { admin, session } = await authenticate.admin(request);
  const authenticatedAt = Date.now();
  const { id } = params;

  const draftOrderGid = buildShopifyGid("DraftOrder", id!);

  const [draftOrder, templates] = await Promise.all([
    getDraftOrder(admin, draftOrderGid),
    listPropertyTemplates(session.shop),
  ]);

  // Where a page load spends its time. Read these next to the action's line
  // to see how long a save takes end to end.
  console.info(
    `[draft-order ${id}] loader: auth ${authenticatedAt - startedAt}ms, ` +
      `load ${Date.now() - authenticatedAt}ms`,
  );

  if (!draftOrder) {
    throw new Response("Draft order not found", { status: 404 });
  }

  // A completed draft has already been converted to an order, and Shopify
  // refuses `draftOrderUpdate` on it. Lock the page rather than let a
  // merchant type out an edit that can only fail on save.
  return {
    draftOrder,
    readOnly: draftOrder.status === "COMPLETED",
    templates,
  };
};

interface SaveResult {
  intent?: "save";
  success: boolean;
  error?: string;
}

interface CalculateResult {
  intent: "calculate";
  success: boolean;
  /** Row ids the prices were requested for, in request order. */
  keys: string[];
  prices: CalculatedLinePrice[];
}

/** What the editor posts per row on save. */
interface LineItemPayload {
  variantId: string | null;
  quantity: number;
  priceOverride: string | null;
  appliedDiscount: LineItemDiscount | null;
  customAttributes?: { key: string; value: string }[];
}

export const action = async ({
  request,
  params,
}: ActionFunctionArgs): Promise<SaveResult | CalculateResult> => {
  const startedAt = Date.now();
  const { admin } = await authenticate.admin(request);
  const authenticatedAt = Date.now();
  const { id } = params;

  const draftOrderGid = buildShopifyGid("DraftOrder", id!);

  const formData = await request.formData();
  const intent = (formData.get("intent") as string | null) ?? "save";
  const lineItemsJson = formData.get("lineItems") as string;
  const currencyCode = (formData.get("currencyCode") as string) || "USD";

  if (!lineItemsJson) {
    return { success: false, error: "No line items provided" };
  }

  if (intent === "calculate") {
    // Price preview for rows just added from the picker (which only knows
    // retail prices) or reset to the catalog price. Nothing is saved.
    const requests: { key: string; variantId: string | null; quantity: number }[] =
      JSON.parse(lineItemsJson);
    const keys = requests.map((item) => item.key);
    try {
      const prices = await calculateLineItemPrices(
        admin,
        draftOrderGid,
        requests.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          priceOverride: null,
          currencyCode,
        })),
      );
      return { intent: "calculate", success: true, keys, prices };
    } catch (error) {
      // The rows keep the picker's price; Shopify prices them on save anyway.
      console.warn(`[draft-order ${id}] price calculation failed:`, error);
      return { intent: "calculate", success: false, keys, prices: [] };
    }
  }

  const customAttributesJson = formData.get("customAttributes") as string;
  const note = formData.get("note") as string | null;

  const lineItems: UpdateLineItemsInput[] = (
    JSON.parse(lineItemsJson) as LineItemPayload[]
  ).map((item) => ({
    variantId: item.variantId ?? null,
    quantity: item.quantity,
    // Null unless the merchant priced this line (here or in the Shopify
    // admin), so Shopify keeps pricing the rest from the customer's catalog.
    priceOverride: item.priceOverride ?? null,
    appliedDiscount: item.appliedDiscount ?? null,
    customAttributes: item.customAttributes,
    currencyCode,
  }));

  const customAttributes: { key: string; value: string }[] =
    customAttributesJson
      ? JSON.parse(customAttributesJson).filter(
          (attr: { key: string; value: string }) => attr.key.trim() !== "",
        )
      : undefined;

  const result = await updateDraftOrderLineItems(
    admin,
    draftOrderGid,
    lineItems,
    customAttributes,
    note ?? undefined,
  );

  // The Shopify mutation is the one part of a save we don't control; this
  // line says whether it is the slow part.
  console.info(
    `[draft-order ${id}] action: auth ${authenticatedAt - startedAt}ms, ` +
      `draftOrderUpdate ${Date.now() - authenticatedAt}ms ` +
      `(${lineItems.length} line items, ${result.success ? "ok" : `error: ${result.error}`})`,
  );

  return result;
};

/**
 * Unit price after the line's discount, for a price the merchant just typed.
 * Shopify recalculates on save; this keeps the row total honest until then.
 */
const discountedUnitFor = (item: LineItem, newPrice: string): string => {
  const unit = parseFloat(newPrice || "0");
  if (!item.appliedDiscount) return unit.toFixed(2);
  if (item.appliedDiscount.valueType === "PERCENTAGE") {
    return (unit * (1 - item.appliedDiscount.value / 100)).toFixed(2);
  }
  // Fixed amount: keep the same per-unit discount Shopify last applied.
  const perUnit =
    parseFloat(item.originalUnitPrice || "0") -
    parseFloat(item.discountedUnitPrice || "0");
  return Math.max(unit - perUnit, 0).toFixed(2);
};

const DraftOrderDetailPage = () => {
  const { draftOrder, readOnly, templates } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const fetcher = useFetcher<SaveResult>();
  // Separate fetcher for price previews, so a save and a preview never race.
  const priceFetcher = useFetcher<CalculateResult>();
  const shopify = useAppBridge();
  const requestReview = useReviewPrompt();

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

  // Point both the working copy and the saved copy at a draft as Shopify
  // reports it. Everything that puts the page back in step with the server
  // (a finished save, a discard, a reload of the loader) goes through here.
  const resetTo = useCallback((draft: DraftOrderDetailType) => {
    setLineItems(draft.lineItems);
    setSavedLineItems(draft.lineItems);
    setCustomAttributes(draft.customAttributes);
    setSavedCustomAttributes(draft.customAttributes);
    setNote(draft.note || "");
    setSavedNote(draft.note || "");
  }, []);

  const lineItemTemplates = useMemo(
    () => templates.filter((t) => t.target === "LINE_ITEM_PROPERTY"),
    [templates],
  );
  const orderAttributeTemplates = useMemo(
    () => templates.filter((t) => t.target === "CUSTOM_ATTRIBUTE"),
    [templates],
  );

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

  // The loader runs again after every save and whenever the merchant returns
  // to this page (useRevalidateOnReturn in app.tsx). Each time it brings a new
  // draft, show it; unless the merchant is mid-edit, in which case their
  // changes win and the next clean reload catches up.
  const shownDraftRef = useRef(draftOrder);
  useEffect(() => {
    if (shownDraftRef.current === draftOrder || hasChanges) return;
    shownDraftRef.current = draftOrder;
    resetTo(draftOrder);
  }, [draftOrder, hasChanges, resetTo]);

  const isSavingRef = useRef(false);

  // Shopify's own draft order page lags behind the API after an app updates a
  // draft, sometimes by a minute, even on a fresh load. That is a Shopify-side
  // bug (community.shopify.dev topic 17388, still open as of Oct 2026) and the
  // one thing merchants reliably notice. Say so after every save, so a page
  // that still shows the old draft isn't read as a save that failed.
  const [showSavedNotice, setShowSavedNotice] = useState(false);
  useEffect(() => {
    if (hasChanges) setShowSavedNotice(false);
  }, [hasChanges]);

  useEffect(() => {
    if (
      !isSavingRef.current ||
      fetcher.state !== "idle" ||
      !fetcher.data?.success
    ) {
      return;
    }
    isSavingRef.current = false;
    // React Router reloads the loader before the fetcher goes idle, so
    // `draftOrder` is already the draft as saved: Shopify's own ids for any
    // products that were added (not the placeholders from handleAddProducts)
    // and totals that reflect the new quantities and prices.
    shownDraftRef.current = draftOrder;
    resetTo(draftOrder);
    setShowSavedNotice(true);
    // Editing a draft order is the job merchants installed us for, so a save
    // that worked is the one honest moment to ask how we're doing. The hook
    // decides whether asking is appropriate; usually it stays quiet.
    void requestReview();
  }, [fetcher.state, fetcher.data, draftOrder, resetTo, requestReview]);

  // Rows waiting for Shopify to say what this customer pays for them.
  const [pendingPriceIds, setPendingPriceIds] = useState<Set<string>>(
    () => new Set(),
  );

  const requestPrices = useCallback(
    (items: LineItem[]) => {
      const requests = items
        .filter((item) => item.variantId)
        .map((item) => ({
          key: item.id,
          variantId: item.variantId,
          quantity: item.quantity,
        }));
      if (requests.length === 0) return;
      setPendingPriceIds(
        (prev) => new Set([...prev, ...requests.map((r) => r.key)]),
      );
      const formData = new FormData();
      formData.append("intent", "calculate");
      formData.append("lineItems", JSON.stringify(requests));
      formData.append("currencyCode", draftOrder.currencyCode);
      priceFetcher.submit(formData, { method: "POST" });
    },
    [priceFetcher, draftOrder.currencyCode],
  );

  // Apply a finished price preview to the rows it was for. Shopify returns
  // the lines in request order, so match each requested row to the next
  // result with its variant. A row the merchant priced meanwhile is left
  // alone. Whatever a preview didn't cover (a superseded request, a failure)
  // simply keeps the picker's price; Shopify prices it on save regardless.
  const appliedPreviewRef = useRef<CalculateResult | null>(null);
  useEffect(() => {
    if (priceFetcher.state !== "idle") return;
    const data = priceFetcher.data;
    if (data && data !== appliedPreviewRef.current) {
      appliedPreviewRef.current = data;
      if (!data.success) {
        // Rows keep the picker's retail price; say so, since for a B2B draft
        // that number is not what the customer will pay.
        shopify.toast.show(
          "Couldn't fetch the customer's price. Shopify sets it when you save.",
          { isError: true },
        );
      }
      if (data.success) {
        setLineItems((prev) => {
          const variantOf = new Map(prev.map((i) => [i.id, i.variantId]));
          const remaining = [...data.prices];
          const lastByVariant = new Map<string, CalculatedLinePrice>();
          const byKey = new Map<string, CalculatedLinePrice>();
          for (const key of data.keys) {
            const variantId = variantOf.get(key);
            if (!variantId) continue;
            const index = remaining.findIndex((p) => p.variantId === variantId);
            const price =
              index >= 0
                ? remaining.splice(index, 1)[0]
                : lastByVariant.get(variantId);
            if (!price) continue;
            byKey.set(key, price);
            lastByVariant.set(variantId, price);
          }
          return prev.map((item) => {
            const price = byKey.get(item.id);
            if (!price || item.priceOverride !== null) return item;
            return {
              ...item,
              originalUnitPrice: price.originalUnitPrice,
              discountedUnitPrice: price.discountedUnitPrice,
            };
          });
        });
      }
    }
    setPendingPriceIds((prev) => (prev.size > 0 ? new Set() : prev));
  }, [priceFetcher.state, priceFetcher.data, shopify]);

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
          const variantImage =
            variant.image?.originalSrc || variant.image?.url || productImage;

          // The picker's price is the retail price. No override is set, so
          // Shopify prices the line for this customer on save (a B2B draft
          // gets the company's catalog price); the preview below shows it.
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
            priceOverride: null,
            appliedDiscount: null,
            discountedUnitPrice: variant.price || "0.00",
            sku: variant.sku || null,
            image: variantImage,
            customAttributes: [],
          });
        });
      });

      if (itemsToAdd.length > 0) {
        setLineItems([...lineItems, ...itemsToAdd]);
        requestPrices(itemsToAdd);
      }
    }
  }, [shopify, lineItems, requestPrices]);

  const handleSave = useCallback(() => {
    isSavingRef.current = true;
    const formData = new FormData();
    formData.append(
      "lineItems",
      JSON.stringify(
        lineItems.map(
          (item): LineItemPayload => ({
            variantId: item.variantId,
            quantity: item.quantity,
            priceOverride: item.priceOverride,
            appliedDiscount: item.appliedDiscount,
            customAttributes: item.customAttributes,
          }),
        ),
      ),
    );
    formData.append("currencyCode", draftOrder.currencyCode);
    formData.append("customAttributes", JSON.stringify(customAttributes));
    formData.append("note", note);
    fetcher.submit(formData, { method: "POST" });
  }, [lineItems, customAttributes, note, fetcher, draftOrder.currencyCode]);

  const handleDiscard = useCallback(() => {
    resetTo(draftOrder);
  }, [draftOrder, resetTo]);

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

  // Typing a price makes it a custom price: Shopify keeps it as is, instead
  // of the catalog price, until the merchant drops it again.
  const handlePriceChange = useCallback((itemId: string, price: string) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              originalUnitPrice: price,
              priceOverride: price,
              discountedUnitPrice: discountedUnitFor(item, price),
            }
          : item,
      ),
    );
  }, []);

  const handleUseCatalogPrice = useCallback(
    (itemId: string) => {
      const item = lineItems.find((it) => it.id === itemId);
      if (!item) return;
      const reset = { ...item, priceOverride: null };
      setLineItems((prev) => prev.map((it) => (it.id === itemId ? reset : it)));
      // The row shows the old custom price until the preview comes back.
      requestPrices([reset]);
    },
    [lineItems, requestPrices],
  );

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

  // Set only once the draft has been completed into an order, which is exactly
  // when this page goes read only.
  const orderNumericId = draftOrder.orderId
    ? extractNumericId(draftOrder.orderId)
    : null;

  const handleOpenOrder = useCallback(
    (event: Event) => {
      event.preventDefault();
      if (orderNumericId) navigate(`/app/orders/${orderNumericId}`);
    },
    [navigate, orderNumericId],
  );

  const isSaving = fetcher.state === "submitting";

  return (
    <s-page heading={draftOrder.name}>
      <s-stack slot="aside" direction="block" gap="base">
        <NotesCard note={note || null} onChange={setNote} readOnly={readOnly} />
        <CustomAttributesCard
          attributes={customAttributes}
          onChange={setCustomAttributes}
          readOnly={readOnly}
          templates={orderAttributeTemplates}
        />
        <CustomerCard
          customer={draftOrder.customer}
          purchasingCompany={draftOrder.purchasingCompany}
        />
        <AddressCard
          title="Shipping address"
          addressLines={formatAddressLines(draftOrder.shippingAddress)}
        />
        <AddressCard
          title="Billing address"
          addressLines={formatAddressLines(draftOrder.billingAddress)}
        />
      </s-stack>
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

      {readOnly && (
        <s-section>
          <s-banner tone="info" heading="This draft order is completed">
            It has been converted to an order, and Shopify doesn&apos;t allow a
            completed draft to be changed, so this page is read only. The note
            and custom attributes can still be edited on the order it created.
            {orderNumericId && (
              <s-link
                slot="primary-action"
                href={`/app/orders/${orderNumericId}`}
                onClick={handleOpenOrder}
              >
                View order
              </s-link>
            )}
          </s-banner>
        </s-section>
      )}

      {showSavedNotice && (
        <s-section>
          <s-banner
            tone="success"
            heading="Saved to Shopify"
            dismissible
            onDismiss={() => setShowSavedNotice(false)}
          >
            The draft order page in the Shopify admin can take about 15
            seconds to show these changes, even after a refresh. That delay
            is on Shopify&apos;s side. Until it catches up, don&apos;t save
            the draft there, or it can write the old values back over this one.
            <s-button slot="primary-action" onClick={handleOpenInShopify}>
              Open in Shopify
            </s-button>
          </s-banner>
        </s-section>
      )}

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
                      templates={lineItemTemplates}
                      onRemove={() => handleRemoveItem(item.id)}
                      onQuantityChange={(qty) =>
                        handleQuantityChange(item.id, qty)
                      }
                      onPriceChange={(price) =>
                        handlePriceChange(item.id, price)
                      }
                      onUseCatalogPrice={() => handleUseCatalogPrice(item.id)}
                      pricePending={pendingPriceIds.has(item.id)}
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
