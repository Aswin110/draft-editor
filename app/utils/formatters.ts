import type { Address, StatusBadgeConfig } from "../types/draft-order";

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatCurrency = (
  amount: string,
  currencyCode: string,
): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(parseFloat(amount));
};

export const getStatusBadge = (status: string): StatusBadgeConfig => {
  const statusMap: Record<string, StatusBadgeConfig> = {
    OPEN: { tone: "info", label: "Open" },
    INVOICE_SENT: { tone: "caution", label: "Invoice Sent" },
    COMPLETED: { tone: "success", label: "Completed" },
  };
  return statusMap[status] || { tone: "info", label: status };
};

export const formatAddressLines = (address: Address | null): string[] => {
  if (!address) return ["No address provided"];

  const lines: string[] = [];
  if (address.name) lines.push(address.name);
  if (address.address1) lines.push(address.address1);
  if (address.address2) lines.push(address.address2);

  const cityLine = [address.city, address.province, address.zip]
    .filter(Boolean)
    .join(", ");
  if (cityLine) lines.push(cityLine);

  if (address.country) lines.push(address.country);
  if (address.phone) lines.push(address.phone);

  return lines.length > 0 ? lines : ["No address provided"];
};

export const parseDraftOrderNumberSearch = (
  rawSearch: string,
): string | null => {
  const match = rawSearch.trim().match(/^#?[dD]?(\d+)$/);
  return match ? match[1] : null;
};

export const draftOrderNumberDigits = (name: string): string =>
  name.replace(/\D/g, "");

export const extractNumericId = (gid: string): string => {
  return gid.split("/").pop() || "";
};

export const buildShopifyGid = (type: string, id: string): string => {
  return `gid://shopify/${type}/${id}`;
};

/**
 * Shopify's `displayFinancialStatus` on an order (PAID, PENDING, REFUNDED…).
 */
export const getFinancialStatusBadge = (
  status: string | null,
): StatusBadgeConfig => {
  if (!status) return { tone: "neutral", label: "Unknown" };

  const statusMap: Record<string, StatusBadgeConfig> = {
    PAID: { tone: "success", label: "Paid" },
    PARTIALLY_PAID: { tone: "caution", label: "Partially paid" },
    PENDING: { tone: "caution", label: "Pending" },
    AUTHORIZED: { tone: "info", label: "Authorized" },
    PARTIALLY_REFUNDED: { tone: "caution", label: "Partially refunded" },
    REFUNDED: { tone: "neutral", label: "Refunded" },
    VOIDED: { tone: "critical", label: "Voided" },
    EXPIRED: { tone: "critical", label: "Expired" },
  };
  return statusMap[status] || { tone: "info", label: humanizeStatus(status) };
};

/**
 * Shopify's `displayFulfillmentStatus` on an order (FULFILLED, UNFULFILLED…).
 */
export const getFulfillmentStatusBadge = (
  status: string | null,
): StatusBadgeConfig => {
  if (!status) return { tone: "neutral", label: "Unknown" };

  const statusMap: Record<string, StatusBadgeConfig> = {
    FULFILLED: { tone: "success", label: "Fulfilled" },
    UNFULFILLED: { tone: "caution", label: "Unfulfilled" },
    PARTIALLY_FULFILLED: { tone: "caution", label: "Partially fulfilled" },
    SCHEDULED: { tone: "info", label: "Scheduled" },
    ON_HOLD: { tone: "caution", label: "On hold" },
    IN_PROGRESS: { tone: "info", label: "In progress" },
    OPEN: { tone: "info", label: "Open" },
    PENDING_FULFILLMENT: { tone: "caution", label: "Pending" },
    RESTOCKED: { tone: "neutral", label: "Restocked" },
  };
  return statusMap[status] || { tone: "info", label: humanizeStatus(status) };
};

const humanizeStatus = (status: string): string => {
  const lower = status.replace(/_/g, " ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

/**
 * Order names are plain numbers ("#1001"), so unlike draft orders there's no
 * "D" prefix to strip.
 */
export const parseOrderNumberSearch = (rawSearch: string): string | null => {
  const match = rawSearch.trim().match(/^#?(\d+)$/);
  return match ? match[1] : null;
};

export const orderNumberDigits = (name: string): string =>
  name.replace(/\D/g, "");
