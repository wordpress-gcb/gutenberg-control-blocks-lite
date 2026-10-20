/**
 * THE KIT'S SLIDER (Mark, 2026-10-19: "do 5 as well" — Airbnb's price: a histogram under two handles, with the least
 * and the most to type). One slider for GCB Pro's built sections and GCB Forms, beside the kit's select.
 *
 * THE NATIVE INPUTS STAY THE TRUTH. The markup is one or two real <input type="number">s (in the kit filter, its
 * data-gcb-kit-min / -max: the filter writes their bounds from the records and listens to them; in a form, what is
 * submitted), with the slider drawn round them — or left to the kit:
 *
 *   <div data-gcb-kit="slider" data-step="500" data-prefix="£">
 *     <div data-gcb-kit-histogram="price"></div>            ← optional: the kit filter draws its bars from the records
 *     <input type="number" data-gcb-kit-min="price">        ← the low end (and the only one, for a single value)
 *     <input type="number" data-gcb-kit-max="price">        ← the high end
 *   </div>
 *
 * Here, once the page runs, Zag (@zag-js/slider, MIT) gives it the handles: a pointer, the keyboard (arrows, page
 * up/down, home, end), the screen reader's words. A handle let go writes its input and fires its `change`, so the
 * filter and a form hear it as they always have; a number typed in a box, or set by the page (the filter's reset),
 * moves its handle. Without scripts the boxes are what shows. The bars of a histogram inside it are lit while they
 * fall inside the range.
 *
 * Its parts, drawn or made: [data-gcb-kit-slider-control] > [data-gcb-kit-slider-track] > [data-gcb-kit-slider-range],
 * and a [data-gcb-kit-slider-thumb] a handle; Zag marks them data-dragging, data-focus, data-disabled for styling.
 * kit/slider/style.css gives defaults that any class beats.
 */
import * as slider from '@zag-js/slider';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import { kept } from '../_core/kept.js';

const ROOT = '[data-gcb-kit="slider"]';
let count = 0;

const num = ( v ) => ( v === '' || v === null || v === undefined || Number.isNaN( Number( v ) ) ? null : Number( v ) );
const part = ( root, name, tag = 'div', parent = root ) => {
	let el = root.querySelector( `[data-gcb-kit-slider-${ name }]` );
	if ( ! el ) {
		el = document.createElement( tag );
		el.setAttribute( `data-gcb-kit-slider-${ name }`, '' );
		parent.appendChild( el );
	}
	return el;
};

