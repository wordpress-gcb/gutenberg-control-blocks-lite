/**
 * THE KIT'S PASSWORD INPUT (2026-10-21, the forms family: "Password" on a sign-in, a sign-up's new password). The kit's
 * input with an eye inside its end that shows and hides what was typed:
 *
 *   <div data-gcb-kit="password-input">
 *     <label data-gcb-kit-label for="pw">Password</label>
 *     <input type="password" id="pw" name="password" autocomplete="current-password" required>
 *   </div>
 *
 * THE NATIVE INPUT STAYS THE TRUTH: the form sends it, its name, required, autocomplete and error (aria-invalid, the
 * server's or the form's check) are the page's; the script only puts it in a box with the eye. Without the script it is
 * the plain password input. Zag's password input (@zag-js/password-input, MIT) switches its type and says the state.
 *
 * THE EYE is a toggle button: one name ("Show password", or the part's data-show) and aria-pressed, never a name that
 * changes as well (two signals saying one thing); aria-controls the input. A press keeps the focus in the box (Zag's
 * pointerdown), the keyboard reaches it by Tab and presses it with Enter or Space. Sending the form hides it again, so a
 * browser saves it as a password. Its parts say their state: the box `data-state="visible|hidden"`.
 */
import * as password from '@zag-js/password-input';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import { kept } from '../_core/kept.js';

/* the part is live, said on <html> where no swap reaches */
document.documentElement.classList.add( 'gcb-kit-password-input-on' );

const ROOT = '[data-gcb-kit="password-input"]';
/* numbered once for the page, whichever bundle makes one */
const next = () => ( window.__gcbKitPasswords = ( window.__gcbKitPasswords || 0 ) + 1 );

/* Tabler's eye and eye-off, the kit's icon set */
const EYE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"/></svg>';
const EYE_OFF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.585 10.587a2 2 0 0 0 2.829 2.828"/><path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87"/><path d="M3 3l18 18"/></svg>';

/* what the page owns on the input: never written by Zag (a missing value would take the form's error off) */
const PAGE = [ 'name', 'required', 'aria-invalid', 'autocomplete', 'autoComplete' ];

function live( root ) {
	if ( root.gcbKitPassword ) {
		return;
	}
	const input = root.querySelector( 'input[data-gcb-kit-password-input], input[type="password"]' );
	if ( ! input ) {
		return;
	}
	let stopped = false;
	const id = 'gcb-password-' + next();
	input.id ||= id + '-input';
	input.setAttribute( 'data-gcb-kit-password-input', '' );
	/* the kit's input, unless the design drew its own */
	if ( ! input.hasAttribute( 'data-gcb-own' ) && ! input.getAttribute( 'class' ) && ! input.hasAttribute( 'data-gcb-kit-control' ) ) {
		input.setAttribute( 'data-gcb-kit-control', '' );
	}

	/* the box round the input and the eye: the one the design drew, else made */
	let control = input.closest( '[data-gcb-kit-password-control]' );
	if ( ! control || ! root.contains( control ) ) {
		control = document.createElement( 'div' );
		control.setAttribute( 'data-gcb-kit-password-control', '' );
		input.replaceWith( control );
		control.appendChild( input );
	}
	let eye = control.querySelector( '[data-gcb-kit-password-toggle]' );
	if ( ! eye ) {
		eye = document.createElement( 'button' );
		eye.setAttribute( 'data-gcb-kit-password-toggle', '' );
		control.appendChild( eye );
	}
	eye.type = 'button';
	eye.id ||= id + '-toggle';
	const name = root.getAttribute( 'data-show' ) || 'Show password';

	const service = new VanillaMachine( password.machine, {
		id,
		ids: { root: root.id || undefined, input: input.id, visibilityTrigger: eye.id },
		defaultVisible: false,
		disabled: input.disabled,
		readOnly: input.readOnly,
	} );
	const api = () => password.connect( service.service, normalizeProps );
	const render = () => {
		if ( stopped ) {
			return;
		}
		const a = api();
		const inputProps = a.getInputProps();
		PAGE.forEach( ( k ) => delete inputProps[ k ] );
		spreadProps( input, inputProps );
		spreadProps( root, a.getRootProps() );
		spreadProps( control, a.getControlProps() );
		const eyeProps = a.getVisibilityTriggerProps();
		delete eyeProps[ 'aria-expanded' ];
		/* the keyboard's press (Zag answers the pointer's alone): a click with no pointer behind it */
		eyeProps.onclick = ( e ) => {
			if ( e.detail === 0 && ! input.disabled ) {
				api().toggleVisible();
			}
		};
		spreadProps( eye, eyeProps );
		eye.removeAttribute( 'tabindex' );
		eye.setAttribute( 'aria-label', name );
		eye.setAttribute( 'aria-pressed', String( a.visible ) );
		const icon = a.visible ? 'off' : 'on';
		if ( eye.dataset.icon !== icon ) {
			eye.dataset.icon = icon;
			eye.innerHTML = a.visible ? EYE_OFF : EYE;
		}
	};
	service.subscribe( render );
	service.start();
	render();

	/* sent hidden, so a browser keeps it as a password */
	const hide = () => ! stopped && api().visible && api().setVisible( false );
	input.form?.addEventListener( 'submit', hide, true );
	input.form?.addEventListener( 'reset', hide );

	root.gcbKitPassword = { service, input, show: ( v = true ) => api().setVisible( v ) };
	/* a router swap that puts back the server's markup: started again over it */
	kept(
		root,
		() => root.contains( control ) && control.contains( input ) && control.contains( eye ),
		() => {
			stopped = true;
			service.stop();
			delete root.gcbKitPassword;
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
/* one drawn later (a dialog's content) comes alive when it lands */
new MutationObserver( ( muts ) => {
	for ( const m of muts ) {
		for ( const n of m.addedNodes ) {
			if ( n.nodeType === 1 ) {
				( n.matches?.( ROOT ) ? [ n ] : [ ...( n.querySelectorAll?.( ROOT ) ?? [] ) ] ).forEach( live );
			}
		}
	}
} ).observe( document.documentElement, { childList: true, subtree: true } );
