/**
 * RelationshipField — placeholder. The original GCB referenced this control
 * type but never shipped a real implementation. Falls back to PostObject in
 * multi-select mode, which handles the same use case.
 */
import PostObjectField from './post-object';

export default function RelationshipField(props) {
	const merged = {
		...props,
		control: { ...props.control, multiple: true },
	};
	return <PostObjectField {...merged} />;
}
