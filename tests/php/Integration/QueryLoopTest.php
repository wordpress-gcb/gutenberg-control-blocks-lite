<?php
/**
 * @covers \GCBLite\Blocks\Queries\QueryLoop
 *
 * Integration: QueryLoop runs a real paginated WP_Query with taxonomy filtering,
 * so we verify against real posts + terms. The pure arg-building is unit-tested
 * separately (QueryLoopArgsTest).
 */

use GCBLite\Blocks\Queries\QueryLoop;

class GcbLite_QueryLoopTest extends WP_UnitTestCase {

    private $dept_eng;
    private $dept_design;

    public function set_up() {
        parent::set_up();
        register_post_type('ql_member', ['public' => true, 'show_in_rest' => true, 'supports' => ['title']]);
        register_taxonomy('ql_dept', 'ql_member', ['public' => true, 'hierarchical' => true]);

        $this->dept_eng    = self::factory()->term->create(['taxonomy' => 'ql_dept', 'name' => 'Engineering', 'slug' => 'engineering']);
        $this->dept_design = self::factory()->term->create(['taxonomy' => 'ql_dept', 'name' => 'Design', 'slug' => 'design']);

        // 25 members: odd → engineering, even → design. Titled for ASC ordering.
        for ($i = 1; $i <= 25; $i++) {
            $pid = self::factory()->post->create([
                'post_type'   => 'ql_member',
                'post_status' => 'publish',
                'post_title'  => sprintf('Member %02d', $i),
            ]);
            wp_set_object_terms($pid, [$i % 2 ? $this->dept_eng : $this->dept_design], 'ql_dept');
        }
    }

    public function tear_down() {
        unregister_taxonomy('ql_dept');
        unregister_post_type('ql_member');
        parent::tear_down();
    }

    private function cfg(array $over = []): array {
        return array_merge([
            'postType' => 'ql_member',
            'perPage'  => 10,
            'orderby'  => 'title',
            'order'    => 'ASC',
            'pagination' => 'numbered',
            'filterTaxonomies' => [['slug' => 'ql_dept', 'label' => 'Department']],
        ], $over);
    }

    public function test_paginates_with_correct_totals() {
        $p1 = QueryLoop::query($this->cfg(), 1);
        $this->assertCount(10, $p1['posts']);
        $this->assertSame(25, $p1['total']);
        $this->assertSame(3, $p1['total_pages']);
        $this->assertSame('Member 01', $p1['posts'][0]->post_title, 'ASC by title');

        $p3 = QueryLoop::query($this->cfg(), 3);
        $this->assertCount(5, $p3['posts'], 'last page has the remainder');
    }

    public function test_taxonomy_filter_limits_results() {
        $eng = QueryLoop::query($this->cfg(), 1, ['ql_dept' => ['engineering']]);
        $this->assertSame(13, $eng['total'], '13 odd-numbered members are Engineering');
        foreach ($eng['posts'] as $p) {
            $terms = wp_get_object_terms($p->ID, 'ql_dept', ['fields' => 'slugs']);
            $this->assertContains('engineering', $terms);
        }
    }

    public function test_undeclared_taxonomy_filter_is_ignored() {
        // 'other_tax' is not in filterTaxonomies → must not constrain the query.
        $r = QueryLoop::query($this->cfg(), 1, ['other_tax' => ['anything']]);
        $this->assertSame(25, $r['total']);
    }

    public function test_render_items_emits_items_and_pager() {
        $_GET['gcb_page'] = 2;
        $_GET['gcb_fragment'] = '1';
        $html = QueryLoop::render_items($this->cfg(), function ($post) {
            return '<li class="m">' . esc_html($post->post_title) . '</li>';
        });
        unset($_GET['gcb_page'], $_GET['gcb_fragment']);

        $this->assertSame(10, substr_count($html, '<li class="m">'), 'page 2 has 10 items');
        $this->assertStringContainsString('gcb-queryloop__items', $html);
        $this->assertStringContainsString('data-page="2"', $html);
        $this->assertStringContainsString('gcb-queryloop__pager--numbered', $html);
    }

    public function test_loadmore_pager_hidden_on_last_page() {
        $cfg = $this->cfg(['pagination' => 'loadmore']);
        $_GET['gcb_page'] = 3; // last page
        $html = QueryLoop::render_items($cfg, fn($post) => '<li>x</li>');
        unset($_GET['gcb_page']);
        $this->assertStringNotContainsString('gcb-queryloop__loadmore', $html, 'no Load more on the final page');
    }

    public function test_empty_result_renders_empty_message() {
        // Filter to a term with no posts.
        $_GET['gcb_tax_ql_dept'] = 'nonexistent-term';
        $html = QueryLoop::render_items($this->cfg(), fn($post) => '<li>x</li>');
        unset($_GET['gcb_tax_ql_dept']);
        $this->assertStringContainsString('gcb-queryloop__empty', $html);
    }
}
