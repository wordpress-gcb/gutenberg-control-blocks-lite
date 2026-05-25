<?php
/**
 * wp-now php entry that boots phpunit's CLI under a loaded WordPress.
 *
 * wp-now runs this file inside a PHP process where wp-load.php has
 * already executed, so WP functions, our plugin, the BlockLoader hooks
 * — everything is real and registered. We then hand control to phpunit
 * via its phar/composer-bin entry.
 *
 * Argv handling: phpunit reads $argv to know which suite + extra flags
 * to use. wp-now strips its own args before invoking the file, so $argv
 * here contains only what we pass after the file path. The wrapping
 * `composer test:integration` script passes `--bootstrap=...` and
 * `--testsuite=integration`.
 *
 * Why not just `wp-now php vendor/bin/phpunit ...`? wp-now requires the
 * PHP file to be its first positional arg AND treats subsequent args
 * as the file's argv. Embedding the phpunit invocation here keeps that
 * contract clean.
 */

if (!defined('ABSPATH')) {
    fwrite(STDERR, "run-integration.php: WordPress not loaded.\n");
    fwrite(STDERR, "Run via: npm run test:integration\n");
    exit(1);
}

require __DIR__ . '/../../vendor/phpunit/phpunit/phpunit';
