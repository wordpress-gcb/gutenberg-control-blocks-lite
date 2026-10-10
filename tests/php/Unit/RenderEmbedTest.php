<?php
/**
 * THE EMBED HELPER (2026-10-10, Mark: "can gcb create a trust pilot component on its own?"). A pasted widget keeps
 * its markup and its provider's script; nothing else it carries runs.
 */

namespace GCBLite\Tests\Unit;

use PHPUnit\Framework\TestCase;

foreach (array('esc_url', 'esc_attr', 'esc_html') as $fn) {
    if (!function_exists($fn)) {
        eval("function {$fn}(\$u) { return htmlspecialchars((string) \$u, ENT_QUOTES); }");
    }
}
if (!function_exists('did_action')) {
    /* outside WordPress: an action has run when the test says so */
    eval('function did_action($hook) { return (int) ($GLOBALS["gcblite_test_did"][$hook] ?? 0); }');
}
if (!function_exists('wp_kses')) {
    /* a minimal wp_kses: tags off the list lose their tag (their text stays), attributes off the list go, and
       'data-*' => true admits any data- attribute — as WordPress's own does */
    eval(<<<'PHP'
function wp_kses($html, $allowed) {
    return preg_replace_callback('#<(/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>#', static function ($m) use ($allowed) {
        $tag = strtolower($m[2]);
        if (!isset($allowed[$tag])) {
            return '';
        }
        if ($m[1] === '/') {
            return '</' . $tag . '>';
        }
        $out = '';
        preg_match_all('/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+))?/', $m[3], $as, PREG_SET_ORDER);
        foreach ($as as $a) {
            $name = strtolower($a[1]);
            $ok = !empty($allowed[$tag][$name]) || (strpos($name, 'data-') === 0 && !empty($allowed[$tag]['data-*']));
            if ($ok) {
                $v = isset($a[2]) ? trim($a[2], '"\'') : '';
                $out .= ' ' . $name . '="' . $v . '"';
            }
        }
        return '<' . $tag . $out . '>';
    }, (string) $html);
}
PHP
    );
}
require_once dirname(__DIR__, 3) . '/includes/Render/embed.php';

final class RenderEmbedTest extends TestCase
{
    private const TP_SRC = '//widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js';

    private const TRUSTBOX = '<!-- TrustBox widget - Micro Review Count -->'
        . '<div class="trustpilot-widget" data-locale="en-US" data-template-id="5419b6a8b0d04a076446a9ad" data-businessunit-id="5f00" data-style-height="24px" data-style-width="100%" data-theme="light">'
        . '<a href="https://www.trustpilot.com/review/example.com" target="_blank" rel="noopener">Trustpilot</a></div>'
        . '<!-- End TrustBox widget -->'
        . '<script type="text/javascript" src="//widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js" async></script>';

    protected function setUp(): void
    {
        $GLOBALS['gcblite_test_enqueued'] = array();
        $GLOBALS['gcblite_embed_loaded'] = array();
        $GLOBALS['gcblite_test_did'] = array();
    }

    private function handle(string $src): string
    {
        return 'gcb-embed-' . md5($src);
    }

    public function test_a_trustbox_keeps_its_markup_and_loads_its_script_once(): void
    {
        $out = gcblite_embed(self::TRUSTBOX);
        $this->assertStringContainsString('<div class="trustpilot-widget"', $out);
        foreach (array('data-locale="en-US"', 'data-template-id="5419b6a8b0d04a076446a9ad"', 'data-businessunit-id="5f00"', 'data-style-height="24px"', 'data-theme="light"') as $attr) {
            $this->assertStringContainsString($attr, $out);
        }
        $this->assertStringContainsString('<a href="https://www.trustpilot.com/review/example.com" target="_blank" rel="noopener">Trustpilot</a>', $out);
        $this->assertStringNotContainsString('<script', $out, 'the script is enqueued, not printed');
        $this->assertStringNotContainsString('<!--', $out);
        $this->assertStringNotContainsString('TrustBox widget', $out);

        /* the same widget twice on a page: its script once */
        gcblite_embed(self::TRUSTBOX);
        $this->assertSame(array($this->handle('https:' . self::TP_SRC)), $GLOBALS['gcblite_test_enqueued']);
    }

    public function test_inline_code_and_unknown_hosts_are_dropped(): void
    {
        $out = gcblite_embed(
            '<div class="w">x</div>'
            . '<script>alert(document.cookie)</script>'
            . '<script src="https://evil.example/steal.js"></script>'
            . '<script src="https://widget.trustpilot.com/x.js">alert(1)</script>'
            . '<img src="https://x.test/a.png" onerror="alert(1)" alt="a">'
        );
        $this->assertStringNotContainsString('alert', $out);
        $this->assertStringNotContainsString('evil.example', $out);
        $this->assertStringNotContainsString('onerror', $out);
        $this->assertStringContainsString('<div class="w">x</div>', $out);
        $this->assertStringContainsString('<img src="https://x.test/a.png" alt="a">', $out);
        $this->assertSame(array(), $GLOBALS['gcblite_test_enqueued'], 'nothing enqueued: one unknown host, one script with code in it');
    }

    public function test_an_empty_value_uses_the_drawn_snippet(): void
    {
        $this->assertStringContainsString('trustpilot-widget', gcblite_embed('', self::TRUSTBOX));
        $this->assertStringContainsString('trustpilot-widget', gcblite_embed(null, self::TRUSTBOX));
        $this->assertStringContainsString('trustpilot-widget', gcblite_embed(array('x'), self::TRUSTBOX));
        $this->assertStringContainsString('calendly', gcblite_embed('<div class="calendly-inline-widget"></div>', self::TRUSTBOX), 'a stored value wins');
        $this->assertSame('', gcblite_embed('', ''));
    }

    public function test_after_the_footer_the_tag_is_printed_inline_once(): void
    {
        $GLOBALS['gcblite_test_did']['wp_footer'] = 1;
        $out = gcblite_embed(self::TRUSTBOX);
        $this->assertSame(1, substr_count($out, '<script src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js" async></script>'));
        $this->assertStringNotContainsString('<script', gcblite_embed(self::TRUSTBOX), 'once per request');
        $this->assertSame(array(), $GLOBALS['gcblite_test_enqueued']);
    }

    public function test_an_iframe_only_on_https(): void
    {
        $out = gcblite_embed('<iframe src="https://calendly.com/x" width="100%" height="600"></iframe><iframe src="http://x.test/y"></iframe><iframe src="javascript:alert(1)"></iframe>');
        $this->assertStringContainsString('<iframe src="https://calendly.com/x" width="100%" height="600"></iframe>', $out);
        $this->assertSame(1, substr_count($out, '<iframe'));
    }

    public function test_the_host_list_is_filterable(): void
    {
        $this->assertSame('', gcblite_embed_script_src('https://widget.example.com/w.js'));
        \GCBLite\Tests\WpStub::add_filter('gcblite_embed_hosts', static fn($h) => array_merge($h, array('widget.example.com')));
        try {
            $this->assertSame('https://widget.example.com/w.js', gcblite_embed_script_src('//widget.example.com/w.js'));
        } finally {
            \GCBLite\Tests\WpStub::reset();
        }
        $this->assertSame('https://assets.calendly.com/assets/external/widget.js', gcblite_embed_script_src('http://assets.calendly.com/assets/external/widget.js'));
        $this->assertSame('', gcblite_embed_script_src('https://widget.trustpilot.com.evil.example/x.js'));
    }
}
