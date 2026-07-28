/**
 * Icon list — native edit. A real ul/ol of InnerBlocks with core-list
 * ergonomics, NOT the generic PHP-preview + repeater pipeline: a list is
 * typed, not form-filled. Rows are added by pressing Enter inside a row
 * (see icon-list-item/edit.js), so no appender is rendered.
 */

import {
	useBlockProps,
	useInnerBlocksProps,
	BlockControls,
} from '@wordpress/block-editor';
import { ToolbarButton } from '@wordpress/components';
import {
	formatListBullets,
	formatListBulletsRTL,
	formatListNumbered,
	formatListNumberedRTL,
} from '@wordpress/icons';
import { __, isRTL } from '@wordpress/i18n';

const TEMPLATE = [ [ 'gcb/icon-list-item' ] ];

export default function IconListEdit( { attributes, setAttributes } ) {
	const { ordered, gap } = attributes;
	const g = typeof gap === 'number' ? Math.max( 0, Math.min( 2, gap ) ) : 0.5;

	const blockProps = useBlockProps( {
		className: 'gcb-icon-list',
		style: { '--gcb-icon-list-gap': `${ g }em` },
	} );
	const innerBlocksProps = useInnerBlocksProps( blockProps, {
		allowedBlocks: [ 'gcb/icon-list-item' ],
		defaultBlock: { name: 'gcb/icon-list-item' },
		directInsert: true,
		template: TEMPLATE,
		templateInsertUpdatesSelection: true,
		renderAppender: false,
	} );

	const TagName = ordered ? 'ol' : 'ul';

	return (
		<>
			<BlockControls group="block">
				<ToolbarButton
					icon={ isRTL() ? formatListBulletsRTL : formatListBullets }
					title={ __( 'Unordered', 'gcblite' ) }
					isActive={ ! ordered }
					onClick={ () => setAttributes( { ordered: false } ) }
				/>
				<ToolbarButton
					icon={
						isRTL() ? formatListNumberedRTL : formatListNumbered
					}
					title={ __( 'Ordered', 'gcblite' ) }
					isActive={ !! ordered }
					onClick={ () => setAttributes( { ordered: true } ) }
				/>
			</BlockControls>
			<TagName { ...innerBlocksProps } />
		</>
	);
}
