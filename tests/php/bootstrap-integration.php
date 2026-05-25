<?php
/**
 * Bootstrap for the "integration" PHPUnit suite.
 *
 * Loads WP core + the WP PHPUnit test framework (installed via
 * bin/install-wp-tests.sh into /tmp/wordpress-tests-lib), then hooks our
 * plugin into the muplugins_loaded action so it's active for every test.
 *
 * Run locally: composer test:integration
 */

$_tests_dir = getenv('WP_TESTS_DIR') ?: '/tmp/wordpress-tests-lib';

if (!file_exists("$_tests_dir/includes/functions.php")) {
    fwrite(STDERR, "WordPress test framework not found at $_tests_dir.\n");
    fwrite(STDERR, "Run: bin/install-wp-tests.sh\n");
    exit(1);
}

require_once "$_tests_dir/includes/functions.php";

// Load our plugin before WP fires muplugins_loaded so our hooks land.
tests_add_filter('muplugins_loaded', function () {
    require dirname(__DIR__, 2) . '/gcb-lite.php';
});

// Hand control to the WP test framework — this boots WP and loads
// PHPUnit\Framework\TestCase + WP_UnitTestCase for our tests to extend.
require "$_tests_dir/includes/bootstrap.php";

// Composer autoloader for GCBLite\ and our GCBLite\Tests\ namespace.
// Required AFTER the WP bootstrap so we don't accidentally shadow any
// WP-provided classes.
require_once dirname(__DIR__, 2) . '/vendor/autoload.php';
