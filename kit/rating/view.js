/**
 * THE KIT'S RATING (2026-10-21: a listing's "4.92", a card's stars, a review form's "Your rating"). Stars, two ways:
 *
 *   SHOWN   <span data-gcb-kit="rating" data-value="4.6" data-max="5"></span>
 *           — the stars filled to the value, a star in part (4.92: the fifth 92% filled). No data-value: the first
 *           number in its words (a record's rating field inside it, "4.92"), the words left where they are.
 *   GIVEN   <div data-gcb-kit="rating" data-half><label>Your rating</label>
 *             <input type="number" name="rating" min="1" max="5"></div>
 *           — stars to press, the keyboard's arrows, Home and End, and half stars with data-half.
 *
 * THE NATIVE INPUT STAYS THE TRUTH: a form sends it, a page that sets it moves the stars; a press writes it and fires its
 * `input` and `change` (and `gcbkit:change` { value, name } on the part). Without the script the number box shows.
 * The giving is Zag's rating group (@zag-js/rating-group, MIT): the stars a radio group, the pointer's preview, the
 * half under the pointer's left side. A shown score is drawn here alone — Zag steps by halves; 4.92 is not a half.
 *
 * THE STAR is the kit's icon set's (Tabler's star), filled, as a mask, so a design can set another shape
 * (--gcb-rating-star). Its colours: --gcb-kit-rating, the part of a star past the value --gcb-kit-rating-half, the
 * stars past it --gcb-rating-empty (the line's grey).
 *
 * THE DESIGN'S STARS (2026-10-26, the kit wears the drawing): a [data-gcb-kit-stars] drawn in the part stays where it
 * was drawn (after the number, say), its classes kept; a [data-gcb-kit-star] drawn in it (an svg heart, an emoji, a
 * classed span) is the model every star is copied from, shown or given — the kit's mask look only for a bare one; each
 * says data-filled, data-part-filled and its --fill (0–100%) for the design's classes. data-star-label="{i} of {n}
 * stars" names a given star; data-label names a shown row.
 */
import * as rating from '@zag-js/rating-group';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import { kept } from '../_core/kept.js';

document.documentElement.classList.add( 'gcb-kit-rating-on' );

const ROOT = '[data-gcb-kit="rating"]';
let made = 0;
const num = ( v ) => ( v === null || v === undefined || v === '' || Number.isNaN( Number( v ) ) ? null : Number( v ) );
const clamp = ( v, lo, hi ) => Math.min( hi, Math.max( lo, v ) );
const said = ( v ) => String( Math.round( v * 100 ) / 100 );

/* one star, filled to f (0–1): a copy of the design's drawn star, else the kit's */
const star = ( f, model = null ) => {
	let s;
	if ( model ) {
		s = model.cloneNode( true );
		s.removeAttribute( 'id' );
	} else {
		s = document.createElement( 'span' );
		s.setAttribute( 'data-gcb-kit-star', '' );
	}
	fill( s, f );
	return s;
};
const fill = ( s, f ) => {
	s.style.setProperty( '--fill', `${ Math.round( clamp( f, 0, 1 ) * 1000 ) / 10 }%` );
	s.toggleAttribute( 'data-part-filled', f > 0 && f < 1 );
	s.toggleAttribute( 'data-filled', f >= 1 );
};

/* SHOWN: the stars drawn before its words, named for a screen reader as one picture */
function shown( root ) {
	const max = Math.max( 1, Math.round( num( root.getAttribute( 'data-max' ) ) ?? 5 ) );
	const words = root.textContent.match( /\d+(?:[.,]\d+)?/ );
	const value = clamp( num( root.getAttribute( 'data-value' ) ) ?? ( words ? Number( words[ 0 ].replace( ',', '.' ) ) : 0 ), 0, max );
	let stars = root.querySelector( ':scope > [data-gcb-kit-stars]' );
	if ( ! stars ) {
		stars = document.createElement( 'span' );
		stars.setAttribute( 'data-gcb-kit-stars', '' );
		root.prepend( stars );
	}
	/* the design's star, the model for all (kept on the part: the row is drawn again from it) */
	if ( ! ( 'gcbKitStarModel' in root ) ) {
		root.gcbKitStarModel = stars.querySelector( ':scope > [data-gcb-kit-star]' )?.cloneNode( true ) ?? null;
	}
	stars.replaceChildren( ...Array.from( { length: max }, ( _, i ) => star( value - i, root.gcbKitStarModel ) ) );
	stars.setAttribute( 'role', 'img' );
	stars.setAttribute( 'aria-label', root.getAttribute( 'data-label' ) || `Rated ${ said( value ) } out of ${ max }` );
	root.gcbKitRating = { value, max };
	kept(
		root,
		() => !! root.querySelector( ':scope > [data-gcb-kit-stars] > [data-gcb-kit-star]' ),
		() => {
			delete root.gcbKitRating;
			live( root );
		}
	);
}

