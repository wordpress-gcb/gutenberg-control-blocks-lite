/**
 * THE KIT'S COPY BUTTON (2026-10-21: "Copy link", a promo code, a booking reference — a press puts words on the
 * visitor's clipboard and says so). The behaviour is Zag's clipboard (@zag-js/clipboard, MIT): the write (the
 * browser's clipboard, else the old way for a page that is not secure) and the moment it is "copied". The interface is
 * ours:
 *
 *   <button data-gcb-kit-copy="CODE20">Copy code</button>                     the words in the attribute
 *   <code data-gcb-kit-copy-value>BK-48213</code> <button data-gcb-kit-copy>Copy</button>
 *                                                                              the words of an element beside it (in it, or the nearest box round both that
 *                                                                              holds no other copy button; an input's value)
 *   <button data-gcb-kit-copy data-copied="Link copied">Copy link</button>     nothing to copy: the page's address
 *
 * ON A PRESS its words say "Copied" (data-copied="…" for others) for two seconds, its width held so nothing moves, and
 * it says data-state="copied" for the design to show it on (data-[state=copied]:). With the kit's toast on the page
 * a toast says it too (gcbkit:toast) — unless the button asks the toast itself (data-gcb-toast); without one, a
 * screen reader is told in a quiet live region. Words of their own to swap: [data-gcb-kit-copy-words] inside the
 * button; else its last words, so an icon before them stays.
 */
import * as clipboard from '@zag-js/clipboard';
import { VanillaMachine, normalizeProps } from '@zag-js/vanilla';

document.documentElement.classList.add( 'gcb-kit-copy-on' );

const ROOT = '[data-gcb-kit-copy]';
const VALUE = '[data-gcb-kit-copy-value]';
const TIME = 2000;
const next = () => ( window.__gcbKitCopies = ( window.__gcbKitCopies || 0 ) + 1 );

/* what is copied, read at the press (a code a script changed, the address the filter moved to) */
function valueOf( button ) {
	const own = ( button.getAttribute( 'data-gcb-kit-copy' ) || '' ).trim();
	if ( own ) {
		return { text: own, link: false };
	}
	/* the nearest box round it that holds a value — and no other copy button: a box two buttons share is neither's */
	for ( let box = button; box && box !== document.documentElement; box = box.parentElement ) {
		if ( box !== button && [ ...box.querySelectorAll( ROOT ) ].some( ( o ) => o !== button && ! o.contains( button ) ) ) {
			break;
		}
		const v = box.querySelector( VALUE );
		if ( v ) {
			const text = ( 'value' in v && v.tagName !== 'BUTTON' ? v.value : v.textContent ).trim();
			if ( text ) {
				return { text, link: /^https?:\/\//.test( text ) };
			}
			break;
		}
	}
	return { text: window.location.href, link: true };
}

/* the words that swap: its own, else its last words (an icon before them stays) */
function wordsOf( button ) {
	const own = button.querySelector( '[data-gcb-kit-copy-words]' );
	if ( own ) {
		return { get: () => own.textContent, set: ( w ) => ( own.textContent = w ) };
	}
	const walk = document.createTreeWalker( button, NodeFilter.SHOW_TEXT, { acceptNode: ( n ) => ( n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP ) } );
	let last = null;
	while ( walk.nextNode() ) {
		last = walk.currentNode;
	}
	if ( ! last ) {
		return null; // an icon alone: its state and the live region say it
	}
	const node = last;
	const pad = node.nodeValue.match( /^(\s*)[\s\S]*?(\s*)$/ );
	return { get: () => node.nodeValue.trim(), set: ( w ) => ( node.nodeValue = pad[ 1 ] + w + pad[ 2 ] ) };
}

/* one quiet live region for the page, when there is no toast to say it */
let status = null;
function say( words ) {
	if ( ! status ) {
		status = document.createElement( 'span' );
		status.setAttribute( 'data-gcb-kit-copy-status', '' );
		status.setAttribute( 'role', 'status' );
		status.setAttribute( 'aria-live', 'polite' );
		document.body.append( status );
	}
	status.textContent = '';
	setTimeout( () => ( status.textContent = words ), 50 );
}

function live( button ) {
	if ( button.gcbKitCopy || button.closest( '.editor-styles-wrapper' ) ) {
		return;
	}
	if ( button.tagName === 'BUTTON' && ! button.hasAttribute( 'type' ) ) {
		button.type = 'button'; // never sends a form it sits in
	}
	if ( ! button.matches( 'button, a[href], input, [tabindex]' ) ) {
		button.tabIndex = 0;
		button.setAttribute( 'role', 'button' );
	}
	const service = new VanillaMachine( clipboard.machine, { id: 'gcb-copy-' + next(), timeout: TIME } );
	const api = () => clipboard.connect( service.service, normalizeProps ) // its state only: no props are spread, so the button keeps its own name and type;
	let words = null;
	let was = '';
	let held = false;
	const render = () => {
		const copied = api().copied;
		if ( copied && ! held ) {
			held = true;
			button.style.minWidth = button.getBoundingClientRect().width + 'px'; // measured before its copied look
			words = wordsOf( button );
			if ( words ) {
				was = words.get();
				words.set( button.getAttribute( 'data-copied' ) || 'Copied' );
			}
		} else if ( ! copied && held ) {
			held = false;
			if ( words ) {
				words.set( was );
			}
			button.style.minWidth = '';
		}
		button.setAttribute( 'data-state', copied ? 'copied' : 'idle' );
	};
	service.subscribe( render );
	service.start();
	render();

	const press = ( e ) => {
		if ( button.matches( ':disabled, [aria-disabled="true"]' ) ) {
			return;
		}
		if ( button.tagName === 'A' ) {
			e.preventDefault();
		}
		const v = valueOf( button );
		const a = api();
		a.setValue( v.text );
		a.copy();
		const title = button.getAttribute( 'data-copied' ) || ( v.link ? 'Link copied' : 'Copied' );
		/* the toast says it, if the page has one and the button did not ask it already */
		if ( document.documentElement.classList.contains( 'gcb-kit-toast-on' ) ) {
			if ( ! button.hasAttribute( 'data-gcb-toast' ) ) {
				button.dispatchEvent( new CustomEvent( 'gcbkit:toast', { bubbles: true, detail: { title, description: ! v.link && v.text.length <= 40 && title !== v.text ? v.text : '', type: 'success' } } ) );
			}
		} else {
			say( title );
		}
	};
	button.addEventListener( 'click', press );
	button.addEventListener( 'keydown', ( e ) => {
		if ( button.tagName !== 'BUTTON' && button.tagName !== 'A' && ( e.key === 'Enter' || e.key === ' ' ) ) {
			e.preventDefault();
			press( e );
		}
	} );
	button.gcbKitCopy = { copy: () => press( new Event( 'click' ) ), stop: () => service.stop() };
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
