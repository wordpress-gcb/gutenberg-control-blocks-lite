import { WP_BLOCK_REGISTRY } from './WPBlockRegistry';

/**
 * The route receives the slug WITHOUT the `gcb/` prefix (it comes from the URL
 * path), but the registry is keyed with the full WP name. Reattach the prefix
 * for lookup so the registry reads like a real WP block list.
 */
export function getComponentBySlug(slug) {
  return WP_BLOCK_REGISTRY[`gcb/${slug}`] || null;
}
