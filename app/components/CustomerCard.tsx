import type { Customer, PurchasingCompanyRef } from "../types/draft-order";

interface CustomerCardProps {
  customer: Customer | null;
  /** The B2B company location the draft is for, when it has one. */
  purchasingCompany?: PurchasingCompanyRef | null;
}

export const CustomerCard = ({
  customer,
  purchasingCompany = null,
}: CustomerCardProps) => {
  return (
    <s-section>
      <s-heading>Customer</s-heading>
      {customer ? (
        <s-stack direction="block" gap="small">
          <s-text type="strong">{customer.displayName}</s-text>
          {customer.email && <s-text color="subdued">{customer.email}</s-text>}
          {purchasingCompany && (
            <s-stack direction="block" gap="small-300">
              <s-text>
                {purchasingCompany.locationName &&
                purchasingCompany.locationName !== purchasingCompany.companyName
                  ? `${purchasingCompany.companyName} · ${purchasingCompany.locationName}`
                  : purchasingCompany.companyName}
              </s-text>
              <s-text color="subdued">
                B2B order. Prices follow this company location&apos;s catalog
                unless a line has a custom price.
              </s-text>
            </s-stack>
          )}
        </s-stack>
      ) : (
        <s-text color="subdued">No customer</s-text>
      )}
    </s-section>
  );
};
