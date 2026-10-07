/**
 * PIN MAP — an image you click to place child blocks on (Mark, 2026-10-07, the Touchpoint Zoom: "a type of repeater
 * field (similar to the grid field) where you have a panel that comes out with an image you can upload and then click
 * to add where you want the touchpoints to appear. that'll add a new repeater 'card' component").
 *
 * The other shape of HotspotsControl. Hotspots keeps its pins IN the field (a repeater field's rows); here the pins
 * belong to the block's own repeater CHILDREN — real blocks — and this field holds only the picture. That is option
 * (a) of docs/hotspot-field.md, which the 2026-09-23 spike proved: a sidebar control can insertBlock a child with its
 * point set. The popover is drawn the way the layout control's is.
 *
 * Two ways a child holds its place:
 *
 *   single  (pointKey)   one {x, y} per child — one pin per card.
 *   grouped (pointsKey)  a repeater FIELD of locations on the child, each row carrying {x, y} at rowPointKey — one
 *                        card, several pins (Mark, 2026-10-07: "several sections … labeled the same … where he might
 *                        have installed the same thing at several locations"). Pins read 03a, 03b, 03c; a lone
 *                        location reads 03. A click adds a new card, unless a pin has been clicked: then a pill
 *                        names that card and a click adds its next location, until the pill's × (or Esc).
 *
 *   value:   { id, url, alt, width, height }   — the backdrop; a child's `point` control finds it here
 *   config:  childBlock   the repeater's child block (default: the block type scoped to this block)
 *            pointKey     single mode: the child attribute holding {x, y} (default "point")
 *            pointsKey    grouped mode: the child's repeater-field attribute of locations (turns grouped mode on)
 *            rowPointKey  grouped mode: the {x, y} key inside a location row (default "point")
 *            rowLabelKey  grouped mode: a location row's name (default "area")
 *            labelKey     the child attribute shown as a card's name (default "title")
 *
 * In the popover: click the picture → a pin there; drag a pin → move it; arrow keys nudge the focused pin (Shift:
 * further). It is for placing; a card is edited and deleted as the block it is, on the canvas (Mark, 2026-10-07:
 * "deleting a touchpoint should be done by normal block deletion process").
 *
 * The fields package passes a control no clientId (hotspot-field.md §7) — a control only renders for the selected
 * block, so the selected block IS this one.
 */
import { BaseControl, Button, Dropdown, __experimentalDropdownContentWrapper as DropdownContentWrapper } from '@wordpress/components';
import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { createBlock } from '@wordpress/blocks';
import { useDispatch, useSelect } from '@wordpress/data';
import { useRef, useState } from '@wordpress/element';
import { Icon, close, mapMarker } from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';
import { controlComponents } from '@wordpress-gcb/fields';
import { pad, pinTag, pinsOf, plain } from './pin-map-value';

const clamp01 = ( n ) => Math.max( 0, Math.min( 1, n ) );
const round = ( n ) => Math.round( n * 1000 ) / 1000;
const rowId = () => 'r' + Math.random().toString( 36 ).slice( 2, 10 );

/** The image value as stored: only what a backdrop needs. */
export function backdropOf( media ) {
	if ( ! media || ! media.url ) {
		return {};
	}
	return {
		id: media.id,
		url: media.url,
		alt: media.alt || '',
		width: media.width || media.media_details?.width,
		height: media.height || media.media_details?.height,
	};
}

/**
 * The child block name this map places: config, else the block type scoped to this block (GCB sets each repeater
 * child's `parent` from the <Repeater allowedBlocks> marker), else the first child's.
 */
function childNameOf( control, blockName, children, blockTypes ) {
	if ( control.childBlock ) {
		return control.childBlock;
	}
	const scoped = blockTypes.find( ( t ) => Array.isArray( t.parent ) && t.parent.includes( blockName ) );
	return scoped?.name || children[ 0 ]?.name || '';
}

