const Privacy = () => {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#1a1a1a",
        lineHeight: 1.7,
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        Last updated: March 1, 2026
      </p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Introduction</h2>
        <p>
          Draft Editor is a Shopify application that allows merchants to edit
          draft orders. This privacy policy explains how we collect, use, and
          protect your data.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Data We Access</h2>
        <p>
          When you install Draft Editor, we request access to the following
          Shopify data through the Shopify API:
        </p>
        <ul style={{ paddingLeft: 24 }}>
          <li>
            <strong>Draft orders</strong> — to display and edit your draft
            orders
          </li>
          <li>
            <strong>Products</strong> — to allow adding products to draft orders
          </li>
          <li>
            <strong>Customers</strong> — to display customer information on
            draft orders
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Data We Store</h2>
        <p>We store the following data in our database:</p>
        <ul style={{ paddingLeft: 24 }}>
          <li>
            <strong>Shop information</strong> — your store domain and name, used
            to identify your account
          </li>
          <li>
            <strong>Session data</strong> — authentication tokens required to
            securely connect to your store
          </li>
          <li>
            <strong>Subscription status</strong> — your current plan and billing
            information managed through Shopify
          </li>
        </ul>
        <p>
          We do not store your draft order content, product data, or customer
          information. All draft order data is read from and written to Shopify
          in real time.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>How We Use Your Data</h2>
        <p>Your data is used solely to:</p>
        <ul style={{ paddingLeft: 24 }}>
          <li>Authenticate your store and maintain your session</li>
          <li>Display and edit draft orders as requested by you</li>
          <li>Manage your subscription plan</li>
        </ul>
        <p>
          We do not sell, share, or transfer your data to any third parties.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Data Sharing</h2>
        <p>
          We do not share your data with any third parties. All communication
          happens directly between our app and the Shopify API. Our app is
          hosted on Railway and uses a PostgreSQL database to store session and
          account data.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>
          Data Retention and Deletion
        </h2>
        <p>
          When you uninstall Draft Editor, your session data is automatically
          removed. If you would like all stored data related to your store to be
          deleted, please contact us and we will process your request promptly.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Security</h2>
        <p>
          We use industry-standard security measures to protect your data. All
          communication between our app and Shopify uses encrypted HTTPS
          connections. Access tokens are stored securely in our database.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Contact</h2>
        <p>
          If you have any questions about this privacy policy or wish to request
          data deletion, please contact us at{" "}
          <a href="mailto:aswinashok110@gmail.com" style={{ color: "#2563eb" }}>
            aswinashok110@gmail.com
          </a>
          .
        </p>
      </section>
    </div>
  );
};

export default Privacy;
