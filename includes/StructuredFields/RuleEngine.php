<?php
/**
 * Shared rule evaluator for the four structured-field registrars.
 *
 * Each registrar (post / taxonomy / options / user) constructs a
 * `$context` array describing what's being edited (post type, term id,
 * user role, etc.) and asks the engine whether a registered field set's
 * `displayWhen` rules pass.
 *
 * ## Shape
 *
 * The `displayWhen` config key accepts:
 *
 * - **Single rule**:
 *     `displayWhen: { key, operator, value }`
 *
 * - **Implicit AND** (an array of single rules):
 *     `displayWhen: [{...}, {...}]`
 *
 * - **Explicit AND/OR groups**:
 *     `displayWhen: { all: [{...}], any: [{ all: [...] }, ...] }`
 *
 * Missing `displayWhen` means "always show" — same behaviour as before
 * conditional registration shipped.
 *
 * ## Supported keys
 *
 * | key            | typical operator             | meaning                              |
 * |----------------|------------------------------|--------------------------------------|
 * | post_type      | =, !=, in, not_in            | current post type                    |
 * | post_id        | =, !=, in, not_in, >, <, etc | specific post being edited           |
 * | post_template  | =, !=                        | page template slug                   |
 * | post_status    | =, !=                        | publish, draft, etc.                 |
 * | post_parent    | =, !=, in                    | parent page id                       |
 * | taxonomy_term  | contains, not_contains       | value: { taxonomy, term }            |
 * | user_role      | =, !=, in                    | role of editing user (or target user)|
 * | current_user_id| =, in                        | id of viewer                         |
 *
 * Unknown keys evaluate to `false` — fail-safe: a typo'd rule hides the
 * panel rather than showing it everywhere.
 *
 * @package GCBLite\StructuredFields
 */

namespace GCBLite\StructuredFields;

if (!defined('ABSPATH')) {
    exit;
}

class RuleEngine {

    /**
     * Top-level entry: should this config be active given the context?
     * Configs without a `displayWhen` clause are always active.
     */
    public static function matches(array $config, array $context) {
        if (empty($config['displayWhen'])) return true;
        return self::evaluate($config['displayWhen'], $context);
    }

    /**
     * Evaluate any of the supported shapes (single rule, implicit AND
     * array, explicit all/any groups). Recursive because `any` branches
     * can themselves contain groups.
     */
    public static function evaluate($rules, array $context) {
        if (empty($rules)) return true;

        // Explicit any/all envelope.
        if (is_array($rules) && (isset($rules['all']) || isset($rules['any']))) {
            $ok = true;
            if (isset($rules['all'])) {
                foreach ((array) $rules['all'] as $sub) {
                    if (!self::evaluate($sub, $context)) { $ok = false; break; }
                }
            }
            if ($ok && isset($rules['any'])) {
                $ok = false;
                foreach ((array) $rules['any'] as $sub) {
                    if (self::evaluate($sub, $context)) { $ok = true; break; }
                }
            }
            return $ok;
        }

        // Single-rule shape: { key, operator, value }.
        if (is_array($rules) && isset($rules['key'])) {
            return self::evaluate_rule($rules, $context);
        }

        // Implicit AND: a flat array of single rules.
        if (is_array($rules)) {
            foreach ($rules as $sub) {
                if (!self::evaluate($sub, $context)) return false;
            }
            return true;
        }

        return true;
    }

    /**
     * Evaluate ONE leaf rule against the context. Returns false on any
     * shape oddness so a malformed rule hides rather than over-shares.
     */
    private static function evaluate_rule(array $rule, array $context) {
        $key      = $rule['key']      ?? null;
        $operator = $rule['operator'] ?? '=';
        $value    = $rule['value']    ?? null;
        if (!$key) return false;

        $actual = self::context_value($key, $context);
        return self::compare($actual, $operator, $value, $key);
    }

    /**
     * Pull the value for a known key out of the context. Returns null for
     * unknown keys — the caller's compare() then short-circuits to false.
     */
    private static function context_value($key, array $context) {
        if ($key === 'taxonomy_term') {
            // Special: caller must have populated `post_terms` so we can
            // check membership without re-querying.
            return $context['post_terms'] ?? [];
        }
        return $context[$key] ?? null;
    }