function PinBoard( { url, pins, onAdd, onMove, focused, target, onFocusPin } ) {
	const box = useRef();
	const drag = useRef( null );
	const [ live, setLive ] = useState( null ); // { key, point } while dragging

	const pointFrom = ( e ) => {
		const r = box.current.getBoundingClientRect();
		return { x: round( clamp01( ( e.clientX - r.left ) / r.width ) ), y: round( clamp01( ( e.clientY - r.top ) / r.height ) ) };
	};

	const onBoardDown = ( e ) => {
		if ( e.button !== 0 || e.target.closest( '.gcb-pinmap__dot' ) ) {
			return;
		}
		onAdd( pointFrom( e ) );
	};
	const onDotDown = ( e, pin ) => {
		if ( e.button !== 0 ) {
			return;
		}
		e.preventDefault();
		drag.current = { pin, moved: false };
		onFocusPin( pin );
		try {
			// Keeps the moves coming when the pointer outruns the 26px dot. Capture can be refused (a pointer the
			// browser no longer tracks); the drag still works while the pointer stays over the dot.
			e.currentTarget.setPointerCapture( e.pointerId );
		} catch ( err ) {}
	};
	const onDotMove = ( e ) => {
		if ( ! drag.current ) {
			return;
		}
		drag.current.moved = true;
		drag.current.point = pointFrom( e );
		setLive( { key: drag.current.pin.key, point: drag.current.point } );
	};
	const onDotUp = () => {
		// One undo step per drag: the point is written once, on release. Read from the ref — a quick drag releases
		// before the `live` state it set has rendered.
		if ( drag.current?.moved && drag.current.point ) {
			onMove( drag.current.pin, drag.current.point );
		}
		drag.current = null;
		setLive( null );
	};
	const onDotKey = ( e, pin ) => {
		const step = e.shiftKey ? 0.05 : 0.01;
		const d = { ArrowLeft: [ -step, 0 ], ArrowRight: [ step, 0 ], ArrowUp: [ 0, -step ], ArrowDown: [ 0, step ] }[ e.key ];
		if ( ! d ) {
			return;
		}
		e.preventDefault();
		onMove( pin, { x: round( clamp01( pin.point.x + d[ 0 ] ) ), y: round( clamp01( pin.point.y + d[ 1 ] ) ) } );
	};

	return (
		<div className="gcb-pinmap__board" ref={ box } onPointerDown={ onBoardDown }>
			<img src={ url } alt="" draggable={ false } />
			{ pins.map( ( pin ) => {
				const p = live?.key === pin.key ? live.point : pin.point;
				const cls = [ 'gcb-pinmap__dot', pin.tag.length > 2 && 'is-grouped', focused === pin.key && 'is-focused', target === pin.cardId && 'is-sibling' ].filter( Boolean ).join( ' ' );
				return (
					<button
						key={ pin.key }
						type="button"
						className={ cls }
						style={ { left: p.x * 100 + '%', top: p.y * 100 + '%' } }
						aria-label={ sprintf( /* translators: 1: pin tag, 2: pin name */ __( 'Pin %1$s: %2$s — drag or use arrow keys to move', 'gcblite' ), pin.tag, pin.label ) }
						onPointerDown={ ( e ) => onDotDown( e, pin ) }
						onPointerMove={ onDotMove }
						onPointerUp={ onDotUp }
						onPointerCancel={ onDotUp }
						onFocus={ () => onFocusPin( pin ) }
						onKeyDown={ ( e ) => onDotKey( e, pin ) }
					>
						{ pin.tag }
					</button>
				);
			} ) }
		</div>
	);
}