function live( root ) {
	if ( root.gcbKitSlider ) {
		return;
	}
	let stopped = false; // a part started again over a swap: the old one's listeners do nothing
	const inputs = [ ...root.querySelectorAll( 'input[type="number"], input[type="range"]' ) ].slice( 0, 2 );
	if ( ! inputs.length ) {
		return;
	}
	/* the ends: the inputs' own bounds (the kit filter writes them from the records), else the root's data-min/-max */
	const lo = num( inputs[ 0 ].getAttribute( 'min' ) ) ?? num( root.getAttribute( 'data-min' ) ) ?? 0;
	const most = num( inputs[ inputs.length - 1 ].getAttribute( 'max' ) ) ?? num( root.getAttribute( 'data-max' ) ) ?? 100;
	if ( ! ( most > lo ) ) {
		return; // nothing to slide between: the boxes alone
	}
	const step = num( root.getAttribute( 'data-step' ) ) ?? num( inputs[ 0 ].getAttribute( 'step' ) ) ?? Math.max( 1, Math.round( ( most - lo ) / 100 ) );
	/* THE TRACK ENDS ON A WHOLE STEP (2026-10-19, run 8: £10,295 to £16,495 in £500 steps — Zag snapped the untouched top
	   handle down to £16,295, said so as a change, and the filter took it for a maximum and hid the dearest car): the
	   step counts from the least, so the top is the most rounded up to the next step, and a handle there is no end */
	const hi = lo + Math.ceil( ( most - lo ) / step ) * step;
	const prefix = root.getAttribute( 'data-prefix' ) ?? '';
	const suffix = root.getAttribute( 'data-suffix' ) ?? '';
	const read = () => inputs.map( ( i, k ) => num( i.value ) ?? ( k === 0 ? lo : hi ) );

	/* the handles go where the eye expects them: under the bars, over the boxes — before the first box's own child of
	   the slider, the box itself or the labelled field it sits in */
	const made = ! root.querySelector( '[data-gcb-kit-slider-control]' );
	const control = part( root, 'control' );
	if ( made ) {
		let before = inputs[ 0 ];
		while ( before.parentElement && before.parentElement !== root ) {
			before = before.parentElement;
		}
		root.insertBefore( control, before.parentElement === root ? before : null );
	}
	const track = part( root, 'track', 'div', control );
	const range = part( root, 'range', 'div', track );
	const thumbs = inputs.map( ( _, k ) => root.querySelectorAll( '[data-gcb-kit-slider-thumb]' )[ k ] ?? part( root, 'thumb-' + k, 'div', control ) );
	thumbs.forEach( ( t ) => t.setAttribute( 'data-gcb-kit-slider-thumb', '' ) );
	const bars = [ ...root.querySelectorAll( '[data-gcb-kit-histogram] [data-from]' ) ];

	let quiet = false;
	const write = ( value, fire ) => {
		quiet = true;
		inputs.forEach( ( input, k ) => {
			const v = value[ k ];
			/* an end at its bound is no end at all: the box is left empty, so the filter is not narrowed by it */
			input.value = ( k === 0 && v <= lo ) || ( k === inputs.length - 1 && inputs.length > 1 && v >= hi ) ? '' : String( v );
			if ( fire ) {
				input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
				input.dispatchEvent( new Event( 'change', { bubbles: true } ) );
			}
		} );
		quiet = false;
	};
	const light = ( value ) => {
		const [ a, b ] = inputs.length > 1 ? value : [ lo, value[ 0 ] ];
		bars.forEach( ( bar ) => bar.toggleAttribute( 'data-in', num( bar.getAttribute( 'data-to' ) ) >= a && num( bar.getAttribute( 'data-from' ) ) <= b ) );
	};
	/* kept inside the track, a handle's size is what Zag needs to know — the drawn handle's own, measured before Zag
	   starts (it reads it once); without it Zag keeps the handles out of sight */
	const thumbSize = { width: thumbs[ 0 ].offsetWidth || 24, height: thumbs[ 0 ].offsetHeight || 24 };
	const service = new VanillaMachine( slider.machine, {
		id: 'gcb-slider-' + ++count,
		min: lo,
		max: hi,
		step,
		defaultValue: read(),
		minStepsBetweenThumbs: 1,
		thumbAlignment: 'contain', // a handle at either end stays inside the track, never half over the edge
		thumbSize,
		getAriaValueText: ( d ) => prefix + Number( d.value ).toLocaleString() + suffix,
		onValueChange: ( d ) => {
			write( d.value, false );
			light( d.value );
		},
		onValueChangeEnd: ( d ) => write( d.value, true ),
	} );
	const render = () => {
		const api = slider.connect( service.service, normalizeProps );
		spreadProps( root, api.getRootProps() );
		spreadProps( control, api.getControlProps() );
		spreadProps( track, api.getTrackProps() );
		spreadProps( range, api.getRangeProps() );
		thumbs.forEach( ( t, index ) => spreadProps( t, api.getThumbProps( { index } ) ) );
	};
	/* a box typed in, or set by the page (the filter's reset): its handle follows */
	const follow = () => {
		if ( stopped ) {
			return;
		}
		if ( quiet ) {
			return;
		}
		const want = read();
		const api = slider.connect( service.service, normalizeProps );
		if ( want.join() !== api.value.join() ) {
			api.setValue( want );
		}
		light( want );
	};
	const own = Object.getOwnPropertyDescriptor( HTMLInputElement.prototype, 'value' );
	inputs.forEach( ( input ) => {
		Object.defineProperty( input, 'value', {
			configurable: true,
			get() {
				return own.get.call( this );
			},
			set( v ) {
				own.set.call( this, v );
				queueMicrotask( follow );
			},
		} );
		input.addEventListener( 'change', follow );
		input.addEventListener( 'input', follow );
	} );
	service.subscribe( render );
	service.start();
	render();

	light( read() );
	root.classList.add( 'is-live' );
	root.gcbKitSlider = { service, inputs };
	/* a router swap that takes what it built: started again over the markup the server drew (../_core/kept.js) */
	kept( root, () => [ ...root.querySelectorAll( '[data-gcb-kit-slider-thumb]' ) ].some( ( t ) => t.getAttribute( 'data-part' ) === 'thumb' ), () => {
		stopped = true;
		service.stop();
		delete root.gcbKitSlider;
		live( root );
	} );
}

function boot() {
	document.querySelectorAll( ROOT ).forEach( live );
}
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', boot );
} else {
	boot();
}
new MutationObserver( ( muts ) => {
	for ( const m of muts ) {
		for ( const n of m.addedNodes ) {
			if ( n.nodeType === 1 ) {
				( n.matches?.( ROOT ) ? [ n ] : [ ...( n.querySelectorAll?.( ROOT ) ?? [] ) ] ).forEach( live );
			}
		}
	}
} ).observe( document.documentElement, { childList: true, subtree: true } );
