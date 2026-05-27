<?php
/**
 * Read canonical per-control docs from schemas/controls/{type}.md.
 *
 * Single source of truth shared with the Next.js docs site (which
 * reads the same files at build time via gray-matter). PHP-side
 * consumers: the field-showcase block's per-row Docs panel, and the
 * gcblite/get-control-docs Ability for AI agents.
 *
 * Frontmatter parser is hand-rolled — gray-matter / Symfony YAML aren't
 * worth pulling in for the few keys we care about. Subset supported:
 *
 *   scalar    : value                       # string, no quoting needed
 *   scalar    : "value with: colons"        # single- or double-quoted
 *   list      :
 *     - item one
 *     - "item two"
 *   list_obj  :
 *     - name: foo
 *       type: string
 *       description: ...
 *   block     : |
 *     literal
 *     multi-line
 *
 * Anything trickier — anchors, flow style, &amp; / &gt; coercion — is
 * outside our format conventions for these files. If the parser sees
 * something it doesn't understand it bails on that line and keeps
 * going, so a malformed file degrades gracefully rather than 500ing.
 *
 * @package GCBLite\Docs
 */

namespace GCBLite\Docs;

if (!defined('ABSPATH')) {
    exit;
}

class ControlDocs {

    /**
     * Where the markdown lives on disk. Resolved from the plugin
     * constant so consumers don't have to know the path.
     */
    public static function dir() {
        if (!defined('GCBLITE_PLUGIN_DIR')) return '';
        return rtrim(GCBLITE_PLUGIN_DIR, '/') . '/schemas/controls';
    }

    /**
     * Return the structured frontmatter for one control type as an
     * associative array. Returns null when no docs file exists for the
     * requested type.
     */
    public static function get($type) {
        $dir = self::dir();
        if (!$dir || !$type) return null;
        $path = $dir . '/' . $type . '.md';
        if (!is_readable($path)) return null;

        static $cache = [];
        if (isset($cache[$type])) return $cache[$type];

        $raw = (string) file_get_contents($path);
        return $cache[$type] = self::parse_frontmatter($raw);
    }

    /**
     * List the control types that have docs files. Useful for
     * generating an index or filling a dropdown.
     *
     * @return string[]
     */
    public static function list_types() {
        $dir = self::dir();
        if (!$dir || !is_dir($dir)) return [];
        $types = [];
        foreach (glob($dir . '/*.md') as $path) {
            $name = basename($path, '.md');
            if ($name === 'README') continue;
            $types[] = $name;
        }
        sort($types);
        return $types;
    }

    /**
     * Extract the `---` … `---` frontmatter block from a markdown file
     * and parse it into a PHP associative array. Body markdown is
     * discarded — frontmatter is the structured data both consumers
     * care about; the body, if any, lives only in the Next docs site.
     *
     * @param string $raw Full file contents.
     * @return array Parsed frontmatter, or empty array if missing/malformed.
     */
    private static function parse_frontmatter($raw) {
        // YAML frontmatter must open on line 1 with --- and close on a
        // later line starting with ---. Anything else is treated as
        // "no frontmatter" — caller gets an empty array.
        if (!preg_match('/^---\s*\R(.+?)\R---\s*\R/s', $raw, $m)) {
            return [];
        }
        return self::parse_yaml($m[1]);
    }

