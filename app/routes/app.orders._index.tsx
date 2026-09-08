import { useState, useCallback, useEffect, useRef } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrders } from "../models/order.server";
import {
  formatDate,
  formatCurrency,
  getFinancialStatusBadge,
  getFulfillmentStatusBadge,
  extractNumericId,
  parseOrderNumberSearch,
  orderNumberDigits,
} from "../utils/formatters";
import type { PageInfo } from "../types/draft-order";
import type { Order } from "../types/order";

const ITEMS_PER_PAGE = 25;

// Same constraint as the draft order list: Shopify search can't substring-match
// an order number, so number searches fetch this many recent orders and filter
// locally. Matches older than this window won't surface.
const NUMBER_SEARCH_FETCH_LIMIT = 250;

const EMPTY_PAGE_INFO: PageInfo = {
  hasNextPage: false,
  hasPreviousPage: false,
  startCursor: null,
  endCursor: null,
};

interface LoaderData {
  orders: Order[];
  pageInfo: PageInfo;
  searchQuery: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const rawSearch = url.searchParams.get("search") || "";
  const searchQuery = rawSearch ? decodeURIComponent(rawSearch) : "";
  const cursor = url.searchParams.get("cursor") || null;
  const direction = url.searchParams.get("direction") || "next";

  const numberSearch = parseOrderNumberSearch(searchQuery);
  if (numberSearch) {
    const { orders } = await getOrders(admin, {
      first: NUMBER_SEARCH_FETCH_LIMIT,
    });
    const matches = orders.filter((order) =>
      orderNumberDigits(order.name).includes(numberSearch),
    );

    return { orders: matches, pageInfo: EMPTY_PAGE_INFO, searchQuery };
  }

  const options =
    direction === "next"
      ? {
          first: ITEMS_PER_PAGE,
          after: cursor || undefined,
          query: searchQuery || undefined,
        }
      : {
          last: ITEMS_PER_PAGE,
          before: cursor || undefined,
          query: searchQuery || undefined,
        };

  const { orders, pageInfo } = await getOrders(admin, options);

  return { orders, pageInfo, searchQuery };
};

const OrdersIndex = () => {
  const { orders, pageInfo, searchQuery } = useLoaderData<LoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [queryValue, setQueryValue] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The s-table pagination handlers are non-standard props on a web component,
  // so React renders them as null during SSR but as functions on the client,
  // tripping a hydration mismatch. Attach them only after mount so the first
  // client render matches the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleQueryChange = useCallback(
    (e: Event) => {
      const value = (e.currentTarget as HTMLInputElement).value;
      setQueryValue(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams();
        const trimmed = value.trim();
        if (trimmed) {
          params.set("search", encodeURIComponent(trimmed));
        }
        setSearchParams(params);
      }, 300);
    },
    [setSearchParams],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleNextPage = useCallback(() => {
    if (pageInfo.endCursor) {
      const params = new URLSearchParams(searchParams);
      params.set("cursor", pageInfo.endCursor);
      params.set("direction", "next");
      if (queryValue) {
        params.set("search", queryValue);
      }
      setSearchParams(params);
    }
  }, [pageInfo.endCursor, searchParams, queryValue, setSearchParams]);

  const handlePreviousPage = useCallback(() => {
    if (pageInfo.startCursor) {
      const params = new URLSearchParams(searchParams);
      params.set("cursor", pageInfo.startCursor);
      params.set("direction", "prev");
      if (queryValue) {
        params.set("search", queryValue);
      }
      setSearchParams(params);
    }
  }, [pageInfo.startCursor, searchParams, queryValue, setSearchParams]);

  const handleRowClick = useCallback(
    (event: Event, orderId: string) => {
      event.preventDefault();
      navigate(`/app/orders/${extractNumericId(orderId)}`);
    },
    [navigate],
  );

  if (orders.length === 0 && !searchQuery) {
    return (
      <s-page heading="Orders">
        <s-section padding="none">
          <s-box padding="large-300">
            <s-stack alignItems="center" gap="base">
              <s-heading>No orders yet</s-heading>
              <s-paragraph>
                Orders will appear here once a draft order is paid or a customer
                checks out
              </s-paragraph>
            </s-stack>
          </s-box>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Orders">
      <s-section padding="none" accessibilityLabel="Orders table section">
        <s-table
          paginate
          hasNextPage={pageInfo.hasNextPage}
          hasPreviousPage={pageInfo.hasPreviousPage}
          onNextPage={mounted ? handleNextPage : undefined}
          onPreviousPage={mounted ? handlePreviousPage : undefined}
        >
          <s-search-field
            slot="filters"
            label="Search orders"
            labelAccessibilityVisibility="exclusive"
            placeholder="Search orders..."
            value={queryValue}
            onInput={handleQueryChange}
            onChange={handleQueryChange}
          ></s-search-field>
          <s-table-header-row>
            <s-table-header listSlot="primary">Order</s-table-header>
            <s-table-header listSlot="secondary">Customer</s-table-header>
            <s-table-header>Payment</s-table-header>
            <s-table-header>Fulfillment</s-table-header>
            <s-table-header format="currency">Total</s-table-header>
            <s-table-header>Created</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {orders.map((order) => {
              const financialBadge = getFinancialStatusBadge(
                order.financialStatus,
              );
              const fulfillmentBadge = getFulfillmentStatusBadge(
                order.fulfillmentStatus,
              );
              const numericId = extractNumericId(order.id);
              const clickableId = `order-row-${numericId}`;
              return (
                <s-table-row key={order.id} clickDelegate={clickableId}>
                  <s-table-cell>
                    <s-link
                      id={clickableId}
                      href={`/app/orders/${numericId}`}
                      onClick={(event: Event) => handleRowClick(event, order.id)}
                    >
                      <s-text type="strong">{order.name}</s-text>
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text>
                      {order.customer?.displayName || "No customer"}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={financialBadge.tone}>
                      {financialBadge.label}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={fulfillmentBadge.tone}>
                      {fulfillmentBadge.label}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text>
                      {formatCurrency(order.totalPrice, order.currencyCode)}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text>{formatDate(order.createdAt)}</s-text>
                  </s-table-cell>
                </s-table-row>
              );
            })}
          </s-table-body>
        </s-table>
        {orders.length === 0 && (
          <s-box padding="large-300">
            <s-stack alignItems="center" gap="base">
              <s-heading>No orders found matching your search</s-heading>
              <s-paragraph>Try changing your search terms</s-paragraph>
            </s-stack>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
};
export default OrdersIndex;
