/**
 * Desired store structure, as code (ENGINEERING items 81, 104). setup-store.ts makes the store match this.
 * Nothing here invents business facts: unknown values (delivery ranges, address) are left empty.
 */

export interface FieldDef { key: string; name: string; type: string; description?: string; validations?: Array<{ name: string; value: string }>; required?: boolean }

export const PRODUCT_METAFIELDS: Array<FieldDef & { storefront: 'PUBLIC_READ' | 'NONE'; filterable?: boolean }> = [
  { key: 'fabric', name: 'Fabric', type: 'single_line_text_field', storefront: 'PUBLIC_READ', description: 'For example "95% polyester, 5% elastane". Only what the supplier states.' },
  { key: 'care', name: 'Care instructions', type: 'list.single_line_text_field', storefront: 'PUBLIC_READ' },
  { key: 'fit_note', name: 'Fit note', type: 'single_line_text_field', storefront: 'PUBLIC_READ', description: 'Shown beside the size picker, for example "Runs small, we suggest one size up".' },
  { key: 'size_chart', name: 'Size chart', type: 'metaobject_reference', storefront: 'PUBLIC_READ' },
  { key: 'model_info', name: 'Model info', type: 'single_line_text_field', storefront: 'PUBLIC_READ', description: 'For example "Model is 175 cm and wears size M".' },
  { key: 'delivery_min_days', name: 'Delivery minimum (working days)', type: 'number_integer', storefront: 'PUBLIC_READ', description: 'Overrides the shop default for this product.' },
  { key: 'delivery_max_days', name: 'Delivery maximum (working days)', type: 'number_integer', storefront: 'PUBLIC_READ' },
  { key: 'price_history', name: 'Price history', type: 'json', storefront: 'PUBLIC_READ', description: 'Dated prices, e.g. [{"date":"2026-10-01","price":29.99}]. The only allowed proof for a compare-at price.' },
  { key: 'supplier_name', name: 'Supplier name', type: 'single_line_text_field', storefront: 'NONE', description: 'Operator only. Never shown on the storefront.' },
  { key: 'supplier_url', name: 'Supplier URL', type: 'url', storefront: 'NONE', description: 'Operator only.' },
  { key: 'supplier_sku', name: 'Supplier SKU', type: 'single_line_text_field', storefront: 'NONE', description: 'Operator only.' },
  { key: 'restricted_check', name: 'Restricted check passed', type: 'boolean', storefront: 'NONE', description: 'Set true only after the checks in OPERATOR_GUIDE section 2.' },
  { key: 'complete_the_look', name: 'Complete the look', type: 'list.product_reference', storefront: 'PUBLIC_READ' },
];

export interface MetaobjectDef { type: string; name: string; displayNameKey: string; fields: FieldDef[] }

export const METAOBJECTS: MetaobjectDef[] = [
  {
    type: 'size_chart', name: 'Size chart', displayNameKey: 'name',
    fields: [
      { key: 'name', name: 'Name', type: 'single_line_text_field', required: true },
      { key: 'unit_note', name: 'Unit note', type: 'single_line_text_field' },
      { key: 'rows', name: 'Rows (cm)', type: 'json', description: '[{"size":"S","chest":88,"waist":70,"hips":94,"length":62}]' },
      { key: 'how_to_measure', name: 'How to measure', type: 'rich_text_field' },
    ],
  },
  {
    type: 'trust_point', name: 'Trust point', displayNameKey: 'heading',
    fields: [
      { key: 'icon', name: 'Icon', type: 'single_line_text_field', validations: [{ name: 'choices', value: JSON.stringify(['delivery', 'returns', 'secure', 'gift', 'ruler']) }] },
      { key: 'heading', name: 'Heading', type: 'single_line_text_field', required: true },
      { key: 'text', name: 'Text', type: 'single_line_text_field' },
    ],
  },
  {
    type: 'faq_item', name: 'FAQ item', displayNameKey: 'question',
    fields: [
      { key: 'question', name: 'Question', type: 'single_line_text_field', required: true },
      { key: 'answer', name: 'Answer', type: 'rich_text_field', required: true },
      { key: 'topic', name: 'Topic', type: 'single_line_text_field', validations: [{ name: 'choices', value: JSON.stringify(['Delivery', 'Returns', 'Sizing', 'Payment', 'Orders']) }] },
    ],
  },
  {
    type: 'shop_info', name: 'Shop info', displayNameKey: 'label',
    fields: [
      { key: 'label', name: 'Label', type: 'single_line_text_field' },
      { key: 'processing_days', name: 'Processing time (working days)', type: 'number_integer' },
      { key: 'delivery_min_days', name: 'Default delivery minimum (working days)', type: 'number_integer' },
      { key: 'delivery_max_days', name: 'Default delivery maximum (working days)', type: 'number_integer' },
      { key: 'free_delivery_threshold', name: 'Free delivery threshold (£)', type: 'number_decimal' },
      { key: 'returns_window_days', name: 'Returns window (days)', type: 'number_integer' },
      { key: 'support_email', name: 'Support email', type: 'single_line_text_field' },
      { key: 'response_time', name: 'Reply time', type: 'single_line_text_field' },
    ],
  },
];

