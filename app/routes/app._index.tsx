import { useState, useCallback, useEffect, useRef } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { getDraftOrders } from "../models/draft-order.server";
import {
  formatDate,
  formatCurrency,
  getStatusBadge,
  extractNumericId,
} from "../utils/formatters";
import type { DraftOrder, PageInfo } from "../types/draft-order";

const ITEMS_PER_PAGE = 10;

interface LoaderData {
  draftOrders: DraftOrder[];
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

  const formattedQuery = searchQuery || undefined;

  const options =
    direction === "next"
      ? {
          first: ITEMS_PER_PAGE,
          after: cursor || undefined,
          query: formattedQuery,
        }
      : {
          last: ITEMS_PER_PAGE,
          before: cursor || undefined,
          query: formattedQuery,
        };

  const { draftOrders, pageInfo } = await getDraftOrders(admin, options);

  return { draftOrders, pageInfo, searchQuery };
};

const DraftOrdersIndex = () => {
  const { draftOrders, pageInfo, searchQuery } = useLoaderData<LoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [queryValue, setQueryValue] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Cleanup timeout on unmount
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

  const handleRowClick = (draftOrderId: string) => {
    navigate(`/app/${extractNumericId(draftOrderId)}`);
  };

  if (draftOrders.length === 0) {
    return (
      <s-page heading="Draft Orders">
        <s-section padding="none">
          <s-box padding="large-300">
            <s-stack alignItems="center" gap="base">
              <s-heading>
                {searchQuery
                  ? "No draft orders found matching your search"
                  : "No draft orders yet"}
              </s-heading>
              <s-paragraph>
                {searchQuery
                  ? "Try changing your search terms"
                  : "Draft orders will appear here once created"}
              </s-paragraph>
            </s-stack>
          </s-box>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Draft Orders">
      <s-section padding="none" accessibilityLabel="Draft orders table section">
        <s-table
          paginate
          hasNextPage={pageInfo.hasNextPage}
          hasPreviousPage={pageInfo.hasPreviousPage}
          onNextPage={handleNextPage}
          onPreviousPage={handlePreviousPage}
        >
          <s-text-field
            slot="filters"
            label="Search draft orders"
            labelAccessibilityVisibility="exclusive"
            icon="search"
            placeholder="Search draft orders..."
            value={queryValue}
            onInput={handleQueryChange}
          ></s-text-field>
          <s-table-header-row>
            <s-table-header listSlot="primary">Draft Order</s-table-header>
            <s-table-header listSlot="secondary">Customer</s-table-header>
            <s-table-header>Status</s-table-header>
            <s-table-header format="currency">Total</s-table-header>
            <s-table-header>Created</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {draftOrders.map((draftOrder) => {
              const statusBadge = getStatusBadge(draftOrder.status);
              const clickableId = `row-${extractNumericId(draftOrder.id)}`;
              return (
                <s-table-row key={draftOrder.id} clickDelegate={clickableId}>
                  <s-table-cell>
                    <s-link
                      id={clickableId}
                      href={`/app/${extractNumericId(draftOrder.id)}`}
                      onClick={() => handleRowClick(draftOrder.id)}
                    >
                      <s-text type="strong">{draftOrder.name}</s-text>
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text>
                      {draftOrder.customer?.displayName || "No customer"}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={statusBadge.tone}>
                      {statusBadge.label}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text>
                      {formatCurrency(
                        draftOrder.totalPrice,
                        draftOrder.currencyCode,
                      )}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text>{formatDate(draftOrder.createdAt)}</s-text>
                  </s-table-cell>
                </s-table-row>
              );
            })}
          </s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
};
export default DraftOrdersIndex;
