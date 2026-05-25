<?php
/**
 * Server-side mirror of src/inspector.js shouldRender. Evaluates a
 * control's `conditionalLogic` block against sibling attribute values so
 * the PHP-side validator can skip fields the user can't see.
 *
 * Keep in sync with shouldRender / evalRule in src/inspector.js.
 *
 * Config shape:
 *
 *   'conditionalLogic' => [
 *       'enabled'  => true,
 *       'operator' => 'and' | 'or',          // default: 'and'
 *       'rules'    => [
 *           ['field' => 'show_cta', 'operator' => '==', 'value' => true],
 *           ['field' => 'count',    'operator' => '>',  'value' => 0],
 *       ],
 *   ]
 *
 * @package GCBLite\PostFields
 */

namespace GCBLite\PostFields;

if (!defined('ABSPATH')) {
    exit;
}

class Conditional {

    public static function should_render(array $control, array $attributes) {
        $cl = $control['conditionalLogic'] ?? null;
        if (!is_array($cl) || empty($cl['enabled']) || empty($cl['rules']) || !is_array($cl['rules'])) {
            return true;
        }

        $op = ($cl['operator'] ?? 'and') === 'or' ? 'or' : 'and';
        $results = array_map(
            fn($rule) => is_array($rule) ? self::eval_rule($rule, $attributes) : true,
            $cl['rules']
        );

        return $op === 'or'
            ? in_array(true, $results, true)
            : !in_array(false, $results, true);
    }

    private static function eval_rule(array $rule, array $attributes) {
        $field    = $rule['field'] ?? '';
        $operator = $rule['operator'] ?? '==';
        $expected = $rule['value']    ?? null;
        $actual   = $attributes[$field] ?? null;

        switch ($operator) {
            case '==': return $actual == $expected;
            case '!=': return $actual != $expected;
            case '>':  return is_numeric($actual) && is_numeric($expected) && (float) $actual >  (float) $expected;
            case '<':  return is_numeric($actual) && is_numeric($expected) && (float) $actual <  (float) $expected;
            case '>=': return is_numeric($actual) && is_numeric($expected) && (float) $actual >= (float) $expected;
            case '<=': return is_numeric($actual) && is_numeric($expected) && (float) $actual <= (float) $expected;
            case 'contains':
                return is_string($actual) && is_string($expected) && strpos($actual, $expected) !== false;
            case 'in':
                return is_array($expected) && in_array($actual, $expected, true);
            default:
                return true;
        }
    }
}
