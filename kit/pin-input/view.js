/**
 * THE KIT'S PIN INPUT (2026-10-21, the forms family: "Enter the 6-digit code we sent you", a booking reference). A code
 * in boxes, one character a box, each box the kit's input made square:
 *
 *   <div data-gcb-kit="pin-input">
 *     <label data-gcb-kit-label for="code">Verification code</label>
 *     <input id="code" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required>
 *   </div>
 *
 * THE NATIVE INPUT STAYS THE TRUTH: the form sends it (the whole code, one value), a page that sets it fills the boxes,
 * a form's reset empties them; every change is written back with `input` + `change`. Without the script it is the one
 * box to type the code in. Its length is the part's data-length, else the input's maxlength, else 6; its characters
 * data-type (numeric | alphanumeric | alphabetic), else numeric when the input says inputmode="numeric", else
 * alphanumeric. autocomplete="one-time-code" unless the input says otherwise (a phone offers the texted code).
 *
 * Zag's pin input (@zag-js/pin-input, MIT): typing moves to the next box, Backspace to the one before, the arrows
 * between them, a paste (or the phone's code) fills them all. data-mask hides what is typed; data-submit sends the form
 * when the last box is filled. Its parts say their state: a box `data-filled`, `data-complete` once all are.
 *
 * THE DRAWING'S BOXES (2026-10-26, the kit wears the drawing): classes on the one input (or the part's data-box-class)
 * go on every box it makes, so the design's box look is worn (border-2 rounded-lg w-12 h-14 text-2xl …); a row drawn as
 * [data-gcb-kit-pin-control] keeps its classes and any boxes drawn in it. data-group="3" puts the boxes in threes, a
 * drawn [data-gcb-kit-pin-separator] (else data-separator's words, else only a wider gap) between them.
 * data-autofocus focuses the first box; data-pattern="[0-9A-F]" is what one character may be; data-length (to 64) is
 * the boxes, else the input's maxlength (to 12); data-box-label="Digit {i} of {n}" names each box.
 */
import * as pin from '@zag-js/pin-input';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import { kept } from '../_core/kept.js';

/* the part is live, said on <html> where no swap reaches */
document.documentElement.classList.add( 'gcb-kit-pin-input-on' );

const ROOT = '[data-gcb-kit="pin-input"]';
const next = () => ( window.__gcbKitPins = ( window.__gcbKitPins || 0 ) + 1 );
const TYPES = [ 'numeric', 'alphanumeric', 'alphabetic' ];