    /**
     * One-shot comparison. Operator names match the React Schema
     * Builder's conditional-logic UI vocabulary so authors only learn
     * one set.
     */
    private static function compare($actual, $operator, $expected, $key) {
        switch ($operator) {
            case '=':
            case '==':
                return self::scalar_equals($actual, $expected);

            case '!=':
                return !self::scalar_equals($actual, $expected);

            case 'in':
                if (!is_array($expected)) return false;
                foreach ($expected as $exp) {
                    if (self::scalar_equals($actual, $exp)) return true;
                }
                return false;

            case 'not_in':
                if (!is_array($expected)) return true;
                foreach ($expected as $exp) {
                    if (self::scalar_equals($actual, $exp)) return false;
                }
                return true;

            case 'contains':
                // For taxonomy_term: $expected is { taxonomy, term }.
                if ($key === 'taxonomy_term' && is_array($expected)) {
                    $tax  = $expected['taxonomy'] ?? '';
                    $term = $expected['term']     ?? '';
                    if (!$tax || !$term) return false;
                    $terms = is_array($actual) ? ($actual[$tax] ?? []) : [];
                    foreach ($terms as $t) {
                        if (self::scalar_equals($t, $term)) return true;
                    }
                    return false;
                }
                // Generic string-contains for everything else.
                return is_string($actual) && is_string($expected)
                    && $expected !== ''
                    && strpos($actual, $expected) !== false;

            case 'not_contains':
                return !self::compare($actual, 'contains', $expected, $key);

            case '>':  return is_numeric($actual) && is_numeric($expected) && (float) $actual >  (float) $expected;
            case '>=': return is_numeric($actual) && is_numeric($expected) && (float) $actual >= (float) $expected;
            case '<':  return is_numeric($actual) && is_numeric($expected) && (float) $actual <  (float) $expected;
            case '<=': return is_numeric($actual) && is_numeric($expected) && (float) $actual <= (float) $expected;

            case 'empty':
                return $actual === null || $actual === '' || $actual === [];

            case 'not_empty':
                return !($actual === null || $actual === '' || $actual === []);
        }
        return false;
    }

    /**
     * Soft equality — int 42 should match string "42" in author-facing
     * config. WP often hands us strings from $_REQUEST that we compare
     * against ints in schema files.
     */
    private static function scalar_equals($a, $b) {
        if (is_numeric($a) && is_numeric($b)) {
            return (float) $a === (float) $b;
        }
        return (string) $a === (string) $b;
    }

    // ------------------------------------------------------------------
    // Context builders — one per surface. Registrars call these to get a
    // standard context shape before asking matches(). Kept here so the
    // shape and key vocabulary stay consistent across the four surfaces.
    // ------------------------------------------------------------------

    /**
     * Build the context for a post-edit screen. Pass the post object or
     * id; the rest is derived. Reads from the post; doesn't depend on a
     * global $post.
     */
    public static function context_for_post($post_or_id) {
        $post = is_object($post_or_id) ? $post_or_id : get_post($post_or_id);
        if (!$post) return [];

        $template = get_page_template_slug($post->ID);

        // Collect taxonomies this post is in so taxonomy_term rules can
        // evaluate without another query per rule.
        $post_terms = [];
        $taxonomies = get_object_taxonomies($post->post_type);
        foreach ($taxonomies as $tax) {
            $terms = wp_get_post_terms($post->ID, $tax, ['fields' => 'slugs']);
            if (!is_wp_error($terms) && is_array($terms)) {
                $post_terms[$tax] = $terms;
            }
        }

        return [
            'post_type'       => $post->post_type,
            'post_id'         => (int) $post->ID,
            'post_template'   => $template ?: '',
            'post_status'     => $post->post_status,
            'post_parent'     => (int) $post->post_parent,
            'post_terms'      => $post_terms,
            'current_user_id' => get_current_user_id(),
            'user_role'       => self::primary_role(get_current_user_id()),
        ];
    }

    /**
     * Build the context for a term-edit screen.
     */
    public static function context_for_term($term_or_id, $taxonomy = '') {
        $term = is_object($term_or_id) ? $term_or_id : get_term($term_or_id, $taxonomy);
        if (!$term || is_wp_error($term)) return [];
        return [
            'taxonomy'        => $term->taxonomy,
            'term_id'         => (int) $term->term_id,
            'current_user_id' => get_current_user_id(),
            'user_role'       => self::primary_role(get_current_user_id()),
        ];
    }

    /**
     * Build the context for an options page render.
     */
    public static function context_for_options($slug) {
        return [
            'options_slug'    => $slug,
            'current_user_id' => get_current_user_id(),
            'user_role'       => self::primary_role(get_current_user_id()),
        ];
    }

    /**
     * Build the context for a user-edit screen.
     */
    public static function context_for_user($target_user_id) {
        $target = get_userdata($target_user_id);
        return [
            'target_user_id'  => (int) $target_user_id,
            'user_role'       => $target ? (self::primary_role($target_user_id)) : '',
            'current_user_id' => get_current_user_id(),
        ];
    }

    private static function primary_role($user_id) {
        $u = get_userdata($user_id);
        if (!$u || empty($u->roles)) return '';
        return reset($u->roles);
    }
}
