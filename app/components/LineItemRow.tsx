import {
  InlineStack,
  BlockStack,
  Text,
  Thumbnail,
  Icon,
  Box,
  Button,
  TextField,
} from "@shopify/polaris";
import { ImageIcon, DragHandleIcon, DeleteIcon } from "@shopify/polaris-icons";
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
      <InlineStack gap="200" blockAlign="start">
        <Box>
          <Icon source={DragHandleIcon} tone="subdued" />
        </Box>
        <Box>
          <Thumbnail
            source={item.image || ImageIcon}
            alt={item.title}
            size="medium"
          />
        </Box>
        <Box minWidth="120px">
          <BlockStack gap="100">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {item.title}
            </Text>
            {item.variantTitle && (
              <Text as="span" variant="bodySm" tone="subdued">
                {item.variantTitle}
              </Text>
            )}
            {item.sku && (
              <Text as="span" variant="bodySm" tone="subdued">
                SKU: {item.sku}
              </Text>
            )}
          </BlockStack>
        </Box>
        <Box minWidth="0" width="100%">
          <InlineStack align="end" blockAlign="center" gap="300">
            <Box width="180px">
              <TextField
                label="Price"
                labelHidden
                type="number"
                value={item.originalUnitPrice}
                onChange={(value) => onPriceChange(value)}
                onBlur={() => {
                  const formatted = parseFloat(
                    item.originalUnitPrice || "0",
                  ).toFixed(2);
                  onPriceChange(formatted);
                }}
                min={0}
                step={0.01}
                autoComplete="off"
                disabled={disabled}
              />
            </Box>
            <Text as="span" tone="subdued">
              ×
            </Text>
            <Box width="80px">
              <TextField
                label="Quantity"
                labelHidden
                type="number"
                value={item.quantity.toString()}
                onChange={(value) => {
                  const qty = parseInt(value, 10);
                  if (!isNaN(qty) && qty >= 1) {
                    onQuantityChange(qty);
                  }
                }}
                min={1}
                autoComplete="off"
                disabled={disabled}
              />
            </Box>
            <Text as="span" tone="subdued">
              =
            </Text>
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {currencyCode} {totalAmount}
            </Text>
            {!disabled && (
              <Button
                icon={DeleteIcon}
                variant="plain"
                tone="critical"
                onClick={onRemove}
                accessibilityLabel={`Remove ${item.title}`}
              />
            )}
          </InlineStack>
        </Box>
      </InlineStack>
    </div>
  );
};
