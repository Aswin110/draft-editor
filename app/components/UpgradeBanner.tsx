import { Banner, Link } from "@shopify/polaris";

interface UpgradeBannerProps {
  usedCount: number;
  limit: number;
}

export const UpgradeBanner = ({ usedCount, limit }: UpgradeBannerProps) => {
  return (
    <Banner title="Edit limit reached" tone="warning">
      <p>
        You&apos;ve edited {usedCount} of {limit} draft orders available on the
        free plan this month.{" "}
        <Link url="/app/plans">Upgrade to a paid plan</Link> for unlimited
        edits.
      </p>
    </Banner>
  );
};
