import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  hooks: {
    afterAuth: async ({ session, admin }) => {
      try {
        shopify.registerWebhooks({ session });
      } catch (e) {
        console.error("Webhook registration error:", e);
      }

      try {
        const response = await admin.graphql(`{ shop { name } }`);
        const { data } = await response.json();

        await prisma.shop.upsert({
          where: { shopDomain: session.shop },
          update: {
            accessToken: session.accessToken!,
            name: data.shop.name,
          },
          create: {
            shopDomain: session.shop,
            accessToken: session.accessToken!,
            name: data.shop.name,
          },
        });
      } catch (e) {
        const err = e as { body?: { errors?: { graphQLErrors?: unknown } }; message?: string };
        console.error("afterAuth error:", JSON.stringify(err?.body?.errors?.graphQLErrors ?? err?.message ?? e, null, 2));
      }
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