function live( root ) {
	if ( root.gcbKitPin ) {
		return;
	}
	const truth = root.querySelector( 'input:not([data-gcb-kit-pin-box])' );
	if ( ! truth ) {
		return;
	}
	let stopped = false;
	const id = 'gcb-pin-' + next();
	truth.id ||= id + '-value';
	/* the boxes: data-length as said (to 64), else the input's maxlength — a long one a text box's, so 12 at most */
	const asked = parseInt( root.getAttribute( 'data-length' ) || '', 10 );
	const length = asked > 0 ? Math.min( 64, asked ) : Math.min( 12, Math.max( 1, parseInt( truth.getAttribute( 'maxlength' ) || '6', 10 ) || 6 ) );
	const said = root.getAttribute( 'data-type' );
	const type = TYPES.includes( said ) ? said : truth.getAttribute( 'inputmode' ) === 'numeric' ? 'numeric' : 'alphanumeric';
	const auto = truth.getAttribute( 'autocomplete' );
	const otp = ! auto || auto === 'one-time-code';
	if ( otp ) {
		truth.setAttribute( 'autocomplete', 'one-time-code' );
	}
	const label = root.querySelector( '[data-gcb-kit-label], label' );
	if ( label ) {
		label.id ||= id + '-label';
	}

	/* the box look the design gave: the part's data-box-class, else the classes it wrote on the one input (read before the
	   input steps aside) */
	const boxClass = root.getAttribute( 'data-box-class' ) ?? ( truth.getAttribute( 'class' ) || '' ).trim();
	const boxOwn = boxClass !== '' || truth.hasAttribute( 'data-gcb-own' );

	/* the native input steps aside: the form's, not the visitor's (the boxes are theirs) */
	truth.setAttribute( 'data-gcb-kit-pin-value', '' );
	truth.tabIndex = -1;
	truth.setAttribute( 'aria-hidden', 'true' );

	/* THE BOXES: the design's row when drawn, else made after the input */
	let control = root.querySelector( '[data-gcb-kit-pin-control]' );
	if ( ! control ) {
		control = document.createElement( 'div' );
		control.setAttribute( 'data-gcb-kit-pin-control', '' );
		truth.after( control );
	}
	const drawnBoxes = control.querySelectorAll( 'input' ).length;
	const boxes = Array.from( { length }, ( _, i ) => {
		let box = control.querySelectorAll( 'input' )[ i ];
		if ( ! box ) {
			box = document.createElement( 'input' );
			if ( boxOwn ) {
				box.className = boxClass;
				box.setAttribute( 'data-gcb-own', '' );
			}
			control.appendChild( box );
		}
		box.setAttribute( 'data-gcb-kit-pin-box', '' );
		/* the kit's input (controls.css), unless the design drew its own */
		if ( ! box.hasAttribute( 'data-gcb-own' ) && ! box.getAttribute( 'class' ) ) {
			box.setAttribute( 'data-gcb-kit-control', '' );
		}
		return box;
	} );
	control.style.setProperty( '--gcb-pin-count', String( length ) );
	/* IN GROUPS: a separator between each data-group boxes — the design's drawn one, else its words, else none (a gap) —
	   where the design has not placed its own between drawn boxes */
	const group = parseInt( root.getAttribute( 'data-group' ) || '', 10 );
	const placed = control.querySelectorAll( '[data-gcb-kit-pin-separator]' );
	if ( group > 0 && group < length && ! ( drawnBoxes && placed.length ) ) {
		const model = placed[ 0 ] ?? null;
		model?.remove();
		const words = root.getAttribute( 'data-separator' );
		for ( let i = group; i < length; i += group ) {
			let sep = model?.cloneNode( true );
			if ( ! sep ) {
				sep = document.createElement( 'span' );
				sep.setAttribute( 'data-gcb-kit-pin-separator', '' );
				sep.textContent = words || '';
			}
			sep.setAttribute( 'aria-hidden', 'true' );
			boxes[ i ].before( sep );
		}
	}
	control.setAttribute( 'role', 'group' );
	if ( label ) {
		control.setAttribute( 'aria-labelledby', label.id );
	}

	const chars = ( s ) => Array.from( { length }, ( _, i ) => ( s || '' )[ i ] || '' );
	const invalid = () => truth.getAttribute( 'aria-invalid' ) === 'true';
	let written = truth.value;
	const service = new VanillaMachine( pin.machine, {
		id,
		ids: { root: root.id || undefined, ...( label ? { label: label.id } : {} ) }, // the design's ids kept
		count: length,
		type,
		otp,
		mask: root.hasAttribute( 'data-mask' ),
		placeholder: root.getAttribute( 'data-placeholder' ) ?? '',
		pattern: root.getAttribute( 'data-pattern' ) || undefined,
		disabled: truth.disabled,
		readOnly: truth.readOnly,
		required: truth.required,
		invalid: invalid(),
		/* never Zag's select-on-focus: it selects a frame later, and a browser's select() focuses — a box the visitor
		   has left took the focus back, and two boxes passed it between them for ever (seen, 2026-10-21) */
		selectOnFocus: false,
		defaultValue: chars( truth.value.slice( 0, length ) ),
		translations: {
			inputLabel: ( i, n ) =>
				root.hasAttribute( 'data-box-label' )
					? root.getAttribute( 'data-box-label' ).replace( '{i}', String( i + 1 ) ).replace( '{n}', String( n ) )
					: `${ label?.textContent.trim() || 'Code' }, character ${ i + 1 } of ${ n }`,
		},
		onValueChange: ( { valueAsString } ) => {
			if ( stopped || valueAsString === written ) {
				return;
			}
			written = valueAsString;
			truth.value = valueAsString;
			[ 'input', 'change' ].forEach( ( t ) => truth.dispatchEvent( new Event( t, { bubbles: true } ) ) );
		},
		onValueComplete: () => {
			if ( ! stopped && root.hasAttribute( 'data-submit' ) && truth.form ) {
				truth.form.requestSubmit();
			}
		},
	} );
	const api = () => pin.connect( service.service, normalizeProps );
	const render = () => {
		if ( stopped ) {
			return;
		}
		const a = api();
		spreadProps( root, a.getRootProps() );
		spreadProps( control, a.getControlProps() );
		if ( label ) {
			const labelProps = a.getLabelProps();
			delete labelProps.htmlFor;
			delete labelProps.for;
			delete labelProps.onclick; // the label's press is ours (below): the first empty box
			spreadProps( label, labelProps );
		}
		boxes.forEach( ( box, index ) => spreadProps( box, a.getInputProps( { index } ) ) );
	};
	service.subscribe( render );
	service.start();
	render();
	/* data-autofocus: the first box ready to type in (Zag's own focuses before its boxes are drawn) */
	if ( root.hasAttribute( 'data-autofocus' ) && ! truth.disabled ) {
		boxes[ 0 ].focus( { preventScroll: true } );
	}

	/* the page's news: a value it sets, a reset, an error it marks */
	const follow = () => {
		if ( stopped || truth.value === written ) {
			return;
		}
		written = truth.value;
		api().setValue( chars( truth.value.slice( 0, length ) ) );
	};
	const own = Object.getOwnPropertyDescriptor( HTMLInputElement.prototype, 'value' );
	Object.defineProperty( truth, 'value', {
		configurable: true,
		get() {
			return own.get.call( this );
		},
		set( v ) {
			own.set.call( this, v );
			queueMicrotask( follow );
		},
	} );
	truth.form?.addEventListener( 'reset', () => setTimeout( follow, 0 ) );
	new MutationObserver( () => ! stopped && service.updateProps( { invalid: invalid(), disabled: truth.disabled } ) ).observe( truth, {
		attributes: true,
		attributeFilter: [ 'aria-invalid', 'disabled' ],
	} );
	/* a form that will not send it empty: the first empty box, for the visitor to fill */
	truth.addEventListener( 'invalid', () => ( boxes.find( ( b ) => ! b.value ) || boxes[ 0 ] ).focus() );
	/* the label's press: the first box to fill */
	label?.addEventListener( 'click', ( e ) => {
		e.preventDefault();
		( boxes.find( ( b ) => ! b.value ) || boxes[ length - 1 ] ).focus();
	} );

	root.gcbKitPin = { service, truth, boxes };
	kept(
		root,
		() => root.contains( control ) && control.querySelectorAll( 'input[data-gcb-kit-pin-box][data-part]' ).length === length,
		() => {
			stopped = true;
			service.stop();
			delete root.gcbKitPin;
			live( root );
		}
	);
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
