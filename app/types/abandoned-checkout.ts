import type { Address, CustomAttribute, CustomerSummary } from "./draft-order";

/** A row on the abandoned checkouts list. */
export interface AbandonedCheckout {
  id: string;
  name: string;
  createdAt: string;
  /** Set once the buyer finished this checkout and it became an order. */
  completedAt: string | null;
  totalPrice: string;
  currencyCode: string;
  customer: CustomerSummary | null;
}

export interface AbandonedCheckoutLineItem {
  id: string;
  /** Null when the variant was deleted after the checkout began, or for custom items. */
  variantId: string | null;
  title: string;
  variantTitle: string | null;
  quantity: number;
  sku: string | null;
  image: string | null;
  originalUnitPrice: string;
  customAttributes: CustomAttribute[];
}

export interface AbandonedCheckoutCustomer extends CustomerSummary {
  id: string;
  email: string | null;
}

export interface AbandonedCheckoutDetail
  extends Omit<AbandonedCheckout, "customer"> {
  customer: AbandonedCheckoutCustomer | null;
  note: string | null;
  discountCodes: string[];
  customAttributes: CustomAttribute[];
  shippingAddress: Address | null;
  billingAddress: Address | null;
  lineItems: AbandonedCheckoutLineItem[];
  /** True when the checkout had more line items than we fetched. */
  lineItemsTruncated: boolean;
}

export interface DraftOrderRef {
  id: string;
  name: string;
}

/**
 * Outcome of turning an abandoned checkout into a draft order.
 *
 * `existingDraftOrder` is set (with `success: false`) when a draft was already
 * created from this checkout and the caller didn't ask to force another one.
 * `warnings` lists anything that couldn't be carried over exactly (custom
 * items, missing shipping rates, ...) so the merchant knows what to check.
 */
export interface ConvertCheckoutResult {
  success: boolean;
  draftOrder?: DraftOrderRef;
  existingDraftOrder?: DraftOrderRef;
  warnings: string[];
  error?: string;
}