/** Facts stated in the brief. Delivery ranges and support email stay empty until the owner confirms them. */
export const SHOP_INFO_MAIN: Record<string, string> = {
  label: 'Ornis shop info',
  processing_days: '3',
  free_delivery_threshold: '30.0',
  returns_window_days: '14',
};

export const TRUST_POINTS = [
  { handle: 'free-delivery', icon: 'delivery', heading: 'Free UK delivery over £30', text: 'Standard delivery £4.99, express £6.99.' },
  { handle: 'returns', icon: 'returns', heading: '14-day returns', text: 'Changed your mind? Send it back within 14 days.' },
  { handle: 'secure-payment', icon: 'secure', heading: 'Secure payment', text: 'Pay with card, Apple Pay, Shop Pay or Klarna.' },
];

const rich = (...paragraphs: string[]) => JSON.stringify({ type: 'root', children: paragraphs.map((p) => ({ type: 'paragraph', children: [{ type: 'text', value: p }] })) });

export const FAQ_ITEMS = [
  { handle: 'delivery-cost', topic: 'Delivery', question: 'How much is delivery?', answer: rich('Standard UK delivery is £4.99, or free on orders over £30. Express delivery is £6.99.') },
  { handle: 'delivery-where', topic: 'Delivery', question: 'Where do you deliver?', answer: rich('We deliver to addresses in the United Kingdom only.') },
  { handle: 'delivery-time', topic: 'Delivery', question: 'How long will my order take?', answer: rich('Each product page shows an estimated delivery date before you buy. Our Delivery page explains processing and delivery times in full.') },
  { handle: 'separate-parcels', topic: 'Delivery', question: 'Why did my order arrive in more than one parcel?', answer: rich('Items in one order can ship from different places, so they may arrive in separate parcels on different days. You will not pay extra delivery for this.') },
  { handle: 'returns-window', topic: 'Returns', question: 'Can I return something?', answer: rich('Yes. You can return unworn items within 14 days of delivery. Our Returns page explains how to start a return.') },
  { handle: 'faulty-item', topic: 'Returns', question: 'What if my item is faulty or wrong?', answer: rich('Contact us with your order number and a photo of the problem. We will put it right with a replacement or a refund.') },
  { handle: 'size-help', topic: 'Sizing', question: 'How do I find my size?', answer: rich('Every clothing page has a Size guide link with measurements in centimetres and inches, plus notes on how the item fits.') },
  { handle: 'payment-methods', topic: 'Payment', question: 'How can I pay?', answer: rich('You can pay by Visa, Mastercard, American Express or Maestro, or with Shop Pay, Apple Pay, Google Pay, PayPal or Klarna.') },
  { handle: 'klarna', topic: 'Payment', question: 'Can I pay in instalments?', answer: rich('Yes. Choose Klarna at checkout to pay in 3 interest-free instalments, subject to Klarna approval.') },
  { handle: 'secure-checkout', topic: 'Payment', question: 'Is checkout secure?', answer: rich('Yes. Checkout and payment are handled by Shopify, which meets the PCI DSS security standard. We never see or store your card details.') },
  { handle: 'track-order', topic: 'Orders', question: 'How do I track my order?', answer: rich('When your order ships we email you a tracking link. You can also sign in to your account with your email address to see your orders.') },
  { handle: 'change-order', topic: 'Orders', question: 'Can I change or cancel my order?', answer: rich('Contact us as soon as possible with your order number. If your order has not been processed yet we will change or cancel it.') },
];

