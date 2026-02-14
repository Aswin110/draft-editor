import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, useSubmit } from "react-router";
import { useEffect } from "react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Box,
  Button,
  Divider,
  Icon,
  InlineGrid,
  Badge,
  Banner,
} from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { MONTHLY_PLAN, ANNUAL_PLAN, FREE_TIER_EDIT_LIMIT } from "../constants/plans";
import { getMonthlyUsageStatus } from "../models/usage.server";
import type { CurrencyCode, AppPricingInterval } from "../types/admin.types.d.ts";

const features = ["Unlimited draft order edits", "Priority support"];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing } = await authenticate.admin(request);

  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [MONTHLY_PLAN, ANNUAL_PLAN],
    isTest: true,
  });

  const currentPlan =
    appSubscriptions.length > 0 ? appSubscriptions[0].name : null;

  // Get usage info for free tier display
  let usageInfo = { usedCount: 0, limit: FREE_TIER_EDIT_LIMIT };
  if (!hasActivePayment) {
    const status = await getMonthlyUsageStatus(admin);
    usageInfo = { usedCount: status.totalThisMonth, limit: status.limit };
  }

  return {
    hasActiveSubscription: hasActivePayment,
    currentPlan,
    usageInfo,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  // Handle cancel/unsubscribe
  if (intent === "cancel") {
    const { appSubscriptions } = await billing.check({
      plans: [MONTHLY_PLAN, ANNUAL_PLAN],
      isTest: true,
    });

    if (appSubscriptions.length > 0) {
      const subscriptionId = appSubscriptions[0].id;

      const response = await admin.graphql(
        `#graphql
        mutation AppSubscriptionCancel($id: ID!) {
          appSubscriptionCancel(id: $id) {
            appSubscription {
              id
              status
            }
            userErrors {
              field
              message
            }
          }
        }`,
        { variables: { id: subscriptionId } },
      );

      const { data } = await response.json();
      const cancelErrors = data?.appSubscriptionCancel?.userErrors;

      if (cancelErrors && cancelErrors.length > 0) {
        console.error("Cancel errors:", cancelErrors);
        return { error: "Failed to cancel subscription" };
      }

      return { cancelled: true };
    }

    return { error: "No active subscription found" };
  }

  // Handle subscribe
  const isAnnual = formData.get("plan") === "annual";
  const planName = isAnnual ? ANNUAL_PLAN : MONTHLY_PLAN;
  const shopName = session.shop.replace(".myshopify.com", "");

  const response = await admin.graphql(
    `#graphql
    mutation CreateSubscription($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean!, $trialDays: Int) {
      appSubscriptionCreate(
        name: $name
        lineItems: $lineItems
        returnUrl: $returnUrl
        test: $test
        trialDays: $trialDays
        replacementBehavior: APPLY_IMMEDIATELY
      ) {
        appSubscription {
          id
        }
        confirmationUrl
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        name: planName,
        test: true,
        trialDays: 7,
        returnUrl: `https://admin.shopify.com/store/${shopName}/apps/${process.env.SHOPIFY_API_KEY}/app/plans`,
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: isAnnual ? 30 : 3, currencyCode: "USD" as CurrencyCode },
                interval: (isAnnual ? "ANNUAL" : "EVERY_30_DAYS") as AppPricingInterval,
              },
            },
          },
        ],
      },
    },
  );

  const { data } = await response.json();
  const createErrors = data?.appSubscriptionCreate?.userErrors;

  if (createErrors && createErrors.length > 0) {
    console.error("Billing errors:", createErrors);
    return { confirmationUrl: null };
  }

  return {
    confirmationUrl: data?.appSubscriptionCreate?.confirmationUrl ?? null,
  };
};

