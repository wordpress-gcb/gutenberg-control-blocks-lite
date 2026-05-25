<?php
/**
 * Server-side mirror of src/validation.js. Keep rules in sync — any new
 * validator added here MUST also exist in the JS file (and vice versa) or
 * the editor will show no error and the server will silently force draft.
 *
 * Validation config shape on a control:
 *
 *   'validation' => [
 *       'required'       => true,            // or [ 'message' => '...' ]
 *       'minLength'      => 3,
 *       'maxLength'      => 80,
 *       'min'            => 0,
 *       'max'            => 100,
 *       'pattern'        => '^[A-Z]',        // PHP-style regex; no delimiters
 *       'patternMessage' => 'Must start...',
 *   ]
 *
 * Returns
 *   [ 'ok' => true ]
 *   [ 'ok' => false, 'errors' => [ attributeKey => 'message', ... ] ]
 *
 * @package GCBLite\PostFields
 */

namespace GCBLite\PostFields;

if (!defined('ABSPATH')) {
    exit;
}

class Validator {

    /**
     * Validate a whole set of controls. Skips structural controls and any
     * field hidden by conditional logic (caller supplies $is_visible).
     *
     * @param array         $controls    Same shape as block.fields.json controls.
     * @param array         $values      attributeKey => value.
     * @param callable|null $is_visible  fn($control) => bool — defaults to always-visible.
     * @return array
     */
    public static function validate_all(array $controls, array $values, $is_visible = null) {
        $errors = [];

        foreach ($controls as $control) {
            $key = $control['attributeKey'] ?? null;
            if (!is_string($key) || $key === '') continue;
            if (in_array($control['type'] ?? '', ['group', 'panel', 'tools-panel'], true)) continue;
            if ($is_visible && !$is_visible($control)) continue;

            $result = self::validate_one($control, $values[$key] ?? null);
            if (!$result['ok']) {
                $errors[$key] = $result['message'];
            }
        }

        return empty($errors) ? ['ok' => true] : ['ok' => false, 'errors' => $errors];
    }

    public static function validate_one(array $control, $value) {
        $v = $control['validation'] ?? null;
        if (!is_array($v)) return ['ok' => true];

        $is_empty = self::is_empty_value($value);

        // Required
        if (!empty($v['required'])) {
            if ($is_empty) {
                $msg = '';
                if (is_array($v['required']) && !empty($v['required']['message'])) {
                    $msg = (string) $v['required']['message'];
                } elseif (!empty($v['requiredMessage'])) {
                    $msg = (string) $v['requiredMessage'];
                } else {
                    $label = $control['label'] ?? ($control['attributeKey'] ?? '');
                    $msg   = sprintf(
                        /* translators: %s is the field label */
                        __('%s is required.', 'gcblite'),
                        $label
                    );
                }
                return ['ok' => false, 'message' => $msg];
            }
        }

        // Empty + not-required = valid; nothing more to check.
        if ($is_empty) return ['ok' => true];

        // Length (strings)
        if (is_string($value)) {
            if (isset($v['minLength']) && mb_strlen($value) < (int) $v['minLength']) {
                return [
                    'ok'      => false,
                    'message' => sprintf(
                        /* translators: %d is the minimum number of characters */
                        __('Must be at least %d characters.', 'gcblite'),
                        (int) $v['minLength']
                    ),
                ];
            }
            if (isset($v['maxLength']) && mb_strlen($value) > (int) $v['maxLength']) {
                return [
                    'ok'      => false,
                    'message' => sprintf(
                        /* translators: %d is the maximum number of characters */
                        __('Must be %d characters or fewer.', 'gcblite'),
                        (int) $v['maxLength']
                    ),
                ];
            }
            if (!empty($v['pattern'])) {
                // PHP requires regex delimiters; the JS pattern is bare. Wrap it.
                $pattern = '/' . str_replace('/', '\\/', $v['pattern']) . '/u';
                $matched = @preg_match($pattern, $value);
                if ($matched === 0) {
                    return [
                        'ok'      => false,
                        'message' => !empty($v['patternMessage'])
                            ? (string) $v['patternMessage']
                            : __('Value does not match the required format.', 'gcblite'),
                    ];
                }
                // matched === false means the regex itself was invalid; skip
                // rather than block the save on an author config error.
            }
        }

        // Numeric range
        if (isset($v['min']) || isset($v['max'])) {
            $num = is_numeric($value) ? (float) $value : null;
            if ($num !== null) {
                if (isset($v['min']) && $num < (float) $v['min']) {
                    return [
                        'ok'      => false,
                        'message' => sprintf(
                            /* translators: %s is the minimum value */
                            __('Must be at least %s.', 'gcblite'),
                            (string) $v['min']
                        ),
                    ];
                }
                if (isset($v['max']) && $num > (float) $v['max']) {
                    return [
                        'ok'      => false,
                        'message' => sprintf(
                            /* translators: %s is the maximum value */
                            __('Must be %s or less.', 'gcblite'),
                            (string) $v['max']
                        ),
                    ];
                }
            }
        }

        return ['ok' => true];
    }

    /**
     * Match the JS isEmptyValue: undefined/null/'' and empty containers
     * count as empty. Booleans, zero, and "0" do NOT count as empty.
     */
    private static function is_empty_value($value) {
        if ($value === null || $value === '') return true;
        if (is_array($value)) {
            if (count($value) === 0) return true;
            // URL control stores ['url' => '...', 'text' => '...', 'opensInNewTab' => bool]
            // — empty means no url set.
            $keys = array_keys($value);
            $url_shape_keys = ['url', 'text', 'opensInNewTab'];
            $is_url_shape   = !array_diff($keys, $url_shape_keys);
            if ($is_url_shape) {
                return empty($value['url']);
            }
            return false;
        }
        return false;
    }
}
