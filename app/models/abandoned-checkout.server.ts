import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { Address, CustomAttribute, PageInfo } from "../types/draft-order";
import type {
  AbandonedCheckout,
  AbandonedCheckoutDetail,
  AbandonedCheckoutLineItem,
  ConvertCheckoutResult,
  DraftOrderRef,
} from "../types/abandoned-checkout";
import { extractNumericId } from "../utils/formatters";

// Draft orders accept up to 499 lines, but fetching that many checkout lines
// (each with a variant lookup) would blow the query cost limit. Real abandoned
// checkouts are far smaller than this; anything past it is reported as a
// warning rather than silently dropped.
const LINE_ITEM_LIMIT = 100;

// Every draft created from a checkout gets both tags: the first lets merchants
// filter drafts by origin, the second lets us find the draft for one checkout
// so a double click doesn't create duplicates.
const ORIGIN_TAG = "abandoned-checkout";
const checkoutTag = (numericId: string) => `${ORIGIN_TAG}-${numericId}`;

const CHECKOUT_ADDRESS_FIELDS = `#graphql
  fragment CheckoutAddressFields on MailingAddress {
    firstName
    lastName
    name
    company
    address1
    address2
    city
    province
    provinceCode
    country
    countryCodeV2
    zip
    phone
  }
`;

