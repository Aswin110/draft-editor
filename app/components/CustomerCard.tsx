import type { Customer } from "../types/draft-order";

interface CustomerCardProps {
  customer: Customer | null;
}

export const CustomerCard = ({ customer }: CustomerCardProps) => {
  return (
    <s-section>
      <s-heading>Customer</s-heading>
      {customer ? (
        <s-stack direction="block" gap="small">
          <s-text type="strong">{customer.displayName}</s-text>
          {customer.email && (
            <s-text color="subdued">{customer.email}</s-text>
          )}
        </s-stack>
      ) : (
        <s-text color="subdued">No customer</s-text>
      )}
    </s-section>
  );
};
