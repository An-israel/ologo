/**
 * Sample data for the local preview server. Illustrative only: these are drawn sample products used to check
 * layout, accessibility and behaviour before the real catalogue is connected. They are never uploaded to the store.
 */
export interface Img { name: string; shape: string; colour: string; width: number; height: number; alt: string }

export interface FixtureVariant { colour?: string; size?: string; price: number; available: boolean; qty: number }

export interface FixtureProduct {
  handle: string; title: string; type: string; tags: string[]; description: string;
  options: string[]; variants: FixtureVariant[]; images: Img[];
  fabric?: string; care?: string[]; fitNote?: string; modelInfo?: string; sizeChart?: string; createdDaysAgo: number;
  completeTheLook?: string[];
}

const img = (handle: string, i: number, shape: string, colour: string, alt: string): Img => ({ name: `${handle}-${i + 1}`, shape, colour, width: 1536, height: 2048, alt });

const desc = (lead: string, bullets: string[]) => `<p>${lead}</p><ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`;

function variants(options: string[], colours: string[], sizes: string[], price: number, soldOut: string[] = []): FixtureVariant[] {
  const out: FixtureVariant[] = [];
  const cs = colours.length ? colours : [undefined];
  const ss = sizes.length ? sizes : [undefined];
  for (const c of cs) for (const s of ss) {
    const key = `${c ?? ''}/${s ?? ''}`;
    const out_ = soldOut.includes(key);
    out.push({ colour: c, size: s, price, available: !out_, qty: out_ ? 0 : key.endsWith('/L') ? 3 : 20 });
  }
  return options.length ? out : [{ price, available: true, qty: 20 }];
}

