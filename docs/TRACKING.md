# Tracking

All tracking runs through Shopify's official apps and Customer Events, never pasted snippets. Every pixel respects the cookie banner: analytics and marketing events fire only after the visitor accepts.

| Event | Fires when | Sent by | How to test |
|---|---|---|---|
| page_viewed | Any page loads | Shopify Analytics; GA4 (Google & YouTube app); Meta and TikTok apps | Accept cookies, open any page. Check GA4 DebugView, Meta Events Manager > Test events, TikTok Events Manager > Test events. |
| product_viewed (view_item / ViewContent) | Product page loads | Same | Open a product page. The event shows the product id and price in GBP. |
| search_submitted (search / Search) | Search results page loads | Same | Search for "jumper". |
| product_added_to_cart (add_to_cart / AddToCart) | Add to bag succeeds (drawer or quick add) | Same, through Shopify's Ajax cart events | Add an item. One event per add; a double tap does not add twice. |
| checkout_started (begin_checkout / InitiateCheckout) | Checkout opens | Shopify checkout | Press Checkout. |
| checkout_completed (purchase / Purchase) | Order is paid | Shopify checkout | Place a test-mode order. Value and currency must match the order total. |

## Consent check

1. Open the site in a private window. Do not touch the cookie banner.
2. In browser developer tools > Network, filter for `facebook`, `tiktok`, `google-analytics`, `googletagmanager`. There must be no requests. (Automated in `tests/e2e/components.spec.ts` against the preview. Repeat on the live store.)
3. Press **Reject**. Browse and still see no requests. Press "Cookie preferences" in the footer, accept, and requests appear.

## Setup
1. Install Google & YouTube, Facebook & Instagram and TikTok from the Shopify App Store. Connect each account and choose **Data sharing: Standard** (Meta: "Maximum" uses the Conversions API from Shopify's servers and still respects consent).
2. Settings > Customer privacy > Cookie banner: on, United Kingdom, with Accept, Reject and Manage preferences buttons.
3. Settings > Customer events: check that each app's pixel shows **Connected** and "Requires customer consent: Yes".
