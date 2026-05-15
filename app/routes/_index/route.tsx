import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

const App = () => {
  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Draft Pen</h1>
        <p className={styles.text}>
          Edit Shopify draft orders quickly — change line items, prices,
          quantities, notes, and properties in one place.
        </p>
        <p className={styles.text}>
          Draft Pen is a Shopify-embedded app. Install it from the Shopify App
          Store and open it from your store admin.
        </p>
      </div>
    </div>
  );
};
export default App;
