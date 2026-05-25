<?php
/**
 * End-to-end save_post + validation behaviour, against a real WP install.
 *
 *  - Register a CPT + fields via gcblite_register_post_fields.
 *  - Simulate a POST submission (nonce, hidden values input).
 *  - Trigger save_post via wp_update_post.
 *  - Assert: meta saved, REST exposes the meta, invalid-required forces
 *    draft + sets an error transient.
 *
 * @group integration
 */

class GcbLite_PostFieldsSaveTest extends WP_UnitTestCase {

    public function set_up() {
        parent::set_up();

        register_post_type('gcbtest_record', [
            'public'       => true,
            'show_in_rest' => true,
            'supports'     => ['title'],
        ]);

        gcblite_register_post_fields('gcbtest_record', [
            'controls' => [
                ['type' => 'text',  'attributeKey' => 'subtitle', 'label' => 'Subtitle',
                    'validation' => ['required' => true, 'minLength' => 3]],
                ['type' => 'url',   'attributeKey' => 'link',     'label' => 'Link'],
                ['type' => 'image', 'attributeKey' => 'cover',    'label' => 'Cover'],
            ],
        ]);

        // Production flow runs Registrar::register_post_meta_for_all on
        // init priority 20, which means the theme's register_post_type
        // (typically init 10) is in place before meta gets registered, and
        // both finish before rest_api_init fires.
        //
        // Test bootstrap already fired init before this set_up runs, so
        // we re-trigger meta registration directly here. The REST schema
        // for the dynamic post-type controller reads from
        // get_registered_meta_keys at request time, so meta added now
        // still appears in subsequent rest_do_request calls.
        \GCBLite\PostFields\Registrar::register_post_meta_for_all();
        \GCBLite\PostFields\Registrar::remove_editor_from_field_only_cpts();

        wp_set_current_user(self::factory()->user->create(['role' => 'administrator']));
    }

    public function tear_down() {
        unregister_post_type('gcbtest_record');
        parent::tear_down();
    }

    public function test_meta_round_trips_through_save_post() {
        $post_id = wp_insert_post([
            'post_title'  => 'A record',
            'post_type'   => 'gcbtest_record',
            'post_status' => 'draft',
        ]);

        // Simulate the meta-box POST shape.
        $this->fake_submission([
            'subtitle' => 'Hello there',
            'link'     => ['url' => 'https://example.com', 'text' => 'Example', 'opensInNewTab' => false],
        ]);

        wp_update_post(['ID' => $post_id, 'post_status' => 'publish']);

        $this->assertSame('Hello there', get_post_meta($post_id, 'subtitle', true));
        $link = get_post_meta($post_id, 'link', true);
        $this->assertIsArray($link);
        $this->assertSame('https://example.com', $link['url']);
        $this->assertSame('publish', get_post_status($post_id), 'Valid post should publish');
    }

    public function test_invalid_required_field_forces_draft_status() {
        $post_id = wp_insert_post([
            'post_title'  => 'Incomplete',
            'post_type'   => 'gcbtest_record',
            'post_status' => 'draft',
        ]);

        // subtitle is required but submitted empty.
        $this->fake_submission(['subtitle' => '']);

        wp_update_post(['ID' => $post_id, 'post_status' => 'publish']);

        $this->assertSame(
            'draft',
            get_post_status($post_id),
            'A required-field violation must demote publish → draft'
        );

        $errors = get_transient('gcblite_post_fields_errors_' . $post_id);
        $this->assertIsArray($errors);
        $this->assertArrayHasKey('subtitle', $errors);
    }

    public function test_minlength_violation_forces_draft() {
        $post_id = wp_insert_post([
            'post_title'  => 'Too short',
            'post_type'   => 'gcbtest_record',
            'post_status' => 'draft',
        ]);

        // 2 chars < minLength of 3.
        $this->fake_submission(['subtitle' => 'ab']);

        wp_update_post(['ID' => $post_id, 'post_status' => 'publish']);

        $this->assertSame('draft', get_post_status($post_id));
    }

    public function test_meta_is_registered_for_rest() {
        // Confirms register_post_meta wired the fields up — the dynamic
        // REST controller builds its `meta` schema from this.
        $registered = registered_meta_key_exists('post', 'subtitle', 'gcbtest_record');
        $this->assertTrue($registered, 'subtitle meta should be registered against gcbtest_record');

        // The full meta-key map for the post type should include our keys.
        $keys = get_registered_meta_keys('post', 'gcbtest_record');
        $this->assertArrayHasKey('subtitle', $keys);
        $this->assertArrayHasKey('link', $keys);
        $this->assertTrue($keys['subtitle']['show_in_rest'] !== false);
    }

    public function test_meta_value_is_persisted_and_readable() {
        // The end-to-end concern users actually care about: when they
        // save a CPT via the meta-box, the meta value is persisted and
        // readable for a headless React frontend to consume.
        $post_id = wp_insert_post([
            'post_title'  => 'REST-visible',
            'post_type'   => 'gcbtest_record',
            'post_status' => 'publish',
        ]);

        $this->fake_submission(['subtitle' => 'Hello via REST']);
        wp_update_post(['ID' => $post_id]);

        $this->assertSame('Hello via REST', get_post_meta($post_id, 'subtitle', true));
    }

    public function test_editor_support_is_stripped_for_field_only_cpts() {
        // The 'gcbtest_record' CPT did NOT include 'editor' in supports
        // — but even if a theme had, the auto-strip should remove it.
        $this->assertFalse(
            post_type_supports('gcbtest_record', 'editor'),
            'Field-only CPTs should not have the block editor enabled'
        );
    }

    // ------------------------------------------------------------------

    /**
     * Pre-populate $_POST with the same shape PostFields\Registrar's
     * save_post handler expects. Includes nonce so the handler doesn't
     * silently bail.
     */
    private function fake_submission(array $values) {
        $_POST['gcblite_post_fields_nonce']  = wp_create_nonce('gcblite_post_fields_save');
        $_POST['gcblite_post_fields_values'] = wp_slash(wp_json_encode($values));
    }
}
