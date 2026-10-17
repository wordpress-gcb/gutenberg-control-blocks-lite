/**
 * THE EDITOR STRIP UNDER A REPEATING BLOCK (Mark, 2026-10-18: "One editor strip, at the BOTTOM of every repeating
 * block"). Every repeater used to add its items its own way, wherever its layout put the button: a bar over a slider,
 * a band under it, a button in a logo row, a full-width bar under a grid, a button floated over a map. Now one strip
 * does it for all of them, the same way and in the same place:
 *
 *   - attached to the block's bottom edge, outside its content (it hangs below the block; the block makes room for it
 *     with a margin while it shows), shown while the block or anything in it is selected;
 *   - the Add button at its left end, then the count ("2 of 8 slides"), and for a carousel the slide switcher;
 *   - the editor's own type and colours, never the site's;
 *   - the same Add in the block's toolbar, for a tall block whose strip is below the screen.
 *
 * Rendered by the block's edit component (index.js, PHPPreviewEdit), after the preview — never by the preview, and
 * never in save(), so none of it reaches the page.
 */
import { BlockControls } from '@wordpress/block-editor';
import { createBlock } from '@wordpress/blocks';
import { Button, ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { Icon, plus } from '@wordpress/icons';
import { addName, countText, footerSizeOf, nounFromLabel, pluralOf } from './utils/block-footer';
import { useRepeaterActive } from './utils/repeater-active';

/**
 * What adding means for one repeating block: how many it has, its limit, its noun, whether it may add here, and the
 * add itself (the new item lands last and is selected, so focus goes into it).
 *
 * @param {string} clientId the repeater block
 * @param {Object} config   its marker's config (utils/repeater-config.js)
 * @return {Object} { count, max, noun, plural, canAdd, atLimit, add, layout, name }
 */
export function useRepeaterAdd( clientId, config ) {
	const { insertBlock } = useDispatch( 'core/block-editor' );
	const { count, attrLayout, pinned } = useSelect(
		( select ) => {
			const be = select( 'core/block-editor' );
			const blockName = be.getBlockName( clientId );
			const controls = window.gcbLite?.blocks?.[ blockName ]?.controls || [];
			const allowed = config?.allowedBlocks;
			/* a pin map adds these: a card belongs where it is pinned (RepeaterTag's rule, kept the same here) */
			const byMap = controls
				.filter( ( c ) => c.type === 'pin-map' )
				.some( ( c ) => ! c.childBlock || ! Array.isArray( allowed ) || allowed.includes( c.childBlock ) );
			return {
				count: be.getBlockCount( clientId ),
				attrLayout: be.getBlockAttributes( clientId )?.editLayout,
				pinned: byMap,
			};
		},
		[ clientId, config?.allowedBlocks ]
	);
	const noun = nounFromLabel( config?.addButtonLabel );
	const max = config?.max || 0;
	const first = config?.firstAllowed;
	const hidden = config?.addButton === 'none' || ( pinned && config?.addButton !== 'show' );
	const atLimit = !! max && count >= max;
	return {
		count,
		max,
		noun,
		plural: pluralOf( noun ),
		mayAdd: !! first && ! hidden,
		atLimit,
		layout: config?.editLayout || attrLayout || 'carousel',
		name: addName( count, max, noun ),
		label: sprintf( /* translators: %s: the item's noun, e.g. slide */ __( 'Add %s', 'gcblite' ), noun ),
		add: () => {
			if ( ! first || atLimit ) {
				return;
			}
			insertBlock( createBlock( first ), count, clientId, true );
		},
	};
}

/**
 * Is the strip shown: the block, or anything inside it, selected.
 *
 * @param {string} clientId
 * @return {boolean} shown
 */
export function useFooterShown( clientId ) {
	return useSelect(
		( select ) => {
			const be = select( 'core/block-editor' );
			return be.isBlockSelected( clientId ) || be.hasSelectedInnerBlock( clientId, true );
		},
		[ clientId ]
	);
}

/** The plus in its square: the button's icon, at every size. */
function PlusMark() {
	return (
		<span className="gcb-block-footer__mark" aria-hidden="true">
			<Icon icon={ plus } size={ 20 } />
		</span>
	);
}

/**
 * The strip.
 *
 * @param {Object} props
 * @param {string} props.clientId the repeater block
 * @param {Object} props.config   its marker's config
 */
export default function BlockFooter( { clientId, config } ) {
	const a = useRepeaterAdd( clientId, config );
	const [ active, setActive ] = useRepeaterActive( clientId );
	const ref = useRef( null );
	const [ width, setWidth ] = useState( 0 );

	/* narrow is measured, not declared: the same block is wide in a page and narrow in a column */
	useEffect( () => {
		const el = ref.current;
		if ( ! el ) {
			return undefined;
		}
		const view = el.ownerDocument.defaultView;
		const measure = () => setWidth( Math.round( el.getBoundingClientRect().width ) );
		measure();
		if ( ! view.ResizeObserver ) {
			return undefined;
		}
		const ro = new view.ResizeObserver( measure );
		ro.observe( el );
		return () => ro.disconnect();
	}, [] );

	const size = footerSizeOf( config?.footerSize, width );
	const switcher = a.layout === 'carousel' && a.count > 1;

	/* TAB REACHES THE STRIP. WordPress's writing flow sends Tab from a selected block out of the canvas (to the
	   sidebar) unless the next thing is a form control inside the block — and the next thing in a block is its
	   content, so the strip was never reached. From the block itself (or a block inside it) Tab goes to the strip's
	   first control; Shift+Tab from that control goes back to the block. Tab while typing in a field is untouched. */
	useEffect( () => {
		const strip = ref.current;
		const block = strip?.parentElement;
		if ( ! block ) {
			return undefined;
		}
		const onKeyDown = ( e ) => {
			if ( e.key !== 'Tab' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey ) {
				return;
			}
			const first = strip.querySelector( 'button:not([tabindex="-1"])' );
			if ( ! first ) {
				return;
			}
			if ( e.shiftKey ) {
				if ( e.target === first ) {
					e.preventDefault();
					block.focus();
				}
				return;
			}
			const fromBlock = e.target === block || ( e.target.matches?.( '[data-block]' ) && block.contains( e.target ) );
			if ( fromBlock && ! strip.contains( e.target ) ) {
				e.preventDefault();
				first.focus();
			}
		};
		block.addEventListener( 'keydown', onKeyDown );
		return () => block.removeEventListener( 'keydown', onKeyDown );
	}, [] );

	/* the block keeps room for the strip below itself, as tall as the strip is (56px, or 40px small or narrow) */
	useEffect( () => {
		const el = ref.current;
		const block = el?.parentElement;
		if ( ! block ) {
			return undefined;
		}
		block.style.setProperty( '--gcb-footer-room', `${ el.offsetHeight }px` );
		return () => block.style.removeProperty( '--gcb-footer-room' );
	}, [ size ] );

	return (
		<div
			ref={ ref }
			className={ `gcb-block-footer is-${ size }` }
			data-gcb-chrome=""
			data-gcb-block-footer=""
			/* a press in the strip must not reach the block's preview handlers (link suppression, field focus) */
			onClick={ ( e ) => e.stopPropagation() }
			role="group"
			aria-label={ sprintf( /* translators: %s: plural noun, e.g. slides */ __( 'Edit %s', 'gcblite' ), a.plural ) }
		>
			{ a.mayAdd && (
				<Button
					__next40pxDefaultSize
					className="gcb-block-footer__add"
					onClick={ a.add }
					disabled={ a.atLimit }
					accessibleWhenDisabled
					label={ a.name }
					showTooltip
					aria-label={ a.name }
				>
					<PlusMark />
					{ size !== 'narrow' && <span className="gcb-block-footer__label">{ a.label }</span> }
				</Button>
			) }
			{ size !== 'narrow' && (
				<span className="gcb-block-footer__count">{ countText( a.count, a.max, a.noun ) }</span>
			) }
			{ switcher && (
				<>
					<span className="gcb-block-footer__divider" aria-hidden="true" />
					<span className="gcb-block-footer__editing">{ __( 'Editing', 'gcblite' ) }</span>
					<span className="gcb-block-footer__slides">
						{ Array.from( { length: a.count }, ( _, i ) => (
							<button
								key={ i }
								type="button"
								className={ 'gcb-block-footer__slide' + ( i === active ? ' is-on' : '' ) }
								aria-pressed={ i === active }
								aria-label={ sprintf( /* translators: %d: slide number */ __( 'Edit slide %d', 'gcblite' ), i + 1 ) }
								onClick={ () => setActive( i ) }
							>
								{ i + 1 }
							</button>
						) ) }
					</span>
				</>
			) }
		</div>
	);
}

/**
 * The same Add in the block's toolbar (shown while the block itself is selected), for a block taller than the screen.
 *
 * @param {Object} props
 * @param {string} props.clientId
 * @param {Object} props.config
 */
export function BlockFooterToolbar( { clientId, config } ) {
	const a = useRepeaterAdd( clientId, config );
	if ( ! a.mayAdd ) {
		return null;
	}
	return (
		<BlockControls group="block">
			<ToolbarGroup>
				<ToolbarButton icon={ plus } onClick={ a.add } disabled={ a.atLimit } label={ a.name } showTooltip>
					{ a.label }
				</ToolbarButton>
			</ToolbarGroup>
		</BlockControls>
	);
}
