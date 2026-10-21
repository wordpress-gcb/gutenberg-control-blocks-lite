<?php
/**
 * THE KIT, ONE FOLDER A PART (Mark, 2026-10-20: "a consistent pattern and folder structure when calling kit elements
 * … adding a kit item can be a straightforward task and bolt onto the sides instead of being intertwined"). A part
 * used to be spread over up to six places and five lists kept by hand; now it is a folder, and this finds it:
 *
 *   kit/<part>/
 *     part.json     what it is — {"about": "…"}, and only what it needs beyond its files:
 *                     "needs":  "gsap" | "scroll"   its script's library (a plugin answers gcblite_kit_script_deps)
 *                     "vendor": ["vendor/x.js"]     third-party scripts loaded before its own
 *                     "server": "Name\\Of\\Class"   its PHP half: register_hooks(), and vendor($html) to choose
 *                                                   the vendor scripts block by block
 *                     "mark":   "data-gcb-x="       a mark, not a part: its CSS ships where the attribute appears
 *     style.css     its look — inline before the first block that uses it; in the editor, every part's at once
 *     script.js     a plain script, as written
 *     view.js       a script module (the Interactivity API), built to build/kit/<part>.js
 *     *.php         its server half, loaded with it
 *     tests/        its tests (never shipped)
 *   kit/_core/      what every part stands on: its CSS (the tokens) goes before the first part's
 *
 * The part's name is its folder's, and the markup's: data-gcb-kit="<part>". A folder without a part.json is not a
 * part. GCB Lite's kit is here; another plugin adds its own folder on `gcblite_kit_dirs`. Its contract for the
 * model is harness prompts/kit/<part>.md.
 *
 * @package GCBLite\Kit
 */

namespace GCBLite\Kit;

if (!defined('ABSPATH')) {
    exit;
}

final class Registry {

    /** @var array<string,array>|null every part, by name, once found */
    private static $parts = null;

    /** @var array<string,bool> what this request has already printed the CSS of ('_core' for the tokens) */
    private static $styled = [];

    public static function init() {
        add_action('init', [__CLASS__, 'load'], 0);
        add_filter('render_block', [__CLASS__, 'note'], 10, 1);
        add_filter('render_block', [__CLASS__, 'own'], 30, 1);
        add_action('enqueue_block_assets', [__CLASS__, 'editor_styles']);
    }

    /** for tests: forget what was found and printed */
    public static function reset(?array $parts = null) {
        self::$parts  = $parts;
        self::$styled = [];
    }

    /**
     * The kit folders: GCB Lite's, and any a plugin adds — each its plugin's folder and URL (the kit is its kit/,
     * the built modules its build/kit/).
     *
     * @return array<int,array{dir:string,url:string}>
     */
    public static function roots() {
        $roots = [['dir' => GCBLITE_PLUGIN_DIR, 'url' => GCBLITE_PLUGIN_URL]];
        return (array) apply_filters('gcblite_kit_dirs', $roots);
    }

    /** every part, found once */
    public static function parts() {
        if (self::$parts === null) {
            self::$parts = self::scan(self::roots());
        }
        return self::$parts;
    }

    /**
     * THE PARTS IN THESE FOLDERS — pure, so it is tested on a folder of its own. A name already found is not taken
     * again: the first folder's part stands.
     *
     * @param array<int,array{dir:string,url:string}> $roots
     * @return array<string,array> name => its manifest, its folder and URL, and the files it has
     */
    /**
     * What every part stands on: the tokens, then the kit's shared looks beside them in _core/ (widget.css: the field
     * every pressable part is, and the panel it opens — 2026-10-21, Mark: "a beautiful consistent feel around the site")
     *
     * @param string $tokens the _core tokens file
     */
    public static function core_css(string $tokens): string {
        if ($tokens === '' || !is_file($tokens)) {
            return '';
        }
        $css = (string) file_get_contents($tokens);
        foreach (glob(dirname($tokens) . '/*.css') ?: [] as $f) {
            if ($f !== $tokens) {
                $css .= "\n" . file_get_contents($f);
            }
        }
        return $css;
    }

