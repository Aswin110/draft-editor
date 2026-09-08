import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { Order, OrderDetail, OrderLineItem } from "../types/order";
import type { PageInfo } from "../types/draft-order";

const ORDERS_QUERY = `#graphql
  query getOrders($first: Int, $last: Int, $after: String, $before: String, $reverse: Boolean, $query: String) {
    orders(first: $first, last: $last, after: $after, before: $before, reverse: $reverse, query: $query) {
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          currentTotalPriceSet {
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

const ORDER_QUERY = `#graphql
  query getOrder($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      note
      displayFinancialStatus
      displayFulfillmentStatus
      customAttributes {
        key
        value
      }
      currentSubtotalPriceSet {
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
      currentTotalTaxSet {
        shopMoney {
          amount
        }
      }
      currentTotalPriceSet {
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
            image {
              url
            }
            originalUnitPriceSet {
              shopMoney {
                amount
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

// Only the order-level fields Shopify lets us write. Line items are absent
// from OrderInput entirely — see the note on OrderLineItem.
const UPDATE_ORDER_MUTATION = `#graphql
  mutation orderUpdate($input: OrderInput!) {
    orderUpdate(input: $input) {
      order {
        id
        note
        customAttributes {
          key
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface MoneyBagNode {
  shopMoney: { amount: string | null; currencyCode?: string | null };
}

interface OrdersResponse {
  orders: {
    edges: {
      node: {
        id: string;
        name: string;
        createdAt: string;
        displayFinancialStatus: string | null;
        displayFulfillmentStatus: string | null;
        currentTotalPriceSet: MoneyBagNode;
        customer: { displayName: string } | null;
      };
    }[];
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
  };
}

interface AddressNode {
  name: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  zip: string | null;
  phone: string | null;
}

interface OrderNode {
  id: string;
  name: string;
  createdAt: string;
  note: string | null;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  customAttributes: { key: string; value: string | null }[];
  currentSubtotalPriceSet: MoneyBagNode;
  totalShippingPriceSet: MoneyBagNode;
  currentTotalTaxSet: MoneyBagNode;
  currentTotalPriceSet: MoneyBagNode;
  customer: {
    displayName: string;
    defaultEmailAddress: { emailAddress: string | null } | null;
  } | null;
  shippingAddress: AddressNode | null;
  billingAddress: AddressNode | null;
  lineItems: {
    edges: {
      node: {
        id: string;
        title: string;
        quantity: number;
        sku: string | null;
        variantTitle: string | null;
        image: { url: string } | null;
        originalUnitPriceSet: MoneyBagNode;
        customAttributes: { key: string; value: string | null }[];
      };
    }[];
  };
}

const mapAttributes = (
  attributes: { key: string; value: string | null }[] | null | undefined,
) => (attributes || []).map((attr) => ({ key: attr.key, value: attr.value ?? "" }));

const mapAddress = (address: AddressNode | null) =>
  address
    ? {
        name: address.name ?? null,
        address1: address.address1 ?? null,
        address2: address.address2 ?? null,
        city: address.city ?? null,
        province: address.province ?? null,
        country: address.country ?? null,
        zip: address.zip ?? null,
        phone: address.phone ?? null,
      }
    : null;

export interface GetOrdersOptions {
  first?: number;
  last?: number;
  after?: string;
  before?: string;
  reverse?: boolean;
  query?: string;
}

export const getOrders = async (
  admin: AdminApiContext,
  options: GetOrdersOptions = {},
): Promise<{ orders: Order[]; pageInfo: PageInfo }> => {
  const response = await admin.graphql(ORDERS_QUERY, {
    variables: {
      first: options.first,
      last: options.last,
      after: options.after,
      before: options.before,
      reverse: options.reverse ?? true,
      query: options.query,
    },
  });

  const { data } = (await response.json()) as { data?: OrdersResponse };

  const orders: Order[] =
    data?.orders.edges.map((edge) => ({
      id: edge.node.id,
      name: edge.node.name,
      createdAt: edge.node.createdAt,
      financialStatus: edge.node.displayFinancialStatus ?? null,
      fulfillmentStatus: edge.node.displayFulfillmentStatus ?? null,
      totalPrice: edge.node.currentTotalPriceSet.shopMoney.amount || "0.00",
      currencyCode:
        edge.node.currentTotalPriceSet.shopMoney.currencyCode || "USD",
      customer: edge.node.customer ?? null,
    })) || [];

  const pageInfo: PageInfo = {
    hasNextPage: data?.orders.pageInfo.hasNextPage || false,
    hasPreviousPage: data?.orders.pageInfo.hasPreviousPage || false,
    startCursor: data?.orders.pageInfo.startCursor || null,
    endCursor: data?.orders.pageInfo.endCursor || null,
  };

  return { orders, pageInfo };
};

export const getOrder = async (
  admin: AdminApiContext,
  id: string,
): Promise<OrderDetail | null> => {
  const response = await admin.graphql(ORDER_QUERY, { variables: { id } });
  const { data } = (await response.json()) as {
    data?: { order?: OrderNode | null };
  };

  const order = data?.order;
  if (!order) return null;

  const lineItems: OrderLineItem[] = order.lineItems.edges.map((edge) => ({
    id: edge.node.id,
    title: edge.node.title,
    quantity: edge.node.quantity,
    sku: edge.node.sku ?? null,
    variantTitle: edge.node.variantTitle ?? null,
    image: edge.node.image?.url ?? null,
    originalUnitPrice: parseFloat(
      edge.node.originalUnitPriceSet.shopMoney.amount || "0",
    ).toFixed(2),
    customAttributes: mapAttributes(edge.node.customAttributes),
  }));

  return {
    id: order.id,
    name: order.name,
    createdAt: order.createdAt,
    note: order.note ?? null,
    financialStatus: order.displayFinancialStatus ?? null,
    fulfillmentStatus: order.displayFulfillmentStatus ?? null,
    subtotalPrice: order.currentSubtotalPriceSet.shopMoney.amount || "0.00",
    totalShippingPrice: order.totalShippingPriceSet.shopMoney.amount || "0.00",
    totalTax: order.currentTotalTaxSet.shopMoney.amount || "0.00",
    totalPrice: order.currentTotalPriceSet.shopMoney.amount || "0.00",
    currencyCode: order.currentTotalPriceSet.shopMoney.currencyCode || "USD",
    customer: order.customer
      ? {
          displayName: order.customer.displayName,
          email: order.customer.defaultEmailAddress?.emailAddress ?? null,
        }
      : null,
    shippingAddress: mapAddress(order.shippingAddress),
    billingAddress: mapAddress(order.billingAddress),
    lineItems,
    customAttributes: mapAttributes(order.customAttributes),
  };
};

/**
 * Updates the order-level fields Shopify allows on an existing order: the note
 * and the custom attributes. `customAttributes` replaces the whole set, which
 * matches how the editor sends it (full list, not a delta).
 */
export const updateOrderAttributes = async (
  admin: AdminApiContext,
  id: string,
  customAttributes?: { key: string; value: string }[],
  note?: string,
): Promise<{ success: boolean; error?: string }> => {
  const input: Record<string, unknown> = { id };

  if (customAttributes) {
    input.customAttributes = customAttributes.filter(
      (attr) => attr.key.trim() !== "",
    );
  }

  if (note !== undefined) {
    input.note = note;
  }

  const response = await admin.graphql(UPDATE_ORDER_MUTATION, {
    variables: { input },
  });

  const { data } = await response.json();
  const userErrors = data?.orderUpdate?.userErrors;

  if (userErrors && userErrors.length > 0) {
    return { success: false, error: userErrors[0].message };
  }

  return { success: true };
};
