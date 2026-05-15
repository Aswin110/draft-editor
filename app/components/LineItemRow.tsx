import type { LineItem, CustomAttribute } from "../types/draft-order";
import { LineItemProperties } from "./LineItemProperties";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface LineItemRowProps {
  item: LineItem;
  currencyCode: string;
  readOnly?: boolean;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
  onPriceChange: (price: string) => void;
  onPropertiesChange: (properties: CustomAttribute[]) => void;
}

export const LineItemRow = ({
  item,
  currencyCode,
  readOnly = false,
  onRemove,
  onQuantityChange,
  onPriceChange,
  onPropertiesChange,
}: LineItemRowProps) => {
  const totalAmount = (
    parseFloat(item.originalUnitPrice || "0") * item.quantity
  ).toFixed(2);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: readOnly });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    border: "1px solid #e1e3e5",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "12px",
    zIndex: isDragging ? 1 : 0,
    position: "relative",
  };

  const handlePriceChange = (e: Event) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    onPriceChange(value);
  };

  const handlePriceBlur = () => {
    const formatted = parseFloat(item.originalUnitPrice || "0").toFixed(2);
    onPriceChange(formatted);
  };

  const handleQuantityChange = (e: Event) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    const qty = parseInt(value, 10);
    if (!isNaN(qty) && qty >= 1) {
      onQuantityChange(qty);
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <s-stack direction="block" gap="small">
        <s-stack direction="inline" gap="base" alignItems="start">
          {!readOnly && (
            <div
              {...attributes}
              {...listeners}
              style={{ cursor: "grab", touchAction: "none" }}
              aria-label="Drag to reorder"
            >
              <s-icon type="drag-handle" tone="neutral"></s-icon>
            </div>
          )}
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
              {readOnly ? (
                <>
                  <s-text>{item.originalUnitPrice}</s-text>
                  <s-text color="subdued">×</s-text>
                  <s-text>{item.quantity}</s-text>
                  <s-text color="subdued">=</s-text>
                  <s-text type="strong">
                    {currencyCode} {totalAmount}
                  </s-text>
                </>
              ) : (
                <>
                  <s-box inlineSize="180px">
                    <s-number-field
                      label="Price"
                      labelAccessibilityVisibility="exclusive"
                      value={item.originalUnitPrice}
                      onInput={handlePriceChange}
                      onBlur={handlePriceBlur}
                      min={0}
                      step={0.01}
                      autocomplete="off"
                    ></s-number-field>
                  </s-box>
                  <s-text color="subdued">×</s-text>
                  <s-box inlineSize="80px">
                    <s-number-field
                      label="Quantity"
                      labelAccessibilityVisibility="exclusive"
                      value={item.quantity.toString()}
                      onInput={handleQuantityChange}
                      min={1}
                      autocomplete="off"
                    ></s-number-field>
                  </s-box>
                  <s-text color="subdued">=</s-text>
                  <s-text type="strong">
                    {currencyCode} {totalAmount}
                  </s-text>
                  <s-button
                    icon="x"
                    variant="tertiary"
                    tone="critical"
                    onClick={onRemove}
                    accessibilityLabel={`Remove ${item.title}`}
                  ></s-button>
                </>
              )}
            </s-stack>
          </s-box>
        </s-stack>
        <s-box paddingInlineStart="large-500">
          <LineItemProperties
            properties={item.customAttributes}
            onChange={onPropertiesChange}
            readOnly={readOnly}
          />
        </s-box>
      </s-stack>
    </div>
  );
};
