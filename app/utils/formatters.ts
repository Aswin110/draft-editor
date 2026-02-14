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

export const formatCurrency = (amount: string, currencyCode: string): string => {
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

export const extractNumericId = (gid: string): string => {
  return gid.split("/").pop() || "";
};

export const buildShopifyGid = (type: string, id: string): string => {
  return `gid://shopify/${type}/${id}`;
};