    public static function scan(array $roots) {
        /* the kit's tokens: the first folder's _core that has them, before every part's look */
        $core = '';
        foreach ($roots as $root) {
            $f    = rtrim((string) ($root['dir'] ?? ''), '/') . '/kit/_core/tokens.css';
            $core = $core ?: (is_file($f) ? $f : '');
        }
        $parts = [];
        foreach ($roots as $root) {
            $base = rtrim((string) ($root['dir'] ?? ''), '/') . '/';
            $url  = rtrim((string) ($root['url'] ?? ''), '/') . '/';
            foreach (glob($base . 'kit/*/part.json') ?: [] as $manifest) {
                $dir  = dirname($manifest) . '/';
                $name = basename($dir);
                if ($name[0] === '_' || isset($parts[$name])) {
                    continue;
                }
                $about = json_decode((string) file_get_contents($manifest), true);
                if (!is_array($about)) {
                    continue;
                }
                $module = $base . 'build/kit/' . $name . '.asset.php';
                $parts[$name] = [
                    'name'   => $name,
                    'dir'    => $dir,
                    'url'    => $url . 'kit/' . $name . '/',
                    'needs'  => (string) ($about['needs'] ?? ''),
                    'vendor' => array_values(array_map('strval', (array) ($about['vendor'] ?? []))),
                    'server' => (string) ($about['server'] ?? ''),
                    'mark'   => (string) ($about['mark'] ?? ''),
                    'style'  => is_file($dir . 'style.css') ? $dir . 'style.css' : '',
                    'script' => is_file($dir . 'script.js') ? $dir . 'script.js' : '',
                    'module' => is_file($dir . 'view.js') && is_file($module) ? ['asset' => $module, 'url' => $url . 'build/kit/' . $name . '.js'] : null,
                    'php'    => glob($dir . '*.php') ?: [],
                    'core'   => $core,
                ];
            }
        }
        return $parts;
    }

    /** each part's server half loaded and hooked, each module registered */
    public static function load() {
        foreach (self::parts() as $part) {
            foreach ($part['php'] as $file) {
                require_once $file;
            }
            if ($part['server'] !== '' && class_exists($part['server']) && method_exists($part['server'], 'register_hooks')) {
                call_user_func([$part['server'], 'register_hooks']);
            }
            if ($part['module'] && function_exists('wp_register_script_module')) {
                $a = require $part['module']['asset'];
                wp_register_script_module(self::handle($part['name']), $part['module']['url'], (array) ($a['dependencies'] ?? []), (string) ($a['version'] ?? ''));
            }
        }
    }

    public static function handle(string $part) {
        return 'gcb-kit-' . $part;
    }

    /** the parts a block's html uses — by data-gcb-kit="<part>", or a mark's attribute */
    public static function used_in(string $html, array $parts) {
        $out = [];
        foreach ($parts as $name => $part) {
            $needle = $part['mark'] !== '' ? $part['mark'] : 'data-gcb-kit="' . $name . '"';
            if (strpos($html, $needle) !== false) {
                $out[] = $name;
            }
        }
        return $out;
    }

    /**
     * A BLOCK THAT DRAWS A PART BRINGS IT: its CSS inline before the block, the first time — render runs in the
     * editor too, where no front-end asset reaches the canvas, and a late <link> would paint the page unstyled
     * first — with the kit's tokens before the first part's; its scripts on a visitor's page only (the editor lays
     * a part out, it does not play it).
     *
     * @param string $html the rendered block
     * @return string the html, the CSS of any part it is the first to use before it
     */
    public static function note($html) {
        if (!is_string($html) || strpos($html, 'data-gcb-') === false) {
            return $html;
        }
        $parts = self::parts();
        $used  = self::used_in($html, $parts);
        if (!$used) {
            return $html;
        }
        $html = self::styles($used, $parts) . $html;
        if (is_admin() || (defined('REST_REQUEST') && REST_REQUEST)) {
            return $html;
        }
        foreach ($used as $name) {
            self::scripts($parts[$name], $html);
        }
        return $html;
    }

    /** the <style>s these parts need that this request has not printed yet: the tokens first */
    public static function styles(array $used, array $parts) {
        $out = '';
        foreach ($used as $name) {
            $part = $parts[$name];
            if ($part['style'] === '' || !empty(self::$styled[$name])) {
                continue;
            }
            if (empty(self::$styled['_core']) && $part['core'] !== '') {
                $out .= '<style id="gcb-kit-core">' . self::core_css($part['core']) . '</style>';
                self::$styled['_core'] = true;
            }
            $out .= '<style id="gcb-kit-' . $name . '">' . file_get_contents($part['style']) . '</style>';
            self::$styled[$name] = true;
        }
        return $out;
    }

