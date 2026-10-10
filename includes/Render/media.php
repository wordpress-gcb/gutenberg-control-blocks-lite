<?php
/**
 * THE MEDIA FIELD, AT RENDER — a picture, an uploaded video, or a YouTube / Vimeo link, played by Video.js 10 from
 * its CDN (Mark, 2026-09-24: "we should have a media component that does image or video and supply from external
 * url like youtube or vimeo … all the usual video features like play pause, timeline … that bg video would have
 * been an example of it"; "video doesn't need to work in the block editor only the FE. video code can be on cdn";
 * Plyr is being deprecated into Video.js 10).
 *
 * This runtime lived in gcb-pro (includes/AI/runtime/media.php) and was PASTED into every built render.php that
 * held a media field or a background film — 19 KB a time, four copies in one theme. Moved here 2026-10-10, the day
 * a client's developer read one of those files: the render now calls `gcb_media_html(...)` or
 * `gcb_media_bg_video(...)` and this file, loaded with the plugin, answers. The names are kept so every render
 * already built keeps working; each function is guarded with function_exists, as helpers.php is, so a block ejected
 * to a site without GCB can carry a copy beside its render.php. Keep it free of namespaces and of gcb-pro calls.
 *
 * One field, three stored values (three sidebar controls):
 *   <key>         the image control with video allowed: a picture or a video file
 *   <key>_link    a YouTube or Vimeo address (it wins over the file)
 *   <key>_poster  the picture shown before it plays
 * and the design's own choices, read off the manuscript at Build ($cfg):
 *   mode    player | minimal | bare | background
 *   accent  the skin's accent colour (kimi's `accent-[#hex]` on the box)
 *   poster  the design's picture, and its classes and alt
 *   play    kimi's own drawn play button, placed where it drew it, or ''
 *   src     the design's own address (`data-gcb-media-src`), the default
 *
 * THE EDITOR GETS A PICTURE, NEVER A PLAYER: no script loads there (a REST render or wp-admin), so the block shows
 * its poster — or YouTube's own thumbnail — and a video file its first frame.
 *
 * WHY OUR PLAY BUTTON IS RE-ATTACHED (measured 2026-09-24, Video.js 10.0.0-rc.2 in Chromium): a <media-play-button>
 * written in the page's own HTML upgrades before the player can hand it state, and never plays anything. Taken out
 * and put back once the elements are defined, it binds and plays. The module script does exactly that, once per
 * button.
 *
 * @package GCBLite\Render
 */

if (!defined('ABSPATH')) {
    exit;
}

if (! function_exists('gcb_media_cdn')) {
    /** the CDN version every URL is pinned to — bundles share hashed chunks */
    function gcb_media_cdn(string $file): string {
        return 'https://cdn.jsdelivr.net/npm/@videojs/cdn@10.0.0-rc.2/' . $file;
    }
}

if (! function_exists('gcb_media_kind')) {
    /** youtube | vimeo | video | image | '' for an address */
    function gcb_media_kind(string $url): string {
        if ($url === '') {
            return '';
        }
        if (preg_match('~^(?:https?:)?//(?:www\.|m\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/~i', $url)) {
            return 'youtube';
        }
        if (preg_match('~^(?:https?:)?//(?:www\.|player\.)?vimeo\.com/~i', $url)) {
            return 'vimeo';
        }
        $path = strtolower((string) parse_url($url, PHP_URL_PATH));
        if (preg_match('~\.(mp4|webm|mov|m4v|ogv|m3u8)$~', $path)) {
            return 'video';
        }
        return 'image';
    }
}

if (! function_exists('gcb_media_url')) {
    /** a stored image-control value → its address */
    function gcb_media_url($v): string {
        $v = is_object($v) ? (array) $v : $v;
        if (! is_array($v)) {
            return '';
        }
        $url = (string) ($v['url'] ?? '');
        $id  = (int) ($v['id'] ?? 0);
        if ($url === '' && $id && function_exists('wp_get_attachment_url')) {
            $url = (string) wp_get_attachment_url($id);
        }
        return $url;
    }
}

if (! function_exists('gcb_media_youtube_still')) {
    /** YouTube's own still, for the editor and as the poster when none is set */
    function gcb_media_youtube_still(string $url): string {
        if (preg_match('~(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})~', $url, $m)) {
            return 'https://i.ytimg.com/vi/' . $m[1] . '/hqdefault.jpg';
        }
        return '';
    }
}

