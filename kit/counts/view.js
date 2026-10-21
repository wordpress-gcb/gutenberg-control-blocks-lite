/**
 * THE KIT'S COUNTS (2026-10-21, Mark: "the dropdowns are kind of widgets more than actual dropdown like text" — a booking
 * card's guests are not a list but adults, children and infants, each counted with − and +). A field that says the sum,
 * opening the kit's widget panel (kit/_core/widget.js) with a row for each count:
 *
 *   <div data-gcb-kit="counts" data-one="guest" data-many="guests" data-sync="stay">
 *     <button type="button" data-gcb-kit-field><span>Guests</span><span data-gcb-kit-counts-said>1 guest</span></button>
 *     <div data-gcb-kit-counts-panel>
 *       <div data-gcb-kit-count><span>Adults</span><span>Ages 13 or above</span>
 *         <input type="number" name="adults" min="1" max="16" value="1"></div>
 *       <div data-gcb-kit-count><span>Infants</span><span>Under 2</span>
 *         <input type="number" name="infants" min="0" max="5" value="0" data-apart data-one="infant" data-many="infants"></div>
 *     </div>
 *   </div>
 *
 * THE NATIVE INPUTS STAY THE TRUTH: a form sends them, a page sets them. Each row is Zag's number input
 * (@zag-js/number-input, MIT — the keyboard's arrows, a press held down, its min and max, a screen reader's words): its
 * input shows the number, − and + made here round it, off at its ends. The field's words are the sum of the counts not set apart ("2 guests") and
 * each set apart after it ("2 guests, 1 infant"). Counts on a page that share data-sync are one: the same names, the
 * same numbers.
 */
import * as numberInput from '@zag-js/number-input';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import { widget } from '../_core/widget.js';

/* the part is live: its look switches from the plain inputs to the steppers on <html>, where no swap reaches */
document.documentElement.classList.add( 'gcb-kit-counts-on' );

const ROOT = '[data-gcb-kit="counts"]';
let made = 0;
const num = ( v, d = 0 ) => ( v === '' || v === null || v === undefined || Number.isNaN( Number( v ) ) ? d : Number( v ) );
const el = ( tag, attrs = {}, html = '' ) => {
	const e = document.createElement( tag );
	Object.entries( attrs ).forEach( ( [ k, v ] ) => e.setAttribute( k, v ) );
	if ( html ) {
		e.innerHTML = html;
	}
	return e;
};
const MINUS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>';
const PLUS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