export const PRODUCTS: FixtureProduct[] = [
  {
    handle: 'womens-cable-knit-jumper', title: "Women's Cable Knit Jumper", type: 'Jumper', tags: ['gender:women', 'category:knitwear', 'season:winter', 'gift', 'new'],
    description: desc('A chunky cable knit jumper that keeps you warm without feeling bulky. The relaxed fit sits just below the hip, with ribbed cuffs and a soft crew neck. Wear it over a shirt for the office or with jeans and boots at the weekend.', ['Relaxed fit, hip length', 'Crew neck with ribbed cuffs and hem', 'Mid-weight cable knit']),
    options: ['Colour', 'Size'], variants: variants(['Colour', 'Size'], ['Cream', 'Navy'], ['XS', 'S', 'M', 'L', 'XL'], 2499, ['Navy/XS']),
    images: [img('womens-cable-knit-jumper', 0, 'jumper', '#efe6d2', "Women's Cable Knit Jumper in Cream, front view"), img('womens-cable-knit-jumper', 1, 'jumper', '#e4d8bf', "Women's Cable Knit Jumper in Cream, worn with jeans"), img('womens-cable-knit-jumper', 2, 'jumper', '#2b3a5c', "Women's Cable Knit Jumper in Navy, front view"), img('womens-cable-knit-jumper', 3, 'detail', '#efe6d2', "Women's Cable Knit Jumper, cable detail")],
    fabric: '60% acrylic, 40% polyester', care: ['Machine wash at 30°C', 'Do not tumble dry', 'Dry flat'], fitNote: 'Relaxed fit. Take your usual size.', modelInfo: 'Model is 175 cm and wears size S', sizeChart: 'womens-tops', createdDaysAgo: 6,
    completeTheLook: ['chunky-knit-scarf', 'cable-knit-beanie'],
  },
  {
    handle: 'mens-slim-stretch-denim-jeans', title: "Men's Slim Stretch Denim Jeans", type: 'Jeans', tags: ['gender:men', 'category:trousers-jeans', 'season:all'],
    description: desc('Slim jeans with a little stretch, so they move with you all day. A mid rise and tapered leg give a clean shape that works with trainers or boots.', ['Slim fit, mid rise', 'Five pockets', 'Stretch denim']),
    options: ['Colour', 'Size'], variants: variants(['Colour', 'Size'], ['Denim Blue', 'Black'], ['S', 'M', 'L', 'XL', 'XXL'], 2999),
    images: [0, 1, 2, 3].map((i) => img('mens-slim-stretch-denim-jeans', i, 'jeans', i === 2 ? '#1d1f24' : '#4a6a8f', `Men's Slim Stretch Denim Jeans in ${i === 2 ? 'Black' : 'Denim Blue'}, ${['front view', 'worn', 'front view', 'back view'][i]}`)),
    fabric: '98% cotton, 2% elastane', care: ['Machine wash at 30°C inside out'], fitNote: 'Slim fit. If you are between sizes, take the larger size.', sizeChart: 'mens-bottoms', createdDaysAgo: 12,
  },
  {
    handle: 'womens-ribbed-midi-dress', title: "Women's Ribbed Midi Dress", type: 'Dress', tags: ['gender:women', 'category:dresses', 'season:winter'],
    description: desc('A ribbed knit midi dress with long sleeves and a close fit. Add boots and a coat for winter days, or trainers for the weekend.', ['Close fit, midi length', 'Long sleeves', 'Soft rib knit']),
    options: ['Colour', 'Size'], variants: variants(['Colour', 'Size'], ['Black', 'Sage Green'], ['XS', 'S', 'M', 'L'], 2799),
    images: [0, 1, 2, 3].map((i) => img('womens-ribbed-midi-dress', i, 'dress', i < 2 ? '#1d1f24' : '#9cb8a0', `Women's Ribbed Midi Dress in ${i < 2 ? 'Black' : 'Sage Green'}, ${['front view', 'worn', 'front view', 'detail'][i]}`)),
    fabric: '95% polyester, 5% elastane', sizeChart: 'womens-tops', createdDaysAgo: 20,
  },
  {
    handle: 'mens-fleece-hoodie', title: "Men's Fleece Hoodie", type: 'Hoodie', tags: ['gender:men', 'category:hoodies-sweatshirts', 'season:winter', 'gift', 'new'],
    description: desc('A soft brushed fleece hoodie with a roomy kangaroo pocket. Easy to layer and easy to wash.', ['Regular fit', 'Lined hood', 'Kangaroo pocket']),
    options: ['Colour', 'Size'], variants: variants(['Colour', 'Size'], ['Grey', 'Navy'], ['S', 'M', 'L', 'XL', 'XXL'], 2499, ['Grey/M', 'Navy/M']),
    images: [0, 1, 2, 3].map((i) => img('mens-fleece-hoodie', i, 'hoodie', i < 2 ? '#8b8f96' : '#2b3a5c', `Men's Fleece Hoodie in ${i < 2 ? 'Grey' : 'Navy'}, ${['front view', 'worn', 'front view', 'back view'][i]}`)),
    fabric: '80% cotton, 20% polyester', sizeChart: 'mens-tops', createdDaysAgo: 3,
  },
  {
    handle: 'kids-padded-jacket', title: "Kids' Padded Jacket", type: 'Coat', tags: ['gender:kids', 'kids:boys', 'kids:girls', 'season:winter'],
    description: desc('A warm padded jacket with a zip front and snap-close pockets. No cords or drawstrings at the hood or neck.', ['Regular fit', 'Zip front', 'Fixed hood with no drawstrings']),
    options: ['Colour', 'Size'], variants: variants(['Colour', 'Size'], ['Navy'], ['2-3 years', '4-5 years', '6-7 years', '8-9 years'], 2299),
    images: [0, 1, 2, 3].map((i) => img('kids-padded-jacket', i, 'jacket', '#2b3a5c', `Kids' Padded Jacket in Navy, ${['front view', 'worn', 'back view', 'detail'][i]}`)),
    fabric: '100% polyester', sizeChart: 'kids', createdDaysAgo: 40,
  },
  {
    handle: 'chunky-knit-scarf', title: 'Chunky Knit Scarf', type: 'Scarf', tags: ['gender:women', 'category:accessories', 'season:winter', 'gift'],
    description: desc('A long, chunky knit scarf that wraps twice. Soft and warm, and a simple gift.', ['180 cm long', 'Ribbed knit', 'Fringed ends']),
    options: ['Colour'], variants: variants(['Colour'], ['Cream', 'Burgundy', 'Grey'], [], 1299),
    images: [0, 1, 2, 3].map((i) => img('chunky-knit-scarf', i, 'scarf', ['#efe6d2', '#efe6d2', '#6b1d2c', '#8b8f96'][i], `Chunky Knit Scarf in ${['Cream', 'Cream', 'Burgundy', 'Grey'][i]}, ${['flat', 'worn', 'flat', 'flat'][i]}`)),
    createdDaysAgo: 9,
  },
  {
    handle: 'cable-knit-beanie', title: 'Cable Knit Beanie', type: 'Hat', tags: ['gender:women', 'category:accessories', 'season:winter', 'gift'],
    description: desc('A warm cable knit beanie with a fold-up cuff.', ['One size', 'Fold-up cuff']),
    options: [], variants: variants([], [], [], 999),
    images: [0, 1, 2, 3].map((i) => img('cable-knit-beanie', i, 'beanie', '#efe6d2', `Cable Knit Beanie in Cream, ${['front view', 'worn', 'side view', 'detail'][i]}`)),
    createdDaysAgo: 15,
  },
  {
    handle: 'makeup-brush-set', title: 'Make-up Brush Set, 10 Pieces', type: 'Make-up tools', tags: ['category:beauty', 'season:all', 'gift'],
    description: desc('Ten soft synthetic brushes for face and eyes, in a zip pouch.', ['10 brushes', 'Synthetic bristles', 'Zip pouch included']),
    options: [], variants: variants([], [], [], 1499),
    images: [0, 1, 2, 3].map((i) => img('makeup-brush-set', i, 'brushes', '#d9c8ab', `Make-up Brush Set, ${['all brushes', 'in pouch', 'face brush', 'eye brushes'][i]}`)),
    createdDaysAgo: 50,
  },
];

