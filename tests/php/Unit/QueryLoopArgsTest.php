<?php
/**
 * QueryLoop::build_args — the pure (no-WP) arg builder. The filter allow-listing,
 * order sanitising, per-page capping and pagination logic all live here, so they
 * can be unit-tested without a WP runtime. The actual WP_Query run is covered by
 * the integration suite.
 *
 * @covers \GCBLite\Blocks\Queries\QueryLoop
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Blocks\Queries\QueryLoop;
use PHPUnit\Framework\TestCase;

/* THIS tree's copy first: the autoloader resolves through a vendor symlink to
   whichever checkout owns it. */
require_once __DIR__ . '/../../../includes/Blocks/Queries/QueryLoop.php';

/* Global-namespace WP shims the unit bootstrap does not carry; eval'd so they
   land in the global namespace, not this file's. */
if (!function_exists('sanitize_key')) {
    eval('function sanitize_key($key) { return strtolower(preg_replace("/[^a-zA-Z0-9_\\-]/", "", (string) $key)); }');
}
if (!function_exists('esc_attr')) {
    eval('function esc_attr($t) { return htmlspecialchars((string) $t, ENT_QUOTES, "UTF-8"); }');
}
if (!function_exists('esc_html__')) {
    eval('function esc_html__($t, $d = "default") { return htmlspecialchars((string) $t, ENT_QUOTES, "UTF-8"); }');
}
if (!function_exists('esc_attr__')) {
    eval('function esc_attr__($t, $d = "default") { return htmlspecialchars((string) $t, ENT_QUOTES, "UTF-8"); }');
}

class QueryLoopArgsTest extends TestCase {

    private function cfg(array $over = []): array {
        return array_merge([
            'postType' => 'team-member',
            'perPage'  => 12,
            'orderby'  => 'date',
            'order'    => 'DESC',
            'filterTaxonomies' => [['slug' => 'department', 'label' => 'Department']],
        ], $over);
    }

    public function test_no_post_type_returns_empty(): void {
        $this->assertSame([], QueryLoop::build_args(['postType' => '']));
        $this->assertSame([], QueryLoop::build_args([]));
    }

    public function test_basic_args(): void {
        $a = QueryLoop::build_args($this->cfg(), 2);
        $this->assertSame('team-member', $a['post_type']);
        $this->assertSame('publish', $a['post_status']);
        $this->assertSame(12, $a['posts_per_page']);
        $this->assertSame(2, $a['paged']);
        $this->assertSame('date', $a['orderby']);
        $this->assertSame('DESC', $a['order']);
    }

    public function test_per_page_caps_at_max(): void {
        $a = QueryLoop::build_args($this->cfg(['perPage' => 9999]));
        $this->assertSame(QueryLoop::MAX_PER_PAGE, $a['posts_per_page']);
    }

    public function test_per_page_falls_back_when_zero_or_missing(): void {
        $this->assertSame(12, QueryLoop::build_args($this->cfg(['perPage' => 0]))['posts_per_page']);
        $cfg = $this->cfg(); unset($cfg['perPage']);
        $this->assertSame(12, QueryLoop::build_args($cfg)['posts_per_page']);
    }

    public function test_page_floors_at_one(): void {
        $this->assertSame(1, QueryLoop::build_args($this->cfg(), 0)['paged']);
        $this->assertSame(1, QueryLoop::build_args($this->cfg(), -5)['paged']);
    }

    public function test_orderby_allowlisted(): void {
        $this->assertSame('title', QueryLoop::build_args($this->cfg(['orderby' => 'title']))['orderby']);
        // Unknown orderby (e.g. a SQL-injection attempt) falls back to date.
        $this->assertSame('date', QueryLoop::build_args($this->cfg(['orderby' => 'date); DROP TABLE']))['orderby']);
    }

    public function test_order_only_asc_or_desc(): void {
        $this->assertSame('ASC', QueryLoop::build_args($this->cfg(['order' => 'asc']))['order']);
        $this->assertSame('DESC', QueryLoop::build_args($this->cfg(['order' => 'whatever']))['order']);
    }

    public function test_filters_only_for_declared_taxonomies(): void {
        // department is declared; locations is NOT — it must be ignored.
        $a = QueryLoop::build_args($this->cfg(), 1, [
            'department' => ['engineering', 'design'],
            'locations'  => ['london'],
        ]);
        $this->assertArrayHasKey('tax_query', $a);
        $this->assertCount(1, $a['tax_query']);
        $this->assertSame('department', $a['tax_query'][0]['taxonomy']);
        $this->assertSame(['engineering', 'design'], $a['tax_query'][0]['terms']);
        $this->assertSame('IN', $a['tax_query'][0]['operator']);
    }

