/**
 * siteContent.js — Every editable sentence on the storefront, in one place.
 *
 * Each entry below is one page (or one shared surface) as the admin sees it
 * in Site content: a settings key, the fields the editor renders, and the
 * defaults the storefront ships with. Pages read the merged value through
 * `useSiteContent(key)` (services/siteContent.js); the admin writes the
 * same key. Nothing here is fetched until a page asks for it.
 *
 * Field types the editor understands:
 *   text · textarea · richtext · toggle · number · select · image ·
 *   stringlist (array of strings) · list (array of objects, `fields` inside) ·
 *   order (fixed rows with a visibility toggle, reorderable)
 *
 * Rich text uses the RichText grammar: blank lines separate paragraphs,
 * lines starting with "-" are bullets, "**bold**", and "[label](/path)" for
 * links. Legal pages may use {legalName}, {supportEmail} and {supportPhone},
 * which are filled from Store information at render time.
 *
 * Health copy here is written as general wellness information: "supports",
 * "contributes to", "traditionally used". Nothing claims to diagnose, treat,
 * cure or prevent a disease.
 *
 * @module content/siteContent
 */
import { FAQS } from "./faqs";

const f = (name, label, type = "text", extra = {}) => ({ name, label, type, ...extra });

/** Home sections in their default order. Labels are what the admin sees. */
export const HOME_SECTIONS = [
  { key: "pillars", label: "Promise panel (below the hero)" },
  { key: "categories", label: "Shop by category and goal" },
  { key: "bestSellers", label: "Best sellers" },
  { key: "routine", label: "When to take what (daily schedule)" },
  { key: "break1", label: "Photo break 1" },
  { key: "standard", label: "The Formulary standard" },
  { key: "ingredients", label: "What's inside (ingredient index)" },
  { key: "proof", label: "Why Core Atoms (navy proof band)" },
  { key: "testimonials", label: "What customers say" },
  { key: "break2", label: "Photo break 2" },
  { key: "education", label: "Know your supplements" },
  { key: "faq", label: "Questions, answered" },
  { key: "recentlyViewed", label: "Recently viewed" },
  { key: "manifesto", label: "Closing statement" },
];

