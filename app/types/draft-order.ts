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

export type DraftOrderStatus = "OPEN" | "INVOICE_SENT" | "COMPLETED";

export interface StatusBadgeConfig {
  tone: "info" | "caution" | "success";
  label: string;
}
