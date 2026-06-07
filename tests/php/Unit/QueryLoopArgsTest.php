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
}
