<?php
/**
 * @covers \GCBLite\Blocks\Queries\Collection
 *
 * Integration tests because Collection delegates to WP_Query, which
 * needs a real WP install. Pure attr-shape branches would be a unit
 * test, but the meaningful behaviour (orderby preservation, count
 * capping, post_status filtering) is what WP gives us, so we verify
 * against real posts.
 */

use GCBLite\Blocks\Queries\Collection;

class GcbLite_CollectionQueryTest extends WP_UnitTestCase {

    public function set_up() {
        parent::set_up();
        register_post_type('cq_project', [
            'public'       => true,
            'show_in_rest' => true,
            'supports'     => ['title'],
        ]);
    }

    public function tear_down() {
        unregister_post_type('cq_project');
        parent::tear_down();
    }

    public function test_latest_returns_count_in_date_order() {
        // Insert four projects with deterministic dates so the test
        // isn't flaky against same-second resolution.
        $ids = [];
        for ($i = 1; $i <= 4; $i++) {
            $ids[] = self::factory()->post->create([
                'post_type'   => 'cq_project',
                'post_status' => 'publish',
                'post_title'  => "P$i",
                'post_date'   => "2025-01-0$i 00:00:00",
            ]);
        }

        $posts = Collection::query(['source' => 'latest', 'count' => 3], 'cq_project');
        $this->assertCount(3, $posts);
        $titles = array_map(fn($p) => $p->post_title, $posts);
        $this->assertSame(['P4', 'P3', 'P2'], $titles, 'Most recent first');
    }

    public function test_latest_defaults_to_six_when_count_missing() {
        for ($i = 0; $i < 10; $i++) {
            self::factory()->post->create(['post_type' => 'cq_project', 'post_status' => 'publish']);
        }
        $posts = Collection::query(['source' => 'latest'], 'cq_project');
        $this->assertCount(6, $posts);
    }

    public function test_latest_count_zero_returns_empty() {
        self::factory()->post->create(['post_type' => 'cq_project', 'post_status' => 'publish']);
        $posts = Collection::query(['source' => 'latest', 'count' => 0], 'cq_project');
        $this->assertSame([], $posts);
    }

    public function test_latest_count_caps_at_max() {
        for ($i = 0; $i < 5; $i++) {
            self::factory()->post->create(['post_type' => 'cq_project', 'post_status' => 'publish']);
        }
        $posts = Collection::query(
            ['source' => 'latest', 'count' => 9999],
            'cq_project',
            ['max_count' => 3]
        );
        $this->assertCount(3, $posts);
    }

    public function test_latest_excludes_draft_posts() {
        self::factory()->post->create(['post_type' => 'cq_project', 'post_status' => 'publish', 'post_title' => 'Live']);
        self::factory()->post->create(['post_type' => 'cq_project', 'post_status' => 'draft',   'post_title' => 'Draft']);
        $posts = Collection::query(['source' => 'latest'], 'cq_project');
        $titles = array_map(fn($p) => $p->post_title, $posts);
        $this->assertContains('Live', $titles);
        $this->assertNotContains('Draft', $titles);
    }

    public function test_manual_returns_posts_in_specified_order() {
        $a = self::factory()->post->create(['post_type' => 'cq_project', 'post_status' => 'publish', 'post_title' => 'A']);
        $b = self::factory()->post->create(['post_type' => 'cq_project', 'post_status' => 'publish', 'post_title' => 'B']);
        $c = self::factory()->post->create(['post_type' => 'cq_project', 'post_status' => 'publish', 'post_title' => 'C']);

        $posts = Collection::query(
            ['source' => 'manual', 'post_ids' => [$c, $a, $b]],
            'cq_project'
        );
        $titles = array_map(fn($p) => $p->post_title, $posts);
        $this->assertSame(['C', 'A', 'B'], $titles, 'Manual order must be preserved');
    }

    public function test_manual_drops_invalid_ids_and_empty() {
        $valid = self::factory()->post->create(['post_type' => 'cq_project', 'post_status' => 'publish']);

        $posts = Collection::query(
            ['source' => 'manual', 'post_ids' => ['', null, $valid, 'not-a-number', 0, -3]],
            'cq_project'
        );
        $this->assertCount(1, $posts);
        $this->assertSame($valid, $posts[0]->ID);
    }

    public function test_manual_with_empty_post_ids_returns_empty() {
        self::factory()->post->create(['post_type' => 'cq_project', 'post_status' => 'publish']);
        $this->assertSame([], Collection::query(['source' => 'manual', 'post_ids' => []], 'cq_project'));
        $this->assertSame([], Collection::query(['source' => 'manual'], 'cq_project'));
    }

    public function test_unknown_source_defaults_to_latest() {
        self::factory()->post->create(['post_type' => 'cq_project', 'post_status' => 'publish']);
        $posts = Collection::query(['source' => 'sideways'], 'cq_project');
        $this->assertCount(1, $posts);
    }

    public function test_empty_post_type_returns_empty() {
        $this->assertSame([], Collection::query(['source' => 'latest'], ''));
    }
}
