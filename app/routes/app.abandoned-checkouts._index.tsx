import { useState, useCallback, useEffect, useRef } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  convertAbandonedCheckoutToDraftOrder,
  getAbandonedCheckouts,
} from "../models/abandoned-checkout.server";
import {
  formatDate,
  formatCurrency,
  extractNumericId,
} from "../utils/formatters";
import type { PageInfo } from "../types/draft-order";
import type {
  AbandonedCheckout,
  ConvertCheckoutResult,
} from "../types/abandoned-checkout";
import { useReviewPrompt } from "../hooks/useReviewPrompt";

const ITEMS_PER_PAGE = 25;

interface LoaderData {
  checkouts: AbandonedCheckout[];
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

  // Shopify's abandoned checkout search matches customer name and email as
  // free text, so the query is passed through as typed.
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

  const { checkouts, pageInfo } = await getAbandonedCheckouts(admin, options);

  return { checkouts, pageInfo, searchQuery };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const checkoutId = formData.get("checkoutId");
  const force = formData.get("force") === "1";

  if (typeof checkoutId !== "string" || checkoutId === "") {
    const result: ConvertCheckoutResult = {
      success: false,
      error: "Missing abandoned checkout id",
      warnings: [],
    };
    return result;
  }

  return convertAbandonedCheckoutToDraftOrder(admin, checkoutId, { force });
};