    public function test_no_filters_no_tax_query(): void {
        $this->assertArrayNotHasKey('tax_query', QueryLoop::build_args($this->cfg()));
        // Empty term arrays don't create a clause either.
        $this->assertArrayNotHasKey('tax_query', QueryLoop::build_args($this->cfg(), 1, ['department' => []]));
    }

    public function test_multiple_facets_use_AND(): void {
        $cfg = $this->cfg(['filterTaxonomies' => [
            ['slug' => 'department'], ['slug' => 'location'],
        ]]);
        $a = QueryLoop::build_args($cfg, 1, [
            'department' => ['engineering'],
            'location'   => ['london'],
        ]);
        $this->assertSame('AND', $a['tax_query']['relation']);
    }

    public function test_filter_terms_are_sanitised(): void {
        $a = QueryLoop::build_args($this->cfg(), 1, ['department' => ['Engineering Team!!']]);
        $this->assertSame(['engineering-team'], $a['tax_query'][0]['terms']);
    }

    /**
     * A listing is built long before its records are published. The PUBLIC
     * front end must only ever see 'publish'; an editor/preview render asks
     * for the drafts too, or the author builds against an empty list and
     * thinks the block is broken. build_args stays pure — the caller decides
     * which world it is in and passes the statuses in.
     */
    public function test_status_defaults_to_publish_only(): void {
        $this->assertSame('publish', QueryLoop::build_args($this->cfg())['post_status']);
    }

    public function test_status_can_include_drafts_for_editing(): void {
        $a = QueryLoop::build_args($this->cfg(), 1, [], ['publish', 'draft', 'pending', 'future', 'private']);
        $this->assertSame(['publish', 'draft', 'pending', 'future', 'private'], $a['post_status']);
    }

    /**
     * A crafted status list can't smuggle in arbitrary values. What survives
     * here is publish alone, which collapses back to the plain string — the
     * exact args a public render would have built anyway.
     */
    public function test_status_is_allow_listed(): void {
        $a = QueryLoop::build_args($this->cfg(), 1, [], ['publish', 'trash', 'nonsense']);
        $this->assertSame('publish', $a['post_status']);

        // A real editing list keeps its allowed members and drops the rest.
        $b = QueryLoop::build_args($this->cfg(), 1, [], ['draft', 'trash', 'auto-draft']);
        $this->assertSame(['draft'], $b['post_status']);
    }

    /** An empty or all-junk status list falls back to the safe default. */
    public function test_empty_status_falls_back_to_publish(): void {
        $this->assertSame('publish', QueryLoop::build_args($this->cfg(), 1, [], [])['post_status']);
        $this->assertSame('publish', QueryLoop::build_args($this->cfg(), 1, [], ['trash'])['post_status']);
    }

    /* ------------------------------------------------------------------ *
     *  ORDER BY A FIELD (gcb-pro's leaderboard, 2026-09-22): a listing's
     *  order is the design's — "highest score first" — and a score is meta,
     *  not a post word. `meta_value_num` sorts as a number; a bare
     *  `meta_value` as words. Neither means anything without the key, so a
     *  meta order that names none falls back to date rather than emitting a
     *  half-built query.
     * ------------------------------------------------------------------ */

    public function test_orderby_a_meta_key_numerically(): void {
        $a = QueryLoop::build_args($this->cfg(['orderby' => 'meta_value_num', 'metaKey' => 'score', 'order' => 'DESC']));
        $this->assertSame('meta_value_num', $a['orderby']);
        $this->assertSame('score', $a['meta_key']);
        $this->assertSame('DESC', $a['order']);
    }

    public function test_orderby_a_meta_key_as_words(): void {
        $a = QueryLoop::build_args($this->cfg(['orderby' => 'meta_value', 'metaKey' => 'machine']));
        $this->assertSame('meta_value', $a['orderby']);
        $this->assertSame('machine', $a['meta_key']);
    }

    public function test_a_meta_order_without_a_key_falls_back_to_date(): void {
        $a = QueryLoop::build_args($this->cfg(['orderby' => 'meta_value_num']));
        $this->assertSame('date', $a['orderby']);
        $this->assertArrayNotHasKey('meta_key', $a);
    }

