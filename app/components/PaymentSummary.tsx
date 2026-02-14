import { formatCurrency } from "../utils/formatters";

export interface PaymentSummaryProps {
  subtotalPrice: string;
  totalShippingPrice: string;
  totalTax: string;
  totalPrice: string;
  currencyCode: string;
}

export const PaymentSummary = ({
  subtotalPrice,
  totalShippingPrice,
  totalTax,
  totalPrice,
  currencyCode,
}: PaymentSummaryProps) => {
  return (
    <s-section>
      <s-heading>Payment</s-heading>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" justifyContent="space-between">
          <s-text>Subtotal</s-text>
          <s-text>{formatCurrency(subtotalPrice, currencyCode)}</s-text>
        </s-stack>
        <s-stack direction="inline" justifyContent="space-between">
          <s-text>Shipping</s-text>
          <s-text>{formatCurrency(totalShippingPrice, currencyCode)}</s-text>
        </s-stack>
        <s-stack direction="inline" justifyContent="space-between">
          <s-text>Tax</s-text>
          <s-text>{formatCurrency(totalTax, currencyCode)}</s-text>
        </s-stack>
        <s-divider></s-divider>
        <s-stack direction="inline" justifyContent="space-between">
          <s-text type="strong">Total</s-text>
          <s-text type="strong">
            {formatCurrency(totalPrice, currencyCode)}
          </s-text>
        </s-stack>
      </s-stack>
    </s-section>
  );
};
