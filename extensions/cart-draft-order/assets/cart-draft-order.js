(function () {
  function init(root) {
    var button = root.querySelector(".cart-draft-order__button");
    var message = root.querySelector(".cart-draft-order__message");
    if (!button) return;

    function setMessage(text) {
      if (!message) return;
      message.textContent = text || "";
      message.hidden = !text;
    }

    // Cart line item properties starting with "_" are private/hidden; skip them.
    function propertiesToArray(props) {
      if (!props) return [];
      return Object.keys(props)
        .filter(function (key) {
          return key.indexOf("_") !== 0;
        })
        .map(function (key) {
          return { key: key, value: String(props[key]) };
        });
    }

    button.addEventListener("click", async function () {
      // Customer details only attach when logged in — send guests to log in.
      if (root.dataset.loggedIn !== "true") {
        var loginUrl = root.dataset.loginUrl || "/account/login";
        var returnUrl = root.dataset.returnUrl || "/cart";
        window.location.href =
          loginUrl + "?return_url=" + encodeURIComponent(returnUrl);
        return;
      }

      button.disabled = true;
      setMessage("Creating draft order…");

      try {
        var cartResponse = await fetch("/cart.js", {
          headers: { Accept: "application/json" },
        });
        var cart = await cartResponse.json();

        if (!cart.items || cart.items.length === 0) {
          setMessage("Your cart is empty.");
          button.disabled = false;
          return;
        }

        var items = cart.items.map(function (item) {
          return {
            variantId: item.variant_id,
            quantity: item.quantity,
            properties: propertiesToArray(item.properties),
          };
        });

        var response = await fetch(root.dataset.proxyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ items: items }),
        });
        var data = await response.json();

        if (!response.ok || !data.success) {
          if (data.error === "login_required") {
            var login = root.dataset.loginUrl || "/account/login";
            var ret = root.dataset.returnUrl || "/cart";
            window.location.href =
              login + "?return_url=" + encodeURIComponent(ret);
            return;
          }
          setMessage(data.error || "Could not create draft order.");
          button.disabled = false;
          return;
        }

        var template =
          root.dataset.successMessage ||
          "Draft order {name} created. We'll be in touch to complete it.";
        setMessage(template.replace("{name}", data.name || ""));
        // Leave the cart intact; the merchant reviews the draft. Hide the
        // button so it isn't clicked again, creating duplicate drafts.
        button.hidden = true;
      } catch (error) {
        setMessage("Something went wrong. Please try again.");
        button.disabled = false;
      }
    });
  }

  function initAll() {
    var roots = document.querySelectorAll(".cart-draft-order");
    for (var i = 0; i < roots.length; i++) init(roots[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})();
