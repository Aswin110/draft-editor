import type { OrderLineItem } from "../types/order";
import { LineItemProperties } from "./LineItemProperties";

export interface OrderLineItemRowProps {
  item: OrderLineItem;
  currencyCode: string;
}

const noop = () => {};

/**
 * Read-only counterpart to LineItemRow for real orders. Deliberately not
 * sortable or editable: order line items (and their properties) can't be
 * changed once the order exists — see the note on OrderLineItem.
 */
export const OrderLineItemRow = ({
  item,
  currencyCode,
}: OrderLineItemRowProps) => {
  const totalAmount = (
    parseFloat(item.originalUnitPrice || "0") * item.quantity
  ).toFixed(2);

  return (
    <div
      style={{
        border: "1px solid #e1e3e5",
        borderRadius: "8px",
        background: "#ffffff",
        padding: "12px",
      }}
    >
      <s-stack direction="block" gap="small">
        <s-stack direction="inline" gap="base" alignItems="start">
          <s-box>
            {item.image ? (
              <s-box
                maxInlineSize="40px"
                maxBlockSize="40px"
                border="base"
                borderRadius="base"
                overflow="hidden"
              >
                <s-image src={item.image} alt={item.title} aspectRatio="1/1" />
              </s-box>
            ) : (
              <s-box
                inlineSize="40px"
                blockSize="40px"
                border="base"
                borderRadius="base"
                overflow="hidden"
              >
                <s-stack
                  alignItems="center"
                  justifyContent="center"
                  blockSize="40px"
                >
                  <s-icon type="image" tone="neutral"></s-icon>
                </s-stack>
              </s-box>
            )}
          </s-box>
          <s-box minInlineSize="120px">
            <s-stack direction="block">
              <s-text type="strong">{item.title}</s-text>
              {item.variantTitle && (
                <s-text color="subdued">{item.variantTitle}</s-text>
              )}
              {item.sku && <s-text color="subdued">SKU: {item.sku}</s-text>}
            </s-stack>
          </s-box>
          <s-box minInlineSize="0" inlineSize="100%">
            <s-stack
              direction="inline"
              justifyContent="end"
              alignItems="center"
              gap="base"
            >
              <s-text>{item.originalUnitPrice}</s-text>
              <s-text color="subdued">×</s-text>
              <s-text>{item.quantity}</s-text>
              <s-text color="subdued">=</s-text>
              <s-text type="strong">
                {currencyCode} {totalAmount}
              </s-text>
            </s-stack>
          </s-box>
        </s-stack>
        <s-box paddingInlineStart="large-500">
          <LineItemProperties
            properties={item.customAttributes}
            onChange={noop}
            readOnly
            modalId={`order-line-properties-${item.id}`}
          />
        </s-box>
      </s-stack>
    </div>
  );
};
