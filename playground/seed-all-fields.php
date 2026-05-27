<?php
/**
 * Seed the /all-fields demo page + supporting fixtures.
 *
 * Thin wrapper around the real seed body, which lives at
 * includes/CLI/SeedShowcaseCommand.php and is also exposed as the
 * `wp gcblite seed-showcase` CLI command. This file is what the
 * Playground blueprint's runPHP step includes; the CLI path is for
 * any other GCB install (Kinsta, staging, local).
 *
 * Idempotent — re-runs update existing rows instead of duplicating.
 *
 *   wp eval-file path/to/seed-all-fields.php
 *
 * @package GCBLite\Playground
 */

if (!defined('ABSPATH')) {
    exit;
}

// The plugin's autoloader will be available because by the time the
// blueprint's runPHP step fires, gcb-lite has already booted via
// installPlugin. Defensive include for paranoid environments.
if (!class_exists('GCBLite\\CLI\\SeedShowcaseCommand')) {
    $cli_file = __DIR__ . '/../includes/CLI/SeedShowcaseCommand.php';
    if (file_exists($cli_file)) {
        require_once $cli_file;
    }
}

if (!class_exists('GCBLite\\CLI\\SeedShowcaseCommand')) {
    echo "[gcb-seed] ERROR: SeedShowcaseCommand class not found. Is gcb-lite installed?\n";
    return;
}

$result = \GCBLite\CLI\SeedShowcaseCommand::run();
echo sprintf(
    "[gcb-seed] all-fields page id=%d, sample post id=%d, categories=[%d, %d]\n",
    $result['page_id'],
    $result['sample_post_id'],
    $result['cat_a'],
    $result['cat_b']
);