export const COLLECTIONS: Array<{ handle: string; title: string; description: string; filter: (p: FixtureProduct) => boolean }> = [
  { handle: 'all', title: 'All products', description: '', filter: () => true },
  { handle: 'women', title: "Women's clothing", description: "Affordable women's clothing delivered across the UK, from knitwear and dresses to coats and loungewear. New styles are added every week, with free UK delivery on orders over £30.", filter: (p) => p.tags.includes('gender:women') },
  { handle: 'men', title: "Men's clothing", description: "Affordable men's clothing delivered across the UK, including knitwear, hoodies, jackets and jeans.", filter: (p) => p.tags.includes('gender:men') },
  { handle: 'kids', title: "Kids' clothing", description: "Affordable kids' clothing delivered across the UK, checked against UK children's clothing safety rules.", filter: (p) => p.tags.includes('gender:kids') },
  { handle: 'beauty', title: 'Beauty accessories', description: 'Make-up tools and hair accessories, delivered across the UK.', filter: (p) => p.tags.includes('category:beauty') },
  { handle: 'gifts', title: 'Gifts', description: 'Gift ideas for everyone on your list, most under £25, delivered across the UK.', filter: (p) => p.tags.includes('gift') },
  { handle: 'new-in', title: 'New in', description: 'The latest arrivals at Ornis.', filter: (p) => p.tags.includes('new') || p.createdDaysAgo < 30 },
  { handle: 'picked-for-you', title: 'Picked for you', description: 'A hand-picked edit of our favourite pieces this season.', filter: (p) => ['womens-ribbed-midi-dress', 'mens-slim-stretch-denim-jeans', 'kids-padded-jacket', 'makeup-brush-set', 'chunky-knit-scarf', 'mens-fleece-hoodie', 'cable-knit-beanie', 'womens-cable-knit-jumper'].includes(p.handle) },
  { handle: 'sale', title: 'Sale', description: '', filter: () => false },
  { handle: 'gifts-under-15', title: 'Gifts under £15', description: 'Stocking fillers and small gifts under £15.', filter: (p) => p.tags.includes('gift') && p.variants[0].price < 1500 },
  { handle: 'gifts-under-25', title: 'Gifts under £25', description: 'Thoughtful gifts under £25.', filter: (p) => p.tags.includes('gift') && p.variants[0].price < 2500 },
  { handle: 'gifts-for-her', title: 'Gifts for her', description: '', filter: (p) => p.tags.includes('gift') && p.tags.includes('gender:women') },
  { handle: 'gifts-for-him', title: 'Gifts for him', description: '', filter: (p) => p.tags.includes('gift') && p.tags.includes('gender:men') },
  { handle: 'gifts-for-kids', title: 'Gifts for kids', description: '', filter: (p) => p.tags.includes('gift') && p.tags.includes('gender:kids') },
  { handle: 'women-knitwear', title: "Women's knitwear", description: '', filter: (p) => p.tags.includes('gender:women') && p.tags.includes('category:knitwear') },
  { handle: 'women-dresses', title: "Women's dresses", description: '', filter: (p) => p.tags.includes('gender:women') && p.tags.includes('category:dresses') },
  { handle: 'women-accessories', title: "Women's accessories", description: '', filter: (p) => p.tags.includes('gender:women') && p.tags.includes('category:accessories') },
  { handle: 'men-hoodies-sweatshirts', title: "Men's hoodies and sweatshirts", description: '', filter: (p) => p.tags.includes('category:hoodies-sweatshirts') },
  { handle: 'men-trousers-jeans', title: "Men's trousers and jeans", description: '', filter: (p) => p.tags.includes('gender:men') && p.tags.includes('category:trousers-jeans') },
  { handle: 'kids-girls', title: "Girls' clothing", description: '', filter: (p) => p.tags.includes('kids:girls') },
  { handle: 'kids-boys', title: "Boys' clothing", description: '', filter: (p) => p.tags.includes('kids:boys') },
];

