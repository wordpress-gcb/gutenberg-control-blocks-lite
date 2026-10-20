/**
 * THE KIT'S SELECT (Mark, 2026-10-19: "it's better if we made a select component it could use … thing with select is
 * anything MUST be possible in any style so we might want icons and stuff in there too. you've got to build something
 * super versatile" — "zag sounds good … both can be uniform"). One select for GCB Pro's built sections and GCB Forms.
 *
 * THE NATIVE <select> STAYS THE TRUTH. The markup is a real <select> (the kit filter fills its options on the server,
 * a form submits it) beside a drawn trigger and a drawn list — any markup, any classes, icons anywhere:
 *
 *   <div data-gcb-kit="select">
 *     <select name="make" data-gcb-kit-facet="make"><option value="">Make</option>…</select>
 *     <button data-gcb-kit-select-trigger><span data-gcb-kit-select-value></span><svg …chevron/></button>
 *     <ul data-gcb-kit-select-list>
 *       <li data-gcb-kit-select-option><span data-gcb-kit-select-label></span></li>   ← one pattern, for every option
 *       <li data-gcb-kit-select-option="electric"><svg …/> Electric</li>               ← or an option drawn as itself
 *     </ul>
 *   </div>
 *
 * Here, once the page runs, Zag (@zag-js/select, MIT) gives it the keyboard, the screen reader's words, focus and
 * the list's place on screen; each option is the pattern drawn again for an option of the native select, unless that
 * value is drawn as itself. A choice is written back to the native select with a `change` event, so the kit filter
 * and a form hear it as they always have; a value the page sets on the native select (the filter's reset, a chip
 * taken off) is followed. Without scripts — and on the editor canvas — the native select is what shows.
 *
 * Its parts say their state for styling: the root `data-state="open|closed"`, an option `data-state="checked"`,
 * `data-highlighted` and `aria-selected`, the trigger `aria-expanded`. assets/kit/select.css gives defaults that any
 * class beats.
 */
import * as select from '@zag-js/select';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';

const ROOT = '[data-gcb-kit="select"]';
let made = 0;

/* the native select's options, as Zag's collection items; a value-less first option is the placeholder */
const itemsOf = ( native ) =>
	[ ...native.options ]
		.filter( ( o ) => o.value !== '' )
		.map( ( o ) => ( { value: o.value, label: o.textContent.trim(), disabled: o.disabled || o.hidden } ) );
const placeholderOf = ( native ) => {
	const first = native.options[ 0 ];
	return first && first.value === '' ? first.textContent.trim() : '';
};
const chosenOf = ( native ) => [ ...native.selectedOptions ].map( ( o ) => o.value ).filter( ( v ) => v !== '' );

