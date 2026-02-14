import type { DraftOrder, DraftOrderDetail, LineItem, PageInfo } from "../types/draft-order";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { CurrencyCode } from "../types/admin.types";

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
      note2
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
  options: GetDraftOrdersOptions = {}
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

  const { data } = await response.json();

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
  id: string
): Promise<DraftOrderDetail | null> => {
  const response = await admin.graphql(DRAFT_ORDER_QUERY, {
    variables: { id },
  });

  const { data } = await response.json();

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
      originalUnitPrice: parseFloat(edge.node.originalUnitPriceSet.shopMoney.amount || "0").toFixed(2),
    })) || [];

  return {
    id: draftOrder.id,
    name: draftOrder.name,
    createdAt: draftOrder.createdAt,
    status: draftOrder.status,
    note: draftOrder.note2 ?? null,
    subtotalPrice: draftOrder.subtotalPriceSet.shopMoney.amount || "0.00",
    totalShippingPrice: draftOrder.totalShippingPriceSet.shopMoney.amount || "0.00",
    totalTax: draftOrder.totalTaxSet.shopMoney.amount || "0.00",
    totalPrice: draftOrder.totalPriceSet.shopMoney.amount || "0.00",
    currencyCode: draftOrder.totalPriceSet.shopMoney.currencyCode || "USD",
    customer: draftOrder.customer ? {
      displayName: draftOrder.customer.displayName,
      email: draftOrder.customer.defaultEmailAddress?.emailAddress ?? null,
    } : null,
    shippingAddress: draftOrder.shippingAddress ? {
      name: draftOrder.shippingAddress.name ?? null,
      address1: draftOrder.shippingAddress.address1 ?? null,
      address2: draftOrder.shippingAddress.address2 ?? null,
      city: draftOrder.shippingAddress.city ?? null,
      province: draftOrder.shippingAddress.province ?? null,
      country: draftOrder.shippingAddress.country ?? null,
      zip: draftOrder.shippingAddress.zip ?? null,
      phone: draftOrder.shippingAddress.phone ?? null,
    } : null,
    billingAddress: draftOrder.billingAddress ? {
      name: draftOrder.billingAddress.name ?? null,
      address1: draftOrder.billingAddress.address1 ?? null,
      address2: draftOrder.billingAddress.address2 ?? null,
      city: draftOrder.billingAddress.city ?? null,
      province: draftOrder.billingAddress.province ?? null,
      country: draftOrder.billingAddress.country ?? null,
      zip: draftOrder.billingAddress.zip ?? null,
      phone: draftOrder.billingAddress.phone ?? null,
    } : null,
    lineItems,
  };
};

export interface UpdateLineItemsInput {
  variantId: string | null;
  quantity: number;
  originalUnitPrice: string;
  currencyCode: string;
}

export const updateDraftOrderLineItems = async (
  admin: AdminApiContext,
  id: string,
  lineItems: UpdateLineItemsInput[]
): Promise<{ success: boolean; error?: string }> => {
  const validLineItems = lineItems.filter((item) => item.variantId !== null);

  if (validLineItems.length === 0) {
    return { success: false, error: "No valid line items to update" };
  }

  const lineItemsInput = validLineItems.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
    priceOverride: {
      amount: parseFloat(item.originalUnitPrice || "0").toFixed(2),
      currencyCode: item.currencyCode as CurrencyCode,
    },
  }));

  const response = await admin.graphql(UPDATE_DRAFT_ORDER_MUTATION, {
    variables: {
      id,
      input: {
        lineItems: lineItemsInput,
      },
    },
  });

  const { data } = await response.json();
  const userErrors = data?.draftOrderUpdate?.userErrors;

  if (userErrors && userErrors.length > 0) {
    return { success: false, error: userErrors[0].message };
  }

  return { success: true };
};
