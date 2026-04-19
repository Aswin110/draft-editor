import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  useLoaderData,
  useActionData,
  useNavigation,
  useSubmit,
} from "react-router";
import { useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import {
  MONTHLY_PLAN,
  ANNUAL_PLAN,
  FREE_PLAN_MONTHLY_EDIT_LIMIT,
} from "../constants/plans";
import {
  isTestStore,
  checkAndSyncBilling,
  upsertPlan,
} from "../utils/billing.server";
import type {
  CurrencyCode,
  AppPricingInterval,
} from "../types/admin.types.d.ts";

const paidFeatures = ["Unlimited draft order edits", "Priority support"];
const freeFeatures = [
  `Edit the first ${FREE_PLAN_MONTHLY_EDIT_LIMIT} draft orders each month`,
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const testStore = await isTestStore(admin);

  const { hasActivePayment, currentPlan } = await checkAndSyncBilling({
    billing,
    shopDomain: session.shop,
    plans: [MONTHLY_PLAN, ANNUAL_PLAN],
    isTest: testStore,
  });

  return {
    hasActiveSubscription: hasActivePayment,
    currentPlan,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  // Handle cancel/unsubscribe
  const testStore = await isTestStore(admin);

  if (intent === "cancel") {
    const { appSubscriptions } = await billing.check({
      plans: [MONTHLY_PLAN, ANNUAL_PLAN],
      isTest: testStore,
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

      // Persist cancellation to DB
      await upsertPlan({
        shopDomain: session.shop,
        planName: null,
        status: "cancelled",
        shopifySubscriptionId: null,
      });

      return { cancelled: true };
    }

    return { error: "No active subscription found" };
  }

  // Handle subscribe
  const isAnnual = formData.get("plan") === "annual";
  const planName = isAnnual ? ANNUAL_PLAN : MONTHLY_PLAN;
  const shopName = session.shop.replace(".myshopify.com", "");

  // Pre-flight: block creating a duplicate subscription for the same plan.
  // For switching plans, replacementBehavior: APPLY_IMMEDIATELY handles it.
  const existingCheck = await billing.check({
    plans: [MONTHLY_PLAN, ANNUAL_PLAN],
    isTest: testStore,
  });

  if (
    existingCheck.hasActivePayment &&
    existingCheck.appSubscriptions.some((sub) => sub.name === planName)
  ) {
    return {
      error: `You are already subscribed to the ${planName}.`,
      confirmationUrl: null,
    };
  }

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
        test: testStore,
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

  // Persist pending subscription to DB (will be updated to "active" by
  // the webhook or the next billing check when the merchant approves)
  const newSubscriptionId = data?.appSubscriptionCreate?.appSubscription?.id;
  if (newSubscriptionId) {
    await upsertPlan({
      shopDomain: session.shop,
      planName: planName,
      status: "pending",
      shopifySubscriptionId: newSubscriptionId,
    });
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
  features,
  isCurrentPlan,
  buttonLabel,
  buttonLoading,
  buttonDisabled,
  buttonCommandFor,
  onSubscribe,
}: {
  title: string;
  price: string;
  priceLabel: string;
  description: string;
  badgeLabel?: string;
  features: string[];
  isCurrentPlan: boolean;
  buttonLabel?: string;
  buttonLoading?: boolean;
  buttonDisabled?: boolean;
  buttonCommandFor?: string;
  onSubscribe?: () => void;
}) => {
  return (
    <s-section>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          height: "100%",
        }}
      >
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

        {buttonLabel && (
          <div style={{ marginTop: "auto", paddingTop: "0.5rem" }}>
            <s-button
              variant="primary"
              onClick={buttonCommandFor ? undefined : onSubscribe}
              commandFor={buttonCommandFor}
              loading={buttonLoading || undefined}
              disabled={buttonDisabled || undefined}
            >
              {buttonLabel}
            </s-button>
          </div>
        )}
      </div>
    </s-section>
  );
};

const PlansPage = () => {
  const { hasActiveSubscription, currentPlan } = useLoaderData<typeof loader>();
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

  useEffect(() => {
    if (actionData?.cancelled) {
      const modal = document.getElementById("cancel-modal") as
        | (HTMLElement & { hideOverlay?: () => void })
        | null;
      modal?.hideOverlay?.();
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

  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">(
    currentPlan === ANNUAL_PLAN ? "annual" : "monthly",
  );

  return (
    <s-page heading="Plans">
      <s-stack direction="block" gap="base">
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

        <s-stack direction="inline" gap="small" alignItems="center">
          <s-button
            variant={billingPeriod === "monthly" ? "primary" : "tertiary"}
            onClick={() => setBillingPeriod("monthly")}
          >
            Monthly
          </s-button>
          <s-button
            variant={billingPeriod === "annual" ? "primary" : "tertiary"}
            onClick={() => setBillingPeriod("annual")}
          >
            Annual
          </s-button>
          <s-badge tone="success">Save 17% annually</s-badge>
        </s-stack>

        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <PlanCard
            title="Free"
            price="$0"
            priceLabel="forever"
            description="Try it out with a limited number of edits each month."
            features={freeFeatures}
            isCurrentPlan={!hasActiveSubscription}
            buttonLabel={
              !hasActiveSubscription ? "Current Plan" : "Switch to Free"
            }
            buttonDisabled={!hasActiveSubscription || isSubmitting}
            buttonCommandFor={
              hasActiveSubscription ? "cancel-modal" : undefined
            }
          />
          {billingPeriod === "monthly" ? (
            <PlanCard
              title="Monthly"
              price="$3"
              priceLabel="/ month"
              description="7-day free trial, then billed monthly."
              features={paidFeatures}
              isCurrentPlan={currentPlan === MONTHLY_PLAN}
              buttonLabel={
                currentPlan === MONTHLY_PLAN
                  ? "Current Plan"
                  : hasActiveSubscription
                    ? "Switch to Monthly"
                    : "Start 7-Day Free Trial"
              }
              buttonLoading={submittingPlan === "monthly"}
              buttonDisabled={currentPlan === MONTHLY_PLAN || isSubmitting}
              onSubscribe={() => handleSubscribe("monthly")}
            />
          ) : (
            <PlanCard
              title="Annual"
              price="$30"
              priceLabel="/ year"
              description="7-day free trial, then $2.50/month billed annually."
              badgeLabel="Save 17%"
              features={paidFeatures}
              isCurrentPlan={currentPlan === ANNUAL_PLAN}
              buttonLabel={
                currentPlan === ANNUAL_PLAN
                  ? "Current Plan"
                  : hasActiveSubscription
                    ? "Switch to Annual"
                    : "Start 7-Day Free Trial"
              }
              buttonLoading={submittingPlan === "annual"}
              buttonDisabled={currentPlan === ANNUAL_PLAN || isSubmitting}
              onSubscribe={() => handleSubscribe("annual")}
            />
          )}
        </s-grid>

        <s-modal id="cancel-modal" heading="Downgrade to Free plan?">
          <s-text>
            You will lose access to unlimited edits and all paid features at the
            end of your current billing period. On the Free plan you can edit
            the first {FREE_PLAN_MONTHLY_EDIT_LIMIT} draft orders each month.
          </s-text>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={handleCancel}
            loading={isCancelling || undefined}
          >
            Yes, downgrade
          </s-button>
          <s-button
            slot="secondary-action"
            commandFor="cancel-modal"
            command="--hide"
          >
            Keep my plan
          </s-button>
        </s-modal>
      </s-stack>
    </s-page>
  );
};
export default PlansPage;