function live( root ) {
	if ( root.gcbKitSelect ) {
		return;
	}
	const native = root.querySelector( 'select' );
	const trigger = root.querySelector( '[data-gcb-kit-select-trigger]' );
	const list = root.querySelector( '[data-gcb-kit-select-list]' );
	if ( ! native || ! trigger || ! list ) {
		return;
	}
	const valueText = root.querySelector( '[data-gcb-kit-select-value]' );
	/* the options as drawn: those that name their value are themselves; the first that does not is the pattern */
	const drawn = {};
	let pattern = null;
	for ( const o of [ ...list.querySelectorAll( '[data-gcb-kit-select-option]' ) ] ) {
		const v = o.getAttribute( 'data-gcb-kit-select-option' );
		if ( v ) {
			drawn[ v ] = o;
		} else if ( ! pattern ) {
			pattern = o;
		}
		o.remove();
	}
	if ( ! pattern ) {
		pattern = document.createElement( 'li' );
		pattern.setAttribute( 'data-gcb-kit-select-option', '' );
		pattern.innerHTML = '<span data-gcb-kit-select-label></span>';
	}
	/* the list floats over the page, placed by Zag in a box of its own */
	const positioner = document.createElement( 'div' );
	positioner.setAttribute( 'data-gcb-kit-select-positioner', '' );
	list.replaceWith( positioner );
	positioner.appendChild( list );

	const id = 'gcb-select-' + ++made;
	let quiet = false; // while the native select is being written from here
	let written = chosenOf( native ).join( '\u0000' ); // what Zag and the native select last agreed on
	let items = itemsOf( native );
	const collection = () => select.collection( { items, itemToValue: ( i ) => i.value, itemToString: ( i ) => i.label, isItemDisabled: ( i ) => i.disabled } );
	/* the parts keep the ids the page gave them (a label's for, a script's own lookup); Zag makes up the rest */
	const ids = Object.fromEntries( [ [ 'root', root ], [ 'trigger', trigger ], [ 'content', list ] ].filter( ( [ , el ] ) => el.id ).map( ( [ k, el ] ) => [ k, el.id ] ) );
	/* A LABEL FOR THE SELECT NAMES THE TRIGGER (a form's <label for> points at the native select, out of sight once
	   this runs): the screen reader reads it for the trigger, and a press on the label goes to the trigger */
	const label = native.id ? document.querySelector( `label[for="${ CSS.escape( native.id ) }"]` ) : null;
	if ( label ) {
		label.id ||= native.id + '-label';
		ids.label = label.id;
		label.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			trigger.focus();
		} );
	}
	const service = new VanillaMachine( select.machine, {
		id,
		ids,
		collection: collection(),
		multiple: native.multiple,
		defaultValue: chosenOf( native ), // where it starts; Zag keeps it from there (a `value` would be held, never moved)
		deselectable: ! native.multiple && !! placeholderOf( native ),
		closeOnSelect: ! native.multiple,
		loopFocus: true,
		positioning: { placement: 'bottom-start', sameWidth: false, gutter: 6, strategy: 'fixed' }, // fixed: a section with overflow:hidden never cuts the menu off (tests/kit/hostile.mjs); // the menu fits its words (assets/kit/select.css): at least the trigger, wider for a long option
		onValueChange( d ) {
			/* the choice goes to the native select, and everyone listening hears it */
			/* OUR OWN ECHO IS NOT NEWS (2026-10-19: a choice wrote the native select, its change came back here while
			   Zag had not yet stored the value, was taken for the page's, set again — and the page died in the loop) */
			const key = d.value.join( '\u0000' );
			if ( key === written ) {
				return;
			}
			written = key;
			quiet = true;
			const want = new Set( d.value );
			if ( native.multiple ) {
				[ ...native.options ].forEach( ( o ) => ( o.selected = want.has( o.value ) ) );
			} else {
				native.value = d.value[ 0 ] ?? '';
			}
			native.dispatchEvent( new Event( 'input', { bubbles: true } ) );
			native.dispatchEvent( new Event( 'change', { bubbles: true } ) );
			quiet = false;
		},
	} );

	/* each option drawn: the value's own, else the pattern with its words */
	let optionEls = [];
	const drawOptions = () => {
		optionEls.forEach( ( el ) => el.remove() );
		optionEls = items.map( ( item ) => {
			const el = ( drawn[ item.value ] ?? pattern ).cloneNode( true );
			el.setAttribute( 'data-gcb-kit-select-option', item.value );
			const label = el.querySelector( '[data-gcb-kit-select-label]' );
			if ( label ) {
				label.textContent = item.label;
			} else if ( ! drawn[ item.value ] ) {
				el.textContent = item.label;
			}
			list.appendChild( el );
			return el;
		} );
	};

	const render = () => {
		const api = select.connect( service.service, normalizeProps );
		spreadProps( root, api.getRootProps() );
		spreadProps( trigger, api.getTriggerProps() );
		spreadProps( positioner, api.getPositionerProps() );
		spreadProps( list, api.getContentProps() );
		items.forEach( ( item, i ) => optionEls[ i ] && spreadProps( optionEls[ i ], api.getItemProps( { item } ) ) );
		/* "Fiat +2" (Mark, 2026-10-19 — the bar's Make said "Fiat" while three makes were on): one choice says itself,
		   several the first and how many more; data-summary="all" names them all */
		const chosen = api.selectedItems.map( ( i ) => i.label );
		const said = chosen.length > 1 && root.getAttribute( 'data-summary' ) !== 'all' ? `${ chosen[ 0 ] } +${ chosen.length - 1 }` : api.valueAsString;
		/* a select with a choice says so, for the design to show it on (data-[chosen]:) and the kit's default outline */
		root.toggleAttribute( 'data-chosen', chosen.length > 0 );
		trigger.toggleAttribute( 'data-chosen', chosen.length > 0 );
		if ( valueText ) {
			const words = said || placeholderOf( native );
			if ( valueText.textContent !== words ) {
				valueText.textContent = words;
			}
			valueText.toggleAttribute( 'data-placeholder', ! api.value.length );
		}
	};

	/* the page sets the native select (the filter's reset, a chip taken off, a dependent list redrawn): followed */
	const follow = () => {
		if ( quiet ) {
			return;
		}
		const now = chosenOf( native );
		const key = now.join( '\u0000' );
		if ( key !== written ) {
			written = key;
			select.connect( service.service, normalizeProps ).setValue( now );
		}
	};
	const own = Object.getOwnPropertyDescriptor( HTMLSelectElement.prototype, 'value' );
	Object.defineProperty( native, 'value', {
		configurable: true,
		get() {
			return own.get.call( this );
		},
		set( v ) {
			own.set.call( this, v );
			queueMicrotask( follow );
		},
	} );
	native.addEventListener( 'change', follow );
	/* a part that sets the native select's options as properties (the kit filter's choices) says so with gcbkit:change */
	document.addEventListener( 'gcbkit:change', () => setTimeout( follow, 30 ) ); // after the filter has drawn its state
	new MutationObserver( () => {
		items = itemsOf( native );
		service.updateProps( { collection: collection() } );
		drawOptions();
		follow();
		render();
	} ).observe( native, { childList: true, subtree: true, attributes: true, attributeFilter: [ 'disabled', 'hidden', 'selected' ] } );

	drawOptions();
	service.subscribe( render );
	service.start();
	render();
	root.classList.add( 'is-live' );
	root.gcbKitSelect = { service, native };
}

function boot() {
	document.querySelectorAll( ROOT ).forEach( live );
}
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', boot );
} else {
	boot();
}
/* a select drawn later (a dialog's content, a list redrawn) comes alive when it lands */
new MutationObserver( ( muts ) => {
	for ( const m of muts ) {
		for ( const n of m.addedNodes ) {
			if ( n.nodeType === 1 ) {
				( n.matches?.( ROOT ) ? [ n ] : [ ...n.querySelectorAll?.( ROOT ) ?? [] ] ).forEach( live );
			}
		}
	}
} ).observe( document.documentElement, { childList: true, subtree: true } );
