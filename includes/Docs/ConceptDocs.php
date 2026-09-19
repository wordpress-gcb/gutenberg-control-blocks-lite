<?php
/**
 * Read the canonical concept docs from schemas/concepts/{name}.md.
 *
 * The sibling of ControlDocs, with one deliberate difference: this
 * keeps the BODY.
 *
 * For a control, the structured frontmatter *is* the documentation —
 * stored shape, config options, gotchas — so ControlDocs parses the
 * frontmatter and throws the prose away. A concept page is the other
 * way round. Its frontmatter is only filing (title, section, order);
 * the value is the prose, because these pages answer the *when* and
 * the *which* rather than the *what*. `blocks-inner.md` settling
 * InnerBlocks-vs-repeater-field is the whole reason this class exists.
 *
 * Same source of truth as the Next.js docs site, which reads these
 * files at build time via gray-matter.
 *
 * Consumer: the gcblite/get-concept-docs Ability, so an AI agent
 * composing a block can reach the same guidance a human reader gets.
 *
 * @package GCBLite\Docs
 */

namespace GCBLite\Docs;

if (!defined('ABSPATH')) {
    exit;
}

class ConceptDocs {

    /**
     * Where the markdown lives on disk. Resolved from the plugin
     * constant so consumers don't have to know the path.
     */
    public static function dir() {
        if (!defined('GCBLITE_PLUGIN_DIR')) return '';
        return rtrim(GCBLITE_PLUGIN_DIR, '/') . '/schemas/concepts';
    }

    /**
     * Every concept page's file name, sorted. Derived from disk, never
     * a hand-kept list — add a page, and it is reachable.
     *
     * @return string[]
     */
    public static function list_names() {
        $dir = self::dir();
        if (!$dir || !is_dir($dir)) return [];
        $names = [];
        foreach (glob($dir . '/*.md') as $path) {
            $name = basename($path, '.md');
            if ($name === 'README') continue;
            $names[] = $name;
        }
        sort($names);
        return $names;
    }

    /**
     * A one-line-per-page index: name, title and section, with no
     * bodies. This is the menu an agent reads before deciding which
     * page it actually needs — without it, the only way to find out
     * what `blocks-inner` covers is to fetch all sixteen.
     *
     * @return array<int, array{name:string, title:string, section:string, slug:string}>
     */
    public static function index() {
        $rows = [];
        foreach (self::list_names() as $name) {
            $doc = self::get($name);
            if (!$doc) continue;
            $rows[] = [
                'name'    => $doc['name'],
                'title'   => $doc['title'],
                'section' => $doc['section'],
                'slug'    => $doc['slug'],
            ];
        }
        return $rows;
    }

    /**
     * One concept page as a structured array:
     *
     *   name     file basename, the key this class is addressed by
     *   title    from frontmatter, falling back to a humanised name
     *   section  from frontmatter ("Blocks", "AI workflows", …)
     *   slug     the docs-site path ("blocks/inner"), which is also an
     *            accepted spelling of the name
     *   body     the markdown prose, frontmatter stripped
     *
     * Returns null when no page exists by that name.
     *
     * @param string $name File basename ("blocks-inner") or docs slug ("blocks/inner").
     * @return array|null
     */
    public static function get($name) {
        $dir = self::dir();
        if (!$dir || !is_string($name) || $name === '') return null;

        // The docs site addresses pages by slug, so "blocks/inner" is a
        // spelling of "blocks-inner". Fold it before the safety check —
        // which then rejects anything still carrying a path separator,
        // so a name can never climb out of schemas/concepts.
        $name = str_replace('/', '-', $name);
        if (preg_match('/[^a-z0-9-]/i', $name)) return null;

        static $cache = [];
        if (array_key_exists($name, $cache)) return $cache[$name];

        $path = $dir . '/' . $name . '.md';
        if (!is_readable($path)) return $cache[$name] = null;

        $raw   = (string) file_get_contents($path);
        $front = [];
        $body  = $raw;

        // Frontmatter must open on line 1 with --- and close on a later
        // line starting with ---. Anything else is a body-only page.
        if (preg_match('/^---\s*\R(.*?)\R---\s*\R/s', $raw, $m)) {
            $front = self::parse_front_scalars($m[1]);
            $body  = substr($raw, strlen($m[0]));
        }

        return $cache[$name] = [
            'name'    => $name,
            'title'   => isset($front['title']) && $front['title'] !== ''
                ? $front['title']
                : ucwords(str_replace('-', ' ', $name)),
            'section' => $front['section'] ?? '',
            // Frontmatter slug when present; otherwise the name is the slug.
            'slug'    => isset($front['slug']) && $front['slug'] !== '' ? $front['slug'] : $name,
            'body'    => trim($body),
        ];
    }

    /**
     * Concept frontmatter is flat `key: value` only — title, section,
     * order, slug. No lists, no block scalars; if one ever appears it
     * is filing metadata we don't read, so skipping the line is right.
     * (ControlDocs' fuller YAML subset is there because control docs
     * carry configOptions and gotchas; these don't.)
     *
     * @return array<string, string>
     */
    private static function parse_front_scalars($block) {
        $out = [];
        foreach (preg_split('/\R/', $block) as $line) {
            if (!preg_match('/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/', $line, $m)) continue;
            $val = trim($m[2]);
            if ($val !== '' && (
                ($val[0] === '"' && substr($val, -1) === '"') ||
                ($val[0] === "'" && substr($val, -1) === "'")
            )) {
                $val = substr($val, 1, -1);
            }
            $out[$m[1]] = $val;
        }
        return $out;
    }
}