const AbandonedCheckoutsIndex = () => {
  const { checkouts, pageInfo, searchQuery } = useLoaderData<LoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const requestReview = useReviewPrompt();
  const fetcher = useFetcher<ConvertCheckoutResult>();
  const [queryValue, setQueryValue] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Same hydration workaround as the other list pages: s-table's pagination
  // handlers are attached after mount so SSR and the first client render match.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Once a draft is created, jump straight to it — the merchant's next step is
  // almost always to finish it, and it saves hunting for it in the list.
  const handledResult = useRef<ConvertCheckoutResult | null>(null);
  useEffect(() => {
    const result = fetcher.data;
    if (
      fetcher.state !== "idle" ||
      !result ||
      handledResult.current === result
    ) {
      return;
    }
    handledResult.current = result;

    if (result.success && result.draftOrder) {
      shopify.toast.show(`Draft order ${result.draftOrder.name} created`);
      void requestReview();
      navigate(`/app/${extractNumericId(result.draftOrder.id)}`);
    }
  }, [fetcher.state, fetcher.data, shopify, requestReview, navigate]);

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

  // Remember which checkout the last submission was for, so the "already
  // exists" banner can offer to create another draft for the same checkout.
  const lastCheckoutId = useRef<string | null>(null);

  const createDraft = useCallback(
    (checkoutId: string, force = false) => {
      lastCheckoutId.current = checkoutId;
      const formData = new FormData();
      formData.append("checkoutId", checkoutId);
      if (force) formData.append("force", "1");
      fetcher.submit(formData, { method: "POST" });
    },
    [fetcher],
  );

  const openCheckoutInShopify = useCallback((checkoutId: string) => {
    window.open(
      `shopify://admin/checkouts/${extractNumericId(checkoutId)}`,
      "_blank",
    );
  }, []);

  const isSubmitting = fetcher.state !== "idle";
  const submittingId = isSubmitting
    ? (fetcher.formData?.get("checkoutId") as string | null)
    : null;
  const lastResult = fetcher.state === "idle" ? fetcher.data : undefined;
  const existingDraft =
    lastResult && !lastResult.success
      ? lastResult.existingDraftOrder
      : undefined;

  const tip = (
    <s-banner tone="info">
      You can also do this from Shopify: open any abandoned checkout and choose
      Create draft order under More actions.
    </s-banner>
  );

  if (checkouts.length === 0 && !searchQuery) {
    return (
      <s-page heading="Abandoned checkouts">
        <s-section>{tip}</s-section>
        <s-section padding="none">
          <s-box padding="large-300">
            <s-stack alignItems="center" gap="base">
              <s-heading>No abandoned checkouts</s-heading>
              <s-paragraph>
                Checkouts that customers start but don&apos;t finish will
                appear here, ready to turn into draft orders.
              </s-paragraph>
            </s-stack>
          </s-box>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Abandoned checkouts">
      <s-section>
        <s-stack direction="block" gap="base">
          {tip}
          {existingDraft && (
            <s-banner tone="warning" heading="Draft order already exists">
              <s-stack direction="block" gap="small-300">
                <s-paragraph>{lastResult?.error}</s-paragraph>
                <s-stack direction="inline" gap="small-300">
                  <s-button
                    variant="primary"
                    onClick={() =>
                      navigate(`/app/${extractNumericId(existingDraft.id)}`)
                    }
                  >
                    Open {existingDraft.name}
                  </s-button>
                  <s-button
                    variant="secondary"
                    disabled={isSubmitting || !lastCheckoutId.current}
                    onClick={() => {
                      if (lastCheckoutId.current) {
                        createDraft(lastCheckoutId.current, true);
                      }
                    }}
                  >
                    Create another draft order
                  </s-button>
                </s-stack>
              </s-stack>
            </s-banner>
          )}
          {lastResult && !lastResult.success && !existingDraft && (
            <s-banner tone="critical">{lastResult.error}</s-banner>
          )}
        </s-stack>
      </s-section>

      <s-section
        padding="none"
        accessibilityLabel="Abandoned checkouts table section"
      >
        <s-table
          paginate
          hasNextPage={pageInfo.hasNextPage}
          hasPreviousPage={pageInfo.hasPreviousPage}
          onNextPage={mounted ? handleNextPage : undefined}
          onPreviousPage={mounted ? handlePreviousPage : undefined}
        >
          <s-search-field
            slot="filters"
            label="Search abandoned checkouts"
            labelAccessibilityVisibility="exclusive"
            placeholder="Search by customer name or email..."
            value={queryValue}
            onInput={handleQueryChange}
            onChange={handleQueryChange}
          ></s-search-field>
          <s-table-header-row>
            <s-table-header listSlot="primary">Checkout</s-table-header>
            <s-table-header listSlot="secondary">Customer</s-table-header>
            <s-table-header>Status</s-table-header>
            <s-table-header format="currency">Total</s-table-header>
            <s-table-header>Created</s-table-header>
            <s-table-header></s-table-header>
          </s-table-header-row>
          <s-table-body>
            {checkouts.map((checkout) => {
              const rowSubmitting = submittingId === checkout.id;
              return (
                <s-table-row key={checkout.id}>
                  <s-table-cell>
                    <s-link
                      href={`shopify://admin/checkouts/${extractNumericId(checkout.id)}`}
                      onClick={(event: Event) => {
                        event.preventDefault();
                        openCheckoutInShopify(checkout.id);
                      }}
                    >
                      <s-text type="strong">{checkout.name}</s-text>
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text>
                      {checkout.customer?.displayName || "No customer"}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    {checkout.completedAt ? (
                      <s-badge tone="success">Recovered</s-badge>
                    ) : (
                      <s-badge tone="caution">Not recovered</s-badge>
                    )}
                  </s-table-cell>
                  <s-table-cell>
                    <s-text>
                      {formatCurrency(
                        checkout.totalPrice,
                        checkout.currencyCode,
                      )}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text>{formatDate(checkout.createdAt)}</s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-button
                      variant="secondary"
                      disabled={isSubmitting && !rowSubmitting}
                      loading={rowSubmitting}
                      accessibilityLabel={`Create draft order from checkout ${checkout.name}`}
                      onClick={() => createDraft(checkout.id)}
                    >
                      Create draft order
                    </s-button>
                  </s-table-cell>
                </s-table-row>
              );
            })}
          </s-table-body>
        </s-table>
        {checkouts.length === 0 && (
          <s-box padding="large-300">
            <s-stack alignItems="center" gap="base">
              <s-heading>No abandoned checkouts match your search</s-heading>
              <s-paragraph>Try changing your search terms</s-paragraph>
            </s-stack>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
};
export default AbandonedCheckoutsIndex;