if (! function_exists('gcb_media_html')) {
    function gcb_media_html(array $attributes, string $key, array $cfg): string {
        $mode   = in_array($cfg['mode'] ?? '', array('player', 'minimal', 'bare', 'background'), true) ? $cfg['mode'] : 'player';
        /* a person's choice of player (the base-components sweep, 2026-10-06); a backdrop stays one */
        $pick = (string) ($attributes[$key . '_player'] ?? '');
        if ($mode !== 'background' && in_array($pick, array('player', 'minimal', 'bare'), true)) {
            $mode = $pick;
        }
        $file   = gcb_media_url($attributes[$key] ?? null);
        $link   = array_key_exists($key . '_link', $attributes) ? trim((string) $attributes[$key . '_link']) : trim((string) ($cfg['src'] ?? ''));
        $src    = $link !== '' ? $link : $file;
        $kind   = gcb_media_kind($src);
        $poster = gcb_media_url($attributes[$key . '_poster'] ?? null);
        if ($poster === '') {
            $poster = (string) ($cfg['poster'] ?? '');
        }
        if ($poster === '' && $kind === 'youtube') {
            $poster = gcb_media_youtube_still($src);
        }
        $alt     = (string) ($cfg['alt'] ?? '');
        $imgCls  = trim('gcb-media-poster ' . (string) ($cfg['posterClass'] ?? ''));
        $picture = static function (string $url) use ($imgCls, $alt): string {
            return $url === '' ? '' : '<img class="' . esc_attr($imgCls) . '" src="' . esc_url($url) . '" alt="' . esc_attr($alt) . '" loading="lazy">';
        };

        /* A BACKDROP'S SCRIM AND THE TEXT COLOUR OVER IT (Mark, 2026-09-24:
           "you NEED the option to change the text color and add a scrim
           ALWAYS"). The scrim sits over the video inside the layer; the
           text colour reaches every word in the layer's container, not the
           buttons — they carry their own fills. Both show in the editor too:
           they are design, not playback. */
        $layer = '';
        $after = '';
        if ($mode === 'background') {
            $mid      = 'm' . substr(md5($key . wp_json_encode($cfg) . mt_rand()), 0, 8);
            $scrimCol = array_key_exists($key . '_scrim', $attributes) ? trim((string) $attributes[$key . '_scrim']) : '#000000';
            $strength = array_key_exists($key . '_scrim_strength', $attributes) && is_numeric($attributes[$key . '_scrim_strength']) ? max(0, min(100, (float) $attributes[$key . '_scrim_strength'])) : 30.0;
            $scrim    = ($scrimCol !== '' && $strength > 0 && preg_match('/^(#[0-9a-f]{3,8}|rgba?\([^;{}]*\)|hsla?\([^;{}]*\)|(?:linear|radial|conic)-gradient\([^;{}]*\))$/i', $scrimCol))
                ? '<div class="gcb-media-scrim" style="background:' . esc_attr($scrimCol) . ';opacity:' . ($strength / 100) . '"></div>'
                : '';
            $text  = trim((string) ($attributes[$key . '_text'] ?? ''));
            $after = preg_match('/^(#[0-9a-f]{3,8}|rgba?\([^;{}]*\)|hsla?\([^;{}]*\))$/i', $text)
                ? '<style>:has(> .gcb-media > [data-gcb-mid="' . $mid . '"]) :is(h1,h2,h3,h4,h5,h6,p,li,span,small,strong,em,blockquote,time):not(a *,button *,[data-gcb-media-control] *){color:' . $text . '!important}</style>'
                : '';
            $layer = ' data-gcb-mid="' . $mid . '"';
            $bgStyle = '<style>.gcb-media-bg>.gcb-media-scrim{position:absolute;inset:0;pointer-events:none}</style>';
            $after = $bgStyle . $after;
            /* AN EMPTY BACKDROP DARKENS NOTHING (the AirPods import, 2026-09-30:
               a background video that is not ours to use, no poster — the
               scrim alone laid 30% black over the section's #f5f5f7, a flat
               grey panel). The scrim is for words over a picture; with no
               picture there is nothing to hold them off. */
            $wrap = static function (string $inner) use ($layer, $scrim, $after): string {
                return '<div class="gcb-media-bg" aria-hidden="true"' . $layer . '>' . $inner . ($inner !== '' ? $scrim : '') . '</div>' . $after;
            };
        }

        /* a picture is a picture, in the editor and on the page */
        if ($kind === 'image' || $kind === '') {
            $pic = $picture($kind === 'image' ? $src : $poster);
            return $mode === 'background' ? $wrap($pic) : $pic;
        }

        $editor = (defined('REST_REQUEST') && REST_REQUEST) || (function_exists('is_admin') && is_admin());
        if ($editor) {
            $still = $poster !== ''
                ? $picture($poster)
                : ($kind === 'video'
                    ? '<video class="' . esc_attr($imgCls) . '" src="' . esc_url($src) . '#t=0.1" preload="metadata" muted playsinline></video>'
                    : '');
            return $mode === 'background' ? $wrap($still) : $still;
        }

        /* the bundles this one needs; a module imported twice loads once */
        $bundles = array();
        if ($mode === 'background') {
            $bundles[] = $kind === 'video' ? 'media/background-video.js' : 'media/' . $kind . '-video.js';
        } else {
            $bundles[] = $mode === 'minimal' ? 'video-minimal.js' : 'video.js';
            if ($kind !== 'video') {
                $bundles[] = 'media/' . $kind . '-video.js';
            }
        }
        $imports = '';
        foreach ($bundles as $b) {
            $imports .= 'import ' . wp_json_encode(gcb_media_cdn($b), JSON_UNESCAPED_SLASHES) . ';';
        }
        /* A CONTROL ANYWHERE IN THE BLOCK (Mark, 2026-09-24: "when you have
           controls like the pause they don't have to follow the websites
           content containers, they can be offset on the edge"). A button with
           data-gcb-media-control="<field>" pauses and plays that field's
           video, wherever it was drawn; it carries data-paused for its icons
           (the first <svg> shows while playing, the second while paused). */
        $wire = 'for(const b of document.querySelectorAll("[data-gcb-media-control]:not([data-gcb-wired])")){'
            . 'b.setAttribute("data-gcb-wired","");const r=b.closest(".gcb-block")||document;'
            . 'const box=r.querySelector(".gcb-media[data-gcb-field=\\""+CSS.escape(b.getAttribute("data-gcb-media-control"))+"\\"]");if(!box)continue;'
            . 'const m=()=>{const e=box.querySelector("background-video,youtube-video,vimeo-video,video");if(!e)return null;if(typeof e.pause==="function")return e;return(e.shadowRoot&&e.shadowRoot.querySelector("video"))||null;};'
            . 'const sync=()=>{const v=m();b.toggleAttribute("data-paused",!!(v&&v.paused));b.setAttribute("aria-label",v&&v.paused?"Play video":"Pause video");};'
            . 'b.addEventListener("click",()=>{const v=m();if(!v)return;v.paused?v.play():v.pause();setTimeout(sync,60);});'
            . 'for(const e of ["play","pause","playing"])box.addEventListener(e,sync,true);const v0=m();if(v0)for(const e of ["play","pause"])v0.addEventListener(e,sync);setTimeout(sync,600);}';
        /* a backdrop has no play button of its own to re-attach */
        $script = '<script type="module">' . $imports
            /* THE PLAYER'S VIDEO REJOINS ITS PLAYER (the BevChain import, 2026-10-06): a background film on the page loads
               YouTube's element before the player's bundle, so this one is set up with no player round it and play reaches
               nothing (NO_TARGET). Taken out and put back once the player is defined, it joins it — the play button's cure. */
            . ($mode === 'background' ? '' : 'await customElements.whenDefined("video-player");'
                . 'for(const e of document.querySelectorAll(".gcb-media:not(.gcb-media-bgv) :is(youtube-video,vimeo-video,video):not([data-gcb-joined])")){'
                . 'e.setAttribute("data-gcb-joined","");const p=e.parentNode,n=e.nextSibling;e.remove();p.insertBefore(e,n);}'
                . 'await customElements.whenDefined("media-play-button");'
                . 'for(const b of document.querySelectorAll(".gcb-media [data-gcb-media-play]:not([data-gcb-live])")){'
                . 'b.setAttribute("data-gcb-live","");const p=b.parentNode,n=b.nextSibling;b.remove();p.insertBefore(b,n);}')
            . $wire
            . '</script>';

        $style = '';
        if (empty($GLOBALS['gcb_media_style_printed'])) {
            $GLOBALS['gcb_media_style_printed'] = true;
            $style = '<style>'
                . '.gcb-media{position:relative;overflow:hidden}.gcb-media:not(.gcb-media-bare){max-height:100vh}'
                . '[data-gcb-media-control]>svg:nth-of-type(2){display:none!important}'
                . '[data-gcb-media-control][data-paused]>svg:first-of-type{display:none!important}'
                . '[data-gcb-media-control][data-paused]>svg:nth-of-type(2){display:inline-block!important}'
                . '.gcb-media video-player,.gcb-media media-container,.gcb-media video-skin,.gcb-media video-minimal-skin{display:block;width:100%;height:100%}'
                . '.gcb-media video,.gcb-media youtube-video,.gcb-media vimeo-video{display:block;width:100%;height:100%;object-fit:cover}'
                . '.gcb-media video-skin,.gcb-media video-minimal-skin{--media-object-fit:cover}'
                . '.gcb-media>.gcb-media-poster,.gcb-media-bg>.gcb-media-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}'
                . '.gcb-media-bg{position:absolute;inset:0;overflow:hidden;container-type:size;pointer-events:none}'
                . '.gcb-media-bg>background-video{position:absolute;inset:0;width:100%;height:100%;--media-object-fit:cover}'
                . '.gcb-media-bg>youtube-video,.gcb-media-bg>vimeo-video{position:absolute;left:50%;top:50%;width:max(100%,calc(100cqh*16/9));height:max(100%,calc(100cqw*9/16));translate:-50% -50%}'
                . '.gcb-media media-play-button[data-gcb-media-play]{cursor:pointer;z-index:3;transition:opacity .2s}'
                . '.gcb-media media-play-button[data-gcb-media-play][data-started]:not([data-paused]){opacity:0}'
                . '.gcb-media:hover media-play-button[data-gcb-media-play][data-started]{opacity:1}'
                . '</style>';
        }

        $attrSrc = ' src="' . esc_url($src) . '"';
        if ($mode === 'background') {
            $media = $kind === 'video'
                ? '<background-video' . $attrSrc . '></background-video>'
                : '<' . $kind . '-video' . $attrSrc . ' autoplay muted loop playsinline></' . $kind . '-video>';
            return $style . $wrap($picture($poster) . $media) . $script;
        }

        $media = $kind === 'video'
            ? '<video' . $attrSrc . ' playsinline preload="metadata"' . ($poster !== '' ? ' poster="' . esc_url($poster) . '"' : '') . '></video>'
            : '<' . $kind . '-video' . $attrSrc . '></' . $kind . '-video>';
        $play = (string) ($cfg['play'] ?? '');
        if ($mode === 'bare' && $play === '') {
            /* a player with no controls still needs a way to start */
            $play = '<media-play-button data-gcb-media-play style="position:absolute;left:50%;top:50%;translate:-50% -50%;width:72px;height:72px;border-radius:9999px;background:rgb(255 255 255/.9);display:grid;place-items:center" aria-label="Play"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="#111"/></svg></media-play-button>';
        }
        $accent = preg_match('/^#[0-9a-f]{3,8}$/i', (string) ($cfg['accent'] ?? '')) ? '--media-accent-color:' . $cfg['accent'] . ';' : '';
        $slot   = $poster !== '' && $kind !== 'video' ? '<img slot="poster" src="' . esc_url($poster) . '" alt="">' : '';
        if ($mode === 'bare') {
            $inner = '<video-player><media-container>' . $media . $play . '</media-container></video-player>';
        } else {
            $skin  = $mode === 'minimal' ? 'video-minimal-skin' : 'video-skin';
            $inner = '<video-player><' . $skin . ' style="' . esc_attr($accent . '--media-border-radius:0') . '">' . $media . $slot . '</' . $skin . '>' . $play . '</video-player>';
        }
        return $style . $inner . $script;
    }
}

