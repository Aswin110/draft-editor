import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { MONTHLY_PLAN, ANNUAL_PLAN } from "../constants/plans";
import { isTestStore } from "../utils/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);

  let shopName = "";
  let ownerName = "";
  let ownerEmail = "";
  let currentPlan = "Free";

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

  try {
    const testStore = await isTestStore(session.shop);
    const { appSubscriptions } = await billing.check({
      plans: [MONTHLY_PLAN, ANNUAL_PLAN],
      isTest: testStore,
    });
    currentPlan =
      appSubscriptions.length > 0 ? appSubscriptions[0].name : "Free";
  } catch (e) {
    console.error("Billing check error:", e);
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shopName,
    ownerName,
    ownerEmail,
    shopDomain: session.shop,
    currentPlan,
  };
};

const CRISP_WEBSITE_ID = "36f18c89-59c6-466f-8523-fc8023bd3a7c";

const App = () => {
  const { apiKey, shopName, ownerName, ownerEmail, shopDomain, currentPlan } =
    useLoaderData<typeof loader>();

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
      window.$crisp.push([
        "set",
        "session:segments",
        [["draft-edit"]],
      ]);
      window.$crisp.push([
        "set",
        "session:data",
        [
          [
            ["shop", shopDomain],
            ["plan", currentPlan],
          ],
        ],
      ]);
    };
    document.head.appendChild(script);
  }, [shopName, shopDomain, currentPlan, ownerName, ownerEmail]);

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Draft Orders</s-link>
        <s-link href="/app/plans">Plans</s-link>
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
