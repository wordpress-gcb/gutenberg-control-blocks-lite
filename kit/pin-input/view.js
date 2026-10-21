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
	const length = Math.min( 12, Math.max( 1, parseInt( root.getAttribute( 'data-length' ) || truth.getAttribute( 'maxlength' ) || '6', 10 ) || 6 ) );
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
	const boxes = Array.from( { length }, ( _, i ) => {
		let box = control.querySelectorAll( 'input' )[ i ];
		if ( ! box ) {
			box = document.createElement( 'input' );
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
		disabled: truth.disabled,
		readOnly: truth.readOnly,
		required: truth.required,
		invalid: invalid(),
		/* never Zag's select-on-focus: it selects a frame later, and a browser's select() focuses — a box the visitor
		   has left took the focus back, and two boxes passed it between them for ever (seen, 2026-10-21) */
		selectOnFocus: false,
		defaultValue: chars( truth.value.slice( 0, length ) ),
		translations: { inputLabel: ( i, n ) => `${ label?.textContent.trim() || 'Code' }, character ${ i + 1 } of ${ n }` },
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
