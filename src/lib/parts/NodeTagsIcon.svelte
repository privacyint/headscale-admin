<script lang="ts">
	import RawMdiTag from '~icons/mdi/tag';
	import TagBadge from './TagBadge.svelte';
	import { popup, type PopupSettings } from '@skeletonlabs/skeleton';

	type NodeTagsIconProps = {
		tags: string[];
		/** Unique ID for the popup — must differ per instance on the page. */
		id: string;
	};
	let { tags, id }: NodeTagsIconProps = $props();
	let popupOpen = $state(false);

	const popupHover = $derived<PopupSettings>({
		event: 'hover',
		target: `tags-popup-${id}`,
		placement: 'bottom',
		state: ({ state }) => {
			popupOpen = state;
		},
	};
</script>

{#if tags.length > 0}
	<span
		class="inline-flex items-center"
		use:popup={popupHover}
		data-testid="node-tags-icon"
		data-popup-open={popupOpen}
	>
		<RawMdiTag class="text-warning-500 dark:text-warning-400 cursor-help" />
	</span>
	<div class="card p-3 variant-filled-surface shadow-xl z-50" data-popup="tags-popup-{id}">
		<div class="flex flex-wrap gap-1.5 max-w-xs">
			{#each tags as tag}
				<TagBadge {tag} />
			{/each}
		</div>
		<div class="arrow variant-filled-surface"></div>
	</div>
{/if}
