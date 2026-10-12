import type {
  CustomerDraftOrder,
  DraftOrder,
  DraftOrderDetail,
  DraftOrderVariantOptions,
  LineItem,
  LineItemDiscount,
  PageInfo,
} from "../types/draft-order";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { CurrencyCode } from "../types/admin.types.d.ts";
import type {
  GetDraftOrdersQuery,
  GetDraftOrderQuery,
} from "../types/admin.generated.d.ts";

const DRAFT_ORDERS_QUERY = `#graphql
  query getDraftOrders($first: Int, $last: Int, $after: String, $before: String, $reverse: Boolean, $query: String) {
    draftOrders(first: $first, last: $last, after: $after, before: $before, reverse: $reverse, query: $query) {
      edges {
        node {
          id
          name
          createdAt
          status
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          customer {
            displayName
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

const DRAFT_ORDER_QUERY = `#graphql
  query getDraftOrder($id: ID!) {
    draftOrder(id: $id) {
      id
      name
      createdAt
      status
      order {
        id
      }
      note2
      customAttributes {
        key
        value
      }
      purchasingEntity {
        __typename
        ... on PurchasingCompany {
          company {
            id
            name
          }
          location {
            id
            name
          }
          contact {
            id
          }
        }
      }
      subtotalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      totalShippingPriceSet {
        shopMoney {
          amount
        }
      }
      totalTaxSet {
        shopMoney {
          amount
        }
      }
      totalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      customer {
        displayName
        defaultEmailAddress {
          emailAddress
        }
      }
      shippingAddress {
        name
        address1
        address2
        city
        province
        country
        zip
        phone
      }
      billingAddress {
        name
        address1
        address2
        city
        province
        country
        zip
        phone
      }
      lineItems(first: 50) {
        edges {
          node {
            id
            title
            quantity
            sku
            variantTitle
            variant {
              id
            }
            image {
              url
            }
            originalUnitPriceSet {
              shopMoney {
                amount
              }
            }
            approximateDiscountedUnitPriceSet {
              shopMoney {
                amount
              }
            }
            priceOverride {
              amount
            }
            appliedDiscount {
              title
              description
              value
              valueType
              amountSet {
                shopMoney {
                  amount
                }
              }
            }
            customAttributes {
              key
              value
            }
          }
        }
      }
    }
  }
