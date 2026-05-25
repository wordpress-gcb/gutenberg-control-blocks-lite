#!/usr/bin/env bash
#
# Sets up a local WordPress install + the official WP PHPUnit test
# framework for our integration suite. Uses SQLite via the
# wp-sqlite-db drop-in — no MySQL server required.
#
# Usage:
#   bin/install-wp-tests.sh [WP_VERSION]
#
# Defaults:
#   WP_VERSION    latest
#   WP_TESTS_DIR  /tmp/wordpress-tests-lib
#   WP_CORE_DIR   /tmp/wordpress
#
# Idempotent — re-running upgrades to the requested WP version and
# refreshes the SQLite drop-in.

set -euo pipefail

WP_VERSION="${1:-latest}"
WP_TESTS_DIR="${WP_TESTS_DIR:-/tmp/wordpress-tests-lib}"
WP_CORE_DIR="${WP_CORE_DIR:-/tmp/wordpress}"

download() {
    if command -v curl >/dev/null; then
        curl -fsSL "$1" -o "$2"
    else
        wget -q "$1" -O "$2"
    fi
}

resolve_wp_version() {
    if [[ "$WP_VERSION" == "latest" ]]; then
        WP_VERSION=$(curl -fsSL https://api.wordpress.org/core/version-check/1.7/ \
            | grep -oE '"current":"[^"]+"' \
            | head -1 \
            | cut -d'"' -f4)
        echo "→ Resolved 'latest' to WordPress $WP_VERSION"
    fi
}

install_wp() {
    if [[ -f "$WP_CORE_DIR/wp-load.php" ]]; then
        local installed
        installed=$(grep -oE "wp_version = '[^']+'" "$WP_CORE_DIR/wp-includes/version.php" | cut -d"'" -f2 || true)
        if [[ "$installed" == "$WP_VERSION" ]]; then
            echo "→ WordPress $WP_VERSION already at $WP_CORE_DIR"
            return
        fi
        echo "→ Replacing WordPress $installed → $WP_VERSION"
        rm -rf "$WP_CORE_DIR"
    fi

    echo "→ Downloading WordPress $WP_VERSION → $WP_CORE_DIR"
    mkdir -p "$WP_CORE_DIR"
    download "https://wordpress.org/wordpress-${WP_VERSION}.tar.gz" /tmp/wordpress.tar.gz
    tar --strip-components=1 -xzf /tmp/wordpress.tar.gz -C "$WP_CORE_DIR"
    rm /tmp/wordpress.tar.gz
}

install_test_suite() {
    if [[ -d "$WP_TESTS_DIR/includes" ]]; then
        echo "→ WP test framework already at $WP_TESTS_DIR"
        return
    fi

    # wordpress-develop tags use SemVer x.y.z (e.g. 7.0.0) while wp.org
    # releases use x.y for the .0 (e.g. 7.0). Normalise.
    local develop_tag="$WP_VERSION"
    if [[ "$WP_VERSION" =~ ^[0-9]+\.[0-9]+$ ]]; then
        develop_tag="${WP_VERSION}.0"
    fi

    echo "→ Downloading WP test framework $develop_tag → $WP_TESTS_DIR"
    mkdir -p "$WP_TESTS_DIR"
    local tarball="/tmp/wp-develop-$develop_tag.tar.gz"
    # Use GitHub mirror — no SVN required, just curl/tar.
    download "https://github.com/WordPress/wordpress-develop/archive/refs/tags/${develop_tag}.tar.gz" "$tarball"
    local extract_dir="/tmp/wp-develop-extracted-$$"
    mkdir -p "$extract_dir"
    tar -xzf "$tarball" -C "$extract_dir"
    local source_root="$extract_dir/wordpress-develop-$develop_tag/tests/phpunit"
    if [[ ! -d "$source_root/includes" ]]; then
        echo "✗ Unexpected tarball layout — couldn't find tests/phpunit/includes" >&2
        ls "$extract_dir" >&2
        exit 1
    fi
    cp -R "$source_root/includes" "$WP_TESTS_DIR/includes"
    [[ -d "$source_root/data" ]] && cp -R "$source_root/data" "$WP_TESTS_DIR/data"
    rm -rf "$tarball" "$extract_dir"
}

install_sqlite_drop_in() {
    local plugin_dir="$WP_CORE_DIR/wp-content/plugins/sqlite-database-integration"
    if [[ ! -d "$plugin_dir" ]]; then
        echo "→ Installing SQLite drop-in (no MySQL required)"
        mkdir -p "$plugin_dir"
        download "https://downloads.wordpress.org/plugin/sqlite-database-integration.latest-stable.zip" /tmp/sqlite.zip
        unzip -q /tmp/sqlite.zip -d "$WP_CORE_DIR/wp-content/plugins/"
        rm /tmp/sqlite.zip
    fi
    # The drop-in needs db.php at wp-content/db.php to take over.
    cp "$plugin_dir/db.copy" "$WP_CORE_DIR/wp-content/db.php"
    # Patch the drop-in's hard-coded plugin path expectation.
    sed -i.bak "s|{SQLITE_IMPLEMENTATION_FOLDER_PATH}|$plugin_dir|g" "$WP_CORE_DIR/wp-content/db.php"
    sed -i.bak "s|{SQLITE_PLUGIN}|sqlite-database-integration/load.php|g" "$WP_CORE_DIR/wp-content/db.php"
    rm -f "$WP_CORE_DIR/wp-content/db.php.bak"
}

create_wp_tests_config() {
    local config="$WP_TESTS_DIR/wp-tests-config.php"
    if [[ -f "$config" ]]; then return; fi

    echo "→ Writing wp-tests-config.php (SQLite mode)"
    cat > "$config" <<PHP
<?php
// WP test framework config — points at the WP core + SQLite drop-in we
// installed above. Used by tests/php/bootstrap-integration.php.

define( 'ABSPATH',         '$WP_CORE_DIR/' );
define( 'WP_TESTS_DOMAIN', 'example.org' );
define( 'WP_TESTS_EMAIL',  'admin@example.org' );
define( 'WP_TESTS_TITLE',  'GCB Lite Test Suite' );
define( 'WP_PHP_BINARY',   'php' );
define( 'WPLANG',          '' );
define( 'WP_DEBUG',        true );

// SQLite drop-in reads these and ignores the DB_* constants entirely,
// but WordPress core still expects the constants to exist.
define( 'DB_NAME',     'wordpress_tests' );
define( 'DB_USER',     'root' );
define( 'DB_PASSWORD', '' );
define( 'DB_HOST',     'localhost' );
define( 'DB_CHARSET',  'utf8' );
define( 'DB_COLLATE',  '' );

\$table_prefix = 'wptests_';
PHP
}

resolve_wp_version
install_wp
install_test_suite
install_sqlite_drop_in
create_wp_tests_config

echo ""
echo "✓ WordPress $WP_VERSION installed at $WP_CORE_DIR"
echo "✓ Test framework at $WP_TESTS_DIR"
echo "✓ SQLite drop-in active"
echo ""
echo "Run integration tests with: composer test:integration"
