<?php
/**
 * CONTRACT CHECKS — a field type says what it needs from the block around it,
 * and a block that doesn't provide it is told so, by name (TODO.md, "Extension
 * points" 3). The gate docs/hotspot-field.md §9 asked for: a hotspots field
 * with no name, a rival image inside it and six hand-placed pins all passed
 * every check there was, because nothing knew what a hotspots field needs.
 *
 * Validation (BlockGcbValidator) looks at one block.fields.json on its own.
 * A contract can need more: the block's render.php, its repeater children and
 * THEIR fields. So checks run once every block is registered, and each gets:
 *
 *   check(array $control, array $ctx): string[]   — the problems, [] when fine
 *
 *   $ctx = [
 *     'block'    => 'gcb/touchpoint-zoom',
 *     'controls' => [...],                     // this block's controls
 *     'children' => ['gcb/touchpoint', ...],   // what its <Repeater> markers allow
 *     'fields_of'=> callable(string $block): array   // another block's controls
 *   ]
 *
 * Register one with a type: gcblite_register_control_type($type, [..., 'check' => callable]).
 * Results: a WP_DEBUG warning per problem as blocks load, and the
 * gcblite/check-blocks ability (what an AI calls after creating a block).
 *
 * @package GCBLite\Fields
 */

namespace GCBLite\Fields;

use GCBLite\Blocks\BlockLoader;

if (!defined('ABSPATH')) {
    exit;
}

final class ContractChecks {

    /**
     * Run every field's check on every registered gcb/* block (or the ones named).
     *
     * @param string[]|null $only Block names to check; null for all.
     * @return array<int, array{block: string, field: string, type: string, message: string}>
     */
    public static function run(?array $only = null) {
        $problems = [];
        $names = $only ?? BlockLoader::block_names();
        foreach ($names as $name) {
            $config = BlockLoader::get_block_config($name);
            if (!$config) {
                continue;
            }
            $controls = self::controls($config);
            $ctx = [
                'block'     => $name,
                'controls'  => $controls,
                'children'  => BlockLoader::children_of($name),
                'fields_of' => static function ($block) {
                    $c = BlockLoader::get_block_config((string) $block);
                    return $c ? self::controls($c) : [];
                },
            ];
            foreach ($controls as $control) {
                $type  = is_array($control) ? (string) ($control['type'] ?? '') : '';
                $check = $type !== '' ? ControlTypes::check_for($type) : null;
                if (!$check) {
                    continue;
                }
                foreach ((array) call_user_func($check, $control, $ctx) as $message) {
                    if (is_string($message) && $message !== '') {
                        $problems[] = [
                            'block'   => $name,
                            'field'   => (string) ($control['attributeKey'] ?? $control['id'] ?? ''),
                            'type'    => $type,
                            'message' => $message,
                        ];
                    }
                }
            }
        }
        return $problems;
    }

    /** As blocks load, with WP_DEBUG on: one warning per problem, naming the block. */
    public static function warn() {
        if (!defined('WP_DEBUG') || !WP_DEBUG) {
            return;
        }
        foreach (self::run() as $p) {
            trigger_error("GCB Lite: {$p['block']} — {$p['type']} field `{$p['field']}`: {$p['message']}", E_USER_WARNING);
        }
    }

    // ------------------------------------------------------------------
    // Lite's own checks
    // ------------------------------------------------------------------

    /**
     * pin-map places the block's repeater children on its picture, so it needs
     * a child to place, and that child needs the point field it writes to.
     */
    public static function pin_map(array $control, array $ctx) {
        $child = (string) ($control['childBlock'] ?? ($ctx['children'][0] ?? ''));
        if ($child === '') {
            return ['it has no child blocks to place. Add a <Repeater allowedBlocks=\'["gcb/your-item"]\'> to render.php (or set `childBlock`).'];
        }
        if (!empty($control['childBlock']) && !in_array($child, $ctx['children'], true)) {
            return ["`childBlock` is {$child}, but no <Repeater> in render.php allows it — the map would place blocks the block can't hold."];
        }
        $fields = call_user_func($ctx['fields_of'], $child);
        if (!$fields) {
            return ["its child block {$child} isn't registered or has no fields — it needs a point field to be placed."];
        }
        if (!empty($control['pointsKey'])) {
            $rows = self::find($fields, (string) $control['pointsKey']);
            if (!$rows || ($rows['type'] ?? '') !== 'repeater') {
                return ["grouped mode (`pointsKey`: {$control['pointsKey']}) needs a repeater field `{$control['pointsKey']}` on {$child} — the map adds a row per location."];
            }
            // The map writes each row's point itself, and a row may hold keys its
            // repeater doesn't declare — so a declared point sub-field is optional
            // (the Touchpoint card drops it: points are placed only on the map).
            // Declared under that key as anything else, it would fight the map.
            $row_point = (string) ($control['rowPointKey'] ?? 'point');
            $sub = self::find((array) ($rows['fields'] ?? []), $row_point);
            if ($sub && ($sub['type'] ?? '') !== 'point') {
                return ["`{$control['pointsKey']}` rows on {$child} declare `{$row_point}` as a {$sub['type']} field, but the map writes a point there — make it a point field, or set `rowPointKey` to another key."];
            }
            return [];
        }
        // Single mode: the point is a block attribute, and WordPress drops an
        // undeclared one when the post is saved — so it must be a declared field.
        $key = (string) ($control['pointKey'] ?? 'point');
        $point = self::find($fields, $key);
        if (!$point || ($point['type'] ?? '') !== 'point') {
            return ["{$child} needs a point field `{$key}` for the map to write where it sits (set `pointKey` if it's named otherwise, or `pointsKey` for several locations per card)."];
        }
        return [];
    }

    /** layout arranges a list's items, so its block must hold a list. */
    public static function layout(array $control, array $ctx) {
        return $ctx['children'] ? [] : ['it arranges a repeater\'s items, but this block has no <Repeater> in render.php — there is nothing to lay out.'];
    }

    /** A block's controls from its stored config. */
    private static function controls(array $config) {
        $c = $config['fields']['controls'] ?? [];
        return is_array($c) ? $c : [];
    }

    /** The control with this attributeKey, or null. */
    private static function find(array $controls, string $key) {
        foreach ($controls as $c) {
            if (is_array($c) && ($c['attributeKey'] ?? null) === $key) {
                return $c;
            }
        }
        return null;
    }
}