    public function test_the_meta_key_is_sanitised(): void {
        $a = QueryLoop::build_args($this->cfg(['orderby' => 'meta_value_num', 'metaKey' => 'sc ore); DROP']));
        $this->assertSame('scoredrop', $a['meta_key']);
    }

    public function test_a_post_order_carries_no_meta_key(): void {
        $a = QueryLoop::build_args($this->cfg(['orderby' => 'title', 'metaKey' => 'score']));
        $this->assertSame('title', $a['orderby']);
        $this->assertArrayNotHasKey('meta_key', $a, 'a key beside a post word is ignored, not smuggled in');
    }

    /* ------------------------------------------------------------------ *
     *  BARE ITEMS (the same leaderboard): the items wrapper is right between
     *  a card grid and its cards and WRONG inside a <tbody>, where a browser
     *  foster-parents the div out of the table and the rows lose their
     *  layout. A caller whose region element is the layout asks for the
     *  items bare — no wrapper, no pager — and shapes the empty state as one
     *  of its own items.
     * ------------------------------------------------------------------ */

    private function res(int $total_pages = 2): array {
        return ['posts' => [], 'page' => 1, 'per_page' => 50, 'total' => 3, 'total_pages' => $total_pages];
    }

    public function test_items_are_wrapped_and_paged_by_default(): void {
        $out = QueryLoop::list_markup('<tr></tr>', $this->res(), 'numbered', [], 'No results.');
        $this->assertStringContainsString('<div class="gcb-queryloop__items"', $out);
        $this->assertStringContainsString('gcb-queryloop__pager', $out);
    }

    public function test_bare_items_have_no_wrapper_and_no_pager(): void {
        $out = QueryLoop::list_markup('<tr>a</tr><tr>b</tr>', $this->res(), 'numbered', ['wrapper' => false], 'No results.');
        $this->assertSame('<tr>a</tr><tr>b</tr>', $out);
    }

    public function test_bare_and_empty_takes_the_callers_item(): void {
        $out = QueryLoop::list_markup('', $this->res(0), 'numbered', [
            'wrapper' => false,
            'empty'   => static function ($message) { return '<tr><td colspan="5">' . $message . '</td></tr>'; },
        ], 'No results.');
        $this->assertSame('<tr><td colspan="5">No results.</td></tr>', $out);
    }

    public function test_bare_and_empty_with_no_item_given_prints_nothing(): void {
        $out = QueryLoop::list_markup('', $this->res(0), 'numbered', ['wrapper' => false], 'No results.');
        $this->assertSame('', $out, 'a <p> in a tbody would be foster-parented out; an empty table is honest');
    }

    public function test_wrapped_and_empty_keeps_the_message_paragraph(): void {
        $out = QueryLoop::list_markup('', $this->res(0), 'numbered', [], 'No results.');
        $this->assertStringContainsString('<p class="gcb-queryloop__empty"', $out);
        $this->assertStringContainsString('No results.', $out);
    }

    /* AN EMPTY LIST IN THE EDITOR SHOWS ITS DRAWN CARDS, FADED (Mark, 2026-10-07: "empty post-type lists") */
    public function test_empty_with_a_sample_shows_the_note_and_the_faded_cards(): void {
        $out = QueryLoop::list_markup('', $this->res(0), 'numbered', ['sample' => '<article>Naomi</article>'], 'No Testimonials yet', 'testimonial');
        $this->assertStringContainsString('gcb-queryloop__empty--sample', $out);
        $this->assertStringContainsString('No Testimonials yet', $out);
        $this->assertMatchesRegularExpression('#<div class="gcb-queryloop__sample" inert aria-hidden="true">\s*<article>Naomi</article>#', $out);
    }

    public function test_a_sample_is_never_printed_over_real_items(): void {
        $out = QueryLoop::list_markup('<article>Real</article>', $this->res(), 'numbered', ['sample' => '<article>Naomi</article>'], 'x');
        $this->assertStringNotContainsString('Naomi', $out);
    }

    public function test_a_bare_list_keeps_its_own_empty_item_and_no_sample(): void {
        $out = QueryLoop::list_markup('', $this->res(0), 'numbered', ['wrapper' => false, 'sample' => '<tr>Naomi</tr>'], 'x');
        $this->assertSame('', $out);
    }
}