export interface CollectionPlan {
  handle: string;
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  rules?: Array<{ column: 'TAG' | 'VARIANT_PRICE' | 'TYPE'; relation: 'EQUALS' | 'LESS_THAN'; condition: string }>;
  disjunctive?: boolean;
  sortOrder?: 'BEST_SELLING' | 'CREATED_DESC' | 'MANUAL' | 'PRICE_ASC';
}

const col = (handle: string, title: string, description: string, rules?: CollectionPlan['rules'], extra: Partial<CollectionPlan> = {}): CollectionPlan => ({
  handle, title, description, rules, seoTitle: `${title} | Ornis`.slice(0, 60), seoDescription: '', sortOrder: 'CREATED_DESC', ...extra,
});
const tag = (t: string) => ({ column: 'TAG' as const, relation: 'EQUALS' as const, condition: t });

export const COLLECTIONS: CollectionPlan[] = [
  col('women', "Women's clothing", "Affordable women's clothing delivered across the UK, from knitwear and dresses to coats and loungewear. New styles are added every week, with free UK delivery on orders over £30.", [tag('gender:women')]),
  col('men', "Men's clothing", "Affordable men's clothing delivered across the UK, including knitwear, hoodies, jackets and jeans. Easy everyday pieces with free UK delivery on orders over £30.", [tag('gender:men')]),
  col('kids', "Kids' clothing", "Affordable kids' clothing for babies, girls and boys, delivered across the UK. Every item is checked against UK children's clothing safety rules before it goes on sale.", [tag('gender:kids')]),
  col('beauty', 'Beauty accessories', 'Make-up tools, hair accessories and beauty gifts, delivered across the UK. Free UK delivery on orders over £30.', [tag('category:beauty')]),
  col('gifts', 'Gifts', 'Gift ideas for everyone on your list, most under £25, delivered across the UK. Browse by budget or by who you are buying for.', [tag('gift')]),
  col('new-in', 'New in', 'The latest arrivals at Ornis, from cosy knitwear to accessories. New styles are added every week, delivered across the UK.', [tag('new')]),
  col('picked-for-you', 'Picked for you', 'A hand-picked edit of our favourite pieces this season, chosen by the Ornis team and delivered across the UK.', undefined, { sortOrder: 'MANUAL' }),
  col('sale', 'Sale', 'Genuine reductions on selected clothing and gifts, delivered across the UK. Every sale price is lower than the price the item really sold at before.', [tag('sale')]),
  col('gifts-under-15', 'Gifts under £15', 'Stocking fillers and small gifts under £15, delivered across the UK. Ideal for Secret Santa and little extras.', [tag('gift'), { column: 'VARIANT_PRICE', relation: 'LESS_THAN', condition: '15.00' }], { sortOrder: 'PRICE_ASC' }),
  col('gifts-under-25', 'Gifts under £25', 'Thoughtful gifts under £25, from knitwear to accessories, delivered across the UK.', [tag('gift'), { column: 'VARIANT_PRICE', relation: 'LESS_THAN', condition: '25.00' }], { sortOrder: 'PRICE_ASC' }),
  col('gifts-for-her', 'Gifts for her', 'Gift ideas for women, from cosy knitwear to accessories, delivered across the UK.', [tag('gift'), tag('gender:women')]),
  col('gifts-for-him', 'Gifts for him', 'Gift ideas for men, from jumpers to accessories, delivered across the UK.', [tag('gift'), tag('gender:men')]),
  col('gifts-for-kids', 'Gifts for kids', 'Gift ideas for children, from cosy clothing to stocking fillers, delivered across the UK.', [tag('gift'), tag('gender:kids')]),
];