if (! function_exists('gcb_media_bg_video')) {
    /**
     * A FILM BEHIND A BOX'S CONTENTS — the background field's fourth kind (Mark, 2026-10-05: "paste in a youtube
     * url, vimeo url, or upload a video, set options for auto play etc (with mute of course)"). $value is the
     * background field's stored value; gcb-lite's contract reads it (Fields::background_video). The layer is the
     * box's first child at z-index -1 in the box's own stacking context: above the box's paint (its colour and the
     * poster lite lays as a background), under every word. Always muted. The pause button sits over the contents
     * at the corner, wired by the media runtime's control script. Anything but a playable video lays nothing.
     */
    function gcb_media_bg_video($value, string $key, array $scrim = array()): string {
        $v = class_exists('\GCBLite\Contract\Fields') ? \GCBLite\Contract\Fields::background_video($value) : null;
        if (! $v) {
            return '';
        }
        /* the media runtime's background mode, fed as a media field. The field's scrim goes over the film (lite lays
           it on the box, under the layer, where it would darken nothing); the text colour stays the field's own. */
        $a = array($key => null, $key . '_link' => $v['src'], $key . '_poster' => $v['poster'] !== '' ? array('url' => $v['poster']) : null,
            $key . '_scrim' => (string) ($scrim['color'] ?? ''), $key . '_scrim_strength' => $scrim['strength'] ?? 0);
        $out = gcb_media_html($a, $key, array('mode' => 'background', 'alt' => ''));
        if (! $v['autoplay']) {
            $out = preg_replace('/(<(?:youtube|vimeo)-video[^>]*?) autoplay/', '$1', $out);
            $out = str_replace('<background-video ', '<video muted playsinline preload="metadata" ', str_replace('</background-video>', '</video>', $out));
        }
        if (! $v['loop']) {
            $out = preg_replace('/(<(?:youtube|vimeo)-video[^>]*?) loop/', '$1', $out);
            $out = str_replace('<background-video ', '<background-video data-gcb-once ', $out);
        }
        $pause  = '';
        $editor = (defined('REST_REQUEST') && REST_REQUEST) || (function_exists('is_admin') && is_admin());
        if ($v['pause'] && ! $editor) {
            $pause = '<button type="button" data-gcb-media-control="' . esc_attr($key) . '" aria-label="Pause video" style="position:absolute;right:16px;bottom:16px;z-index:2;width:40px;height:40px;border-radius:9999px;border:0;background:rgb(0 0 0/.45);color:#fff;display:grid;place-items:center;cursor:pointer">'
                . '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/></svg>'
                . '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button>';
        }
        $style = '';
        if (empty($GLOBALS['gcb_media_bgv_style_printed'])) {
            $GLOBALS['gcb_media_bgv_style_printed'] = true;
            $style = '<style>'
                . ':has(>.gcb-media-bgv){isolation:isolate}:has(>.gcb-media-bgv):not(.absolute,.fixed,.sticky){position:relative}'
                . '.gcb-media-bgv .gcb-media-bg{pointer-events:none}'
                . '@media (max-width:781px){.gcb-media-bgv[data-gcb-phones="poster"] .gcb-media-bg>:not(.gcb-media-poster),.gcb-media-bgv[data-gcb-phones="poster"]~[data-gcb-media-control]{display:none!important}}'
                /* YouTube's and Vimeo's title bar falls outside the box */
                . '.gcb-media-bgv youtube-video,.gcb-media-bgv vimeo-video{scale:1.2}'
                . '.gcb-media-bgv .gcb-media-bg>:not(.gcb-media-poster):not(.gcb-media-scrim){opacity:0;transition:opacity .6s}.gcb-media-bgv[data-gcb-live] .gcb-media-bg>:not(.gcb-media-poster):not(.gcb-media-scrim){opacity:1}'
                . '</style>';
        }
        /* THE FILM SHOWS ONLY WHILE IT PLAYS (the BevChain import, 2026-10-05: YouTube's own title, its spinner and black
           frames showed each time the film looped): the poster shows until it plays and while it waits, and a looping film
           goes back to its start just before its end, so YouTube's end screen never comes */
        $live = '';
        if (! $editor) {
            $live = '<script type="module">for(const b of document.querySelectorAll(".gcb-media-bgv:not([data-gcb-bgv-wired])")){b.setAttribute("data-gcb-bgv-wired","");'
                . 'const v=b.querySelector("youtube-video,vimeo-video,background-video,video");if(!v)continue;'
                . 'const on=()=>b.setAttribute("data-gcb-live",""),off=()=>b.removeAttribute("data-gcb-live");'
                . 'v.addEventListener("playing",on);v.addEventListener("waiting",off);v.addEventListener("ended",off);'
                . ($v['loop'] ? 'v.addEventListener("timeupdate",()=>{const d=v.duration;if(d>1&&v.currentTime>d-0.6)v.currentTime=0;});' : '')
                . '}</script>';
        }
        return $style . '<div class="gcb-media gcb-media-bare gcb-media-bgv" data-gcb-field="' . esc_attr($key) . '" data-gcb-phones="' . esc_attr($v['phones']) . '" style="position:absolute;inset:0;z-index:-1;max-height:none">' . $out . '</div>' . $pause . $live;
    }
}
