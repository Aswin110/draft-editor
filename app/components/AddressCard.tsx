export interface AddressCardProps {
  title: string;
  addressLines: string[];
}

export const AddressCard = ({ title, addressLines }: AddressCardProps) => {
  return (
    <s-section>
      <s-heading>{title}</s-heading>
      <s-stack direction="block" gap="small-300">
        {addressLines.map((line, i) => (
          <s-text key={i}>{line}</s-text>
        ))}
      </s-stack>
    </s-section>
  );
};
