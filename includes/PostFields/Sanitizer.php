<?php
/**
 * Server-side value sanitization for gcb-lite controls.
 *
 * The Validator decides "is this submission acceptable?". This decides
 * "what gets persisted?" — separate concern, runs on EVERY save even when
 * validation passes, and is the gate that stops malformed POST data from
 * landing in wp_postmeta / wp_options.
 *
 * Currently only the `repeater` control needs special handling: it
 * stores an array of row objects with a stable `_id` and a known set
 * of sub-field keys. Anything outside that surface gets dropped so a
 * crafted POST can't smuggle junk keys into a row.
 *
 * Used by both PostFields\Registrar (post-meta saves) and
 * Options\Registrar (wp_options saves).
 *
 * @package GCBLite\PostFields
 */

namespace GCBLite\PostFields;

if (!defined('ABSPATH')) {
    exit;
}

class Sanitizer {

    /**
     * Run the per-control sanitizer. Returns the cleaned value, or the
     * input unchanged when no special handling applies.
     */
    public static function sanitize_one(array $control, $value) {
        if (($control['type'] ?? '') === 'repeater') {
            return self::sanitize_repeater($control, $value);
        }
        return $value;
    }

    /**
     * Coerce a submitted repeater value into a clean array of rows.
     *
     * Each row is kept only if it's an associative array. Per row, we
     * keep `_id` (or generate a new one) plus values for every
     * registered sub-field. Anything else gets dropped — stops a
     * malformed POST from saving garbage keys.
     */
    public static function sanitize_repeater(array $control, $value) {
        if (!is_array($value)) return [];
        $sub_keys = [];
        foreach (($control['fields'] ?? []) as $sub) {
            if (isset($sub['attributeKey']) && is_string($sub['attributeKey'])) {
                $sub_keys[] = $sub['attributeKey'];
            }
        }
        $out = [];
        foreach ($value as $row) {
            if (!is_array($row)) continue;
            $clean = [
                '_id' => isset($row['_id']) && is_string($row['_id'])
                    ? $row['_id']
                    : 'r' . substr(md5(uniqid('', true)), 0, 8),
            ];
            foreach ($sub_keys as $k) {
                if (array_key_exists($k, $row)) {
                    $clean[$k] = $row[$k];
                }
            }
            $out[] = $clean;
        }
        return $out;
    }
}