/** Sub-categories for the mega menu. Empty ones are hidden by the theme automatically. */
export const SUBCATEGORIES: Record<string, Array<[string, string]>> = {
  women: [['knitwear', 'Knitwear'], ['dresses', 'Dresses'], ['tops', 'Tops'], ['coats-jackets', 'Coats and jackets'], ['trousers-jeans', 'Trousers and jeans'], ['loungewear', 'Loungewear'], ['accessories', 'Accessories']],
  men: [['knitwear', 'Knitwear'], ['hoodies-sweatshirts', 'Hoodies and sweatshirts'], ['tops', 'T-shirts and tops'], ['coats-jackets', 'Coats and jackets'], ['trousers-jeans', 'Trousers and jeans'], ['accessories', 'Accessories']],
  kids: [['girls', 'Girls'], ['boys', 'Boys'], ['baby', 'Baby']],
};

const KIDS_TITLES: Record<string, string> = { girls: "Girls' clothing", boys: "Boys' clothing", baby: 'Baby clothing' };

for (const [gender, cats] of Object.entries(SUBCATEGORIES)) {
  const label = gender === 'women' ? "Women's" : "Men's";
  for (const [slug, title] of cats) {
    if (gender === 'kids') {
      const t = KIDS_TITLES[slug];
      COLLECTIONS.push(col(`kids-${slug}`, t, `Affordable ${t.toLowerCase()} delivered across the UK. Every item is checked against UK children's clothing safety rules before it goes on sale.`, [tag('gender:kids'), tag(`kids:${slug}`)]));
    } else {
      COLLECTIONS.push(col(`${gender}-${slug}`, `${label} ${title.toLowerCase()}`, `Affordable ${label.toLowerCase()} ${title.toLowerCase()} delivered across the UK. Free UK delivery on orders over £30 and 14-day returns.`, [tag(`gender:${gender}`), tag(`category:${slug}`)]));
    }
  }
}
for (const c of COLLECTIONS) c.seoDescription = c.description.length > 155 ? `${c.description.slice(0, 152).replace(/\s+\S*$/, '')}.` : c.description;

export interface PagePlan { handle: string; title: string; templateSuffix?: string; file: string; seoDescription: string }

export const PAGES: PagePlan[] = [
  { handle: 'about', title: 'About Ornis', file: 'content/pages/about.html', seoDescription: 'Who runs Ornis, what we sell, how we choose and check every product, and where your order ships from. Affordable fashion and gifts for the UK.' },
  { handle: 'contact', title: 'Contact us', templateSuffix: 'contact', file: 'content/pages/contact.html', seoDescription: 'Contact Ornis about an order, a return or a product question. Send us a message and we will reply by email.' },
  { handle: 'delivery', title: 'Delivery', templateSuffix: 'delivery', file: 'content/pages/delivery.html', seoDescription: 'Ornis UK delivery: standard £4.99, free over £30, express £6.99. Processing times, tracking and Christmas last order dates.' },
  { handle: 'returns', title: 'Returns and exchanges', templateSuffix: 'returns', file: 'content/pages/returns.html', seoDescription: 'How to return or exchange an Ornis order within 14 days, how refunds work, and what to do if an item arrives faulty.' },
  { handle: 'size-guide', title: 'Size guide', templateSuffix: 'size-guide', file: 'content/pages/size-guide.html', seoDescription: 'Ornis size charts for women, men and kids in centimetres and inches, with simple steps for measuring yourself at home.' },
  { handle: 'faq', title: 'Frequently asked questions', templateSuffix: 'faq', file: 'content/pages/faq.html', seoDescription: 'Answers to common questions about Ornis delivery, returns, sizing, payment and orders.' },
  { handle: 'track-order', title: 'Track my order', templateSuffix: 'track-order', file: 'content/pages/track-order.html', seoDescription: 'Track your Ornis order with the link in your shipping email, or sign in with your email address to see your orders.' },
  { handle: 'gift-guide', title: 'Christmas gift guide', templateSuffix: 'gift-guide', file: 'content/pages/gift-guide.html', seoDescription: 'The Ornis Christmas gift guide: presents under £15 and £25, and gifts for her, him and the kids, delivered across the UK.' },
  { handle: 'accessibility', title: 'Accessibility statement', file: 'content/pages/accessibility.html', seoDescription: 'How Ornis makes its online shop accessible, the standard we aim for, and how to tell us about any problem you find.' },
  { handle: 'cookie-policy', title: 'Cookie policy', file: 'content/pages/cookie-policy.html', seoDescription: 'Which cookies the Ornis website uses, why, and how to accept, reject or change your choice at any time.' },
];