export default function PinMapControl( { control, value, onChange, clientId } ) {
	const cfg = {
		pointKey: control.pointKey || 'point',
		pointsKey: control.pointsKey || '',
		rowPointKey: control.rowPointKey || 'point',
		rowLabelKey: control.rowLabelKey || 'area',
		labelKey: control.labelKey || 'title',
	};
	const grouped = !! cfg.pointsKey;
	const [ focused, setFocused ] = useState( null );
	const [ target, setTarget ] = useState( 'new' ); // grouped: 'new' or a card's clientId

	const { parentId, blockName, children, blockTypes } = useSelect( ( select ) => {
		const be = select( 'core/block-editor' );
		// The block this inspector belongs to (fields SDK ≥ 0.2.5 passes it); the selection on older SDKs.
		const id = clientId || be.getSelectedBlockClientId();
		return {
			parentId: id,
			blockName: id ? be.getBlockName( id ) : '',
			children: id ? be.getBlocks( id ) : [],
			blockTypes: select( 'core/blocks' ).getBlockTypes(),
		};
	}, [ clientId ] );
	const { insertBlock, updateBlockAttributes } = useDispatch( 'core/block-editor' );

	const childName = childNameOf( control, blockName, children, blockTypes );
	const cards = children.filter( ( b ) => b.name === childName );
	const pins = pinsOf( cards, cfg );
	const cardById = ( id ) => cards.find( ( c ) => c.clientId === id );
	const rowsOf = ( card ) => ( Array.isArray( card?.attributes?.[ cfg.pointsKey ] ) ? card.attributes[ cfg.pointsKey ] : [] );
	const cardName = ( card, i ) => plain( card.attributes?.[ cfg.labelKey ] ) || sprintf( __( 'Touchpoint %s', 'gcblite' ), pad( i + 1 ) );

	const image = value && value.url ? value : null;
	const activeTarget = target !== 'new' && cardById( target ) ? target : 'new';
	const targetCard = activeTarget === 'new' ? null : cardById( activeTarget );
	const targetIndex = targetCard ? cards.indexOf( targetCard ) : -1;
	const targetRows = targetCard ? rowsOf( targetCard ).length : 0;
	/* the tag the next click makes: 06 with one location becomes 06a / 06b, so the next is the letter after them */
	const nextTag = targetCard ? pinTag( targetIndex, targetRows, targetRows + 1 ) : '';

	const focusPin = ( pin ) => {
		setFocused( pin.key );
		if ( grouped ) {
			setTarget( pin.cardId );
		}
	};

	const add = ( point ) => {
		if ( ! childName || ! parentId ) {
			return;
		}
		if ( grouped && activeTarget !== 'new' ) {
			const card = cardById( activeTarget );
			const rows = [ ...rowsOf( card ), { _id: rowId(), [ cfg.rowPointKey ]: point } ];
			updateBlockAttributes( card.clientId, { [ cfg.pointsKey ]: rows } );
			setFocused( card.clientId + ':' + rows[ rows.length - 1 ]._id );
			return;
		}
		const attrs = grouped ? { [ cfg.pointsKey ]: [ { _id: rowId(), [ cfg.rowPointKey ]: point } ] } : { [ cfg.pointKey ]: point };
		const block = createBlock( childName, attrs );
		insertBlock( block, children.length, parentId, false );
		setFocused( grouped ? block.clientId + ':' + attrs[ cfg.pointsKey ][ 0 ]._id : block.clientId );
	};

	const move = ( pin, point ) => {
		if ( pin.row < 0 ) {
			updateBlockAttributes( pin.cardId, { [ cfg.pointKey ]: point } );
			return;
		}
		const rows = rowsOf( cardById( pin.cardId ) ).map( ( r, i ) => ( i === pin.row ? { ...r, [ cfg.rowPointKey ]: point } : r ) );
		updateBlockAttributes( pin.cardId, { [ cfg.pointsKey ]: rows } );
	};

	const chooser = ( label, variant ) => (
		<MediaUploadCheck>
			<MediaUpload
				allowedTypes={ [ 'image' ] }
				value={ image?.id }
				onSelect={ ( media ) => onChange( backdropOf( media ) ) }
				render={ ( { open } ) => (
					<Button variant={ variant } onClick={ open } __next40pxDefaultSize>
						{ label }
					</Button>
				) }
			/>
		</MediaUploadCheck>
	);

	return (
		<BaseControl label={ control.label || __( 'Pin map', 'gcblite' ) } help={ control.help || control.helpText } __nextHasNoMarginBottom>
			{ ! image ? (
				<div className="gcb-pinmap__empty">{ chooser( __( 'Choose image', 'gcblite' ), 'secondary' ) }</div>
			) : (
				<Dropdown
					className="gcb-pinmap"
					contentClassName="gcb-pinmap__popover"
					popoverProps={ { placement: 'left-start', offset: 36, shift: true } }
					renderToggle={ ( { isOpen, onToggle } ) => (
						<button type="button" className="gcb-pinmap__toggle" onClick={ onToggle } aria-expanded={ isOpen }>
							<span className="gcb-pinmap__thumb">
								<img src={ image.url } alt="" />
							</span>
							<span className="gcb-pinmap__summary">
								<strong>{ __( 'Place pins', 'gcblite' ) }</strong>
								<span>
									{ grouped
										? sprintf( /* translators: 1: pins, 2: cards */ __( '%1$d pins on %2$d cards', 'gcblite' ), pins.length, cards.length )
										: sprintf( /* translators: %d: number of pins */ __( '%d on the image', 'gcblite' ), pins.length ) }
								</span>
							</span>
						</button>
					) }
					renderContent={ () => (
						<DropdownContentWrapper paddingSize="none">
							<div
								className="gcb-pinmap__panel"
								onKeyDown={ ( e ) => {
									if ( e.key === 'Escape' && grouped && activeTarget !== 'new' ) {
										e.stopPropagation(); // stop here: Esc would otherwise close the popover
										setTarget( 'new' );
									}
								} }
							>
								<div className="gcb-pinmap__head">
									<strong>{ control.label || __( 'Pin map', 'gcblite' ) }</strong>
									<div className="gcb-pinmap__head-actions">{ chooser( __( 'Replace image', 'gcblite' ), 'tertiary' ) }</div>
								</div>
								{ grouped ? (
									/* WHICH MODE A CLICK IS IN, OUT LOUD (Mark, 2026-10-07: "the user needs to know that they've
									   selected to add more variation and needs to be able to easily unselect") — a pill naming the
									   card and the next tag, with an × (or Esc) back to adding new touchpoints. */
									targetCard ? (
										<div className="gcb-pinmap__mode is-adding" role="status">
											<span className="gcb-pinmap__pill">
												<span className="gcb-pinmap__pill-tag">{ pad( targetIndex + 1 ) }</span>
												<span className="gcb-pinmap__pill-name">{ cardName( targetCard, targetIndex ) }</span>
												<button
													type="button"
													className="gcb-pinmap__pill-x"
													onClick={ () => setTarget( 'new' ) }
													aria-label={ __( 'Stop adding locations to this touchpoint', 'gcblite' ) }
												>
													<Icon icon={ close } size={ 16 } />
												</button>
											</span>
											<span className="gcb-pinmap__mode-text">
												{ sprintf( /* translators: %s: the next pin's tag, e.g. 06d */ __( 'Click the image to add location %s. × or Esc to stop.', 'gcblite' ), nextTag ) }
											</span>
										</div>
									) : (
										<div className="gcb-pinmap__mode" role="status">
											<span className="gcb-pinmap__mode-text">
												{ __( 'Click the image to add a new touchpoint. Click a pin to add more locations to it (a, b, c…). Drag a pin to move it.', 'gcblite' ) }
											</span>
										</div>
									)
								) : (
									<p className="gcb-pinmap__hint">{ __( 'Click the image to add a pin. Drag a pin to move it.', 'gcblite' ) }</p>
								) }
								<PinBoard url={ image.url } pins={ pins } onAdd={ add } onMove={ move } focused={ focused } target={ targetCard?.clientId } onFocusPin={ focusPin } />
							</div>
						</DropdownContentWrapper>
					) }
				/>
			) }
			{ ! childName && image && (
				<p className="gcb-pinmap__warn">
					<Icon icon={ mapMarker } size={ 16 } /> { __( 'This block declares no repeater child to place.', 'gcblite' ) }
				</p>
			) }
		</BaseControl>
	);
}

/** Put the control where the inspector looks. Idempotent; never overrides one the fields package may one day ship. */
export function registerPinMapControl() {
	if ( controlComponents && ! controlComponents[ 'pin-map' ] ) {
		controlComponents[ 'pin-map' ] = PinMapControl;
	}
}
