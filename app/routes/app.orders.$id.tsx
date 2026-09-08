import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { useState, useCallback, useRef, useEffect } from "react";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getOrder, updateOrderAttributes } from "../models/order.server";
import {
  formatAddressLines,
  buildShopifyGid,
  extractNumericId,
  getFinancialStatusBadge,
  getFulfillmentStatusBadge,
} from "../utils/formatters";
import { AddressCard } from "../components/AddressCard";
import { CustomerCard } from "../components/CustomerCard";
import { NotesCard } from "../components/NotesCard";
import { CustomAttributesCard } from "../components/CustomAttributesCard";
import { OrderLineItemRow } from "../components/OrderLineItemRow";
import { PaymentSummary } from "../components/PaymentSummary";
import type { CustomAttribute, PropertyTemplate } from "../types/draft-order";
import type { OrderDetail as OrderDetailType } from "../types/order";
import { listPropertyTemplates } from "../models/property-template.server";
import { useReviewPrompt } from "../hooks/useReviewPrompt";

interface LoaderData {
  order: OrderDetailType;
  templates: PropertyTemplate[];
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { id } = params;

  const orderGid = buildShopifyGid("Order", id!);

  const [order, templates] = await Promise.all([
    getOrder(admin, orderGid),
    // Only order-level templates apply here — line item properties are frozen
    // once the order exists.
    listPropertyTemplates(session.shop, "CUSTOM_ATTRIBUTE"),
  ]);

  if (!order) {
    throw new Response("Order not found", { status: 404 });
  }

  return { order, templates };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { id } = params;

  const orderGid = buildShopifyGid("Order", id!);

  const formData = await request.formData();
  const customAttributesJson = formData.get("customAttributes") as string;
  const note = formData.get("note") as string | null;

  const customAttributes: { key: string; value: string }[] | undefined =
    customAttributesJson
      ? JSON.parse(customAttributesJson).filter(
          (attr: { key: string; value: string }) => attr.key.trim() !== "",
        )
      : undefined;

  return updateOrderAttributes(
    admin,
    orderGid,
    customAttributes,
    note ?? undefined,
  );
};

const OrderDetailPage = () => {
  const { order, templates } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const fetcher = useFetcher<{ success: boolean; error?: string }>();
  const shopify = useAppBridge();
  const requestReview = useReviewPrompt();

  const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>(
    order.customAttributes,
  );
  const [savedCustomAttributes, setSavedCustomAttributes] = useState<
    CustomAttribute[]
  >(order.customAttributes);
  const [note, setNote] = useState<string>(order.note || "");
  const [savedNote, setSavedNote] = useState<string>(order.note || "");

  const hasAttributeChanges =
    JSON.stringify(customAttributes) !== JSON.stringify(savedCustomAttributes);
  const hasNoteChanges = note !== savedNote;
  const hasChanges = hasAttributeChanges || hasNoteChanges;

  const isSavingRef = useRef(false);

  useEffect(() => {
    if (
      isSavingRef.current &&
      fetcher.state === "idle" &&
      fetcher.data?.success
    ) {
      setSavedCustomAttributes([...customAttributes]);
      setSavedNote(note);
      isSavingRef.current = false;
      shopify.toast.show("Order updated");
      void requestReview();
    }
  }, [
    fetcher.state,
    fetcher.data,
    customAttributes,
    note,
    shopify,
    requestReview,
  ]);

  const handleSave = useCallback(() => {
    isSavingRef.current = true;
    const formData = new FormData();
    formData.append("customAttributes", JSON.stringify(customAttributes));
    formData.append("note", note);
    fetcher.submit(formData, { method: "POST" });
  }, [customAttributes, note, fetcher]);

  const handleDiscard = useCallback(() => {
    setCustomAttributes(order.customAttributes);
    setSavedCustomAttributes(order.customAttributes);
    setNote(order.note || "");
    setSavedNote(order.note || "");
  }, [order.customAttributes, order.note]);

  const handleOpenInShopify = useCallback(() => {
    const numericId = extractNumericId(order.id);
    window.open(`shopify://admin/orders/${numericId}`, "_blank");
  }, [order.id]);

  const isSaving = fetcher.state === "submitting";
  const financialBadge = getFinancialStatusBadge(order.financialStatus);
  const fulfillmentBadge = getFulfillmentStatusBadge(order.fulfillmentStatus);
  const hasLineItemProperties = order.lineItems.some(
    (item) => item.customAttributes.length > 0,
  );

  return (
    <s-page heading={order.name}>
      <div slot="aside">
        <NotesCard note={note || null} onChange={setNote} />
        <CustomAttributesCard
          attributes={customAttributes}
          onChange={setCustomAttributes}
          templates={templates}
        />
        <CustomerCard customer={order.customer} />
        <AddressCard
          title="Shipping address"
          addressLines={formatAddressLines(order.shippingAddress)}
        />
        <AddressCard
          title="Billing address"
          addressLines={formatAddressLines(order.billingAddress)}
        />
      </div>
      <s-link slot="breadcrumb-actions" onClick={() => navigate("/app/orders")}>
        Orders
      </s-link>
      <s-button
        slot="secondary-actions"
        variant="secondary"
        onClick={handleOpenInShopify}
        accessibilityLabel="Open order in Shopify Admin"
        icon="external"
      >
        Open in Shopify
      </s-button>

      <SaveBar id="order-save-bar" open={hasChanges}>
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
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-badge tone={financialBadge.tone}>{financialBadge.label}</s-badge>
            <s-badge tone={fulfillmentBadge.tone}>
              {fulfillmentBadge.label}
            </s-badge>
          </s-stack>
          {fetcher.data?.error && (
            <s-banner tone="critical">{fetcher.data.error}</s-banner>
          )}
        </s-stack>
      </s-section>

      <s-section>
        <s-stack direction="block" gap="base">
          <s-heading>Products</s-heading>
          <s-banner tone="info">
            Line item properties can&apos;t be edited once an order exists —
            Shopify doesn&apos;t expose a way to change them. Use Notes and
            Custom attributes for anything you need to add now, or capture
            per-product detail on the draft order before it&apos;s paid.
          </s-banner>
          {order.lineItems.length > 0 ? (
            <s-stack direction="block" gap="small-300">
              {order.lineItems.map((item) => (
                <OrderLineItemRow
                  key={item.id}
                  item={item}
                  currencyCode={order.currencyCode}
                />
              ))}
            </s-stack>
          ) : (
            <s-box padding="base">
              <s-stack alignItems="center" gap="small">
                <s-text color="subdued">No products on this order</s-text>
              </s-stack>
            </s-box>
          )}
          {order.lineItems.length > 0 && !hasLineItemProperties && (
            <s-text color="subdued">
              No line item properties were captured on this order.
            </s-text>
          )}
        </s-stack>
      </s-section>

      <PaymentSummary
        subtotalPrice={order.subtotalPrice}
        totalShippingPrice={order.totalShippingPrice}
        totalTax={order.totalTax}
        totalPrice={order.totalPrice}
        currencyCode={order.currencyCode}
      />
    </s-page>
  );
};
export default OrderDetailPage;
