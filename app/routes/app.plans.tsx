import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  useLoaderData,
  useActionData,
  useNavigation,
  useSubmit,
} from "react-router";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";
import {
  MONTHLY_PLAN,
  ANNUAL_PLAN,
  FREE_TIER_EDIT_LIMIT,
} from "../constants/plans";
import { getMonthlyUsageStatus } from "../models/usage.server";
import type {
  CurrencyCode,
  AppPricingInterval,
} from "../types/admin.types.d.ts";

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
                price: {
                  amount: isAnnual ? 30 : 3,
                  currencyCode: "USD" as CurrencyCode,
                },
                interval: (isAnnual
                  ? "ANNUAL"
                  : "EVERY_30_DAYS") as AppPricingInterval,
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

const PlanCard = ({
  title,
  price,
  priceLabel,
  description,
  badgeLabel,
  currentPlan,
  planName,
  isSubmitting,
  submittingPlan,
  onSubscribe,
}: {
  title: string;
  price: string;
  priceLabel: string;
  description: string;
  badgeLabel?: string;
  currentPlan: string | null;
  planName: string;
  isSubmitting: boolean;
  submittingPlan: FormDataEntryValue | null;
  onSubscribe: () => void;
}) => {
  const isCurrentPlan = currentPlan === planName;

  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-heading>{title}</s-heading>
            {badgeLabel && <s-badge tone="success">{badgeLabel}</s-badge>}
            {isCurrentPlan && <s-badge tone="info">Current Plan</s-badge>}
          </s-stack>
          <s-stack direction="inline" gap="small-300" alignItems="end">
            <s-heading>{price}</s-heading>
            <s-text color="subdued">{priceLabel}</s-text>
          </s-stack>
          <s-text color="subdued">{description}</s-text>
        </s-stack>

        <s-divider></s-divider>

        <s-stack direction="block" gap="small">
          {features.map((feature, index) => (
            <s-stack
              key={index}
              direction="inline"
              gap="small"
              alignItems="center"
            >
              <s-icon type="check" tone="success"></s-icon>
              <s-text>{feature}</s-text>
            </s-stack>
          ))}
        </s-stack>

        <s-box paddingBlockStart="small">
          <s-button
            variant="primary"
            onClick={onSubscribe}
            loading={
              submittingPlan ===
                (planName === MONTHLY_PLAN ? "monthly" : "annual") || undefined
            }
            disabled={isCurrentPlan || isSubmitting || undefined}
          >
            {isCurrentPlan ? "Current Plan" : "Start Free Trial"}
          </s-button>
        </s-box>
      </s-stack>
    </s-section>
  );
};

const PlansPage = () => {
  const { hasActiveSubscription, currentPlan, usageInfo } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();

  const isSubmitting = navigation.state === "submitting";
  const submittingPlan = isSubmitting ? navigation.formData?.get("plan") : null;

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
    <s-page heading="Plans">
      {hasActiveSubscription && (
        <s-banner tone="success">
          You are currently subscribed to the <strong>{currentPlan}</strong>.
        </s-banner>
      )}

      {actionData?.cancelled && (
        <s-banner tone="info">Your subscription has been cancelled.</s-banner>
      )}

      {actionData?.error && (
        <s-banner tone="critical">{actionData.error}</s-banner>
      )}

      {!hasActiveSubscription && (
        <s-section>
          <s-stack direction="block" gap="small">
            <s-heading>Current Usage</s-heading>
            <s-text>
              You&apos;ve edited {usageInfo.usedCount} of {usageInfo.limit}{" "}
              draft orders this month on the free plan.
            </s-text>
            {usageInfo.usedCount >= usageInfo.limit && (
              <s-banner tone="warning">
                You&apos;ve reached your free plan limit. Upgrade to continue
                editing draft orders.
              </s-banner>
            )}
          </s-stack>
        </s-section>
      )}

      <s-section>
        <s-stack direction="block" gap="base">
          <s-heading>Choose your plan</s-heading>
          <s-text color="subdued">
            Start with a 7-day free trial. Save 17% with annual billing.
          </s-text>
        </s-stack>
      </s-section>

      <s-grid gridTemplateColumns="1fr 1fr" gap="base">
        <PlanCard
          title="Monthly"
          price="$3"
          priceLabel="/ month"
          description="7-day free trial, then billed monthly."
          currentPlan={currentPlan}
          planName={MONTHLY_PLAN}
          isSubmitting={isSubmitting}
          submittingPlan={submittingPlan ?? null}
          onSubscribe={() => handleSubscribe("monthly")}
        />
        <PlanCard
          title="Annual"
          price="$30"
          priceLabel="/ year"
          description="7-day free trial, then $2.50/month billed annually."
          badgeLabel="Save 17%"
          currentPlan={currentPlan}
          planName={ANNUAL_PLAN}
          isSubmitting={isSubmitting}
          submittingPlan={submittingPlan ?? null}
          onSubscribe={() => handleSubscribe("annual")}
        />
      </s-grid>

      {hasActiveSubscription && (
        <s-section>
          <s-stack direction="block" gap="small">
            <s-heading>Cancel subscription</s-heading>
            <s-text color="subdued">
              If you cancel, you will lose access to all paid features at the
              end of your current billing period.
            </s-text>
            <s-box>
              <s-button
                tone="critical"
                onClick={handleCancel}
                loading={isCancelling || undefined}
                disabled={isSubmitting || undefined}
              >
                Cancel Subscription
              </s-button>
            </s-box>
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
};
export default PlansPage;