const ABANDONED_CHECKOUTS_QUERY = `#graphql
  query getAbandonedCheckouts($first: Int, $last: Int, $after: String, $before: String, $query: String, $reverse: Boolean) {
    abandonedCheckouts(first: $first, last: $last, after: $after, before: $before, query: $query, reverse: $reverse, sortKey: CREATED_AT) {
      edges {
        node {
          id
          name
          createdAt
          completedAt
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

// There's no top-level `abandonedCheckout(id:)` query, but AbandonedCheckout
// implements Node, so a `node` lookup by gid does the job.
const ABANDONED_CHECKOUT_QUERY = `#graphql
  query getAbandonedCheckout($id: ID!, $lineItemLimit: Int!) {
    node(id: $id) {
      ... on AbandonedCheckout {
        id
        name
        createdAt
        completedAt
        note
        discountCodes
        taxesIncluded
        customAttributes {
          key
          value
        }
        customer {
          id
          displayName
          defaultEmailAddress {
            emailAddress
          }
        }
        shippingAddress {
          ...CheckoutAddressFields
        }
        billingAddress {
          ...CheckoutAddressFields
        }
        subtotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalTaxSet {
          shopMoney {
            amount
          }
        }
        totalDutiesSet {
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
        lineItems(first: $lineItemLimit) {
          pageInfo {
            hasNextPage
          }
          edges {
            node {
              id
              title
              variantTitle
              quantity
              sku
              variant {
                id
              }
              image {
                url
              }
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
            }
          }
        }
      }
    }
  }
  ${CHECKOUT_ADDRESS_FIELDS}
`;

const DRAFT_ORDER_FOR_CHECKOUT_QUERY = `#graphql
  query findDraftOrderForCheckout($query: String!) {
    draftOrders(first: 1, query: $query, reverse: true) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

// Abandoned checkouts don't record which shipping rate the buyer picked, so
// we ask Shopify which rates apply to the same address and items instead.
const CALCULATE_SHIPPING_MUTATION = `#graphql
  mutation calculateCheckoutDraftOrder($input: DraftOrderInput!) {
    draftOrderCalculate(input: $input) {
      calculatedDraftOrder {
        availableShippingRates {
          handle
          title
          price {
            amount
            currencyCode
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

const CREATE_FROM_CHECKOUT_MUTATION = `#graphql
  mutation createDraftOrderFromCheckout($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface MoneyNode {
  shopMoney: { amount: string | null; currencyCode?: string | null };
}

interface AddressNode {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  company: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  provinceCode: string | null;
  country: string | null;
  countryCodeV2: string | null;
  zip: string | null;
  phone: string | null;
}

interface AttributeNode {
  key: string;
  value: string | null;
}

interface CheckoutListNode {
  id: string;
  name: string;
  createdAt: string;
  completedAt: string | null;
  totalPriceSet: MoneyNode;
  customer: { displayName: string } | null;
}

interface CheckoutLineItemNode {
  id: string;
  title: string | null;
  variantTitle: string | null;
  quantity: number;
  sku: string | null;
  variant: { id: string } | null;
  image: { url: string } | null;
  originalUnitPriceSet: MoneyNode;
  customAttributes: AttributeNode[];
}

interface CheckoutNode {
  id: string;
  name: string;
  createdAt: string;
  completedAt: string | null;
  note: string;
  discountCodes: string[];
  taxesIncluded: boolean;
  customAttributes: AttributeNode[];
  customer: {
    id: string;
    displayName: string;
    defaultEmailAddress: { emailAddress: string | null } | null;
  } | null;
  shippingAddress: AddressNode | null;
  billingAddress: AddressNode | null;
  subtotalPriceSet: MoneyNode;
  totalTaxSet: MoneyNode | null;
  totalDutiesSet: MoneyNode | null;
  totalPriceSet: MoneyNode;
  lineItems: {
    pageInfo: { hasNextPage: boolean };
    edges: { node: CheckoutLineItemNode }[];
  };
}

interface ShippingRateNode {
  handle: string;
  title: string;
  price: { amount: string; currencyCode: string };
}

interface UserError {
  field: string[] | null;
  message: string;
}

const CHECKOUT_GID_PREFIX = "gid://shopify/AbandonedCheckout/";

/**
 * Accepts either a bare numeric id or a full gid and returns the gid, or null
 * when the value isn't an abandoned checkout id at all.
 */
export const toAbandonedCheckoutGid = (value: string): string | null => {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return `${CHECKOUT_GID_PREFIX}${trimmed}`;
  if (
    trimmed.startsWith(CHECKOUT_GID_PREFIX) &&
    /^\d+$/.test(trimmed.slice(CHECKOUT_GID_PREFIX.length))
  ) {
    return trimmed;
  }
  return null;
};

const amountOf = (money: MoneyNode | null | undefined): number => {
  const parsed = parseFloat(money?.shopMoney.amount ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
};

const cleanAttributes = (
  attributes: AttributeNode[] | null | undefined,
): CustomAttribute[] =>
  (attributes || [])
    .filter((attr) => attr.key.trim() !== "")
    .map((attr) => ({ key: attr.key, value: attr.value ?? "" }));

const mapAddress = (address: AddressNode | null): Address | null =>
  address
    ? {
        name:
          address.name ??
          ([address.firstName, address.lastName].filter(Boolean).join(" ") ||
            null),
        address1: address.address1 ?? null,
        address2: address.address2 ?? null,
        city: address.city ?? null,
        province: address.province ?? null,
        country: address.country ?? null,
        zip: address.zip ?? null,
        phone: address.phone ?? null,
      }
    : null;

/**
 * Converts a checkout address into a `MailingAddressInput`. Returns undefined
 * when the address is empty so we don't attach a blank address to the draft.
 */
const toAddressInput = (
  address: AddressNode | null,
): Record<string, string> | undefined => {
  if (!address) return undefined;

  // Checkout addresses normally carry first/last name, but fall back to the
  // combined name so we never drop the recipient entirely.
  const firstName = address.firstName ?? undefined;
  const lastName =
    address.lastName ?? (!address.firstName ? address.name : null) ?? undefined;

  const input: Record<string, string | undefined> = {
    firstName,
    lastName,
    company: address.company ?? undefined,
    address1: address.address1 ?? undefined,
    address2: address.address2 ?? undefined,
    city: address.city ?? undefined,
    provinceCode: address.provinceCode ?? undefined,
    countryCode: address.countryCodeV2 ?? undefined,
    zip: address.zip ?? undefined,
    phone: address.phone ?? undefined,
  };

  const present = Object.fromEntries(
    Object.entries(input).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1].trim() !== "",
    ),
  );

  return Object.keys(present).length > 0 ? present : undefined;
};

const mapLineItem = (node: CheckoutLineItemNode): AbandonedCheckoutLineItem => ({
  id: node.id,
  variantId: node.variant?.id ?? null,
  title: node.title ?? "Custom item",
  variantTitle: node.variantTitle ?? null,
  quantity: node.quantity,
  sku: node.sku ?? null,
  image: node.image?.url ?? null,
  originalUnitPrice: amountOf(node.originalUnitPriceSet).toFixed(2),
  customAttributes: cleanAttributes(node.customAttributes),
});

const mapDetail = (node: CheckoutNode): AbandonedCheckoutDetail => ({
  id: node.id,
  name: node.name,
  createdAt: node.createdAt,
  completedAt: node.completedAt ?? null,
  totalPrice: node.totalPriceSet.shopMoney.amount || "0.00",
  currencyCode: node.totalPriceSet.shopMoney.currencyCode || "USD",
  customer: node.customer
    ? {
        id: node.customer.id,
        displayName: node.customer.displayName,
        email: node.customer.defaultEmailAddress?.emailAddress ?? null,
      }
    : null,
  note: node.note.trim() !== "" ? node.note : null,
  discountCodes: node.discountCodes,
  customAttributes: cleanAttributes(node.customAttributes),
  shippingAddress: mapAddress(node.shippingAddress),
  billingAddress: mapAddress(node.billingAddress),
  lineItems: node.lineItems.edges.map((edge) => mapLineItem(edge.node)),
  lineItemsTruncated: node.lineItems.pageInfo.hasNextPage,
});

export interface GetAbandonedCheckoutsOptions {
  first?: number;
  last?: number;
  after?: string;
  before?: string;
  reverse?: boolean;
  query?: string;
}

export const getAbandonedCheckouts = async (
  admin: AdminApiContext,
  options: GetAbandonedCheckoutsOptions = {},
): Promise<{ checkouts: AbandonedCheckout[]; pageInfo: PageInfo }> => {
  const response = await admin.graphql(ABANDONED_CHECKOUTS_QUERY, {
    variables: {
      first: options.first,
      last: options.last,
      after: options.after,
      before: options.before,
      reverse: options.reverse ?? true,
      query: options.query,
    },
  });

  const { data } = (await response.json()) as {
    data?: {
      abandonedCheckouts: {
        edges: { node: CheckoutListNode }[];
        pageInfo: PageInfo;
      };
    };
  };

  const checkouts: AbandonedCheckout[] =
    data?.abandonedCheckouts.edges.map((edge) => ({
      id: edge.node.id,
      name: edge.node.name,
      createdAt: edge.node.createdAt,
      completedAt: edge.node.completedAt ?? null,
      totalPrice: edge.node.totalPriceSet.shopMoney.amount || "0.00",
      currencyCode: edge.node.totalPriceSet.shopMoney.currencyCode || "USD",
      customer: edge.node.customer ?? null,
    })) || [];

  const pageInfo: PageInfo = {
    hasNextPage: data?.abandonedCheckouts.pageInfo.hasNextPage || false,
    hasPreviousPage: data?.abandonedCheckouts.pageInfo.hasPreviousPage || false,
    startCursor: data?.abandonedCheckouts.pageInfo.startCursor || null,
    endCursor: data?.abandonedCheckouts.pageInfo.endCursor || null,
  };

  return { checkouts, pageInfo };
};

const fetchCheckoutNode = async (
  admin: AdminApiContext,
  gid: string,
): Promise<{ node: CheckoutNode | null; error?: string }> => {
  const response = await admin.graphql(ABANDONED_CHECKOUT_QUERY, {
    variables: { id: gid, lineItemLimit: LINE_ITEM_LIMIT },
  });
  const { data, errors } = (await response.json()) as {
    data?: { node?: CheckoutNode | Record<string, never> | null };
    errors?: { message: string }[];
  };

  const node = data?.node;
  // `node` resolves to an empty object when the gid points at some other type
  // (the inline fragment doesn't match), so check for a field we asked for.
  if (!node || !("name" in node)) {
    return { node: null, error: errors?.[0]?.message };
  }
  return { node: node as CheckoutNode };
};

export const getAbandonedCheckout = async (
  admin: AdminApiContext,
  id: string,
): Promise<AbandonedCheckoutDetail | null> => {
  const gid = toAbandonedCheckoutGid(id);
  if (!gid) return null;

  const { node } = await fetchCheckoutNode(admin, gid);
  return node ? mapDetail(node) : null;
};

/**
 * Finds the draft order previously created from this checkout, if any, via the
 * per-checkout tag we stamp on every draft we create.
 */
export const findDraftOrderForCheckout = async (
  admin: AdminApiContext,
  id: string,
): Promise<DraftOrderRef | null> => {
  const gid = toAbandonedCheckoutGid(id);
  if (!gid) return null;

  const response = await admin.graphql(DRAFT_ORDER_FOR_CHECKOUT_QUERY, {
    variables: { query: `tag:${checkoutTag(extractNumericId(gid))}` },
  });
  const { data } = (await response.json()) as {
    data?: { draftOrders: { edges: { node: DraftOrderRef }[] } };
  };

  const node = data?.draftOrders.edges[0]?.node;
  return node ? { id: node.id, name: node.name } : null;
};

/**
 * What the buyer paid for shipping, inferred from the checkout totals. The
 * checkout doesn't expose its shipping line, but total − items − tax − duties
 * leaves shipping (and tips, which are rare enough to ignore). Used to pick the
 * same rate the buyer saw when one of the available rates matches.
 */
const impliedShippingAmount = (checkout: CheckoutNode): number => {
  const total = amountOf(checkout.totalPriceSet);
  const subtotal = amountOf(checkout.subtotalPriceSet);
  const tax = checkout.taxesIncluded ? 0 : amountOf(checkout.totalTaxSet);
  const duties = amountOf(checkout.totalDutiesSet);
  return total - subtotal - tax - duties;
};

const buildDraftOrderInput = (
  checkout: CheckoutNode,
  numericId: string,
): { input: Record<string, unknown>; warnings: string[] } => {
  const warnings: string[] = [];
  const lineItems: Record<string, unknown>[] = [];
  let customItems = 0;

  for (const { node } of checkout.lineItems.edges) {
    const customAttributes = cleanAttributes(node.customAttributes);
    const base = {
      quantity: node.quantity,
      ...(customAttributes.length > 0 ? { customAttributes } : {}),
    };

    if (node.variant?.id) {
      lineItems.push({ ...base, variantId: node.variant.id });
      continue;
    }

    // The variant was deleted (or it was a custom item), so carry it over as
    // a custom line at the price the buyer saw rather than losing it.
    customItems += 1;
    const title =
      [node.title, node.variantTitle].filter(Boolean).join(" - ") ||
      "Custom item";
    lineItems.push({
      ...base,
      title,
      ...(node.sku ? { sku: node.sku } : {}),
      originalUnitPriceWithCurrency: {
        amount: amountOf(node.originalUnitPriceSet).toFixed(2),
        currencyCode:
          node.originalUnitPriceSet.shopMoney.currencyCode ||
          checkout.totalPriceSet.shopMoney.currencyCode ||
          "USD",
      },
    });
  }

  if (customItems > 0) {
    warnings.push(
      customItems === 1
        ? "1 item is no longer in your catalog, so it was added as a custom item at its checkout price."
        : `${customItems} items are no longer in your catalog, so they were added as custom items at their checkout prices.`,
    );
  }
  if (checkout.lineItems.pageInfo.hasNextPage) {
    warnings.push(
      `Only the first ${LINE_ITEM_LIMIT} items were copied. Add the rest on the draft order.`,
    );
  }
  if (checkout.completedAt) {
    warnings.push(
      "The customer already completed this checkout, so an order may exist for it.",
    );
  }

  const input: Record<string, unknown> = {
    lineItems,
    tags: [ORIGIN_TAG, checkoutTag(numericId)],
    // Mirror the checkout: automatic discounts applied there, so apply them on
    // the draft too, and re-try any codes the buyer entered.
    acceptAutomaticDiscounts: true,
  };

  if (checkout.customer?.id) {
    input.purchasingEntity = { customerId: checkout.customer.id };
  } else {
    warnings.push(
      "No customer record is attached to this checkout. Add the customer on the draft order if you need one.",
    );
  }

  const shippingAddress = toAddressInput(checkout.shippingAddress);
  if (shippingAddress) input.shippingAddress = shippingAddress;
  const billingAddress = toAddressInput(checkout.billingAddress);
  if (billingAddress) input.billingAddress = billingAddress;

  if (checkout.note.trim() !== "") input.note = checkout.note;

  const customAttributes = cleanAttributes(checkout.customAttributes);
  if (customAttributes.length > 0) input.customAttributes = customAttributes;

  if (checkout.discountCodes.length > 0) {
    input.discountCodes = checkout.discountCodes;
  }

  return { input, warnings };
};

/**
 * Adds a shipping line to `input`, mutating it in place. Picks the available
 * rate whose price matches what the buyer was charged; when none matches, the
 * cheapest rate, so the merchant always has something to adjust rather than a
 * blank. Any problem becomes a warning — shipping should never block the draft.
 */
const addShippingLine = async (
  admin: AdminApiContext,
  checkout: CheckoutNode,
  input: Record<string, unknown>,
  warnings: string[],
): Promise<void> => {
  if (!input.shippingAddress) {
    warnings.push(
      "The checkout has no shipping address, so no shipping was added.",
    );
    return;
  }

  let rates: ShippingRateNode[] = [];
  try {
    const response = await admin.graphql(CALCULATE_SHIPPING_MUTATION, {
      variables: { input },
    });
    const { data } = (await response.json()) as {
      data?: {
        draftOrderCalculate?: {
          calculatedDraftOrder?: {
            availableShippingRates: ShippingRateNode[];
          } | null;
          userErrors: UserError[];
        } | null;
      };
    };
    const payload = data?.draftOrderCalculate;
    if (payload?.userErrors?.length) {
      console.error(
        "draftOrderCalculate user errors:",
        JSON.stringify(payload.userErrors),
      );
    }
    rates = payload?.calculatedDraftOrder?.availableShippingRates ?? [];
  } catch (error) {
    console.error("draftOrderCalculate failed:", error);
  }

  if (rates.length === 0) {
    warnings.push(
      "No shipping rates are available for this address, so shipping was left for you to add.",
    );
    return;
  }

  const priceOf = (rate: ShippingRateNode) => parseFloat(rate.price.amount) || 0;
  const implied = impliedShippingAmount(checkout);
  const matching = rates.find((rate) => Math.abs(priceOf(rate) - implied) < 0.005);
  const cheapest = rates.reduce((best, rate) =>
    priceOf(rate) < priceOf(best) ? rate : best,
  );
  const chosen = matching ?? cheapest;

  input.shippingLine = {
    shippingRateHandle: chosen.handle,
    title: chosen.title,
    priceWithCurrency: {
      amount: priceOf(chosen).toFixed(2),
      currencyCode: chosen.price.currencyCode,
    },
  };

  if (!matching) {
    warnings.push(
      `Shipping was set to the cheapest available rate (${chosen.title}). Change it on the draft order if the customer chose a different one.`,
    );
  }
};

export interface ConvertCheckoutOptions {
  /** Create a new draft even if one was already created from this checkout. */
  force?: boolean;
}

/**
 * Turns an abandoned checkout into a draft order in one step: line items (with
 * their properties), customer, addresses, note, attributes and discount codes
 * are copied, and a shipping rate is chosen for the shipping address.
 *
 * Refuses to create a second draft for the same checkout unless `force` is set,
 * returning the existing one instead so the caller can offer to open it.
 */
export const convertAbandonedCheckoutToDraftOrder = async (
  admin: AdminApiContext,
  id: string,
  options: ConvertCheckoutOptions = {},
): Promise<ConvertCheckoutResult> => {
  const gid = toAbandonedCheckoutGid(id);
  if (!gid) {
    return {
      success: false,
      error: "That doesn't look like an abandoned checkout.",
      warnings: [],
    };
  }
  const numericId = extractNumericId(gid);

  const { node: checkout, error: loadError } = await fetchCheckoutNode(
    admin,
    gid,
  );
  if (!checkout) {
    return {
      success: false,
      error: loadError
        ? `Unable to load this abandoned checkout: ${loadError}`
        : "Abandoned checkout not found. Shopify may have removed it.",
      warnings: [],
    };
  }

  if (!options.force) {
    const existing = await findDraftOrderForCheckout(admin, gid);
    if (existing) {
      return {
        success: false,
        existingDraftOrder: existing,
        error: `Draft order ${existing.name} was already created from this checkout.`,
        warnings: [],
      };
    }
  }

  const { input, warnings } = buildDraftOrderInput(checkout, numericId);
  if ((input.lineItems as unknown[]).length === 0) {
    return {
      success: false,
      error: "This checkout has no items to copy.",
      warnings,
    };
  }

  await addShippingLine(admin, checkout, input, warnings);

  const response = await admin.graphql(CREATE_FROM_CHECKOUT_MUTATION, {
    variables: { input },
  });
  const { data, errors } = (await response.json()) as {
    data?: {
      draftOrderCreate?: {
        draftOrder: DraftOrderRef | null;
        userErrors: UserError[];
      } | null;
    };
    errors?: { message: string }[];
  };

  const userErrors = data?.draftOrderCreate?.userErrors ?? [];
  if (userErrors.length > 0) {
    return { success: false, error: userErrors[0].message, warnings };
  }

  const draftOrder = data?.draftOrderCreate?.draftOrder;
  if (!draftOrder) {
    return {
      success: false,
      error: errors?.[0]?.message ?? "Draft order could not be created.",
      warnings,
    };
  }

  return {
    success: true,
    draftOrder: { id: draftOrder.id, name: draftOrder.name },
    warnings,
  };
};
