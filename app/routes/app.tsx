import type {
  HeadersFunction,
  LoaderFunctionArgs,
  ShouldRevalidateFunction,
} from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { useRevalidateOnReturn } from "../hooks/useRevalidateOnReturn";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  let shopName = "";
  let ownerName = "";
  let ownerEmail = "";

  try {
    const response = await admin.graphql(
      `{ shop { name contactEmail shopOwnerName } }`,
    );
    const { data } = await response.json();
    shopName = data.shop.name;
    ownerName = data.shop.shopOwnerName;
    ownerEmail = data.shop.contactEmail;
  } catch (e) {
    console.error("GraphQL shop query error:", e);
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shopName,
    ownerName,
    ownerEmail,
    shopDomain: session.shop,
  };
};

// The shop's name and owner don't change while the app is open, so this
// loader only needs to run again on a real navigation. Without this, every
// save and every return-to-tab reload on a child page would also re-query
// the shop.
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) => {
  if (currentUrl.href === nextUrl.href) return false;
  return defaultShouldRevalidate;
};

const CRISP_WEBSITE_ID = "36f18c89-59c6-466f-8523-fc8023bd3a7c";

const App = () => {
  const { apiKey, shopName, ownerName, ownerEmail, shopDomain } =
    useLoaderData<typeof loader>();

  // Whichever page is open, show what Shopify has now when the merchant
  // comes back to it.
  useRevalidateOnReturn();

  useEffect(() => {
    if (window.$crisp) return;
    window.$crisp = [];
    window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;
    const script = document.createElement("script");
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    script.onload = () => {
      window.$crisp.push(["set", "user:nickname", [ownerName]]);
      window.$crisp.push(["set", "user:email", [ownerEmail]]);
      window.$crisp.push(["set", "user:company", [shopName]]);
      window.$crisp.push(["set", "session:segments", [["draft-edit"]]]);
      window.$crisp.push([
        "set",
        "session:data",
        [[["shop", shopDomain]]],
      ]);
    };
    document.head.appendChild(script);
  }, [shopName, shopDomain, ownerName, ownerEmail]);

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Draft Orders</s-link>
        <s-link href="/app/orders">Orders</s-link>
        <s-link href="/app/abandoned-checkouts">Abandoned Checkouts</s-link>
        <s-link href="/app/property-templates">Property Templates</s-link>
        <s-link href="/app/integration">Integration</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
};
export default App;

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export const ErrorBoundary = () => {
  return boundary.error(useRouteError());
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
