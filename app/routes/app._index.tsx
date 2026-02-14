import { useState, useCallback, useEffect, useRef } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, useNavigate } from "react-router";
import {
  Page,
  IndexTable,
  Text,
  Badge,
  EmptySearchResult,
  Card,
  TextField,
  Icon,
  Box,
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
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

  // Pass search query directly to Shopify API
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
    (value: string) => {
      setQueryValue(value);

      // Debounce the search
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

  const handleQueryClear = useCallback(() => {
    setQueryValue("");
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

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

  const rowMarkup = draftOrders.map((draftOrder, index) => {
    const statusBadge = getStatusBadge(draftOrder.status);
    return (
      <IndexTable.Row
        id={draftOrder.id}
        key={draftOrder.id}
        position={index}
        onClick={() => handleRowClick(draftOrder.id)}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {draftOrder.name}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">
            {draftOrder.customer?.displayName || "No customer"}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" numeric>
            {formatCurrency(draftOrder.totalPrice, draftOrder.currencyCode)}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">
            {formatDate(draftOrder.createdAt)}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const emptyStateMarkup = (
    <EmptySearchResult
      title={
        searchQuery
          ? "No draft orders found matching your search"
          : "No draft orders yet"
      }
      description={
        searchQuery
          ? "Try changing your search terms"
          : "Draft orders will appear here once created"
      }
      withIllustration
    />
  );

  return (
    <Page title="Draft Orders" fullWidth>
      <Card padding="0">
        <Box padding="400">
          <TextField
            label=""
            labelHidden
            value={queryValue}
            onChange={handleQueryChange}
            placeholder="Search draft orders..."
            clearButton
            onClearButtonClick={handleQueryClear}
            prefix={<Icon source={SearchIcon} />}
            autoComplete="off"
          />
        </Box>
        <IndexTable
          resourceName={{ singular: "draft order", plural: "draft orders" }}
          itemCount={draftOrders.length}
          selectable={false}
          headings={[
            { title: "Draft Order" },
            { title: "Customer" },
            { title: "Status" },
            { title: "Total" },
            { title: "Created" },
          ]}
          emptyState={emptyStateMarkup}
          pagination={{
            hasNext: pageInfo.hasNextPage,
            hasPrevious: pageInfo.hasPreviousPage,
            onNext: handleNextPage,
            onPrevious: handlePreviousPage,
          }}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  );
};
export default DraftOrdersIndex;