/* GIVEN: Zag's rating group over the number input */
function given( root, input ) {
	let stopped = false;
	const max = Math.max( 1, Math.round( num( input.max ) ?? num( root.getAttribute( 'data-max' ) ) ?? 5 ) );
	const least = num( input.min ) ?? 0;
	const half = root.hasAttribute( 'data-half' );
	const name = input.name || undefined;
	const label = [ ...root.querySelectorAll( 'label' ) ].find( ( l ) => ! l.contains( input ) ) ?? null;
	let control = root.querySelector( ':scope [data-gcb-kit-stars]' );
	if ( ! control ) {
		control = document.createElement( 'div' );
		control.setAttribute( 'data-gcb-kit-stars', '' );
		input.after( control );
	}
	/* the design's stars kept; the rest copies of its first (else the kit's) */
	const model = control.querySelector( ':scope > [data-gcb-kit-star]' )?.cloneNode( true ) ?? null;
	const items = Array.from( { length: max }, ( _, i ) => control.children[ i ] ?? control.appendChild( star( 0, model ) ) );
	input.setAttribute( 'data-gcb-kit-rating-input', '' );
	input.tabIndex = -1;
	input.setAttribute( 'aria-hidden', 'true' );

	let quiet = false;
	const start = clamp( num( input.value ) ?? 0, 0, max );
	const service = new VanillaMachine( rating.machine, {
		id: 'gcb-rating-' + ++made,
		count: max,
		ids: { root: root.id || undefined, label: label?.id || undefined }, // the design's ids kept
		allowHalf: half,
		defaultValue: start,
		disabled: input.disabled || undefined,
		readOnly: input.readOnly || undefined,
		required: input.required || undefined,
		translations: {
			ratingValueText: ( i ) =>
				root.hasAttribute( 'data-star-label' )
					? root.getAttribute( 'data-star-label' ).replace( '{i}', String( i ) ).replace( '{n}', String( max ) )
					: `${ i } of ${ max } star${ i === 1 ? '' : 's' }`,
		},
		onValueChange: ( d ) => {
			if ( stopped ) {
				return;
			}
			/* below the input's least (a 1–5 rating cleared to 0): no rating, an empty box */
			const v = d.value > 0 ? Math.max( d.value, least ) : 0;
			quiet = true;
			input.value = v > 0 ? String( v ) : '';
			input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
			input.dispatchEvent( new Event( 'change', { bubbles: true } ) );
			quiet = false;
			root.dispatchEvent( new CustomEvent( 'gcbkit:change', { bubbles: true, detail: { value: v, name } } ) );
		},
	} );
	const api = () => rating.connect( service.service, normalizeProps );
	const render = () => {
		if ( stopped ) {
			return;
		}
		const a = api();
		spreadProps( root, a.getRootProps() );
		spreadProps( control, a.getControlProps() );
		if ( label ) {
			spreadProps( label, a.getLabelProps() );
		} else {
			control.removeAttribute( 'aria-labelledby' );
			control.setAttribute( 'aria-label', input.getAttribute( 'aria-label' ) || 'Rating' );
		}
		items.forEach( ( s, i ) => {
			const st = a.getItemState( { index: i + 1 } );
			spreadProps( s, a.getItemProps( { index: i + 1 } ) );
			fill( s, st.half ? 0.5 : st.highlighted ? 1 : 0 );
			s.toggleAttribute( 'data-preview', a.hovering );
		} );
	};
	service.subscribe( render );
	render();
	service.start();
	render();
	/* NO RING AFTER A PRESS: Zag focuses the chosen star from its script after a click, which a browser counts as the
	   keyboard's; the ring is the keyboard's only, so a press says so until a key is pressed */
	control.addEventListener( 'pointerdown', () => root.setAttribute( 'data-pressed', '' ) );
	control.addEventListener( 'keydown', () => root.removeAttribute( 'data-pressed' ) );
	control.addEventListener( 'focusout', ( e ) => ! control.contains( e.relatedTarget ) && root.removeAttribute( 'data-pressed' ) );

	/* a value set by the page, or typed with no script yet: the stars follow */
	const follow = () => {
		if ( quiet || stopped ) {
			return;
		}
		const want = clamp( num( input.value ) ?? 0, 0, max );
		if ( want !== api().value ) {
			if ( want ) {
				api().setValue( want );
			} else {
				api().clearValue();
			}
		}
	};
	const own = Object.getOwnPropertyDescriptor( HTMLInputElement.prototype, 'value' );
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
	input.form?.addEventListener( 'reset', () => setTimeout( follow, 0 ) );
	root.gcbKitRating = { service, get value() {
		return api().value;
	}, set: ( v ) => api().setValue( v ) };
	kept(
		root,
		() => root.contains( control ) && control.hasAttribute( 'data-part' ) && control.children.length === max,
		() => {
			stopped = true;
			service.stop();
			delete root.gcbKitRating;
			live( root );
		}
	);
}

function live( root ) {
	if ( root.gcbKitRating ) {
		return;
	}
	const input = root.querySelector( 'input' );
	if ( input ) {
		given( root, input );
	} else {
		shown( root );
	}
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
