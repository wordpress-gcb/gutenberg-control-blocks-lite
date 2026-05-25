/**
 * Tells controls *which surface* they're being rendered into so they can
 * render differently. Set by the host (block edit.js for Inspector, post-
 * fields App for meta-boxes).
 *
 * Values:
 *   - 'sidebar' (default): the block editor's Inspector — narrow column,
 *     popovers welcome.
 *   - 'metabox': a classic add_meta_box panel — wider, popovers feel
 *     out-of-place, controls should lay out inline.
 *
 * Controls that don't care can ignore the context entirely.
 */

import { createContext } from '@wordpress/element';

export const ControlContext = createContext({ variant: 'sidebar' });
