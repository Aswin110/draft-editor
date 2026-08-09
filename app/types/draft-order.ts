export interface Address {
  name: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  zip: string | null;
  phone: string | null;
}

export interface CustomerSummary {
  displayName: string;
}

export interface Customer extends CustomerSummary {
  email: string | null;
}

export interface LineItem {
  id: string;
  variantId: string | null;
  title: string;
  quantity: number;
  originalUnitPrice: string;
  image: string | null;
  sku: string | null;
  variantTitle: string | null;
  customAttributes: CustomAttribute[];
}

export interface CustomAttribute {
  key: string;
  value: string;
}

/**
 * Where a template can be applied. Mirrors the TemplateTarget enum in
 * schema.prisma — kept as a plain union here so client components can import it
 * without pulling in the Prisma client.
 */
export type TemplateTarget = "LINE_ITEM_PROPERTY" | "CUSTOM_ATTRIBUTE";

export const TEMPLATE_TARGETS: TemplateTarget[] = [
  "LINE_ITEM_PROPERTY",
  "CUSTOM_ATTRIBUTE",
];

export const TEMPLATE_TARGET_LABELS: Record<TemplateTarget, string> = {
  LINE_ITEM_PROPERTY: "Line item properties",
  CUSTOM_ATTRIBUTE: "Order custom attributes",
};

export const TEMPLATE_TARGET_DESCRIPTIONS: Record<TemplateTarget, string> = {
  LINE_ITEM_PROPERTY:
    "Added to a single product on a draft order — engraving, size, gift note.",
  CUSTOM_ATTRIBUTE:
    "Added to the draft order as a whole — PO number, delivery window, sales rep.",
};

export const isTemplateTarget = (value: unknown): value is TemplateTarget =>
  typeof value === "string" && (TEMPLATE_TARGETS as string[]).includes(value);

export interface PropertyTemplate {
  id: string;
  name: string;
  target: TemplateTarget;
  properties: CustomAttribute[];
}

export interface DraftOrder {
  id: string;
  name: string;
  createdAt: string;
  status: string;
  totalPrice: string;
  currencyCode: string;
  customer: CustomerSummary | null;
}

export interface DraftOrderDetail extends Omit<DraftOrder, "customer"> {
  customer: Customer | null;
  note: string | null;
  subtotalPrice: string;
  totalShippingPrice: string;
  totalTax: string;
  shippingAddress: Address | null;
  billingAddress: Address | null;
  lineItems: LineItem[];
  customAttributes: CustomAttribute[];
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface CustomerVariantOption {
  id: string;
  title: string;
  price: string;
  availableForSale: boolean;
  image: string | null;
}

export interface CustomerDraftLineItem {
  id: string;
  variantId: string | null;
  title: string;
  variantTitle: string | null;
  quantity: number;
  image: string | null;
  unitPrice: string;
  customAttributes: CustomAttribute[];
}

// Variant options for a single draft order, keyed by line item gid. Loaded
// separately from the order list (getDraftOrderVariantOptions) to keep that
// list query within Shopify's query cost limit.
export type DraftOrderVariantOptions = Record<string, CustomerVariantOption[]>;

export interface CustomerDraftOrder {
  id: string;
  name: string;
  createdAt: string;
  status: string;
  totalPrice: string;
  currencyCode: string;
  invoiceUrl: string | null;
  lineItems: CustomerDraftLineItem[];
}

export type DraftOrderStatus = "OPEN" | "INVOICE_SENT" | "COMPLETED";

export interface StatusBadgeConfig {
  tone: "info" | "caution" | "success";
  label: string;
}