const PlansPage = () => {
  const { hasActiveSubscription, currentPlan, usageInfo } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();

  const isSubmitting = navigation.state === "submitting";
  const submittingPlan = isSubmitting
    ? navigation.formData?.get("plan")
    : null;

  useEffect(() => {
    if (actionData?.confirmationUrl) {
      open(actionData.confirmationUrl, "_top");
    }
  }, [actionData]);

  const handleSubscribe = (plan: "monthly" | "annual") => {
    submit({ plan, intent: "subscribe" }, { method: "post" });
  };

  const handleCancel = () => {
    submit({ intent: "cancel" }, { method: "post" });
  };

  const isCancelling =
    isSubmitting && navigation.formData?.get("intent") === "cancel";

  return (
    <Page title="Plans">
      <BlockStack gap="400">
        {hasActiveSubscription && (
          <Banner tone="success">
            <p>
              You are currently subscribed to the{" "}
              <strong>{currentPlan}</strong>.
            </p>
          </Banner>
        )}

        {actionData?.cancelled && (
          <Banner tone="info">
            <p>Your subscription has been cancelled.</p>
          </Banner>
        )}

        {actionData?.error && (
          <Banner tone="critical">
            <p>{actionData.error}</p>
          </Banner>
        )}

        {!hasActiveSubscription && (
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">
                Current Usage
              </Text>
              <Text as="p">
                You&apos;ve edited <strong>{usageInfo.usedCount}</strong> of{" "}
                <strong>{usageInfo.limit}</strong> draft orders this month on
                the free plan.
              </Text>
              {usageInfo.usedCount >= usageInfo.limit && (
                <Banner tone="warning">
                  <p>
                    You&apos;ve reached your free plan limit. Upgrade to continue
                    editing draft orders.
                  </p>
                </Banner>
              )}
            </BlockStack>
          </Card>
        )}

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">
              Choose your plan
            </Text>
            <Text as="p" tone="subdued">
              Start with a 7-day free trial. Save 17% with annual billing.
            </Text>
          </BlockStack>
        </Card>

        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="h3" variant="headingMd">
                    Monthly
                  </Text>
                  {currentPlan === MONTHLY_PLAN && (
                    <Badge tone="info">Current Plan</Badge>
                  )}
                </InlineStack>
                <InlineStack gap="100" blockAlign="baseline">
                  <Text as="span" variant="heading2xl" fontWeight="bold">
                    $3
                  </Text>
                  <Text as="span" variant="bodyMd" tone="subdued">
                    / month
                  </Text>
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  7-day free trial, then billed monthly.
                </Text>
              </BlockStack>

              <Divider />

              <BlockStack gap="300">
                {features.map((feature, index) => (
                  <InlineStack key={index} gap="200" blockAlign="center">
                    <Box>
                      <Icon source={CheckIcon} tone="success" />
                    </Box>
                    <Text as="span" variant="bodyMd">
                      {feature}
                    </Text>
                  </InlineStack>
                ))}
              </BlockStack>

              <Box paddingBlockStart="200">
                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  onClick={() => handleSubscribe("monthly")}
                  loading={submittingPlan === "monthly"}
                  disabled={currentPlan === MONTHLY_PLAN || isSubmitting}
                >
                  {currentPlan === MONTHLY_PLAN
                    ? "Current Plan"
                    : "Start Free Trial"}
                </Button>
              </Box>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="h3" variant="headingMd">
                    Annual
                  </Text>
                  <Badge tone="success">Save 17%</Badge>
                  {currentPlan === ANNUAL_PLAN && (
                    <Badge tone="info">Current Plan</Badge>
                  )}
                </InlineStack>
                <InlineStack gap="100" blockAlign="baseline">
                  <Text as="span" variant="heading2xl" fontWeight="bold">
                    $30
                  </Text>
                  <Text as="span" variant="bodyMd" tone="subdued">
                    / year
                  </Text>
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  7-day free trial, then $2.50/month billed annually.
                </Text>
              </BlockStack>

              <Divider />

              <BlockStack gap="300">
                {features.map((feature, index) => (
                  <InlineStack key={index} gap="200" blockAlign="center">
                    <Box>
                      <Icon source={CheckIcon} tone="success" />
                    </Box>
                    <Text as="span" variant="bodyMd">
                      {feature}
                    </Text>
                  </InlineStack>
                ))}
              </BlockStack>

              <Box paddingBlockStart="200">
                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  onClick={() => handleSubscribe("annual")}
                  loading={submittingPlan === "annual"}
                  disabled={currentPlan === ANNUAL_PLAN || isSubmitting}
                >
                  {currentPlan === ANNUAL_PLAN
                    ? "Current Plan"
                    : "Start Free Trial"}
                </Button>
              </Box>
            </BlockStack>
          </Card>
        </InlineGrid>

        {hasActiveSubscription && (
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd">
                Cancel subscription
              </Text>
              <Text as="p" tone="subdued">
                If you cancel, you will lose access to all paid features at the
                end of your current billing period.
              </Text>
              <Box>
                <Button
                  tone="critical"
                  onClick={handleCancel}
                  loading={isCancelling}
                  disabled={isSubmitting}
                >
                  Cancel Subscription
                </Button>
              </Box>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
};
export default PlansPage;
