interface UpgradeBannerProps {
  usedCount: number;
  limit: number;
}

export const UpgradeBanner = ({ usedCount, limit }: UpgradeBannerProps) => {
  return (
    <s-banner heading="Edit limit reached" tone="warning">
      You&apos;ve edited {usedCount} of {limit} draft orders available on the
      free plan this month.{" "}
      <s-link href="/app/plans">Upgrade to a paid plan</s-link> for unlimited
      edits.
    </s-banner>
  );
};
