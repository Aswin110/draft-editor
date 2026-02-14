import { FREE_TIER_EDIT_LIMIT } from "../constants/plans";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

const getMonthStartDate = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};

/**
 * Check if a draft order is among the first N created this calendar month.
 * Free users can only edit draft orders that fall within the limit.
 */
export const canEditDraftOrder = async (
  admin: AdminApiContext,
  draftOrderGid: string,
  hasActivePlan: boolean,
): Promise<{ allowed: boolean; monthlyCount: number; limit: number }> => {
  if (hasActivePlan) {
    return { allowed: true, monthlyCount: 0, limit: Infinity };
  }

  const monthStart = getMonthStartDate();

  const response = await admin.graphql(
    `#graphql
    query MonthlyDraftOrders($first: Int!, $query: String!) {
      draftOrders(first: $first, query: $query, sortKey: ID, reverse: false) {
        edges {
          node { id }
        }
      }
    }`,
    {
      variables: {
        first: FREE_TIER_EDIT_LIMIT,
        query: `created_at:>=${monthStart}`,
      },
    },
  );

  const { data } = await response.json();
  const allowedIds =
    data?.draftOrders?.edges.map((e: { node: { id: string } }) => e.node.id) ||
    [];

  return {
    allowed: allowedIds.includes(draftOrderGid),
    monthlyCount: allowedIds.length,
    limit: FREE_TIER_EDIT_LIMIT,
  };
};

/**
 * Get monthly draft order count for the plans page display.
 */
export const getMonthlyUsageStatus = async (admin: AdminApiContext) => {
  const monthStart = getMonthStartDate();

  const response = await admin.graphql(
    `#graphql
    query MonthlyDraftOrderCount($query: String!) {
      draftOrders(first: 100, query: $query) {
        edges {
          node { id }
        }
      }
    }`,
    {
      variables: {
        query: `created_at:>=${monthStart}`,
      },
    },
  );

  const { data } = await response.json();
  const totalThisMonth = data?.draftOrders?.edges?.length || 0;

  return {
    totalThisMonth,
    limit: FREE_TIER_EDIT_LIMIT,
    isAtLimit: totalThisMonth > FREE_TIER_EDIT_LIMIT,
  };
};
