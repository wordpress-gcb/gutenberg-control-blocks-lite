/**
 * THE KIT'S TAGS INPUT (2026-10-21, the forms family: "Skills", "Interests", "Keywords"). Words of the visitor's own,
 * each a chip in one box that looks like the kit's input:
 *
 *   <div data-gcb-kit="tags-input" data-max="8">
 *     <label data-gcb-kit-label for="skills">Skills</label>
 *     <input id="skills" name="skills" placeholder="Add a skill" value="Design, Research">
 *   </div>
 *
 * THE NATIVE INPUT STAYS THE TRUTH, ONE VALUE, COMMA-SEPARATED ("Design, Research"): the form sends one field, as
 * it would without the script — where the visitor types "Design, Research" into the plain box — so the server reads
 * the same shape either way (split on commas), and GCB Forms' text rules (required, its length) still hold. Repeated
 * inputs (name[]) would send a different shape with the script than without it. Every change is written back with
 * `input` + `change`; a value the page sets and a form's reset are followed.
 *
 * Zag's tags input (@zag-js/tags-input, MIT): Enter or a comma adds what is typed, a paste of "a, b, c" adds three,
 * leaving the box adds what was left in it; Backspace in the empty box marks the last chip and a second Backspace takes
 * it off (the arrows move the mark, Delete takes the marked one); its × takes one off; no word twice; data-max the most
 * (one more is refused and said, in the kit's error words — data-max-words for other words; a paste past it keeps
 * the first ones). A screen reader hears each added and taken off. Its parts
 * say their state: the box `data-focus`, `data-invalid`; a chip `data-highlighted`; the part `data-full` at its most.
 */
import * as tags from '@zag-js/tags-input';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import { kept } from '../_core/kept.js';

/* the part is live, said on <html> where no swap reaches */
document.documentElement.classList.add( 'gcb-kit-tags-input-on' );

const ROOT = '[data-gcb-kit="tags-input"]';
const next = () => ( window.__gcbKitTags = ( window.__gcbKitTags || 0 ) + 1 );
const split = ( s ) =>
	( s || '' )
		.split( ',' )
		.map( ( w ) => w.trim() )
		.filter( Boolean );
const X = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';
const el = ( tag, attr ) => {
	const e = document.createElement( tag );
	e.setAttribute( attr, '' );
	return e;
};

