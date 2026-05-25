/**
 * Registry of control type → React component.
 *
 * Each component receives `{ control, value, onChange, attributes }` and is
 * responsible for its own UI. Some are thin wrappers around @wordpress/components;
 * the richer ones (image, gallery, post-object, taxonomy, user, icon, google-map)
 * carry full UI logic ported from the original plugin.
 */

import TextField          from './text';
import TextareaField      from './textarea';
import NumberField        from './number';
import EmailField         from './email';
import UrlField           from './url';
import CodeField          from './code';
import SelectField        from './select';
import RadioField         from './radio';
import CheckboxField      from './checkbox';
import CheckboxGroupField from './checkbox-group';
import ToggleField        from './toggle';
import ToggleGroupField   from './toggle-group';
import ButtonGroupField   from './button-group';
import RangeField         from './range';
import ColorField         from './color';
import DateField          from './date';
import DatetimeField      from './datetime';
import SizeField          from './size';
import SpacingField       from './spacing';
import MessageField       from './message';
import OembedField        from './oembed';
import WysiwygField       from './wysiwyg';
import ImageField         from './image';
import GalleryField       from './gallery';
import FileField          from './file';
import IconField          from './icon';
import GoogleMapField     from './google-map';
import PostObjectField    from './post-object';
import TaxonomyField      from './taxonomy';
import UserField          from './user';
import PageLinkField      from './page-link';
import RelationshipField  from './relationship';
import HeadingLevelField  from './heading-level';

export const controlComponents = {
	// Text family
	text: TextField,
	textarea: TextareaField,
	number: NumberField,
	email: EmailField,
	url: UrlField,
	code: CodeField,

	// Choice family
	select: SelectField,
	radio: RadioField,
	checkbox: CheckboxField,
	'checkbox-group': CheckboxGroupField,
	toggle: ToggleField,
	'toggle-group': ToggleGroupField,
	'button-group': ButtonGroupField,

	// Numeric / visual
	range: RangeField,
	color: ColorField,
	date: DateField,
	datetime: DatetimeField,
	size: SizeField,
	spacing: SpacingField,
	'heading-level': HeadingLevelField,

	// Display-only
	message: MessageField,
	wysiwyg: WysiwygField,
	oembed: OembedField,

	// Media
	image: ImageField,
	gallery: GalleryField,
	file: FileField,
	icon: IconField,

	// Reference
	'post-object': PostObjectField,
	taxonomy: TaxonomyField,
	user: UserField,
	'page-link': PageLinkField,
	relationship: RelationshipField,

	// Other
	'google-map': GoogleMapField,
};
