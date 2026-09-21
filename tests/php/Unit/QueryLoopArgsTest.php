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
}
