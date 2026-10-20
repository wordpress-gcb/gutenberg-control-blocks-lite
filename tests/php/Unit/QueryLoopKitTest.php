<?php
/**
 * THE FILTER KIT'S ANSWER AT THE LIST'S QUERY (2026-10-20): the address is a filter's whole state, read by the plugin
 * that owns the filter (gcb-pro's kit filter, on gcblite_query_loop_kit_args), which says the posts it leaves and their
 * order; the list's query takes them, a page at a time, with its own declared filters still holding. Pure.
 *
 * @covers \GCBLite\Blocks\Queries\QueryLoop
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Blocks\Queries\QueryLoop;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../includes/Blocks/Queries/QueryLoop.php';

class QueryLoopKitTest extends TestCase {

    public function test_the_kits_posts_and_their_order_are_the_lists_a_page_at_a_time(): void {
        $kit  = ['post__in' => [40, 12, 7], 'orderby' => 'post__in'];
        $args = QueryLoop::build_args(['postType' => 'listing'], 2, [], [], $kit);
        $this->assertSame([40, 12, 7], $args['post__in']);
        $this->assertSame('post__in', $args['orderby']);
        $this->assertSame(2, $args['paged']);
    }

    public function test_the_lists_declared_filters_still_hold(): void {
        $kit  = ['post__in' => [40], 'orderby' => 'post__in'];
        $args = QueryLoop::build_args(['postType' => 'listing', 'filterTaxonomies' => [['slug' => 'department']]], 1, ['department' => ['eng']], [], $kit);
        $this->assertSame('department', $args['tax_query'][0]['taxonomy']);
        $this->assertSame([40], $args['post__in']);
    }

    public function test_nothing_from_the_kit_leaves_the_list_as_configured(): void {
        $args = QueryLoop::build_args(['postType' => 'listing'], 1, [], [], []);
        $this->assertArrayNotHasKey('post__in', $args);
    }
}
