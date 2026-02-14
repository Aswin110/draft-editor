import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Page,
  Card,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  Box,
  Divider,
  Layout,
  Banner,
  Button,
  FooterHelp,
} from "@shopify/polaris";
import { PlusIcon, ExternalIcon } from "@shopify/polaris-icons";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getDraftOrder, updateDraftOrderLineItems } from "../models/draft-order.server";
import { canEditDraftOrder } from "../models/usage.server";
import {
  formatDateTime,
  getStatusBadge,
  formatAddressLines,
  buildShopifyGid,
  extractNumericId,
} from "../utils/formatters";
import { AddressCard } from "../components/AddressCard";
import { CustomerCard } from "../components/CustomerCard";
import { LineItemRow } from "../components/LineItemRow";
import { NotesCard } from "../components/NotesCard";
import { PaymentSummary } from "../components/PaymentSummary";
import { UpgradeBanner } from "../components/UpgradeBanner";
import { MONTHLY_PLAN, ANNUAL_PLAN } from "../constants/plans";
import type { DraftOrderDetail as DraftOrderDetailType, LineItem } from "../types/draft-order";

interface LoaderData {
  draftOrder: DraftOrderDetailType;
  canEdit: boolean;
  usedCount: number;
  limit: number;
  hasActivePlan: boolean;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, billing } = await authenticate.admin(request);
  const { id } = params;

  const draftOrderGid = buildShopifyGid("DraftOrder", id!);
  const draftOrder = await getDraftOrder(admin, draftOrderGid);

  if (!draftOrder) {
    throw new Response("Draft order not found", { status: 404 });
  }

  const { hasActivePayment } = await billing.check({
    plans: [MONTHLY_PLAN, ANNUAL_PLAN],
    isTest: true,
  });

  const { allowed, monthlyCount, limit } = await canEditDraftOrder(
    admin,
    draftOrderGid,
    hasActivePayment,
  );

  return {
    draftOrder,
    canEdit: allowed,
    usedCount: monthlyCount,
    limit,
    hasActivePlan: hasActivePayment,
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, billing } = await authenticate.admin(request);
  const { id } = params;
  const formData = await request.formData();
  const lineItemsJson = formData.get("lineItems") as string;
  const currencyCode = formData.get("currencyCode") as string;

  if (!lineItemsJson) {
    return { success: false, error: "No line items provided" };
  }

  const draftOrderGid = buildShopifyGid("DraftOrder", id!);

  // Server-side usage limit enforcement
  const { hasActivePayment } = await billing.check({
    plans: [MONTHLY_PLAN, ANNUAL_PLAN],
    isTest: true,
  });

  if (!hasActivePayment) {
    const { allowed } = await canEditDraftOrder(admin, draftOrderGid, false);
    if (!allowed) {
      return {
        success: false,
        error:
          "Free plan edit limit reached. Please upgrade to continue editing draft orders.",
      };
    }
  }

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
  const { draftOrder, canEdit, usedCount, limit, hasActivePlan } =
    useLoaderData<LoaderData>();
  const editingDisabled = !canEdit;
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
    }
  }, [fetcher.state, fetcher.data, lineItems]);

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

  const statusBadge = getStatusBadge(draftOrder.status);
  const isSaving = fetcher.state === "submitting";

  return (
    <Page
      backAction={{ content: "Draft Orders", onAction: () => navigate("/app") }}
      title={draftOrder.name}
      titleMetadata={<Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>}
      subtitle={`Created on ${formatDateTime(draftOrder.createdAt)}`}
      secondaryActions={[
        {
          content: "Open in Shopify",
          icon: ExternalIcon,
          onAction: handleOpenInShopify,
          accessibilityLabel: "Open draft order in Shopify Admin",
        },
      ]}
    >
      {!editingDisabled && (
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
      )}
      <Layout>
        <Layout.Section>
          {editingDisabled && (
            <Box paddingBlockEnd="400">
              <UpgradeBanner usedCount={usedCount} limit={limit} />
            </Box>
          )}

          {!hasActivePlan && !editingDisabled && (
            <Box paddingBlockEnd="400">
              <Banner tone="info">
                <p>
                  Free plan: {usedCount} of {limit} draft order edits used
                  this month.
                </p>
              </Banner>
            </Box>
          )}

          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Products
                </Text>
                {!editingDisabled && (
                  <InlineStack gap="200">
                    {lineItems.length > 1 && (
                      <Text as="span" variant="bodySm" tone="subdued">
                        Drag to reorder
                      </Text>
                    )}
                    <Button
                      icon={PlusIcon}
                      onClick={handleAddProducts}
                      accessibilityLabel="Add products"
                    >
                      Add Products
                    </Button>
                  </InlineStack>
                )}
              </InlineStack>
              {fetcher.data?.error && (
                <Banner tone="critical">{fetcher.data.error}</Banner>
              )}
              {lineItems.length > 0 ? (
                <BlockStack gap="400">
                  {lineItems.map((item, index) => (
                    <Box
                      key={item.id}
                      borderColor={
                        dragOverIndex === index ? "border-brand" : "transparent"
                      }
                      borderWidth={dragOverIndex === index ? "025" : "0"}
                      borderRadius="200"
                    >
                      {index > 0 && <Divider />}
                      <Box
                        paddingBlockStart={index > 0 ? "400" : "0"}
                        paddingBlockEnd="100"
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
                          disabled={editingDisabled}
                        />
                      </Box>
                    </Box>
                  ))}
                </BlockStack>
              ) : (
                <Box paddingBlock="400">
                  <BlockStack gap="200" align="center">
                    <Text as="p" tone="subdued">
                      No products yet
                    </Text>
                    {!editingDisabled && (
                      <Button onClick={handleAddProducts} icon={PlusIcon}>
                        Add products
                      </Button>
                    )}
                  </BlockStack>
                </Box>
              )}
            </BlockStack>
          </Card>

          <Box paddingBlockStart="400">
            <PaymentSummary
              subtotalPrice={draftOrder.subtotalPrice}
              totalShippingPrice={draftOrder.totalShippingPrice}
              totalTax={draftOrder.totalTax}
              totalPrice={draftOrder.totalPrice}
              currencyCode={draftOrder.currencyCode}
            />
          </Box>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          {draftOrder.note && (
            <Box paddingBlockEnd="400">
              <NotesCard note={draftOrder.note} />
            </Box>
          )}

          <CustomerCard customer={draftOrder.customer} />

          <Box paddingBlockStart="400">
            <AddressCard
              title="Shipping address"
              addressLines={formatAddressLines(draftOrder.shippingAddress)}
            />
          </Box>

          <Box paddingBlockStart="400">
            <AddressCard
              title="Billing address"
              addressLines={formatAddressLines(draftOrder.billingAddress)}
            />
          </Box>
        </Layout.Section>
      </Layout>
      <FooterHelp />
    </Page>
  );
};
export default DraftOrderDetailPage;