function live( root ) {
	if ( root.gcbKitCounts ) {
		return;
	}
	const field = root.querySelector( '[data-gcb-kit-field]' );
	const panel = root.querySelector( '[data-gcb-kit-counts-panel]' );
	const rows = [ ...root.querySelectorAll( '[data-gcb-kit-count]' ) ];
	if ( ! field || ! panel || ! rows.length ) {
		return;
	}
	const said = root.querySelector( '[data-gcb-kit-counts-said]' );
	const one = root.getAttribute( 'data-one' ) || '';
	const many = root.getAttribute( 'data-many' ) || one;
	const sync = root.getAttribute( 'data-sync' ) || '';

	/* each row Zag's number input: − its input (the number) +, the row's first words its label */
	let quiet = false;
	const counts = rows
		.map( ( row ) => {
			const input = row.querySelector( 'input' );
			if ( ! input ) {
				return null;
			}
			const labelEl = row.querySelector( 'span' );
			const label = ( labelEl?.textContent || input.name || '' ).trim();
			const less = el( 'button', { type: 'button', 'data-gcb-kit-count-less': '' }, MINUS );
			const more = el( 'button', { type: 'button', 'data-gcb-kit-count-more': '' }, PLUS );
			const step = el( 'div', { 'data-gcb-kit-count-step': '' } );
			input.replaceWith( step );
			step.append( less, input, more );
			input.setAttribute( 'data-gcb-kit-count-input', '' );
			const c = { row, input, less, more, step, label, labelEl };
			c.service = new VanillaMachine( numberInput.machine, {
				id: 'gcb-count-' + ++made,
				name: input.name || undefined,
				min: num( input.min, 0 ),
				max: num( input.max, 99 ),
				step: num( input.step, 1 ),
				defaultValue: String( num( input.value, num( input.min, 0 ) ) ),
				allowMouseWheel: false,
				clampValueOnBlur: true,
				spinOnPress: true,
				translations: { decrementLabel: 'Fewer ' + label.toLowerCase(), incrementLabel: 'More ' + label.toLowerCase() },
				onValueChange: () => {
					input.dispatchEvent( new Event( 'change', { bubbles: true } ) );
					render();
					tell();
				},
			} );
			c.api = () => numberInput.connect( c.service.service, normalizeProps );
			c.draw = () => {
				const a = c.api();
				spreadProps( row, a.getRootProps() );
				if ( labelEl ) {
					spreadProps( labelEl, a.getLabelProps() );
				}
				spreadProps( step, a.getControlProps() );
				spreadProps( input, a.getInputProps() );
				spreadProps( less, a.getDecrementTriggerProps() );
				spreadProps( more, a.getIncrementTriggerProps() );
			};
			c.service.subscribe( c.draw );
			c.service.start();
			c.draw();
			return c;
		} )
		.filter( Boolean );
	const read = ( c ) => c.api().valueAsNumber || 0;
	const tell = () => {
		if ( sync && ! quiet ) {
			document.dispatchEvent( new CustomEvent( 'gcbkit:counts-sync', { detail: { key: sync, from: root, values: Object.fromEntries( counts.map( ( x ) => [ x.input.name, read( x ) ] ) ) } } ) );
		}
	};

	/* the field's words: the sum of the counts not set apart, then each set apart */
	const words = ( n, o, m ) => `${ n } ${ n === 1 ? o : m }`.trim();
	const render = () => {
		if ( said ) {
			const main = counts.filter( ( c ) => ! c.input.hasAttribute( 'data-apart' ) ).reduce( ( t, c ) => t + read( c ), 0 );
			const apart = counts
				.filter( ( c ) => c.input.hasAttribute( 'data-apart' ) && read( c ) > 0 )
				.map( ( c ) => words( read( c ), c.input.getAttribute( 'data-one' ) || c.label.toLowerCase(), c.input.getAttribute( 'data-many' ) || c.label.toLowerCase() ) );
			/* nobody yet ("Add guests"): the design's own words, as a placeholder — the sum once there is one */
			said.dataset.drawn ??= said.textContent.trim();
			const none = main === 0 && ! apart.length;
			said.textContent = none ? said.dataset.drawn : [ words( main, one, many ), ...apart ].join( ', ' );
			said.toggleAttribute( 'data-placeholder', none );
		}
		field.toggleAttribute( 'data-active', pane.isOpen() );
		field.setAttribute( 'aria-expanded', String( pane.isOpen() ) );
		if ( pane.isOpen() ) {
			pane.place();
		}
	};

	const pane = widget( panel, field, { side: 'start', keep: () => [ field ], closed: () => render(), focus: field } );
	panel.style.setProperty( '--gcb-counts-min', field.getBoundingClientRect().width + 'px' );
	field.setAttribute( 'aria-haspopup', 'dialog' );
	if ( ! field.matches( 'button, a, input' ) ) {
		field.setAttribute( 'role', 'button' );
		field.tabIndex = 0;
	}
	const toggle = () => {
		if ( pane.isOpen() ) {
			pane.close();
		} else {
			panel.style.setProperty( '--gcb-counts-min', field.getBoundingClientRect().width + 'px' );
			pane.open();
		}
		render();
	};
	field.addEventListener( 'click', ( e ) => {
		e.preventDefault();
		toggle();
	} );
	if ( ! field.matches( 'button' ) ) {
		field.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Enter' || e.key === ' ' ) {
				e.preventDefault();
				toggle();
			}
		} );
	}
	/* a count set by the page (a form's reset): followed */
	counts.forEach( ( c ) =>
		c.input.addEventListener( 'reset', () => c.api().setValue( num( c.input.defaultValue, 0 ) ) )
	);
	if ( sync ) {
		document.addEventListener( 'gcbkit:counts-sync', ( e ) => {
			if ( e.detail.key !== sync || e.detail.from === root ) {
				return;
			}
			quiet = true;
			counts.forEach( ( c ) => {
				if ( c.input.name in e.detail.values && read( c ) !== e.detail.values[ c.input.name ] ) {
					c.api().setValue( e.detail.values[ c.input.name ] );
				}
			} );
			quiet = false;
		} );
	}
	render();
	root.gcbKitCounts = { pane, counts };
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
