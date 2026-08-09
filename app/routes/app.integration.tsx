import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import SetupGuide from "../components/SetupGuide";

interface LoaderData {
  shopDomain: string;
  apiKey: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  return {
    shopDomain: session.shop,
    apiKey: process.env.SHOPIFY_API_KEY || "",
  };
};

const Integration = () => {
  const { shopDomain, apiKey } = useLoaderData<LoaderData>();

  return (
    <s-page heading="Integration">
      <SetupGuide shopDomain={shopDomain} apiKey={apiKey} />
    </s-page>
  );
};

export default Integration;