function live( root ) {
	if ( root.gcbKitTags ) {
		return;
	}
	const truth = root.querySelector( 'input:not([data-gcb-kit-tags-entry])' );
	if ( ! truth ) {
		return;
	}
	let stopped = false;
	const id = 'gcb-tags-' + next();
	truth.id ||= id + '-value';
	const max = parseInt( root.getAttribute( 'data-max' ) || '', 10 ) || Infinity;
	const label = root.querySelector( '[data-gcb-kit-label], label' );
	if ( label ) {
		label.id ||= id + '-label';
	}

	/* the native input steps aside: the form's, not the visitor's */
	truth.setAttribute( 'data-gcb-kit-tags-value', '' );
	truth.tabIndex = -1;
	truth.setAttribute( 'aria-hidden', 'true' );

	/* THE BOX: the chips, then the box typed in (the design's own words for it: the input's placeholder) */
	let control = root.querySelector( '[data-gcb-kit-tags-control]' );
	if ( ! control ) {
		control = el( 'div', 'data-gcb-kit-tags-control' );
		truth.after( control );
	}
	let entry = control.querySelector( '[data-gcb-kit-tags-entry]' );
	if ( ! entry ) {
		entry = el( 'input', 'data-gcb-kit-tags-entry' );
		control.appendChild( entry );
	}
	/* drawn here, not by the kit's input: the box round the chips is the input, this is the words inside it */
	entry.setAttribute( 'data-gcb-own', '' );
	entry.id = id + '-entry';
	entry.setAttribute( 'enterkeyhint', 'enter' );
	let error = root.querySelector( '[data-gcb-kit-tags-error]' );
	if ( ! error ) {
		error = el( 'p', 'data-gcb-kit-tags-error' );
		error.setAttribute( 'data-gcb-kit-error-text', '' );
		error.setAttribute( 'aria-live', 'polite' );
		error.hidden = true;
		control.after( error );
	}
	const tooMany = root.getAttribute( 'data-max-words' ) || ( max === 1 ? 'Only one.' : `Up to ${ max }.` );
	const say = ( words ) => {
		error.textContent = words;
		error.hidden = ! words;
	};

	const invalid = () => truth.getAttribute( 'aria-invalid' ) === 'true';
	let carry = null; // what is typed between a chip added and Zag emptying the box (below)
	let count = split( truth.value ).length;
	let written = split( truth.value ).join( ', ' );
	const service = new VanillaMachine( tags.machine, {
		id,
		ids: { root: root.id || undefined, input: entry.id, control: id + '-control', ...( label ? { label: label.id } : {} ) },
		defaultValue: split( truth.value ),
		max,
		delimiter: ',',
		addOnPaste: true,
		blurBehavior: 'add',
		editable: false,
		allowDuplicates: false,
		placeholder: truth.getAttribute( 'placeholder' ) || undefined,
		disabled: truth.disabled,
		readOnly: truth.readOnly,
		invalid: invalid(),
		onInputValueChange: ( { inputValue } ) => {
			if ( carry !== null && inputValue === '' ) {
				const typed = carry;
				carry = null;
				if ( typed ) {
					queueMicrotask( () => ! stopped && api().setInputValue( typed ) );
				}
			}
		},
		onValueChange: ( { value } ) => {
			/* a paste past the most: its first ones kept, the rest said */
			if ( value.length > max ) {
				queueMicrotask( () => api().setValue( value.slice( 0, max ) ) );
				say( tooMany );
				return;
			}
			if ( error.textContent !== tooMany || value.length < max ) {
				say( '' );
			}
			/* a chip added from the box: the box empty now, not a frame from now */
			if ( value.length > count && document.activeElement === entry ) {
				carry = '';
				entry.value = '';
			}
			count = value.length;
			const now = value.join( ', ' );
			if ( stopped || now === written ) {
				return;
			}
			written = now;
			truth.value = now;
			[ 'input', 'change' ].forEach( ( t ) => truth.dispatchEvent( new Event( t, { bubbles: true } ) ) );
		},
	} );
	const api = () => tags.connect( service.service, normalizeProps );

	/* EACH CHIP: the item, its pill (the mark), its words and its × — drawn again only when the words change */
	let drawn = '';
	let chips = [];
	const draw = ( value ) => {
		const key = value.join( '\u0000' );
		if ( key === drawn ) {
			return;
		}
		drawn = key;
		chips.forEach( ( c ) => c.item.remove() );
		chips = value.map( ( v ) => {
			const item = el( 'span', 'data-gcb-kit-tag' );
			const chip = el( 'span', 'data-gcb-kit-tag-chip' );
			const text = el( 'span', 'data-gcb-kit-tag-text' );
			const x = el( 'button', 'data-gcb-kit-tag-remove' );
			x.type = 'button';
			x.innerHTML = X;
			text.textContent = v;
			chip.append( text, x );
			item.appendChild( chip );
			control.insertBefore( item, entry );
			return { item, chip, text, x };
		} );
	};
	const render = () => {
		if ( stopped ) {
			return;
		}
		const a = api();
		draw( a.value );
		spreadProps( root, a.getRootProps() );
		spreadProps( control, a.getControlProps() );
		spreadProps( entry, a.getInputProps() );
		if ( label ) {
			spreadProps( label, a.getLabelProps() );
		}
		a.value.forEach( ( value, index ) => {
			const c = chips[ index ];
			if ( ! c ) {
				return;
			}
			const p = { index, value };
			spreadProps( c.item, a.getItemProps( p ) );
			spreadProps( c.chip, a.getItemPreviewProps( p ) );
			spreadProps( c.text, a.getItemTextProps( p ) );
			spreadProps( c.x, a.getItemDeleteTriggerProps( p ) );
		} );
		root.toggleAttribute( 'data-full', a.value.length >= max );
	};
	service.subscribe( render );
	service.start();
	render();
	/* A CHIP ADDED, THE BOX EMPTY AT ONCE: Zag empties it a frame later, which took with it a letter typed in that frame
	   ("Writing" became "riting"); emptied here as the chip is added, and what is typed before Zag's frame carried
	   over it */
	entry.addEventListener( 'input', () => carry !== null && ( carry = entry.value ) );
	/* one more at the most: Zag refuses it quietly; said here, in the kit's error words */
	entry.addEventListener( 'keydown', ( e ) => {
		if ( ( e.key === 'Enter' || e.key === ',' ) && api().atMax && entry.value.trim() ) {
			e.preventDefault();
			say( tooMany );
		}
	} );
	/* the visitor empties the box: the "too many" goes with what they typed */
	entry.addEventListener( 'input', () => ! entry.value && error.textContent === tooMany && say( '' ) );
	/* a press anywhere in the box puts the caret in it */
	control.addEventListener( 'pointerdown', ( e ) => {
		if ( e.target === control ) {
			e.preventDefault();
			entry.focus();
		}
	} );

	/* the page's news: a value it sets, a reset, an error it marks */
	const follow = () => {
		const now = split( truth.value ).join( ', ' );
		if ( stopped || now === written ) {
			return;
		}
		written = now;
		api().setValue( split( truth.value ) );
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
	/* a form that will not send it empty: the box, for the visitor to fill */
	truth.addEventListener( 'invalid', () => entry.focus() );
	/* sent with what was left typed: a word in the box when the form goes is a chip */
	truth.form?.addEventListener(
		'submit',
		() => {
			if ( entry.value.trim() ) {
				api().addValue( entry.value.trim() );
				api().clearInputValue();
			}
		},
		true
	);

	root.gcbKitTags = { service, truth, entry };
	kept(
		root,
		() => root.contains( control ) && control.contains( entry ) && entry.hasAttribute( 'data-part' ),
		() => {
			stopped = true;
			service.stop();
			delete root.gcbKitTags;
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
