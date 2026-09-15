/**
 * Icon list item — native edit. The row's text is a canvas RichText with
 * the core-list Enter grammar, all through public APIs:
 *
 *   Enter mid-text        → onSplit: this row keeps the first half, a new
 *                           row (inheriting this row's ICON) takes the rest
 *   Enter on an empty row → leave the list: the row is removed and a
 *                           paragraph lands after the list (the list itself
 *                           dissolves if that was the only row)
 *   Backspace at start    → onMerge into the previous row
 *
 * The icon itself stays a field (the SDK picker in the inspector, via the
 * standard controls HOC); the toolbar button jumps you to it.
 */

import { useBlockProps, RichText, BlockControls } from '@wordpress/block-editor';
import { createBlock } from '@wordpress/blocks';
import { ToolbarButton } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { useIcon, IconSvg } from '../../utils/icon-library';
import { focusInspectorField } from '../../utils/focusField';

export default function IconListItemEdit( {
	attributes,
	setAttributes,
	clientId,
	name,
} ) {
	const { text, icon } = attributes;
	const iconDef = useIcon( icon?.name || '' );

	const { replaceBlocks, removeBlock, insertBlocks, mergeBlocks } =
		useDispatch( 'core/block-editor' );
	const ctx = useSelect(
		( select ) => {
			const be = select( 'core/block-editor' );
			const listId = be.getBlockRootClientId( clientId );
			return {
				listId,
				parentOfList: listId ? be.getBlockRootClientId( listId ) : null,
				listIndex: listId ? be.getBlockIndex( listId ) : 0,
				itemCount: listId ? be.getBlockOrder( listId ).length : 0,
				prevItemId: be.getPreviousBlockClientId( clientId ),
				nextItemId: be.getNextBlockClientId( clientId ),
			};
		},
		[ clientId ]
	);

	// Enter on an empty row = leave the list and carry on in a paragraph.
	const exitList = () => {
		const para = createBlock( 'core/paragraph' );
		if ( ! ctx.listId ) {
			return;
		}
		if ( ctx.itemCount <= 1 ) {
			replaceBlocks( ctx.listId, [ para ] );
		} else {
			removeBlock( clientId );
			insertBlocks(
				para,
				ctx.listIndex + 1,
				ctx.parentOfList || undefined
			);
		}
	};

	// Capture-phase on the <li>: RichText's own Enter handling is a native
	// listener on the editable, which beats a React onKeyDown prop — but
	// not a capture handler on an ancestor. Only the empty-row case is
	// intercepted; everything else falls through to RichText/onSplit.
	const onKeyDownCapture = ( event ) => {
		if (
			event.key !== 'Enter' ||
			event.shiftKey ||
			event.isDefaultPrevented()
		) {
			return;
		}
		const isEmpty = ! text || text === '' || text === '<br>';
		if ( ! isEmpty ) {
			return; // RichText's onSplit owns the non-empty case.
		}
		event.preventDefault();
		event.stopPropagation();
		exitList();
	};

	const blockProps = useBlockProps( { className: 'gcb-icon-list-item' } );

	return (
		<li { ...blockProps } onKeyDownCapture={ onKeyDownCapture }>
			<BlockControls group="block">
				<ToolbarButton
					icon={
						iconDef ? (
							<IconSvg content={ iconDef.content } />
						) : undefined
					}
					label={ __( 'Change icon', 'gcblite' ) }
					onClick={ () =>
						focusInspectorField( 'icon', {
							clientId,
							blockName: name,
						} )
					}
				>
					{ iconDef ? null : __( 'Icon', 'gcblite' ) }
				</ToolbarButton>
			</BlockControls>
			<span className="gcb-icon-list-item__icon">
				{ iconDef ? (
					<IconSvg content={ iconDef.content } />
				) : (
					<span aria-hidden>•</span>
				) }
			</span>
			<RichText
				identifier="text"
				tagName="span"
				className="gcb-icon-list-item__text"
				value={ text }
				onChange={ ( v ) => setAttributes( { text: v } ) }
				placeholder={ __( 'List item…', 'gcblite' ) }
				aria-label={ __( 'List item text', 'gcblite' ) }
				onSplit={ ( value, isOriginal ) => {
					// New rows inherit this row's icon — set the tick once,
					// type five rows.
					const block = createBlock( name, {
						...attributes,
						text: value,
					} );
					if ( isOriginal ) {
						block.clientId = clientId;
					}
					return block;
				} }
				onReplace={ ( blocks, indexToSelect, initialPosition ) =>
					replaceBlocks(
						clientId,
						blocks,
						indexToSelect,
						initialPosition
					)
				}
				onMerge={ ( forward ) => {
					if ( forward ) {
						if ( ctx.nextItemId ) {
							mergeBlocks( clientId, ctx.nextItemId );
						}
					} else if ( ctx.prevItemId ) {
						mergeBlocks( ctx.prevItemId, clientId );
					}
				} }
				onRemove={ () => removeBlock( clientId ) }
			/>
		</li>
	);
}
