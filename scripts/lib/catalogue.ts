/**
 * Loads products with variants, media and metafields in one paginated query (no N+1 lookups, item 27),
 * asking only for the fields the scripts use (item 26).
 */
import type { ShopifyClient } from './shopify.js';

export interface Variant {
  id: string;
  title: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  selectedOptions: Array<{ name: string; value: string }>;
  inventoryQuantity: number | null;
  weightGrams: number | null;
  unitCost: number | null;
  imageId: string | null;
}

export interface MediaImage { id: string; url: string; alt: string | null }

export interface Product {
  id: string;
  handle: string;
  title: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  descriptionHtml: string;
  productType: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  onlineStoreUrl: string | null;
  seo: { title: string | null; description: string | null };
  options: Array<{ id: string; name: string; position: number; optionValues: Array<{ id: string; name: string }> }>;
  variants: Variant[];
  images: MediaImage[];
  metafields: Record<string, string | null>;
}

const METAFIELD_KEYS = ['fabric', 'care', 'fit_note', 'size_chart', 'model_info', 'delivery_min_days', 'delivery_max_days', 'price_history', 'supplier_name', 'supplier_url', 'supplier_sku', 'restricted_check', 'complete_the_look'];

export const PRODUCT_FIELDS = `
  id handle title status descriptionHtml productType tags createdAt updatedAt onlineStoreUrl
  seo { title description }
  options { id name position optionValues { id name } }
  variants(first: 100) {
    nodes {
      id title sku price compareAtPrice inventoryQuantity
      selectedOptions { name value }
      image { id }
      inventoryItem { unitCost { amount } measurement { weight { unit value } } }
    }
  }
  media(first: 20) { nodes { ... on MediaImage { id alt image { url } } } }
  ${METAFIELD_KEYS.map((k) => `mf_${k}: metafield(namespace: "custom", key: "${k}") { value }`).join('\n  ')}
`;

const toGrams = (w?: { unit: string; value: number } | null): number | null => {
  if (!w) return null;
  const factor: Record<string, number> = { GRAMS: 1, KILOGRAMS: 1000, OUNCES: 28.3495, POUNDS: 453.592 };
  return Math.round(w.value * (factor[w.unit] ?? 1));
};

export function normaliseProduct(node: any): Product {
  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    status: node.status,
    descriptionHtml: node.descriptionHtml ?? '',
    productType: node.productType ?? '',
    tags: node.tags ?? [],
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    onlineStoreUrl: node.onlineStoreUrl,
    seo: node.seo ?? { title: null, description: null },
    options: node.options ?? [],
    variants: (node.variants?.nodes ?? []).map((v: any) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      price: Number(v.price),
      compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
      selectedOptions: v.selectedOptions ?? [],
      inventoryQuantity: v.inventoryQuantity,
      weightGrams: toGrams(v.inventoryItem?.measurement?.weight),
      unitCost: v.inventoryItem?.unitCost?.amount ? Number(v.inventoryItem.unitCost.amount) : null,
      imageId: v.image?.id ?? null,
    })),
    images: (node.media?.nodes ?? []).filter((m: any) => m?.image).map((m: any) => ({ id: m.id, url: m.image.url, alt: m.alt })),
    metafields: Object.fromEntries(METAFIELD_KEYS.map((k) => [k, node[`mf_${k}`]?.value ?? null])),
  };
}

export async function* allProducts(client: ShopifyClient, search = ''): AsyncGenerator<Product> {
  const query = `query($after: String, $q: String) { products(first: 10, after: $after, query: $q, sortKey: CREATED_AT) { pageInfo { hasNextPage endCursor } nodes { ${PRODUCT_FIELDS} } } }`;
  for await (const node of client.paginate<any>(query, ['products'], { q: search || null }, 900)) yield normaliseProduct(node);
}

export async function productByHandle(client: ShopifyClient, handle: string): Promise<Product | null> {
  const data = await client.request(`query($h: String!) { productByIdentifier(identifier: { handle: $h }) { ${PRODUCT_FIELDS} } }`, { h: handle }, 300);
  return data.productByIdentifier ? normaliseProduct(data.productByIdentifier) : null;
}

export function optionIndex(product: Product, names: string[]): number {
  return product.options.findIndex((o) => names.includes(o.name.toLowerCase()));
}
