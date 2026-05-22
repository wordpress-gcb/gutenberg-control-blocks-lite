<?php
/**
 * Pulls the root element's attributes off rendered HTML so the editor can
 * apply them via useBlockProps() instead of double-wrapping the block.
 *
 * Lifted (and trimmed) from the full plugin's Rendering\Shared\BlockWrapperParser.
 *
 * @package GCBLite\Rendering
 */

namespace GCBLite\Rendering;

if (!defined('ABSPATH')) {
    exit;
}

class BlockWrapperParser {

    /**
     * @param string $html Rendered HTML (from render.php or the component server)
     * @return array{
     *     wrapperAttributes: array<string, string>,
     *     html: string
     * }
     */
    public static function parse($html) {
        $result = [
            'wrapperAttributes' => [],
            'html'              => $html,
        ];

        $html = trim($html);
        if ($html === '') {
            return $result;
        }

        $dom = new \DOMDocument();
        $previous_errors = libxml_use_internal_errors(true);

        try {
            $dom->loadHTML(
                '<?xml encoding="UTF-8">' . $html,
                LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
            );
        } catch (\Throwable $e) {
            libxml_clear_errors();
            libxml_use_internal_errors($previous_errors);
            return $result;
        }
        libxml_clear_errors();
        libxml_use_internal_errors($previous_errors);

        $root = $dom->documentElement;
        if (!$root) {
            return $result;
        }

        $result['wrapperAttributes']['tag'] = $root->nodeName;
        if ($root->hasAttributes()) {
            foreach ($root->attributes as $attr) {
                $result['wrapperAttributes'][$attr->nodeName] = $attr->nodeValue;
            }
        }

        return $result;
    }
}
