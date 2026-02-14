import type { LineItem } from "../types/draft-order";

export interface LineItemRowProps {
  item: LineItem;
  currencyCode: string;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
  onPriceChange: (price: string) => void;
  disabled?: boolean;
}

export const LineItemRow = ({
  item,
  currencyCode,
  isDragging,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onRemove,
  onQuantityChange,
  onPriceChange,
  disabled = false,
}: LineItemRowProps) => {
  const totalAmount = (
    parseFloat(item.originalUnitPrice || "0") * item.quantity
  ).toFixed(2);

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
    <div
      draggable={!disabled}
      onDragStart={disabled ? undefined : onDragStart}
      onDragOver={disabled ? undefined : onDragOver}
      onDragLeave={disabled ? undefined : onDragLeave}
      onDrop={disabled ? undefined : onDrop}
      onDragEnd={disabled ? undefined : onDragEnd}
      style={{
        cursor: disabled ? "default" : "grab",
        opacity: isDragging ? 0.5 : disabled ? 0.6 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <s-stack direction="inline" gap="base" alignItems="start">
        <s-box>
          <s-icon type="drag-handle" tone="neutral"></s-icon>
        </s-box>
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
              maxInlineSize="40px"
              maxBlockSize="40px"
              border="base"
              borderRadius="base"
              overflow="hidden"
              padding="small"
            >
              <s-icon type="image" tone="neutral"></s-icon>
            </s-box>
          )}
        </s-box>
        <s-box minInlineSize="120px">
          <s-stack direction="block" gap="small-300">
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
            <s-box inlineSize="180px">
              <s-number-field
                label="Price"
                labelAccessibilityVisibility="exclusive"
                value={item.originalUnitPrice}
                onInput={handlePriceChange}
                onBlur={handlePriceBlur}
                min={0}
                step={0.01}
                disabled={disabled || undefined}
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
                disabled={disabled || undefined}
              ></s-number-field>
            </s-box>
            <s-text color="subdued">=</s-text>
            <s-text type="strong">
              {currencyCode} {totalAmount}
            </s-text>
            {!disabled && (
              <s-button
                icon="x"
                variant="tertiary"
                tone="critical"
                onClick={onRemove}
                accessibilityLabel={`Remove ${item.title}`}
              ></s-button>
            )}
          </s-stack>
        </s-box>
      </s-stack>
    </div>
  );
};