export const PAGES = [
  {
    key: "site_global",
    title: "Global",
    description: "The announcement bar and footer that appear on every page.",
    fields: [
      f("announcement.showShipping", "Show the free-shipping fact (uses the threshold from Settings)", "toggle"),
      f("announcement.showCod", "Show the Cash on Delivery fact (only when COD is enabled)", "toggle"),
      f("announcement.extra", "Other announcement lines", "stringlist", { hint: "One fact per line. Phones rotate through them." }),
      f("footer.tagline", "Footer tagline", "textarea"),
      f("footer.instagramHandle", "Instagram handle", "text"),
      f("footer.instagramUrl", "Instagram URL", "text"),
      f("footer.aboutLabel", "About link label", "text"),
      f("footer.aboutUrl", "About link URL", "text"),
      f("footer.madeIn", "Closing line (bottom right)", "text"),
      f("footer.disclaimer", "Supplement disclaimer", "textarea", { hint: "Required on nutraceutical storefronts. The FSSAI licence from Store information is appended automatically." }),
    ],
    defaults: {
      announcement: { showShipping: true, showCod: true, extra: ["Every batch third-party lab tested"] },
      footer: {
        tagline: "Formulas with every ingredient on the label, verified batch by batch, delivered anywhere in India.",
        instagramHandle: "@core_atoms",
        instagramUrl: "https://www.instagram.com/core_atoms/",
        aboutLabel: "About Atoms Lifecare",
        aboutUrl: "https://atomslifecare.com/about",
        madeIn: "Made in India, shipped pan-India",
        disclaimer: "Products sold on this site are dietary supplements, not medicines, and are not intended to diagnose, treat, cure or prevent any disease. Always read the label and do not exceed the recommended usage. Consult a healthcare professional before use if you are pregnant, nursing, taking medication or have a medical condition. Supplements are not a substitute for a varied diet.",
      },
    },
  },
  {
    key: "site_motion",
    title: "Motion and effects",
    description: "Switch the storefront's effects on or off. Visitors who ask their device for reduced motion never see them regardless.",
    fields: [
      f("smoothScroll", "Smooth, weighted scrolling (desktop)", "toggle"),
      f("scrollbar", "Custom scrollbar and reading line (desktop)", "toggle"),
      f("cursor", "Custom pointer with “View” labels (desktop)", "toggle"),
      f("curtain", "Navy curtain between pages", "toggle"),
      f("grain", "Film grain over the page", "toggle"),
      f("stage", "Product stages: the jar turns as the product page scrolls, and the category index previews on hover (desktop)", "toggle"),
      f("tilt", "Tiles tilt toward the pointer; primary buttons lean toward it", "toggle"),
    ],
    defaults: { smoothScroll: true, scrollbar: true, cursor: false, curtain: true, grain: true, stage: true, tilt: true },
  },
  {
    key: "page_home",
    title: "Home",
    description: "Section order and visibility, the headings of every section, the photo breaks, the standard and the education panels. The hero, promise panel, categories, featured products and proof band keep their own editor under Homepage.",
    fields: [
      f("sections", "Sections, in order", "order", { rows: HOME_SECTIONS }),
      f("bestSellers.title", "Best sellers heading", "text"),
      f("bestSellers.sub", "Best sellers line", "text"),
      f("categories.title", "Categories heading", "text"),
      f("categories.sub", "Categories line", "text"),
      f("categories.goalsLabel", "Goal chips label", "text"),
      f("routine.title", "Schedule heading", "text"),
      f("routine.sub", "Schedule line", "textarea"),
      f("routine.footnote", "Schedule footnote", "textarea"),
      f("standard.title", "Standard heading", "text"),
      f("standard.intro", "Standard line", "textarea"),
      f("standards", "The rules", "list", {
        fields: [
          f("icon", "Icon", "select", { options: ["form", "dose", "blend", "test", "dispatch", "claims"] }),
          f("title", "Title", "text"),
          f("text", "Text", "textarea"),
        ],
      }),
      f("ingredients.title", "Ingredient index heading", "text"),
      f("ingredients.sub", "Ingredient index line", "text"),
      f("testimonials.title", "Reviews heading", "text"),
      f("breaks", "Photo breaks (use the second and third hero photographs)", "list", {
        fields: [f("text", "Headline", "text"), f("sub", "Line", "textarea")],
        max: 2,
      }),
      f("education.title", "Education heading", "text"),
      f("education.sub", "Education line", "text"),
      f("education.cards", "Education panels", "list", {
        fields: [
          f("icon", "Icon", "select", { options: ["label", "form", "timing", "testing"] }),
          f("title", "Title", "text"),
          f("text", "Text", "textarea"),
          f("href", "Link (path or #section)", "text"),
          f("linkText", "Link label", "text"),
        ],
      }),
      f("faq.title", "FAQ heading", "text"),
      f("faq.sub", "FAQ line", "text"),
      f("faq.picks", "Questions shown on the home page (must match questions on the FAQ page)", "stringlist"),
      f("recentlyViewed.title", "Recently viewed heading", "text"),
    ],
    defaults: {
      sections: HOME_SECTIONS.map((s) => ({ key: s.key, visible: true })),
      bestSellers: { title: "Best sellers", sub: "The formulas customers come back for." },
      categories: { title: "Shop by category", sub: "Start from what you need. Every range is fully disclosed on the label.", goalsLabel: "Shop by goal" },
      routine: {
        title: "When to take what",
        sub: "Every label carries a pairing note: what a formula goes with and when. Read together, they give the range a daily schedule from breakfast to bedtime.",
        footnote: "Timings are general guidance drawn from each label's pairing notes, not medical advice. Follow the directions on your pack, and ask a doctor first if you are pregnant, nursing or taking medication.",
      },
      standard: { title: "The Formulary standard", intro: "Six rules every Core Atoms formula is held to, from the form of each nutrient to the words we use to describe it." },
      standards: [
        { icon: "form", title: "Forms that absorb", text: "We choose the form of each nutrient for how well the body takes it up: magnesium as glycinate, calcium as citrate, vitamin D as D3. The form is printed on the label, not hidden behind a generic name." },
        { icon: "dose", title: "Doses that match the label", text: "What the label says is what each serving delivers. Every active is listed with its amount per serving, so you can compare it with your daily requirement instead of guessing." },
        { icon: "blend", title: "No proprietary blends", text: "A blend that lists ingredients without amounts tells you nothing. Every Core Atoms formula discloses each ingredient individually, including the herbal extracts." },
        { icon: "test", title: "Tested batch by batch", text: "Each production batch is checked for identity, potency and contaminants before it is released, and the batch number on your pack ties back to that record." },
        { icon: "dispatch", title: "Packed and dispatched fast", text: "Orders are packed and handed to the courier within a business day, tracked door to door, with Cash on Delivery available across India." },
        { icon: "claims", title: "Honest about what supplements do", text: "Supplements support a routine; they do not treat or cure disease. We describe what each nutrient is known for and leave the miracle language to others." },
      ],
      ingredients: { title: "What's inside", sub: "The actives across the range, what each is known for, and how many formulas carry it." },
      testimonials: { title: "What customers say" },
      breaks: [
        { text: "Made for the days you keep.", sub: "Formulas built around routines, not resolutions. One dose, the same time, every day." },
        { text: "Checked before it ships.", sub: "Identity, potency and contaminants, verified on every batch by an independent laboratory." },
      ],
      education: {
        title: "Know your supplements",
        sub: "Four things worth understanding before you buy a supplement, from us or anyone else.",
        cards: [
          { icon: "label", title: "How to read a supplement label", text: "Start with the serving size, then the amount of each active per serving and its share of the daily requirement. Ingredients listed as a blend without amounts are a red flag; every Core Atoms label lists them individually.", href: "/faq", linkText: "Where to find ingredient details" },
          { icon: "form", title: "Why the form of a nutrient matters", text: "Magnesium oxide and magnesium glycinate are both \"magnesium\", yet the body absorbs them very differently and one is far gentler on the stomach. The same goes for calcium citrate versus carbonate, and D3 versus D2. Check the form first.", href: "/shop?q=Magnesium", linkText: "See our magnesium" },
          { icon: "timing", title: "When to take what", text: "Fat-soluble nutrients such as vitamin D3 and omega-3 absorb best with a meal that contains some fat. Iron is better taken on its own with vitamin C, away from tea, coffee and calcium. Magnesium and ashwagandha suit the evening. Consistency matters more than the exact hour.", href: "#routine", linkText: "See the daily schedule" },
          { icon: "testing", title: "What third-party testing checks", text: "An independent laboratory verifies that a batch contains what the label claims (identity and potency) and that it is free of heavy metals and microbial contamination (purity). It is the difference between a claim and a certificate.", href: "/faq", linkText: "Are your products safe?" },
        ],
      },
      faq: {
        title: "Questions, answered",
        sub: "Ordering, delivery, replacements, and what our products are and are not.",
        picks: ["Are your products safe?", "Where do I find ingredient details?", "Is Cash on Delivery available?", "How long does delivery take?", "My product arrived damaged. What do I do?"],
      },
      recentlyViewed: { title: "Recently viewed" },
    },
  },
  {
    key: "page_shop",
    title: "Shop",
    description: "The catalogue page heading and its empty state.",
    fields: [
      f("title", "Heading (when nothing is filtered)", "text"),
      f("intro", "Line under the heading", "textarea"),
      f("emptyTitle", "No results heading", "text"),
      f("emptyText", "No results line", "textarea"),
    ],
    defaults: {
      title: "All products",
      intro: "",
      emptyTitle: "No formulas match",
      emptyText: "Try widening the price band or clearing a filter or two.",
    },
  },
  {
    key: "page_product",
    title: "Product page",
    description: "The trust row, the section headings, the jar hint and the disclaimer every product page carries. The monograph itself is edited per product under Products.",
    fields: [
      f("trustPoints", "Trust row (four short points)", "stringlist", { max: 4 }),
      f("storyHint", "Line beside the jar (desktop)", "textarea"),
      f("sectionTitles.benefits", "Benefits heading", "text"),
      f("sectionTitles.about", "About heading", "text"),
      f("sectionTitles.inside", "Ingredients heading", "text"),
      f("sectionTitles.howToUse", "How to use heading", "text"),
      f("sectionTitles.stack", "Stack heading", "text"),
      f("sectionTitles.faqs", "FAQ heading", "text"),
      f("sectionTitles.safety", "Safety heading", "text"),
      f("sectionTitles.reviews", "Reviews heading", "text"),
      f("sectionTitles.related", "Cross-sell heading", "text"),
      f("disclaimer", "Disclaimer under the monograph", "textarea"),
    ],
    defaults: {
      trustPoints: ["100% authentic", "Lab tested", "Secure payments", "Easy replacement"],
      storyHint: "Scroll through the label. Each ingredient appears as you reach it.",
      sectionTitles: {
        benefits: "What it does for you", about: "About this product", inside: "What's inside", howToUse: "How to use",
        stack: "Build your stack", faqs: "Questions, answered", safety: "Safety information", reviews: "Reviews", related: "You may also like",
      },
      disclaimer: "Nutraceutical supplements are not a substitute for a varied, balanced diet or a healthy lifestyle, and are not intended to diagnose, treat, cure or prevent any disease. Consult your healthcare professional before use if you are pregnant, nursing, on medication or have a medical condition.",
    },
  },
  {
    key: "page_cart",
    title: "Cart and drawer",
    description: "Copy on the cart page and in the slide-over cart.",
    fields: [
      f("title", "Cart heading", "text"),
      f("emptyTitle", "Empty cart heading", "text"),
      f("emptyText", "Empty cart line", "textarea"),
      f("summaryNote", "Note under the totals", "text"),
      f("trust", "Trust points under Checkout (three)", "stringlist", { max: 3 }),
      f("drawerEmptyTitle", "Drawer empty heading", "text"),
      f("drawerEmptyText", "Drawer empty line", "textarea"),
      f("drawerNote", "Drawer note under the subtotal", "text"),
    ],
    defaults: {
      title: "Your cart",
      emptyTitle: "Your cart is empty",
      emptyText: "Every formula on the site ships anywhere in India, with Cash on Delivery.",
      summaryNote: "Coupon codes and CoreCoins are applied at checkout.",
      trust: ["Secure checkout", "Quality packing", "Ships across India"],
      drawerEmptyTitle: "Nothing here yet",
      drawerEmptyText: "Add a formula and it will show up here, ready for checkout.",
      drawerNote: "Shipping, GST and coupons are worked out at checkout.",
    },
  },
  {
    key: "page_checkout",
    title: "Checkout",
    description: "Headings and the thank-you copy after an order is placed.",
    fields: [
      f("title", "Checkout heading", "text"),
      f("successTitle", "Order placed heading", "text"),
      f("successText", "Order placed line", "textarea"),
    ],
    defaults: { title: "Checkout", successTitle: "Order placed", successText: "Thank you. We're preparing your order for dispatch." },
  },
  {
    key: "page_account",
    title: "Account pages",
    description: "The navy panel beside the sign-in, forgot-password and reset forms, and the sign-in headings.",
    fields: [
      f("panelHeading", "Panel heading", "textarea"),
      f("panelPoints", "Panel points (three)", "stringlist", { max: 3 }),
      f("panelFootnote", "Panel footnote", "text"),
      f("loginTitle", "Sign in heading", "text"),
      f("loginSubtitle", "Sign in line", "text"),
      f("signupTitle", "Create account heading", "text"),
      f("signupSubtitle", "Create account line", "text"),
    ],
    defaults: {
      panelHeading: "Every ingredient on the label. Every batch tested.",
      panelPoints: ["Track every order and shipment live", "Cash on Delivery across India", "CoreCoins on every purchase"],
      panelFootnote: "Core Atoms. Nutraceuticals made in India.",
      loginTitle: "Welcome back",
      loginSubtitle: "Sign in to manage your orders and preferences.",
      signupTitle: "Create your account",
      signupSubtitle: "Order tracking, replacements and CoreCoins, all in one place.",
    },
  },
  {
    key: "page_orders",
    title: "My orders",
    description: "The order history heading.",
    fields: [f("title", "Heading", "text"), f("sub", "Line under the heading", "text")],
    defaults: { title: "My orders", sub: "Track shipments, raise replacements and leave reviews." },
  },
  {
    key: "page_faq",
    title: "FAQ",
    description: "Every question and answer, grouped by topic. The home page shows the questions picked under Home.",
    fields: [
      f("title", "Heading", "text"),
      f("intro", "Line under the heading", "textarea", { hint: "A “Contact us” link is added after this line automatically." }),
      f("groups", "Topics", "list", {
        fields: [
          f("section", "Topic", "text"),
          f("items", "Questions", "list", { fields: [f("q", "Question", "text"), f("a", "Answer", "textarea")] }),
        ],
      }),
    ],
    defaults: {
      title: "Questions, answered",
      intro: "Ordering, payment, shipping, replacements and CoreCoins. Not here?",
      groups: FAQS,
    },
  },
  {
    key: "page_contact",
    title: "Contact",
    description: "The contact page copy. Addresses, phone and email come from Store information under Settings.",
    fields: [
      f("title", "Heading", "text"),
      f("supportText", "Order support paragraph", "richtext"),
      f("reachHeading", "Reach us heading", "text"),
      f("fallbackText", "Shown when no contact details are saved", "richtext"),
      f("grievanceHeading", "Grievance heading", "text"),
      f("grievanceText", "Grievance paragraph", "richtext", { hint: "You can use {grievanceOfficer} and {supportEmail}." }),
    ],
    defaults: {
      title: "Contact Us",
      supportText: "The fastest answers for order questions are on the site itself: [My Orders](/orders) shows live tracking for every shipment, lets you cancel eligible orders instantly, and is where replacements for damaged products are raised. Common questions are answered on the [FAQ page](/faq).",
      reachHeading: "Reach us",
      fallbackText: "You can also reach the team on Instagram [@core_atoms](https://www.instagram.com/core_atoms/).",
      grievanceHeading: "Grievance redressal",
      grievanceText: "In accordance with the Consumer Protection (E-Commerce) Rules, 2020, complaints that are not resolved through regular support can be escalated to {grievanceOfficer} at {supportEmail} with \"Grievance\" in the subject line. Grievances are acknowledged within 48 hours and resolved within one month of receipt.",
    },
  },
  {
    key: "page_legal_terms",
    title: "Terms & conditions",
    description: "The terms page. Use {legalName} for the business name from Store information.",
    fields: [
      f("title", "Heading", "text"),
      f("updated", "Last updated", "text"),
      f("seoDescription", "Search description", "textarea"),
      f("sections", "Sections", "list", { fields: [f("title", "Section title", "text"), f("body", "Body", "richtext")] }),
    ],
    defaults: {
      title: "Terms & Conditions",
      updated: "31 August 2026",
      seoDescription: "The terms that govern purchases from the Core Atoms store: ordering, pricing, payments, cancellations and replacements.",
      sections: [
        { title: "1. Who we are", body: "This website is operated by {legalName} (\"we\", \"us\"). By placing an order on this site you agree to these terms and to our [Privacy Policy](/privacy), [Shipping Policy](/shipping-policy) and [Cancellation, Refund & Replacement Policy](/refund-policy)." },
        { title: "2. Products and health disclaimer", body: "We sell nutraceutical and dietary supplement products. These products are not medicines: they are **not intended to diagnose, treat, cure or prevent any disease**. Always read the label, do not exceed the recommended daily usage, and consult a qualified healthcare professional before use if you are pregnant, nursing, taking medication or have a medical condition. Supplements are not a substitute for a varied diet and healthy lifestyle.\n\nProduct images are for illustration; packaging you receive may vary as batches and label revisions change." },
        { title: "3. Orders and pricing", body: "All prices are shown in Indian Rupees. Applicable GST and shipping charges are itemised at checkout before you pay. Every order total, meaning item prices, GST, shipping, coupon discounts and CoreCoins redemption, is independently verified on our servers when the order is placed; if the total displayed to you cannot be verified, the order is rejected rather than charged incorrectly.\n\nAn order is accepted when it appears in My Orders with the status \"Placed\". We may refuse or cancel an order for suspected fraud, pricing errors, or stock unavailability; if payment was collected for a cancelled order it is refunded in full." },
        { title: "4. Payments", body: "We accept online payment through Razorpay (cards, UPI, netbanking and wallets) and Cash on Delivery where available. We never see or store your card details; online payments are processed entirely by Razorpay. For Cash on Delivery, the exact order total shown at checkout is the amount collected at your door." },
        { title: "5. Cancellations and replacements", body: "You can cancel an order yourself from My Orders at any time while it is still in the \"Placed\" or \"Processing\" state. Once an order has been shipped it can no longer be cancelled, but delivered products that arrive damaged or defective can be raised for replacement within the replacement window shown on your order. The full rules are in the [Cancellation, Refund & Replacement Policy](/refund-policy)." },
        { title: "6. CoreCoins and coupons", body: "CoreCoins are a loyalty benefit, earned on delivered orders and redeemable against future purchases at the rate shown at checkout. They have no cash value, cannot be transferred, and coins redeemed on an order are returned to your wallet if that order is cancelled. Coupon codes are subject to their own validity window and eligibility conditions, which are enforced at the time the order is placed." },
        { title: "7. Your account", body: "You are responsible for keeping your account credentials confidential and for all activity under your account. We may suspend accounts used fraudulently or in breach of these terms." },
        { title: "8. Liability", body: "To the maximum extent permitted by law, our liability for any claim arising out of an order is limited to the amount you paid for that order. Nothing in these terms limits rights that cannot be limited under the Consumer Protection Act, 2019." },
        { title: "9. Governing law and grievances", body: "These terms are governed by the laws of India. Complaints and grievances are handled as described on our [Contact page](/contact), which lists our grievance contact as required by the Consumer Protection (E-Commerce) Rules, 2020." },
      ],
    },
  },
  {
    key: "page_legal_privacy",
    title: "Privacy policy",
    description: "The privacy page. Use {supportEmail} for the support address from Store information.",
    fields: [
      f("title", "Heading", "text"),
      f("updated", "Last updated", "text"),
      f("seoDescription", "Search description", "textarea"),
      f("sections", "Sections", "list", { fields: [f("title", "Section title", "text"), f("body", "Body", "richtext")] }),
    ],
    defaults: {
      title: "Privacy Policy",
      updated: "31 August 2026",
      seoDescription: "What personal data Core Atoms collects, why, who it is shared with, and the choices you have.",
      sections: [
        { title: "What we collect", body: "When you create an account and shop with us, we collect:\n\n- **Account details**: your name, email address and password (stored as a secure hash; we never see the password itself).\n- **Order details**: the products you buy, order totals, payment method, and order status history.\n- **Delivery details**: the recipient name, phone number and shipping address you enter at checkout.\n- **Reviews**: ratings and review text you choose to publish, shown with the display name you provide.\n\nWe do not collect your card, UPI or banking details. Online payments are processed directly by Razorpay, and only a payment reference reaches us." },
        { title: "How we use it", body: "- To process, deliver and support your orders.\n- To operate your account, order history, replacements and CoreCoins wallet.\n- To send transactional messages about your orders (confirmations, status updates).\n- To prevent fraud and abuse, for example by verifying order totals server-side and rate-limiting suspicious traffic.\n\nWe do not sell your personal data, and we do not use third-party advertising trackers on this site." },
        { title: "Who we share it with", body: "- **Razorpay**: to process online payments (they receive the amount and payment identifiers; they show you their own privacy terms at payment time).\n- **Delhivery**: our courier partner receives the recipient name, phone, address and, for Cash on Delivery, the amount to collect, so your order can be delivered.\n- **Supabase**: our infrastructure provider, which hosts our database and authentication.\n\nEach partner receives only what it needs to perform its role." },
        { title: "Cookies and device storage", body: "We use your browser's local storage for functional purposes only: keeping you signed in, remembering your cart between visits, and caching your profile so pages load faster. Clearing your browser's site data removes these. We do not set third-party advertising cookies." },
        { title: "Retention and your choices", body: "Order records are retained as required for accounting and tax law. You can update your saved addresses and profile from your account. To request correction or deletion of your personal data, contact us using the details on the [Contact page](/contact) or email {supportEmail}. We respond to grievances as required by the Information Technology Act, 2000 and the Consumer Protection (E-Commerce) Rules, 2020." },
      ],
    },
  },
  {
    key: "page_legal_shipping",
    title: "Shipping policy",
    description: "How orders are shipped and delivered.",
    fields: [
      f("title", "Heading", "text"),
      f("updated", "Last updated", "text"),
      f("seoDescription", "Search description", "textarea"),
      f("sections", "Sections", "list", { fields: [f("title", "Section title", "text"), f("body", "Body", "richtext")] }),
    ],
    defaults: {
      title: "Shipping & Delivery Policy",
      updated: "31 August 2026",
      seoDescription: "How Core Atoms ships orders across India: serviceability, charges, timelines and tracking.",
      sections: [
        { title: "Where we deliver", body: "We ship across India through our courier partner **Delhivery**. Enter your pincode on any product page or at checkout to confirm serviceability and see the delivery estimate for your area before you order. Both prepaid and Cash on Delivery are supported on serviceable pincodes (COD availability can vary by location)." },
        { title: "Shipping charges", body: "The shipping charge for your order is calculated at checkout, based on your pincode where courier rates are available, or a flat rate otherwise, and is always itemised before you pay. Orders above the free-shipping threshold shown at checkout ship free. There are no hidden charges: for Cash on Delivery, the amount collected at your door is exactly the order total shown at checkout." },
        { title: "Dispatch and delivery timelines", body: "- Orders are typically dispatched within 1–2 business days of being placed.\n- Metro cities usually receive orders in 3–5 business days after dispatch.\n- Other serviceable locations usually take 5–7 business days; remote or out-of-delivery-area pincodes can take 7–10.\n\nThese are estimates, not guarantees. Courier delays, weather and regional disruptions can extend them. The tracking page always has the current status." },
        { title: "Tracking your order", body: "As soon as your order is handed to the courier, a tracking number (AWB) is assigned. You can follow the shipment live from [My Orders](/orders), which shows checkpoint-by-checkpoint progress, or on Delhivery's own tracking page via the link on your order." },
        { title: "If a delivery fails", body: "The courier attempts delivery multiple times and will usually contact the phone number on the order. If a shipment is returned to us undelivered, we will contact you to reship it or cancel and refund the order. If your package arrives damaged, please refuse the delivery if possible, or raise a replacement from [My Orders](/orders) with photos. See the [Cancellation, Refund & Replacement Policy](/refund-policy)." },
      ],
    },
  },
  {
    key: "page_legal_refund",
    title: "Refund & replacement policy",
    description: "Cancellation, refund and replacement rules. Keep in step with how orders actually behave.",
    fields: [
      f("title", "Heading", "text"),
      f("updated", "Last updated", "text"),
      f("seoDescription", "Search description", "textarea"),
      f("sections", "Sections", "list", { fields: [f("title", "Section title", "text"), f("body", "Body", "richtext")] }),
    ],
    defaults: {
      title: "Cancellation, Refund & Replacement Policy",
      updated: "31 August 2026",
      seoDescription: "When Core Atoms orders can be cancelled, how refunds are processed, and how damaged products are replaced.",
      sections: [
        { title: "Cancelling an order", body: "You can cancel an order yourself, with no phone call needed, from [My Orders](/orders) at any time while it is in the **\"Placed\"** or **\"Processing\"** state. Cancellation is immediate: stock is released, and any CoreCoins you redeemed on the order are returned to your wallet at the same moment.\n\nOnce an order status moves to \"Shipped\" it is with the courier and can no longer be cancelled from the site. If you no longer want a shipped order, you may refuse the delivery; once it returns to us we will process a refund of the product amount." },
        { title: "Refunds", body: "- **Prepaid orders**: refunds are issued to the original payment method through Razorpay, typically within 5–7 business days of the cancellation or return being confirmed. Your bank may take additional time to post it.\n- **Cash on Delivery orders**: if cancelled before delivery, no money has changed hands and there is nothing to refund. For a refused or returned COD delivery, any refund due is settled to your bank account after we receive the shipment back.\n- **CoreCoins**: coins redeemed on a cancelled order are re-credited automatically and in full." },
        { title: "Replacements for damaged or defective products", body: "Because these are consumable supplement products, we do not accept opened products back for change-of-mind returns. What we do stand behind is the condition the product reaches you in:\n\n- If your order arrives **damaged, defective, or incorrect**, raise a replacement from [My Orders](/orders) within the replacement window shown on your delivered order.\n- Attach clear photos of the damage; they are what our team reviews.\n- Approved replacements are shipped free of charge. Depending on the case, we may ship the replacement directly, arrange a doorstep pickup of the damaged product first, or exchange both in a single courier visit.\n\nThe replacement window and each request's live status are always visible on the order itself." },
        { title: "What is not covered", body: "- Change of mind after the product has been opened or used.\n- Damage caused by improper storage after delivery.\n- Requests raised after the replacement window on the order has closed." },
        { title: "Questions or disputes", body: "If you believe a refund or replacement was handled incorrectly, contact us via the [Contact page](/contact). Grievances are acknowledged and resolved within the timelines set by the Consumer Protection (E-Commerce) Rules, 2020." },
      ],
    },
  },
  {
    key: "page_errors",
    title: "Error pages",
    description: "The page-not-found and something-went-wrong screens.",
    fields: [
      f("notFoundTitle", "404 heading", "text"),
      f("notFoundText", "404 line", "textarea"),
      f("errorTitle", "Error heading", "text"),
      f("errorText", "Error fallback line", "textarea"),
    ],
    defaults: {
      notFoundTitle: "That page isn't on the label",
      notFoundText: "The address doesn't match anything on the site. It may have moved, or the link had a typo.",
      errorTitle: "Something went wrong",
      errorText: "Something went wrong while loading this page.",
    },
  },
];

export const PAGE_KEYS = PAGES.map((p) => p.key);
export const DEFAULTS = Object.fromEntries(PAGES.map((p) => [p.key, p.defaults]));
export const pageDef = (key) => PAGES.find((p) => p.key === key);