export interface MenuItemPlan { title: string; collection?: string; page?: string; url?: string; items?: MenuItemPlan[] }

export const MENUS: Array<{ handle: string; title: string; items: MenuItemPlan[] }> = [
  {
    handle: 'main-menu', title: 'Main menu',
    items: [
      { title: 'Women', collection: 'women', items: SUBCATEGORIES.women.map(([slug, t]) => ({ title: t, collection: `women-${slug}` })) },
      { title: 'Men', collection: 'men', items: SUBCATEGORIES.men.map(([slug, t]) => ({ title: t, collection: `men-${slug}` })) },
      { title: 'Kids', collection: 'kids', items: SUBCATEGORIES.kids.map(([slug, t]) => ({ title: t, collection: `kids-${slug}` })) },
      { title: 'Beauty', collection: 'beauty' },
      { title: 'Gifts', collection: 'gifts', items: [
        { title: 'Gifts under £15', collection: 'gifts-under-15' }, { title: 'Gifts under £25', collection: 'gifts-under-25' },
        { title: 'For her', collection: 'gifts-for-her' }, { title: 'For him', collection: 'gifts-for-him' }, { title: 'For kids', collection: 'gifts-for-kids' },
        { title: 'Gift guide', page: 'gift-guide' },
      ] },
      { title: 'Sale', collection: 'sale' },
    ],
  },
  { handle: 'footer-shop', title: 'Shop', items: [{ title: 'Women', collection: 'women' }, { title: 'Men', collection: 'men' }, { title: 'Kids', collection: 'kids' }, { title: 'Beauty', collection: 'beauty' }, { title: 'Gifts', collection: 'gifts' }, { title: 'New in', collection: 'new-in' }] },
  { handle: 'footer-help', title: 'Help', items: [{ title: 'Contact us', page: 'contact' }, { title: 'Delivery', page: 'delivery' }, { title: 'Returns', page: 'returns' }, { title: 'Size guide', page: 'size-guide' }, { title: 'FAQ', page: 'faq' }, { title: 'Track my order', page: 'track-order' }] },
  { handle: 'footer-about', title: 'About', items: [{ title: 'About Ornis', page: 'about' }, { title: 'Accessibility', page: 'accessibility' }, { title: 'Cookie policy', page: 'cookie-policy' }, { title: 'Privacy policy', url: '/policies/privacy-policy' }, { title: 'Terms of service', url: '/policies/terms-of-service' }, { title: 'Refund policy', url: '/policies/refund-policy' }, { title: 'Shipping policy', url: '/policies/shipping-policy' }] },
];

/** Collections from the audit that are wrong or leftovers: hidden from the Online Store (never deleted) and redirected. */
export const RETIRED_COLLECTIONS: Array<{ handle: string; redirectTo: string }> = [
  { handle: 'personal-care', redirectTo: '/collections/men' },
  { handle: 'health-care', redirectTo: '/collections/kids' },
  { handle: 'beauty-example-products', redirectTo: '/collections/beauty' },
  { handle: 'home-page', redirectTo: '/' },
  { handle: 'fashion-and-apparel', redirectTo: '/collections/women' },
];
