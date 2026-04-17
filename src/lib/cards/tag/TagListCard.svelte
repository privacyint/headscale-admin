<script lang="ts">
	import { AccordionItem } from '@skeletonlabs/skeleton';

	import type { Tag } from '$lib/common/types';

	import CardListEntry from '../CardListEntry.svelte';
	import TagInfo from './TagInfo.svelte';

	type TagListCardProps = {
		tag: Tag,
		open?: boolean,
	}

	let { tag = $bindable(), open = $bindable(false) }: TagListCardProps = $props()

	const onlineCount = $derived(tag.nodes.filter((n) => n.online).length);
	const tagColor = $derived(
		onlineCount > 0
			? 'text-success-600 dark:text-success-400'
			: 'text-error-500 dark:text-error-400'
	);
</script>

<AccordionItem
	{open}
	id={tag.name}
	class="backdrop-blur-xl backdrop-brightness-100 bg-white/25 dark:bg-white/5 rounded-md"
	padding="py-4 px-4"
	regionControl="!rounded-none"
>
	<svelte:fragment slot="lead">
		<span class="badge-icon variant-filled-secondary text-xs">{tag.nodes.length}</span>
	</svelte:fragment>
	<svelte:fragment slot="summary">
		<div class="grid">
			<CardListEntry title="{onlineCount}/{tag.nodes.length} online">
				<span class="font-bold">{tag.name}</span>
			</CardListEntry>
		</div>
	</svelte:fragment>
	<svelte:fragment slot="content">
		<TagInfo {tag} />
	</svelte:fragment>
</AccordionItem>