    /**
     * Tiny YAML subset parser. Supports the shapes documented in the
     * file header — scalars, single-level lists, lists of objects, and
     * block scalars (|). Indentation is tracked by leading-space count.
     */
    private static function parse_yaml($body) {
        $lines  = preg_split('/\R/', $body);
        $result = [];
        $i = 0;
        $n = count($lines);

        while ($i < $n) {
            $line = $lines[$i];

            // Skip blanks + comments.
            if (trim($line) === '' || ltrim($line)[0] === '#') {
                $i++;
                continue;
            }

            // Top-level key: value
            if (preg_match('/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/', $line, $m)) {
                $key = $m[1];
                $val = $m[2];

                // Block scalar: key: | (or >) — collect indented lines.
                if ($val === '|' || $val === '>') {
                    $collected = [];
                    $i++;
                    while ($i < $n && (trim($lines[$i]) === '' || preg_match('/^\s{2,}/', $lines[$i]))) {
                        // Strip the leading 2-space indent (our convention).
                        $collected[] = preg_replace('/^\s{0,2}/', '', $lines[$i], 1);
                        $i++;
                    }
                    $joined = implode("\n", $collected);
                    // `>` folds newlines to spaces; `|` keeps them. Trim
                    // trailing newlines so callers don't double-pad.
                    $result[$key] = $val === '>'
                        ? trim(preg_replace('/\s+/', ' ', $joined))
                        : rtrim($joined, "\n");
                    continue;
                }

                // Empty value → either a list or a map of objects starts
                // on the next line. Peek ahead to disambiguate.
                if ($val === '') {
                    $i++;
                    // Object-list: lines start with "  - key: value"
                    if ($i < $n && preg_match('/^\s+-\s+\w+\s*:/', $lines[$i])) {
                        list($items, $i) = self::parse_object_list($lines, $i, $n);
                        $result[$key] = $items;
                        continue;
                    }
                    // String-list: lines start with "  - value"
                    if ($i < $n && preg_match('/^\s+-\s+/', $lines[$i])) {
                        list($items, $i) = self::parse_string_list($lines, $i, $n);
                        $result[$key] = $items;
                        continue;
                    }
                    // Empty value, no list — store empty.
                    $result[$key] = '';
                    continue;
                }

                // Inline list: key: []   — treat as empty array.
                if (preg_match('/^\[\s*\]$/', $val)) {
                    $result[$key] = [];
                    $i++;
                    continue;
                }

                // Scalar value. Strip surrounding quotes if present.
                $result[$key] = self::unquote($val);
                $i++;
                continue;
            }

            // Unrecognised line — skip rather than crash.
            $i++;
        }

        return $result;
    }

    /**
     * Parse a flat list of scalars indented with `- `. Stops when
     * indentation drops or a new top-level key appears.
     */
    private static function parse_string_list($lines, $i, $n) {
        $items = [];
        while ($i < $n) {
            $line = $lines[$i];
            if (preg_match('/^\s+-\s+(.+?)\s*$/', $line, $m)) {
                $items[] = self::unquote($m[1]);
                $i++;
                continue;
            }
            // Anything else ends the list.
            break;
        }
        return [$items, $i];
    }

    /**
     * Parse a list of objects. Each object starts with `- key: value`
     * (the dashed line), followed by zero+ continuation lines of the
     * same indent that contribute additional keys to that object.
     */
    private static function parse_object_list($lines, $i, $n) {
        $items = [];
        $current = null;
        $base_indent = null;
        $cont_indent = null;

        while ($i < $n) {
            $line = $lines[$i];
            // Dashed line: new object.
            if (preg_match('/^(\s+)-\s+(\w+)\s*:\s*(.*)$/', $line, $m)) {
                if ($base_indent === null) {
                    $base_indent = strlen($m[1]);
                    // Continuation lines have base + 2 extra spaces past the dash.
                    $cont_indent = $base_indent + 2;
                }
                if (strlen($m[1]) !== $base_indent) break;
                if ($current !== null) $items[] = $current;
                $current = [$m[2] => self::unquote($m[3])];
                $i++;
                continue;
            }
            // Continuation line for the current object.
            if ($current !== null && preg_match('/^(\s+)(\w+)\s*:\s*(.*)$/', $line, $m)) {
                if (strlen($m[1]) !== $cont_indent) break;
                $val = $m[3];
                // Block scalar inside a list item: "  | …"
                if ($val === '|' || $val === '>') {
                    $collected = [];
                    $i++;
                    $body_indent = $cont_indent + 2;
                    while ($i < $n && (trim($lines[$i]) === '' || preg_match('/^\s{' . $body_indent . ',}/', $lines[$i]))) {
                        $collected[] = preg_replace('/^\s{0,' . $body_indent . '}/', '', $lines[$i], 1);
                        $i++;
                    }
                    $joined = implode("\n", $collected);
                    $current[$m[2]] = $val === '>'
                        ? trim(preg_replace('/\s+/', ' ', $joined))
                        : rtrim($joined, "\n");
                    continue;
                }
                $current[$m[2]] = self::unquote($val);
                $i++;
                continue;
            }
            // Anything else ends the list.
            break;
        }
        if ($current !== null) $items[] = $current;
        return [$items, $i];
    }

    /**
     * Strip surrounding quotes from a YAML scalar. Also coerces a few
     * literal types: true/false/null. Leaves numbers as strings — the
     * consumers we have don't care about strict numeric typing here.
     */
    private static function unquote($val) {
        $val = trim($val);
        if ($val === '') return '';
        if ($val === 'true')  return true;
        if ($val === 'false') return false;
        if ($val === 'null')  return null;
        $first = $val[0];
        $last  = $val[strlen($val) - 1];
        if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
            return substr($val, 1, -1);
        }
        return $val;
    }
}