export const SIZE_CHARTS: Record<string, { name: string; unit_note: string; rows: Array<Record<string, string | number>>; how: string }> = {
  'womens-tops': { name: "Women's tops and knitwear", unit_note: 'Body measurements.', rows: [{ size: 'XS', chest: 80, waist: 62, hips: 88 }, { size: 'S', chest: 84, waist: 66, hips: 92 }, { size: 'M', chest: 90, waist: 72, hips: 98 }, { size: 'L', chest: 96, waist: 78, hips: 104 }, { size: 'XL', chest: 102, waist: 84, hips: 110 }], how: 'Measure around the fullest part of your chest, keeping the tape level.' },
  'mens-bottoms': { name: "Men's trousers and jeans", unit_note: 'Body measurements.', rows: [{ size: 'S', waist: 76, hips: 92 }, { size: 'M', waist: 82, hips: 98 }, { size: 'L', waist: 88, hips: 104 }, { size: 'XL', waist: 94, hips: 110 }, { size: 'XXL', waist: 100, hips: 116 }], how: 'Measure around your natural waist.' },
  'mens-tops': { name: "Men's tops", unit_note: 'Body measurements.', rows: [{ size: 'S', chest: 92 }, { size: 'M', chest: 98 }, { size: 'L', chest: 104 }, { size: 'XL', chest: 110 }, { size: 'XXL', chest: 116 }], how: 'Measure around the fullest part of your chest.' },
  kids: { name: "Kids' coats", unit_note: 'Body measurements by age.', rows: [{ size: '2-3 years', chest: 54, length: 38 }, { size: '4-5 years', chest: 58, length: 42 }, { size: '6-7 years', chest: 62, length: 47 }, { size: '8-9 years', chest: 68, length: 52 }], how: 'Measure around the chest under the arms.' },
};

export const FAQ = [
  { question: 'How much is delivery?', answer: 'Standard UK delivery is £4.99, or free on orders over £30. Express delivery is £6.99.', topic: 'Delivery' },
  { question: 'Can I return something?', answer: 'Yes. You can return unworn items within 14 days of delivery.', topic: 'Returns' },
  { question: 'How do I find my size?', answer: 'Every clothing page has a Size guide link with measurements in centimetres and inches.', topic: 'Sizing' },
  { question: 'Can I pay in instalments?', answer: 'Yes. Choose Klarna at checkout to pay in 3 interest-free instalments, subject to approval.', topic: 'Payment' },
  { question: 'How do I track my order?', answer: 'When your order ships we email you a tracking link.', topic: 'Orders' },
];
