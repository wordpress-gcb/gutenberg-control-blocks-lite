<?php
/**
 * The control vocabulary has two readers, and they must agree.
 *
 *   ControlDocs::list_types()  — schemas/controls/*.md, the CANONICAL list.
 *                                 Docs are the source of truth: add a control
 *                                 by writing its doc file.
 *   BlockGcbValidator          — BUILTIN_CONTROL_TYPES, the list that decides
 *                                 whether a block.fields.json is accepted.
 *
 * They drifted once already. `heading.md` declared `type: heading` while the
 * SDK registry, the validator and every real block used `heading-level`. The
 * consequences were both silent: `ControlDocs::get('heading-level')` 404'd in
 * the Schema Builder help panel (get() resolves by FILENAME), and the type the
 * docs advertised was rejected by the validator. Fixed 2026-09-22 by renaming
 * the file to heading-level.md and inverting the alias.
 *
 * This is the same guarantee gcb-pro's FieldVocabularyDerivedTest enforces one
 * layer up, for the same reason: a list you retype is a list that decays. Pro
 * derives its field drawer from ControlDocs; if these two disagree, pro offers
 * kimi a type the validator will reject — which is exactly the google-map bug
 * (a control existed, nothing named it, so the model shipped two text boxes).
 *
 * @covers \GCBLite\Docs\ControlDocs
 * @covers \GCBLite\Validation\BlockGcbValidator
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Docs\ControlDocs;
use GCBLite\Validation\BlockGcbValidator;
use PHPUnit\Framework\TestCase;

if (!defined('GCBLITE_PLUGIN_DIR')) {
    define('GCBLITE_PLUGIN_DIR', dirname(__DIR__, 3) . '/');
}

class ControlVocabularyDerivedTest extends TestCase {

    /** The validator's private allow-list, read reflectively. */
    private function validator_types(): array {
        $ref = new \ReflectionClass(BlockGcbValidator::class);
        $types = $ref->getConstant('BUILTIN_CONTROL_TYPES');
        sort($types);
        return array_values(array_unique($types));
    }

    private function documented_types(): array {
        $types = ControlDocs::list_types();
        sort($types);
        return array_values(array_unique($types));
    }

    /**
     * The headline guarantee, asserted in BOTH directions so neither list can
     * grow an entry the other doesn't know about.
     */
    public function test_documented_and_validated_vocabularies_match() {
        $documented = $this->documented_types();
        $validated  = $this->validator_types();

        $this->assertSame(
            [],
            array_values(array_diff($documented, $validated)),
            'Types are documented (schemas/controls/*.md, incl. aliases) but REJECTED by '
            . 'BlockGcbValidator. Docs are canonical — add them to BUILTIN_CONTROL_TYPES.'
        );

        $this->assertSame(
            [],
            array_values(array_diff($validated, $documented)),
            'Types are accepted by BlockGcbValidator but have NO doc file. Docs are '
            . 'canonical — write schemas/controls/<type>.md (or drop the type).'
        );
    }

    /**
     * get() resolves by filename, so every advertised type must be fetchable
     * under the exact name list_types() hands out. This is the half the
     * heading/heading-level drift broke: the type was listed but not gettable.
     *
     * Aliases are exempt — they resolve to their canonical file, not one of
     * their own — as are the structural types, which list_types() appends
     * explicitly and which have no doc file by design.
     */
    public function test_every_non_alias_type_has_a_fetchable_doc() {
        $structural = BlockGcbValidator::STRUCTURAL_TYPES;
        $aliases    = $this->declared_aliases();

        foreach ($this->documented_types() as $type) {
            if (in_array($type, $structural, true)) continue;
            if (in_array($type, $aliases, true))    continue;

            $this->assertNotNull(
                ControlDocs::get($type),
                "ControlDocs::get('{$type}') returned null. list_types() advertises it, "
                . "but get() resolves by FILENAME — so schemas/controls/{$type}.md must exist."
            );
        }
    }

    /**
     * A doc file's `type:` frontmatter must equal its filename. When they
     * diverge the file is reachable under one name and advertised under
     * another — precisely the heading/heading-level failure.
     */
    public function test_type_frontmatter_matches_filename() {
        foreach (glob(ControlDocs::dir() . '/*.md') as $path) {
            $slug = basename($path, '.md');
            if ($slug === 'README') continue;

            $front = ControlDocs::get($slug);
            $this->assertIsArray($front, "Unparseable frontmatter in {$slug}.md");

            $this->assertSame(
                $slug,
                $front['type'] ?? null,
                "schemas/controls/{$slug}.md declares `type: " . ($front['type'] ?? 'null')
                . "` but lives at {$slug}.md. The two must match; put the other name in `aliases:`."
            );
        }
    }

    /** Every alias declared across the doc files. */
    private function declared_aliases(): array {
        $aliases = [];
        foreach (glob(ControlDocs::dir() . '/*.md') as $path) {
            $slug = basename($path, '.md');
            if ($slug === 'README') continue;
            $front = ControlDocs::get($slug);
            foreach ((array) ($front['aliases'] ?? []) as $alias) {
                if (is_string($alias) && $alias !== '') $aliases[] = $alias;
            }
        }
        return array_values(array_unique($aliases));
    }
}