`;

const UPDATE_DRAFT_ORDER_MUTATION = `#graphql
  mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
    draftOrderUpdate(id: $id, input: $input) {
      draftOrder {
        id
        note2
        customAttributes {
          key
          value
        }
        lineItems(first: 50) {
          edges {
            node {
              id
              quantity
              originalUnitPriceSet {
                shopMoney {
                  amount
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CREATE_DRAFT_ORDER_MUTATION = `#graphql
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        invoiceUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CUSTOMER_DRAFT_ORDER_FIELDS = `#graphql
  fragment CustomerDraftOrderFields on DraftOrder {
    id
    name
    createdAt
    status
    invoiceUrl
    totalPriceSet {
      shopMoney {
        amount
        currencyCode
      }
    }
    lineItems(first: 50) {
      edges {
        node {
          id
          title
          quantity
          variantTitle
          image {
            url
          }
          originalUnitPriceSet {
            shopMoney {
              amount
            }
          }
          variant {
            id
          }
          customAttributes {
            key
            value
          }
        }
      }
    }
  }
`;

const CUSTOMER_DRAFT_ORDERS_QUERY = `#graphql
  query getCustomerDraftOrders($query: String!) {
    draftOrders(first: 10, query: $query, sortKey: NUMBER, reverse: true) {
      edges {
        node {
          ...CustomerDraftOrderFields
        }
      }
    }
  }
  ${CUSTOMER_DRAFT_ORDER_FIELDS}
`;

// Preview-only: most recent draft orders regardless of customer. Used to give
// the customer account extension something to render in the dev preview, where
// there's no logged-in customer (no `sub` claim). Never used in production.
const RECENT_DRAFT_ORDERS_QUERY = `#graphql
  query getRecentDraftOrders($first: Int!) {
    draftOrders(first: $first, reverse: true) {
      edges {
        node {
          ...CustomerDraftOrderFields
        }
      }
    }
  }
  ${CUSTOMER_DRAFT_ORDER_FIELDS}
`;

interface CustomerDraftOrderNode {
  id: string;
  name: string;
  createdAt: string;
  status: string;
  invoiceUrl: string | null;
  totalPriceSet: {
    shopMoney: { amount: string | null; currencyCode: string | null };
  };
  lineItems: {
    edges: {
      node: {
        id: string;
        title: string;
        quantity: number;
        variantTitle: string | null;
        image: { url: string } | null;
        originalUnitPriceSet: { shopMoney: { amount: string | null } };
        variant: { id: string } | null;
        customAttributes: { key: string; value: string | null }[];
      };
    }[];
  };
}

interface CustomerDraftOrdersResponse {
  draftOrders: { edges: { node: CustomerDraftOrderNode }[] };
}

const mapCustomerDraftOrder = (
  node: CustomerDraftOrderNode,
): CustomerDraftOrder => ({
  id: node.id,
  name: node.name,
  createdAt: node.createdAt,
  status: node.status,
  invoiceUrl: node.invoiceUrl ?? null,
  totalPrice: node.totalPriceSet.shopMoney.amount || "0.00",
  currencyCode: node.totalPriceSet.shopMoney.currencyCode || "USD",
  // Variant options are intentionally NOT included here — fetching them for
  // every line item of every order in this list query blows past the query
  // cost limit. They're loaded per-order on demand via getDraftOrderVariantOptions.
  lineItems: node.lineItems.edges.map((item) => ({
    id: item.node.id,
    variantId: item.node.variant?.id ?? null,
    title: item.node.title,
    variantTitle: item.node.variantTitle ?? null,
    quantity: item.node.quantity,
    image: item.node.image?.url ?? null,
    unitPrice: parseFloat(
      item.node.originalUnitPriceSet.shopMoney.amount || "0",
    ).toFixed(2),
    customAttributes: (item.node.customAttributes || []).map((attr) => ({
      key: attr.key,
      value: attr.value ?? "",
    })),
  })),
});

/**
 * Fetches all draft orders belonging to a single customer. Used by the
 * customer account UI extension so a shopper can see the draft orders a
 * merchant created for them and pay via the secure invoice URL.
 *
 * @param customerId - The customer's gid (e.g. "gid://shopify/Customer/123").
 */
export const getCustomerDraftOrders = async (
  admin: AdminApiContext,
  customerId: string,
): Promise<CustomerDraftOrder[]> => {
  const numericId = customerId.includes("/")
    ? customerId.split("/").pop()
    : customerId;

  if (!numericId) return [];

  const response = await admin.graphql(CUSTOMER_DRAFT_ORDERS_QUERY, {
    variables: { query: `customer_id:${numericId}` },
  });

  const { data } = (await response.json()) as {
    data?: CustomerDraftOrdersResponse;
  };

  return (
    data?.draftOrders.edges.map((edge) => mapCustomerDraftOrder(edge.node)) ||
    []
  );
};

/**
 * Preview-only: fetches the store's most recent draft orders regardless of
 * which customer they belong to. The customer account extension's dev preview
 * has no logged-in customer (no `sub` claim), so the normal customer-scoped
 * lookup returns nothing. This gives the preview some data to render.
 *
 * MUST NOT be used in production — it would expose one customer's draft orders
 * to any caller. The loader gates this behind a non-production check.
 */
export const getRecentDraftOrders = async (
  admin: AdminApiContext,
  first = 2,
): Promise<CustomerDraftOrder[]> => {
  const response = await admin.graphql(RECENT_DRAFT_ORDERS_QUERY, {
    variables: { first },
  });

  const { data } = (await response.json()) as {
    data?: CustomerDraftOrdersResponse;
  };

  return (
    data?.draftOrders.edges.map((edge) => mapCustomerDraftOrder(edge.node)) ||
    []
  );
};

// Variant options for a single draft order. Queried by draft order ID directly,
// so there's no draftOrders -> lineItems -> variants multiplier and it stays
// well within the query cost limit. That headroom lets us use the
// non-deprecated `media` field and a generous variant page size.
const DRAFT_ORDER_VARIANT_OPTIONS_QUERY = `#graphql
  query getDraftOrderVariantOptions($id: ID!) {
    draftOrder(id: $id) {
      id
      customer {
        id
      }
      lineItems(first: 50) {
        edges {
          node {
            id
            variant {
              id
              product {
                variants(first: 100) {
                  edges {
                    node {
                      id
                      title
                      price
                      availableForSale
                      media(first: 1) {
                        nodes {
                          preview {
                            image {
                              url
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface VariantOptionsResponse {
  draftOrder: {
    id: string;
    customer: { id: string } | null;
    lineItems: {
      edges: {
        node: {
          id: string;
          variant: {
            id: string;
            product: {
              variants: {
                edges: {
                  node: {
                    id: string;
                    title: string;
                    price: string;
                    availableForSale: boolean;
                    media: {
                      nodes: {
                        preview: { image: { url: string } | null } | null;
                      }[];
                    };
                  };
                }[];
              };
            };
          } | null;
        };
      }[];
    };
  } | null;
}

/**
 * Fetches the selectable variant options for each line item of a single draft
 * order, keyed by line item gid. Used by the customer account extension to
 * populate the variant picker on demand (per order), so the order list query
 * stays cheap.
 *
 * Re-verifies that the draft order belongs to `customerId` before returning
 * anything. Line items whose product has only one variant are omitted (there's
 * no choice to offer).
 */
export const getDraftOrderVariantOptions = async (
  admin: AdminApiContext,
  customerId: string,
  draftOrderId: string,
): Promise<DraftOrderVariantOptions> => {
  const response = await admin.graphql(DRAFT_ORDER_VARIANT_OPTIONS_QUERY, {
    variables: { id: draftOrderId },
  });
  const { data } = (await response.json()) as { data?: VariantOptionsResponse };

  const draft = data?.draftOrder;
  if (!draft) return {};

  // Ownership check: never expose another customer's order contents.
  const draftCustomerId = draft.customer ? numericId(draft.customer.id) : null;
  if (!draftCustomerId || draftCustomerId !== numericId(customerId)) {
    return {};
  }

  const result: DraftOrderVariantOptions = {};
  for (const edge of draft.lineItems.edges) {
    const node = edge.node;
    const productVariants = node.variant?.product.variants.edges ?? [];
    // Only expose options when there's a real choice to make.
    if (productVariants.length <= 1) continue;

    result[node.id] = productVariants.map((v) => ({
      id: v.node.id,
      title: v.node.title,
      price: parseFloat(v.node.price || "0").toFixed(2),
      availableForSale: v.node.availableForSale,
      image: v.node.media.nodes[0]?.preview?.image?.url ?? null,
    }));
  }

  return result;
};

interface AppliedDiscountNode {
  title?: string | null;
  description?: string | null;
  value: number;
  valueType: string;
  amountSet?: { shopMoney: { amount: string | null } } | null;
}

const mapLineDiscount = (
  discount: AppliedDiscountNode | null | undefined,
): LineItemDiscount | null =>
  discount
    ? {
        title: discount.title ?? null,
        description: discount.description ?? null,
        value: Number(discount.value),
        valueType:
          discount.valueType === "FIXED_AMOUNT" ? "FIXED_AMOUNT" : "PERCENTAGE",
        amount: parseFloat(discount.amountSet?.shopMoney.amount || "0").toFixed(
          2,
        ),
      }
    : null;

export interface GetDraftOrdersOptions {
  first?: number;
  last?: number;
  after?: string;
  before?: string;
  reverse?: boolean;
  query?: string;
}

export const getDraftOrders = async (
  admin: AdminApiContext,
  options: GetDraftOrdersOptions = {},
): Promise<{ draftOrders: DraftOrder[]; pageInfo: PageInfo }> => {
  const response = await admin.graphql(DRAFT_ORDERS_QUERY, {
    variables: {
      first: options.first,
      last: options.last,
      after: options.after,
      before: options.before,
      reverse: options.reverse ?? true,
      query: options.query,
    },
  });

  const { data } = (await response.json()) as { data: GetDraftOrdersQuery };

  const draftOrders: DraftOrder[] =
    data?.draftOrders.edges.map((edge) => ({
      id: edge.node.id,
      name: edge.node.name,
      createdAt: edge.node.createdAt,
      status: edge.node.status,
      totalPrice: edge.node.totalPriceSet.shopMoney.amount || "0.00",
      currencyCode: edge.node.totalPriceSet.shopMoney.currencyCode || "USD",
      customer: edge.node.customer ?? null,
    })) || [];

  const pageInfo: PageInfo = {
    hasNextPage: data?.draftOrders.pageInfo.hasNextPage || false,
    hasPreviousPage: data?.draftOrders.pageInfo.hasPreviousPage || false,
    startCursor: data?.draftOrders.pageInfo.startCursor || null,
    endCursor: data?.draftOrders.pageInfo.endCursor || null,
  };

  return { draftOrders, pageInfo };
};

export const getDraftOrder = async (
  admin: AdminApiContext,
  id: string,
): Promise<DraftOrderDetail | null> => {
  const response = await admin.graphql(DRAFT_ORDER_QUERY, {
    variables: { id },
  });

  const { data } = (await response.json()) as { data: GetDraftOrderQuery };

  const draftOrder = data?.draftOrder;
  if (!draftOrder) return null;

  const lineItems: LineItem[] =
    draftOrder.lineItems.edges.map((edge) => ({
      id: edge.node.id,
      variantId: edge.node.variant?.id || null,
      title: edge.node.title,
      quantity: edge.node.quantity,
      sku: edge.node.sku ?? null,
      variantTitle: edge.node.variantTitle ?? null,
      image: edge.node.image?.url || null,
      originalUnitPrice: parseFloat(
        edge.node.originalUnitPriceSet.shopMoney.amount || "0",
      ).toFixed(2),
      priceOverride: edge.node.priceOverride
        ? parseFloat(edge.node.priceOverride.amount || "0").toFixed(2)
        : null,
      appliedDiscount: mapLineDiscount(edge.node.appliedDiscount),
      discountedUnitPrice: parseFloat(
        edge.node.approximateDiscountedUnitPriceSet.shopMoney.amount || "0",
      ).toFixed(2),
      customAttributes: (edge.node.customAttributes || []).map((attr) => ({
        key: attr.key,
        value: attr.value ?? "",
      })),
    })) || [];

  const purchasingEntity = draftOrder.purchasingEntity;
  const purchasingCompany =
    purchasingEntity && purchasingEntity.__typename === "PurchasingCompany"
      ? {
          companyId: purchasingEntity.company.id,
          companyLocationId: purchasingEntity.location.id,
          companyContactId: purchasingEntity.contact?.id ?? "",
          companyName: purchasingEntity.company.name,
          locationName: purchasingEntity.location.name ?? null,
        }
      : null;

  return {
    id: draftOrder.id,
    name: draftOrder.name,
    createdAt: draftOrder.createdAt,
    status: draftOrder.status,
    // Only set once the draft has been completed into a real order.
    orderId: draftOrder.order?.id ?? null,
    note: draftOrder.note2 ?? null,
    subtotalPrice: draftOrder.subtotalPriceSet.shopMoney.amount || "0.00",
    totalShippingPrice:
      draftOrder.totalShippingPriceSet.shopMoney.amount || "0.00",
    totalTax: draftOrder.totalTaxSet.shopMoney.amount || "0.00",
    totalPrice: draftOrder.totalPriceSet.shopMoney.amount || "0.00",
    currencyCode: draftOrder.totalPriceSet.shopMoney.currencyCode || "USD",
    customer: draftOrder.customer
      ? {
          displayName: draftOrder.customer.displayName,
          email: draftOrder.customer.defaultEmailAddress?.emailAddress ?? null,
        }
      : null,
    purchasingCompany,
    shippingAddress: draftOrder.shippingAddress
      ? {
          name: draftOrder.shippingAddress.name ?? null,
          address1: draftOrder.shippingAddress.address1 ?? null,
          address2: draftOrder.shippingAddress.address2 ?? null,
          city: draftOrder.shippingAddress.city ?? null,
          province: draftOrder.shippingAddress.province ?? null,
          country: draftOrder.shippingAddress.country ?? null,
          zip: draftOrder.shippingAddress.zip ?? null,
          phone: draftOrder.shippingAddress.phone ?? null,
        }
      : null,
    billingAddress: draftOrder.billingAddress
      ? {
          name: draftOrder.billingAddress.name ?? null,
          address1: draftOrder.billingAddress.address1 ?? null,
          address2: draftOrder.billingAddress.address2 ?? null,
          city: draftOrder.billingAddress.city ?? null,
          province: draftOrder.billingAddress.province ?? null,
          country: draftOrder.billingAddress.country ?? null,
          zip: draftOrder.billingAddress.zip ?? null,
          phone: draftOrder.billingAddress.phone ?? null,
        }
      : null,
    lineItems,
    customAttributes: (draftOrder.customAttributes || []).map((attr) => ({
      key: attr.key,
      value: attr.value ?? "",
    })),
  };
};

export interface UpdateLineItemsInput {
  variantId: string | null;
  quantity: number;
  /**
   * Custom unit price for the line, or null to let Shopify price it from the
   * customer's catalog. Only lines the merchant actually priced carry one.
   * Sending an override for every line pinned B2B drafts at whatever the
   * catalog said at save time and put newly added products in at retail,
   * which is how wholesale drafts came out at full price.
   */
  priceOverride: string | null;
  currencyCode: string;
  /** The line's existing discount, sent back as read so a save keeps it. */
  appliedDiscount?: LineItemDiscount | null;
  customAttributes?: { key: string; value: string }[];
}

const toAppliedDiscountInput = (discount: LineItemDiscount) => ({
  ...(discount.title ? { title: discount.title } : {}),
  ...(discount.description ? { description: discount.description } : {}),
  value: discount.value,
  valueType: discount.valueType,
});

/**
 * Builds Shopify's `DraftOrderLineItemInput` list. Exported so the price
 * calculation and tests send exactly what a save sends.
 */
export const buildLineItemsInput = (lineItems: UpdateLineItemsInput[]) =>
  lineItems
    .filter((item) => item.variantId !== null)
    .map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      ...(item.priceOverride !== null
        ? {
            priceOverride: {
              amount: parseFloat(item.priceOverride || "0").toFixed(2),
              currencyCode: item.currencyCode as CurrencyCode,
            },
          }
        : {}),
      ...(item.appliedDiscount
        ? { appliedDiscount: toAppliedDiscountInput(item.appliedDiscount) }
        : {}),
      ...(item.customAttributes && item.customAttributes.length > 0
        ? {
            customAttributes: item.customAttributes.filter(
              (attr) => attr.key.trim() !== "",
            ),
          }
        : {}),
    }));

export const updateDraftOrderLineItems = async (
  admin: AdminApiContext,
  id: string,
  lineItems: UpdateLineItemsInput[],
  customAttributes?: { key: string; value: string }[],
  note?: string,
): Promise<{ success: boolean; error?: string }> => {
  const lineItemsInput = buildLineItemsInput(lineItems);

  if (lineItemsInput.length === 0) {
    return { success: false, error: "No valid line items to update" };
  }

  const input: Record<string, unknown> = {
    lineItems: lineItemsInput,
  };

  if (customAttributes) {
    input.customAttributes = customAttributes;
  }

  if (note !== undefined) {
    input.note = note;
  }

  const response = await admin.graphql(UPDATE_DRAFT_ORDER_MUTATION, {
    variables: {
      id,
      input,
    },
  });

  const { data } = await response.json();
  const userErrors = data?.draftOrderUpdate?.userErrors;

  if (userErrors && userErrors.length > 0) {
    return { success: false, error: userErrors[0].message };
  }

  return { success: true };
};

const DRAFT_PURCHASING_ENTITY_QUERY = `#graphql
  query getDraftOrderPurchasingEntity($id: ID!) {
    draftOrder(id: $id) {
      id
      purchasingEntity {
        __typename
        ... on Customer {
          id
        }
        ... on PurchasingCompany {
          company {
            id
          }
          location {
            id
          }
          contact {
            id
          }
        }
      }
    }
  }
`;

const CALCULATE_DRAFT_ORDER_MUTATION = `#graphql
  mutation draftOrderCalculate($input: DraftOrderInput!) {
    draftOrderCalculate(input: $input) {
      calculatedDraftOrder {
        lineItems {
          variant {
            id
          }
          quantity
          originalUnitPriceSet {
            shopMoney {
              amount
            }
          }
          approximateDiscountedUnitPriceSet {
            shopMoney {
              amount
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export type PurchasingEntityInput =
  | { customerId: string }
  | {
      purchasingCompany: {
        companyId: string;
        companyLocationId: string;
        companyContactId: string;
      };
    };

interface PurchasingEntityNode {
  __typename: string;
  id?: string;
  company?: { id: string };
  location?: { id: string };
  contact?: { id: string } | null;
}

const toPurchasingEntityInput = (
  node: PurchasingEntityNode | null | undefined,
): PurchasingEntityInput | null => {
  if (!node) return null;
  if (node.__typename === "PurchasingCompany" && node.company && node.location) {
    return {
      purchasingCompany: {
        companyId: node.company.id,
        companyLocationId: node.location.id,
        companyContactId: node.contact?.id ?? "",
      },
    };
  }
  return node.id ? { customerId: node.id } : null;
};

export interface CalculatedLinePrice {
  variantId: string;
  originalUnitPrice: string;
  discountedUnitPrice: string;
}

/**
 * Asks Shopify what it would charge for these lines on this draft, without
 * saving anything. The product picker only knows retail prices, so when a
 * merchant adds products to a B2B draft this is how the editor shows the
 * company's catalog price right away. Also used when a custom price is
 * dropped, to show what the catalog says.
 *
 * Results come back in Shopify's order, which follows the input; the caller
 * matches them to its rows by variant.
 */
export const calculateLineItemPrices = async (
  admin: AdminApiContext,
  draftOrderId: string,
  lineItems: UpdateLineItemsInput[],
): Promise<CalculatedLinePrice[]> => {
  const lineItemsInput = buildLineItemsInput(lineItems);
  if (lineItemsInput.length === 0) return [];

  const entityResponse = await admin.graphql(DRAFT_PURCHASING_ENTITY_QUERY, {
    variables: { id: draftOrderId },
  });
  const { data: entityData } = (await entityResponse.json()) as {
    data?: {
      draftOrder?: { purchasingEntity: PurchasingEntityNode | null } | null;
    };
  };
  const purchasingEntity = toPurchasingEntityInput(
    entityData?.draftOrder?.purchasingEntity,
  );

  const input: Record<string, unknown> = { lineItems: lineItemsInput };
  if (purchasingEntity) input.purchasingEntity = purchasingEntity;

  const response = await admin.graphql(CALCULATE_DRAFT_ORDER_MUTATION, {
    variables: { input },
  });
  const { data } = (await response.json()) as {
    data?: {
      draftOrderCalculate?: {
        calculatedDraftOrder: {
          lineItems: {
            variant: { id: string } | null;
            quantity: number;
            originalUnitPriceSet: { shopMoney: { amount: string } };
            approximateDiscountedUnitPriceSet: { shopMoney: { amount: string } };
          }[];
        } | null;
        userErrors: { message: string }[];
      } | null;
    };
  };

  const payload = data?.draftOrderCalculate;
  if (!payload?.calculatedDraftOrder || payload.userErrors.length > 0) {
    throw new Error(
      payload?.userErrors[0]?.message ?? "Unable to calculate prices",
    );
  }

  return payload.calculatedDraftOrder.lineItems.map((line) => ({
    variantId: line.variant?.id ?? "",
    originalUnitPrice: parseFloat(
      line.originalUnitPriceSet.shopMoney.amount || "0",
    ).toFixed(2),
    discountedUnitPrice: parseFloat(
      line.approximateDiscountedUnitPriceSet.shopMoney.amount || "0",
    ).toFixed(2),
  }));
};

export interface CreateDraftOrderLineInput {
  variantId: string;
  quantity: number;
  customAttributes?: { key: string; value: string }[];
}

/**
 * Creates a new draft order from the storefront cart "Create draft order"
 * button (via the App Proxy route). The purchasing entity comes from
 * `resolvePurchasingEntity`: a B2B shopper's company location, so Shopify
 * applies that location's catalog prices, or the plain customer otherwise.
 * Prices always come from Shopify (no client-supplied price), and automatic
 * discounts are accepted so the draft matches the cart the shopper just saw.
 */
export const createDraftOrder = async (
  admin: AdminApiContext,
  purchasingEntity: PurchasingEntityInput,
  lineItems: CreateDraftOrderLineInput[],
): Promise<{
  success: boolean;
  name?: string;
  invoiceUrl?: string;
  error?: string;
}> => {
  if (lineItems.length === 0) {
    return { success: false, error: "No line items provided" };
  }

  const input = {
    purchasingEntity,
    acceptAutomaticDiscounts: true,
    lineItems: lineItems.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      ...(item.customAttributes && item.customAttributes.length > 0
        ? {
            customAttributes: item.customAttributes.filter(
              (attr) => attr.key.trim() !== "",
            ),
          }
        : {}),
    })),
  };

  const response = await admin.graphql(CREATE_DRAFT_ORDER_MUTATION, {
    variables: { input },
  });

  const { data } = await response.json();
  const userErrors = data?.draftOrderCreate?.userErrors;
  if (userErrors && userErrors.length > 0) {
    return { success: false, error: userErrors[0].message };
  }

  const draftOrder = data?.draftOrderCreate?.draftOrder;
  if (!draftOrder) {
    return { success: false, error: "Draft order could not be created" };
  }

  return {
    success: true,
    name: draftOrder.name,
    invoiceUrl: draftOrder.invoiceUrl ?? undefined,
  };
};

const CUSTOMER_COMPANY_CONTACTS_QUERY = `#graphql
  query getCustomerCompanyContacts($id: ID!) {
    customer(id: $id) {
      id
      companyContactProfiles {
        id
        company {
          id
          name
        }
        roleAssignments(first: 50) {
          nodes {
            companyLocation {
              id
              name
            }
          }
        }
      }
    }
  }
`;

interface CompanyContactProfileNode {
  id: string;
  company: { id: string; name: string };
  roleAssignments: {
    nodes: { companyLocation: { id: string; name: string } }[];
  };
}

export interface ResolvedPurchasingEntity {
  purchasingEntity: PurchasingEntityInput;
  /** Set when the customer is a company contact but the draft had to be personal. */
  warning?: string;
}

/**
 * Works out who a draft created for `customerId` should be purchased as.
 *
 * A B2B contact only gets catalog pricing when the draft names their company
 * location; a bare `customerId` creates the draft at retail prices. When the
 * storefront says which location the shopper is buying for, use it once the
 * customer is confirmed to be a contact with a role there (the location id
 * comes from the browser, so it is never trusted on its own). Without a
 * requested location, a contact at exactly one location gets that one. In
 * every other case the draft is personal, and the warning says why.
 */
export const resolvePurchasingEntity = async (
  admin: AdminApiContext,
  customerId: string,
  requested?: { companyId: string; companyLocationId: string } | null,
): Promise<ResolvedPurchasingEntity> => {
  const personal: ResolvedPurchasingEntity = {
    purchasingEntity: { customerId },
  };

  let profiles: CompanyContactProfileNode[] = [];
  try {
    const response = await admin.graphql(CUSTOMER_COMPANY_CONTACTS_QUERY, {
      variables: { id: customerId },
    });
    const { data } = (await response.json()) as {
      data?: {
        customer?: {
          companyContactProfiles: CompanyContactProfileNode[] | null;
        } | null;
      };
    };
    profiles = data?.customer?.companyContactProfiles ?? [];
  } catch (error) {
    // Stores without B2B reject the field; a personal draft is right there.
    console.warn("companyContactProfiles lookup failed:", error);
    return personal;
  }

  const seen = new Set<string>();
  const memberships = profiles.flatMap((profile) =>
    profile.roleAssignments.nodes
      .filter((role) => {
        if (seen.has(role.companyLocation.id)) return false;
        seen.add(role.companyLocation.id);
        return true;
      })
      .map((role) => ({
        companyId: profile.company.id,
        companyContactId: profile.id,
        companyLocationId: role.companyLocation.id,
      })),
  );
  if (memberships.length === 0) return personal;

  const asCompany = (
    membership: (typeof memberships)[number],
  ): ResolvedPurchasingEntity => ({
    purchasingEntity: { purchasingCompany: membership },
  });

  if (requested) {
    const match = memberships.find(
      (m) =>
        m.companyId === requested.companyId &&
        m.companyLocationId === requested.companyLocationId,
    );
    if (match) return asCompany(match);
    return {
      ...personal,
      warning:
        "The customer isn't a contact at the requested company location, so the draft was created as a personal order.",
    };
  }

  if (memberships.length === 1) return asCompany(memberships[0]);

  return {
    ...personal,
    warning: `This customer orders for ${memberships.length} company locations, so the draft was created as a personal order. Pick the company location on the draft to apply its catalog pricing.`,
  };
};

// Fetches everything needed to safely apply a customer-driven edit in one
// round trip: ownership (customer id), status, and each line item's variant
// plus its product's other variants (for validating a variant switch and
// looking up the authoritative price). Kept separate from DRAFT_ORDER_QUERY so
// we don't have to touch the generated types.
const CUSTOMER_DRAFT_UPDATE_QUERY = `#graphql
  query getDraftOrderForCustomerUpdate($id: ID!) {
    draftOrder(id: $id) {
      id
      status
      customer {
        id
      }
      lineItems(first: 50) {
        edges {
          node {
            id
            quantity
            originalUnitPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            customAttributes {
              key
              value
            }
            priceOverride {
              amount
            }
            appliedDiscount {
              title
              description
              value
              valueType
              amountSet {
                shopMoney {
                  amount
                }
              }
            }
            variant {
              id
              product {
                variants(first: 100) {
                  edges {
                    node {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface DraftOrderForCustomerUpdate {
  id: string;
  status: string;
  customer: { id: string } | null;
  lineItems: {
    edges: {
      node: {
        id: string;
        quantity: number;
        originalUnitPriceSet: {
          shopMoney: { amount: string | null; currencyCode: string | null };
        };
        customAttributes: { key: string; value: string | null }[];
        priceOverride: { amount: string } | null;
        appliedDiscount: AppliedDiscountNode | null;
        variant: {
          id: string;
          product: {
            variants: { edges: { node: { id: string } }[] };
          };
        } | null;
      };
    }[];
  };
}

const numericId = (gid: string): string | undefined =>
  gid.includes("/") ? gid.split("/").pop() : gid;

/**
 * Applies customer-driven edits (quantity and/or variant) to a draft order's
 * line items on behalf of the logged-in customer (customer account extension).
 *
 * Security: this is a customer-facing write path, so it re-verifies that the
 * draft order actually belongs to `customerId` before making any change — the
 * caller only proves *who* the customer is (via the session token `sub`), not
 * that they own the draft. It also refuses completed drafts.
 *
 * The new line items are reconstructed from authoritative server-side data; the
 * client only chooses a quantity and a target variant. A variant switch is
 * validated to belong to the same product, and the new variant is priced by
 * Shopify for this customer (catalog or B2B price list) — the client can never
 * set an arbitrary price or swap in a different product. A custom price or
 * discount the merchant put on a line is kept as long as the variant stays.
 *
 * @param quantities - Map of line item gid -> new quantity (must be >= 1).
 * @param variants - Map of line item gid -> target variant gid.
 * @param properties - Map of line item gid -> full custom attribute list. When
 *   a line item id is present, its attributes replace the existing ones;
 *   otherwise the existing attributes are preserved.
 */
export const updateCustomerDraftOrderLineItems = async (
  admin: AdminApiContext,
  customerId: string,
  draftOrderId: string,
  quantities: Record<string, number>,
  variants: Record<string, string>,
  properties: Record<string, { key: string; value: string }[]> = {},
): Promise<{ success: boolean; error?: string }> => {
  const response = await admin.graphql(CUSTOMER_DRAFT_UPDATE_QUERY, {
    variables: { id: draftOrderId },
  });
  const { data } = (await response.json()) as {
    data?: { draftOrder?: DraftOrderForCustomerUpdate | null };
  };

  const draft = data?.draftOrder;
  if (!draft) {
    return { success: false, error: "Draft order not found" };
  }

  // Verify ownership + status.
  const draftCustomerId = draft.customer ? numericId(draft.customer.id) : null;
  if (!draftCustomerId || draftCustomerId !== numericId(customerId)) {
    return { success: false, error: "Not authorized" };
  }

  if (draft.status === "COMPLETED") {
    return { success: false, error: "This order can no longer be edited" };
  }

  const nodes = draft.lineItems.edges.map((edge) => edge.node);

  // draftOrderUpdate replaces the entire line item set, and
  // updateDraftOrderLineItems drops items without a variant. If this draft has
  // any custom (non-variant) line items, editing here would silently delete
  // them — refuse rather than lose data.
  if (nodes.some((node) => !node.variant)) {
    return { success: false, error: "This order can't be edited here" };
  }

  const currencyCode = (nodes[0]?.originalUnitPriceSet.shopMoney.currencyCode ||
    "USD") as CurrencyCode;

  // Reconstruct the full line item set from authoritative data, applying the
  // requested quantity and variant changes.
  const lineItems: UpdateLineItemsInput[] = [];
  for (const node of nodes) {
    const variant = node.variant!;
    let variantId = variant.id;
    // A custom price the merchant set stays with the line; a line priced from
    // the catalog stays that way too (no override), so a B2B price list keeps
    // applying after the customer's edit.
    let priceOverride = node.priceOverride
      ? parseFloat(node.priceOverride.amount || "0").toFixed(2)
      : null;

    const requestedVariantId = variants[node.id];
    if (requestedVariantId && requestedVariantId !== variant.id) {
      // The target variant must belong to the same product. Its price is left
      // to Shopify: a custom price set for the old variant doesn't carry over.
      const match = variant.product.variants.edges.find(
        (edge) => edge.node.id === requestedVariantId,
      );
      if (!match) {
        return { success: false, error: "Invalid variant selected" };
      }
      variantId = requestedVariantId;
      priceOverride = null;
    }

    lineItems.push({
      variantId,
      quantity: quantities[node.id] ?? node.quantity,
      priceOverride,
      currencyCode,
      appliedDiscount: mapLineDiscount(node.appliedDiscount),
      // Customer-edited attributes replace the existing set when provided;
      // otherwise the merchant's existing attributes are preserved.
      customAttributes: (
        properties[node.id] ??
        node.customAttributes.map((attr) => ({
          key: attr.key,
          value: attr.value ?? "",
        }))
      )
        .map((attr) => ({
          key: attr.key.trim(),
          value: (attr.value ?? "").trim(),
        }))
        .filter((attr) => attr.key !== ""),
    });
  }

  return updateDraftOrderLineItems(admin, draftOrderId, lineItems);
};
