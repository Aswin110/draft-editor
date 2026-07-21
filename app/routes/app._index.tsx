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
  parseDraftOrderNumberSearch,
  draftOrderNumberDigits,
} from "../utils/formatters";
import type { DraftOrder, PageInfo } from "../types/draft-order";
import SetupGuide from "../components/SetupGuide";

const ITEMS_PER_PAGE = 25;

// Shopify search can't substring-match a draft order number, so number searches
// fetch this many recent drafts and filter locally. Matches older than this
// window won't surface (Shopify's max page size is 250).
const NUMBER_SEARCH_FETCH_LIMIT = 250;

const EMPTY_PAGE_INFO: PageInfo = {
  hasNextPage: false,
  hasPreviousPage: false,
  startCursor: null,
  endCursor: null,
};

interface LoaderData {
  draftOrders: DraftOrder[];
  pageInfo: PageInfo;
  searchQuery: string;
  shopDomain: string;
  apiKey: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const rawSearch = url.searchParams.get("search") || "";
  const searchQuery = rawSearch ? decodeURIComponent(rawSearch) : "";
  const cursor = url.searchParams.get("cursor") || null;
  const direction = url.searchParams.get("direction") || "next";

  const apiKey = process.env.SHOPIFY_API_KEY || "";

  // Number searches ("2", "D2", "#D12") need substring matching on the draft
  // order number, which Shopify's prefix-only search can't do. Fetch a recent
  // window and filter locally so "2" surfaces both "#D2" and "#D12". Pagination
  // is disabled in this mode — all matches within the window are shown.
  const numberSearch = parseDraftOrderNumberSearch(searchQuery);
  if (numberSearch) {
    const { draftOrders } = await getDraftOrders(admin, {
      first: NUMBER_SEARCH_FETCH_LIMIT,
    });
    const matches = draftOrders.filter((order) =>
      draftOrderNumberDigits(order.name).includes(numberSearch),
    );

    return {
      draftOrders: matches,
      pageInfo: EMPTY_PAGE_INFO,
      searchQuery,
      shopDomain: session.shop,
      apiKey,
    };
  }

  // Default listing and text searches (customer name, email) use Shopify's
  // server-side query with cursor pagination.
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

  const { draftOrders, pageInfo } = await getDraftOrders(admin, options);

  return {
    draftOrders,
    pageInfo,
    searchQuery,
    shopDomain: session.shop,
    apiKey,
  };
};

const DraftOrdersIndex = () => {
  const { draftOrders, pageInfo, searchQuery, shopDomain, apiKey } =
    useLoaderData<LoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [queryValue, setQueryValue] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // todo: do a better fix
  //  The s-table pagination handlers are non-standard props on a web component,
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

  // Genuine empty state (no draft orders and no active search): show the
  // setup guide and an empty message instead of the table.
  if (draftOrders.length === 0 && !searchQuery) {
    return (
      <s-page heading="Draft Orders">
        <SetupGuide shopDomain={shopDomain} apiKey={apiKey} />
        <s-section padding="none">
          <s-box padding="large-300">
            <s-stack alignItems="center" gap="base">
              <s-heading>No draft orders yet</s-heading>
              <s-paragraph>
                Draft orders will appear here once created
              </s-paragraph>
            </s-stack>
          </s-box>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Draft Orders">
      <SetupGuide shopDomain={shopDomain} apiKey={apiKey} />
      <s-section padding="none" accessibilityLabel="Draft orders table section">
        <s-table
          paginate
          hasNextPage={pageInfo.hasNextPage}
          hasPreviousPage={pageInfo.hasPreviousPage}
          onNextPage={mounted ? handleNextPage : undefined}
          onPreviousPage={mounted ? handlePreviousPage : undefined}
        >
          <s-search-field
            slot="filters"
            label="Search draft orders"
            labelAccessibilityVisibility="exclusive"
            placeholder="Search draft orders..."
            value={queryValue}
            onInput={handleQueryChange}
            onChange={handleQueryChange}
          ></s-search-field>
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
        {draftOrders.length === 0 && (
          <s-box padding="large-300">
            <s-stack alignItems="center" gap="base">
              <s-heading>No draft orders found matching your search</s-heading>
              <s-paragraph>Try changing your search terms</s-paragraph>
            </s-stack>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
};
export default DraftOrdersIndex;
