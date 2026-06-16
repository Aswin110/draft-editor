import { useCallback, useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

interface SetupGuideProps {
  shopDomain: string;
  apiKey: string;
}

const THEME_EXTENSION_HANDLE = "theme-app-extension";
const ORDER_PAGE_HANDLE = "customer-draft-orders";

type ActivationStatus = "active" | "inactive" | "unknown";

function StatusBadge({ status }: { status: ActivationStatus }) {
  if (status === "active") return <s-badge tone="success">Active</s-badge>;
  if (status === "inactive") return <s-badge tone="warning">Not added</s-badge>;
  return null;
}

const SetupGuide = ({ shopDomain, apiKey }: SetupGuideProps) => {
  const shopify = useAppBridge();
  const [cartStatus, setCartStatus] = useState<ActivationStatus>("unknown");
  const [orderStatus, setOrderStatus] = useState<ActivationStatus>("unknown");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const extensions = await shopify.app.extensions();
        if (cancelled) return;

        const statusFor = (handle: string): ActivationStatus => {
          const info = extensions.find((e) => e.handle === handle);
          if (!info) return "unknown";
          return info.activations.length > 0 ? "active" : "inactive";
        };

        setCartStatus(statusFor(THEME_EXTENSION_HANDLE));
        setOrderStatus(statusFor(ORDER_PAGE_HANDLE));
      } catch (e) {
        console.error("Failed to read app extension status", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shopify]);

  const openThemeEditor = useCallback(() => {
    const url =
      `https://${shopDomain}/admin/themes/current/editor` +
      `?template=cart` +
      `&addAppBlockId=${apiKey}/cart-draft-button` +
      `&target=newAppsSection`;
    window.open(url, "_blank");
  }, [shopDomain, apiKey]);

  const openCustomerAccounts = useCallback(() => {
    window.open(
      `https://${shopDomain}/admin/settings/customer_accounts`,
      "_blank",
    );
  }, [shopDomain]);

  return (
    <s-section heading="Finish setting up">
      <s-paragraph color="subdued">
        Add these to your storefront so customers can create and manage draft
        orders.
      </s-paragraph>

      <s-stack direction="block" gap="base">
        <s-box padding="base" borderRadius="base" background="subdued">
          <s-stack direction="block" gap="small-300">
            <s-stack direction="inline" gap="small-300" alignItems="center">
              <s-text type="strong">
                1. Add the “Create draft order” button to your cart
              </s-text>
              <StatusBadge status={cartStatus} />
            </s-stack>
            <s-text color="subdued">
              Lets shoppers turn their cart into a draft order you can finish
              for them.
            </s-text>
            <s-stack direction="inline">
              <s-button
                variant="primary"
                icon="external"
                accessibilityLabel="Open the theme editor for the cart page"
                onClick={openThemeEditor}
              >
                {cartStatus === "active"
                  ? "Manage on cart page"
                  : "Add to cart page"}
              </s-button>
            </s-stack>
          </s-stack>
        </s-box>

        <s-box padding="base" borderRadius="base" background="subdued">
          <s-stack direction="block" gap="small-300">
            <s-stack direction="inline" gap="small-300" alignItems="center">
              <s-text type="strong">
                2. Show draft orders on the customer order page
              </s-text>
              <StatusBadge status={orderStatus} />
            </s-stack>
            <s-text color="subdued">
              Lets logged-in customers view and edit their draft orders. After
              opening the editor, choose Customize and add the “Customer Draft
              Orders” block to the Orders page.
            </s-text>
            <s-stack direction="inline">
              <s-button
                variant="secondary"
                icon="external"
                accessibilityLabel="Open the customer accounts editor"
                onClick={openCustomerAccounts}
              >
                Open account editor
              </s-button>
            </s-stack>
          </s-stack>
        </s-box>
      </s-stack>
    </s-section>
  );
};

export default SetupGuide;