    /** a part's scripts: its vendor scripts, its own script with the library it needs, its module */
    private static function scripts(array $part, string $html) {
        $name = $part['name'];
        $vendor = $part['vendor'];
        if ($part['server'] !== '' && method_exists($part['server'], 'vendor')) {
            $vendor = (array) call_user_func([$part['server'], 'vendor'], $html);
        }
        foreach ($vendor as $file) {
            if (is_file($part['dir'] . $file)) {
                wp_enqueue_script(self::handle($name) . '-' . preg_replace('/\W+/', '-', basename($file, '.js')), $part['url'] . $file, [], (string) filemtime($part['dir'] . $file), true);
            }
        }
        if ($part['script'] !== '') {
            $deps = $part['needs'] !== '' ? (array) apply_filters('gcblite_kit_script_deps', [], $part['needs']) : [];
            wp_enqueue_script(self::handle($name), $part['url'] . 'script.js', $deps, (string) filemtime($part['script']), true);
        }
        if ($part['module'] && function_exists('wp_enqueue_script_module')) {
            wp_enqueue_script_module(self::handle($name));
        }
    }

    /**
     * EVERY PART'S CSS IN THE EDITOR (Mark, 2026-10-01: a text + media part's "Text position" changed nothing on the
     * canvas). The editor draws a block without the inline <style> the front end gets, so in the editor the kit's
     * CSS (a few KB) goes in whole, the tokens first, through the block assets the canvas loads.
     */
    public static function editor_styles() {
        if (!is_admin()) {
            return;
        }
        $parts = self::parts();
        $css   = '';
        $core  = '';
        foreach ($parts as $part) {
            $core = $part['core'];
            if ($part['style'] !== '') {
                $css .= file_get_contents($part['style']) . "\n";
            }
        }
        if ($css === '') {
            return;
        }
        wp_register_style('gcb-kit-editor', false, [], null);
        wp_enqueue_style('gcb-kit-editor');
        wp_add_inline_style('gcb-kit-editor', ($core !== '' ? self::core_css($core) . "\n" : '') . $css);
    }

    /** the controls a part's look reaches into, beside the parts themselves (any data-gcb-kit-* attribute) */
    const CONTROLS = ['DETAILS', 'SUMMARY', 'INPUT', 'SELECT', 'BUTTON'];

    /**
     * WHICH PARTS ARE THE DESIGN'S, decided once from the markup as written (Mark, 2026-10-19: "when i hover over
     * something it breaks"). A part's look is for a bare part; a part the design gave classes to is the design's. The
     * test was once :not([class]) in the CSS — but the page adds classes as it runs (gcb-hover under the pointer, and
     * `class=""` left when it goes; an Interactivity class binding), and every one took the part's look away. So the
     * classes as written are read here and a part with any is stamped `data-gcb-own`; the CSS asks for that, and
     * nothing a script adds later changes the answer. A class only a `data-wp-class--` binding sets is not the
     * design's. Runs after the parts' own filters (20) and before the Interactivity API processes directives.
     */
    public static function own($content) {
        if (!is_string($content) || strpos($content, 'data-gcb-kit="') === false || !class_exists('WP_HTML_Tag_Processor')) {
            return $content;
        }
        $p = new \WP_HTML_Tag_Processor($content);
        while ($p->next_tag()) {
            if ($p->is_tag_closer() || $p->get_attribute('data-gcb-own') !== null) {
                continue;
            }
            if (!in_array($p->get_tag(), self::CONTROLS, true) && !$p->get_attribute_names_with_prefix('data-gcb-kit')) {
                continue;
            }
            $class = $p->get_attribute('class');
            if (!is_string($class) || trim($class) === '') {
                continue;
            }
            $bound = array_map(
                static fn ($a) => substr($a, strlen('data-wp-class--')),
                (array) $p->get_attribute_names_with_prefix('data-wp-class--')
            );
            if (array_diff(preg_split('/\s+/', trim($class)), $bound)) {
                $p->set_attribute('data-gcb-own', '');
            }
        }
        return $p->get_updated_html();
    }
}
