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
import { PaymentSummary } from "../components/PaymentSummary";
import type {
  DraftOrderDetail as DraftOrderDetailType,
  LineItem,
} from "../types/draft-order";

interface LoaderData {
  draftOrder: DraftOrderDetailType;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { id } = params;

  const draftOrderGid = buildShopifyGid("DraftOrder", id!);
  const draftOrder = await getDraftOrder(admin, draftOrderGid);

  if (!draftOrder) {
    throw new Response("Draft order not found", { status: 404 });
  }

  return { draftOrder };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { id } = params;
  const formData = await request.formData();
  const lineItemsJson = formData.get("lineItems") as string;
  const currencyCode = formData.get("currencyCode") as string;

  if (!lineItemsJson) {
    return { success: false, error: "No line items provided" };
  }

  const draftOrderGid = buildShopifyGid("DraftOrder", id!);

  const lineItems: {
    variantId: string | null;
    quantity: number;
    originalUnitPrice: string;
    currencyCode: string;
  }[] = JSON.parse(lineItemsJson).map(
    (item: {
      variantId: string | null;
      quantity: number;
      originalUnitPrice: string;
    }) => ({
      ...item,
      currencyCode: currencyCode || "USD",
    }),
  );

  return updateDraftOrderLineItems(admin, draftOrderGid, lineItems);
};

const DraftOrderDetailPage = () => {
  const { draftOrder } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const fetcher = useFetcher<{ success: boolean; error?: string }>();
  const shopify = useAppBridge();

  const [lineItems, setLineItems] = useState<LineItem[]>(draftOrder.lineItems);
  const [savedLineItemIds, setSavedLineItemIds] = useState<string[]>(
    draftOrder.lineItems.map((item) => item.id),
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [hasNewItems, setHasNewItems] = useState(false);

  const currentIds = lineItems.map((item) => item.id);
  const hasOrderChanges = savedLineItemIds.some(
    (id, index) => id !== currentIds[index],
  );
  const hasChanges =
    hasOrderChanges ||
    hasNewItems ||
    lineItems.length !== savedLineItemIds.length;

  const isSavingRef = useRef(false);

  useEffect(() => {
    if (
      isSavingRef.current &&
      fetcher.state === "idle" &&
      fetcher.data?.success
    ) {
      setSavedLineItemIds(lineItems.map((item) => item.id));
      setHasNewItems(false);
      isSavingRef.current = false;
      shopify.toast.show("Draft order updated");
    }
  }, [fetcher.state, fetcher.data, lineItems, shopify]);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex !== null && draggedIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [draggedIndex],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === dropIndex) {
        setDraggedIndex(null);
        setDragOverIndex(null);
        return;
      }

      const newItems = [...lineItems];
      const [draggedItem] = newItems.splice(draggedIndex, 1);
      newItems.splice(dropIndex, 0, draggedItem);
      setLineItems(newItems);

      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, lineItems],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
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
            });
          }
        });
      });

      if (itemsToAdd.length > 0) {
        setLineItems([...lineItems, ...itemsToAdd]);
        setHasNewItems(true);
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
        })),
      ),
    );
    formData.append("currencyCode", draftOrder.currencyCode);
    fetcher.submit(formData, { method: "POST" });
  }, [lineItems, fetcher, draftOrder.currencyCode]);

  const handleDiscard = useCallback(() => {
    setLineItems(draftOrder.lineItems);
    setSavedLineItemIds(draftOrder.lineItems.map((item) => item.id));
    setHasNewItems(false);
  }, [draftOrder.lineItems]);

  const handleRemoveItem = useCallback((itemId: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const handleQuantityChange = useCallback(
    (itemId: string, quantity: number) => {
      setLineItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
      );
      setHasNewItems(true);
    },
    [],
  );

  const handlePriceChange = useCallback((itemId: string, price: string) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, originalUnitPrice: price } : item,
      ),
    );
    setHasNewItems(true);
  }, []);

  const handleOpenInShopify = useCallback(() => {
    const numericId = extractNumericId(draftOrder.id);
    window.open(`shopify://admin/draft_orders/${numericId}`, "_blank");
  }, [draftOrder.id]);

  const isSaving = fetcher.state === "submitting";

  return (
    <s-page heading={draftOrder.name}>
      <div slot="aside">
        {draftOrder.note && <NotesCard note={draftOrder.note} />}
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

      <SaveBar id="product-order-save-bar" open={hasChanges}>
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
          </s-stack>
          {fetcher.data?.error && (
            <s-banner tone="critical">{fetcher.data.error}</s-banner>
          )}
          {lineItems.length > 0 ? (
            <s-stack direction="block" gap="base">
              {lineItems.map((item, index) => (
                <s-box
                  key={item.id}
                  border={dragOverIndex === index ? "base" : undefined}
                  borderRadius="base"
                >
                  {index > 0 && <s-divider></s-divider>}
                  <s-box
                    paddingBlockStart={index > 0 ? "base" : undefined}
                    paddingBlockEnd="small-300"
                  >
                    <LineItemRow
                      item={item}
                      currencyCode={draftOrder.currencyCode}
                      isDragging={draggedIndex === index}
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      onRemove={() => handleRemoveItem(item.id)}
                      onQuantityChange={(qty) =>
                        handleQuantityChange(item.id, qty)
                      }
                      onPriceChange={(price) =>
                        handlePriceChange(item.id, price)
                      }
                    />
                  </s-box>
                </s-box>
              ))}
            </s-stack>
          ) : (
            <s-box padding="base">
              <s-stack alignItems="center" gap="small">
                <s-text color="subdued">No products yet</s-text>
                <s-button onClick={handleAddProducts} icon="plus">
                  Add products
                </s-button>
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
