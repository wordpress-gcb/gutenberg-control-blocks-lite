/**
 * Container that hosts a control's "rich settings" UI in the right surface
 * for the current ControlContext:
 *   - sidebar  → <Dropdown> (popover anchored to the toggle)
 *   - metabox  → <Modal> (centered overlay with backdrop)
 *
 * Why: popovers feel right in a narrow sidebar where they extend outward,
 * but in a wide meta-box they're awkward (they can run off-screen, they
 * obscure adjacent fields, and they don't have the visual weight to read
 * as "editing this field"). Modals match meta-box context.
 *
 * Usage:
 *   <PopoverOrModal
 *     renderToggle={({ onToggle, isOpen }) => <Button onClick={onToggle}>Open</Button>}
 *     renderContent={({ close, variant }) => (
 *       <div style={variant === 'modal' ? { width: '100%' } : { minWidth: 320, maxWidth: 400 }}>
 *         <MySettings onDone={close} />
 *       </div>
 *     )}
 *     modalTitle="Image settings"
 *   />
 *
 * renderContent receives `{ close, variant }`:
 *   - close():        dismiss the popover or modal
 *   - variant:        'popover' | 'modal' — lets callers branch widths,
 *                     padding, etc. ('modal' contents typically want to
 *                     fill the modal width; 'popover' contents want a
 *                     comfortable popover-sized box.)
 *
 * The dropdown render passes the same { onToggle, isOpen } shape as
 * @wordpress/components Dropdown.renderToggle so the call-site doesn't
 * have to know which it's getting.
 */

import { useContext, useState } from '@wordpress/element';
import { Dropdown, Modal } from '@wordpress/components';
import { ControlContext } from '../control-context';

export default function PopoverOrModal({
	renderToggle,
	renderContent,
	modalTitle,
	modalSize = 'medium',
	dropdownProps = {},
}) {
	const ctx = useContext(ControlContext);

	if (ctx.variant === 'metabox') {
		return (
			<ModalAffordance
				renderToggle={renderToggle}
				renderContent={renderContent}
				modalTitle={modalTitle}
				modalSize={modalSize}
			/>
		);
	}

	return (
		<Dropdown
			{...dropdownProps}
			renderToggle={renderToggle}
			renderContent={({ onClose }) => renderContent({ close: onClose, variant: 'popover' })}
		/>
	);
}

function ModalAffordance({ renderToggle, renderContent, modalTitle, modalSize }) {
	const [open, setOpen] = useState(false);
	const onToggle = () => setOpen((v) => !v);
	const close = () => setOpen(false);

	return (
		<>
			{renderToggle({ onToggle, isOpen: open })}
			{open && (
				<Modal title={modalTitle} onRequestClose={close} size={modalSize}>
					{renderContent({ close, variant: 'modal' })}
				</Modal>
			)}
		</>
	);
}
