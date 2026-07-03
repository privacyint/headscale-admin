<script lang="ts">
	import { xxHash32 } from 'js-xxhash';

	type TagBadgeProps = {
		tag: string;
	};
	let { tag }: TagBadgeProps = $props();

	const label = $derived(tag.startsWith('tag:') ? tag : 'tag:' + tag);

	/**
	 * Deterministic HSL colour derived from the tag name via xxHash32.
	 * Saturation and lightness are clamped to keep badges legible on both
	 * light and dark backgrounds.
	 */
	const hue = $derived(xxHash32(label, 0xbeefbabe) % 360);
</script>

<span
	class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold leading-tight text-white"
	style="background-color: hsl({hue}, 55%, 45%)"
	data-testid="tag-badge"
>
	{label}
</span>
