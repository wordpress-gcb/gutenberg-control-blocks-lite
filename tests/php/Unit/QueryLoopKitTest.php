<?php
/**
 * QueryLoop::kit_words / kit_args — the filter kit's address words as a WP_Query (2026-10-20). Pure.
 *
 * @covers \GCBLite\Blocks\Queries\QueryLoop
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Blocks\Queries\QueryLoop;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../includes/Blocks/Queries/QueryLoop.php';

if (!function_exists('sanitize_key')) {
    eval('function sanitize_key($key) { return strtolower(preg_replace("/[^a-zA-Z0-9_\\-]/", "", (string) $key)); }');
}

class QueryLoopKitTest extends TestCase {

    private const TAXES  = ['location', 'amenity'];
    private const FIELDS = ['price' => 'number', 'guests' => 'number', 'host_name' => 'text', 'opened' => 'date'];

    public function test_only_the_post_types_own_words_are_kept(): void {
        $got = QueryLoop::kit_words(['location' => 'Robe', 'price_min' => '100', 'sort' => 'price:asc', 'q' => 'sea', 'evil' => 'x', 'post_status' => 'trash', 'gcb_page' => '2', 'amenity' => ''], self::TAXES, self::FIELDS);
        $this->assertSame(['location' => 'Robe', 'price_min' => '100', 'sort' => 'price:asc', 'q' => 'sea'], $got);
    }

    public function test_a_taxonomy_is_any_of_its_term_names(): void {
        $a = QueryLoop::kit_args(['location' => 'Robe, Edithburgh'], self::TAXES, self::FIELDS);
        $this->assertSame([['taxonomy' => 'location', 'field' => 'name', 'terms' => ['Robe', 'Edithburgh'], 'operator' => 'IN']], $a['tax_query']);
    }

    public function test_two_taxonomies_must_both_hold(): void {
        $a = QueryLoop::kit_args(['location' => 'Robe', 'amenity' => 'Pool'], self::TAXES, self::FIELDS);
        $this->assertSame('AND', $a['tax_query']['relation']);
        $this->assertCount(3, $a['tax_query']);
    }

    public function test_a_least_and_a_most_are_typed(): void {
        $a = QueryLoop::kit_args(['price_min' => '100', 'opened_max' => '2026-10-19'], self::TAXES, self::FIELDS);
        $this->assertSame(['key' => 'price', 'value' => '100', 'compare' => '>=', 'type' => 'NUMERIC'], $a['meta_query'][0]);
        $this->assertSame(['key' => 'opened', 'value' => '2026-10-19', 'compare' => '<=', 'type' => 'DATE'], $a['meta_query'][1]);
    }

    public function test_a_number_fields_spans_are_any_of(): void {
        $a = QueryLoop::kit_args(['price' => '0-200,500-'], self::TAXES, self::FIELDS);
        $any = $a['meta_query'][0];
        $this->assertSame('OR', $any['relation']);
        $this->assertSame(['key' => 'price', 'value' => '500', 'compare' => '>=', 'type' => 'NUMERIC'], $any[1][0]);
    }

    public function test_a_text_field_is_any_of_its_values(): void {
        $a = QueryLoop::kit_args(['host_name' => 'Emily,Joel'], self::TAXES, self::FIELDS);
        $this->assertSame(['key' => 'host_name', 'value' => ['Emily', 'Joel'], 'compare' => 'IN', 'type' => 'CHAR'], $a['meta_query'][0]);
    }

    public function test_the_order_reads_a_number_as_a_number(): void {
        $this->assertSame(['orderby' => 'meta_value_num', 'meta_key' => 'price', 'order' => 'DESC'], QueryLoop::kit_args(['sort' => 'price:desc'], self::TAXES, self::FIELDS));
        $this->assertSame(['orderby' => 'title', 'order' => 'ASC'], QueryLoop::kit_args(['sort' => 'title:asc'], self::TAXES, self::FIELDS));
        $this->assertSame([], QueryLoop::kit_args(['sort' => 'evil:asc'], self::TAXES, self::FIELDS));
    }

    public function test_the_kits_args_join_the_declared_filters(): void {
        $kit  = QueryLoop::kit_args(['location' => 'Robe', 'price_min' => '100', 'sort' => 'price:asc'], self::TAXES, self::FIELDS);
        $args = QueryLoop::build_args(['postType' => 'listing', 'filterTaxonomies' => [['slug' => 'department']]], 2, ['department' => ['eng']], [], $kit);
        $this->assertSame('AND', $args['tax_query']['relation']);
        $this->assertSame('meta_value_num', $args['orderby']);
        $this->assertSame('price', $args['meta_key']);
        $this->assertSame(2, $args['paged']);
        $this->assertSame('>=', $args['meta_query'][0]['compare']);
    }
}
