import type {
  Address,
  CustomAttribute,
  Customer,
  CustomerSummary,
} from "./draft-order";

export interface Order {
  id: string;
  name: string;
  createdAt: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  totalPrice: string;
  currencyCode: string;
  customer: CustomerSummary | null;
}

/**
 * A line item on a real (already created) order.
 *
 * Everything here is read-only, and that's a Shopify constraint rather than a
 * choice: once an order exists there is no API to change a line item's
 * customAttributes. `OrderInput` (what `orderUpdate` accepts) has no
 * `lineItems` field, and none of the orderEdit* mutations take attributes —
 * `orderEditAddCustomItem` only accepts title/price/quantity/taxable/
 * requiresShipping/locationId. The properties are surfaced so the spec
 * captured at draft or cart time stays visible on the order.
 */
export interface OrderLineItem {
  id: string;
  title: string;
  quantity: number;
  sku: string | null;
  variantTitle: string | null;
  image: string | null;
  originalUnitPrice: string;
  customAttributes: CustomAttribute[];
}

export interface OrderDetail extends Omit<Order, "customer"> {
  customer: Customer | null;
  note: string | null;
  subtotalPrice: string;
  totalShippingPrice: string;
  totalTax: string;
  shippingAddress: Address | null;
  billingAddress: Address | null;
  lineItems: OrderLineItem[];
  /** Order-level attributes — editable, unlike the line item ones. */
  customAttributes: CustomAttribute[];
}
