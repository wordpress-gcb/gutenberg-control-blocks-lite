/**
 * A PART THAT DRAWS ITS OWN MARKUP, KEPT THROUGH A SWAP (2026-10-20). The kit's filter is answered on the server: a
 * choice is a new address, and WordPress's router patches the filter to the server's markup — keeping its elements,
 * putting back their attributes and children as the server drew them. A part that builds markup of its own in the
 * browser (the slider's track and handles, the calendar, the select's list) loses it there, and its `is-live` class
 * with it. This watches a part: its class is put back, and when what it built is gone it is started again over the
 * markup the server drew — the markup it starts from on a page's first load.
 *
 * @param {Element}    root   the part
 * @param {() => boolean} intact what it built is still there
 * @param {() => void} again  start it again (its old machine stopped)
 */
export function kept( root, intact, again ) {
	let due = 0;
	const watch = new MutationObserver( () => {
		if ( ! root.classList.contains( 'is-live' ) ) {
			root.classList.add( 'is-live' );
		}
		cancelAnimationFrame( due );
		due = requestAnimationFrame( () => {
			if ( root.isConnected && ! intact() ) {
				watch.disconnect();
				again();
			}
		} );
	} );
	watch.observe( root, { childList: true, subtree: true, attributes: true, attributeFilter: [ 'class' ] } );
	return watch;
}
