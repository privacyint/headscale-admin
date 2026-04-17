<script lang="ts">
	import type { Tag } from '$lib/common/types';
	import CardListContainer from '../CardListContainer.svelte';
	import CardSeparator from '../CardSeparator.svelte';
	import TagListNodes from './TagListNodes.svelte';

	type TagInfoProps = {
		tag: Tag,
	}

	let { tag }: TagInfoProps = $props()

	const onlineCount = $derived(tag.nodes.filter((n) => n.online).length);
</script>

<CardListContainer>
	<div class="grid py-0 grid-cols-12">
		<div class="grid grid-cols-12 col-span-12 justify-between items-center">
			<div class="grid col-span-5 text-left">Tag:</div>
			<div class="grid col-span-7 text-right font-bold">{tag.name}</div>
		</div>
	</div>
	<CardSeparator />
	<div class="grid py-0 grid-cols-12">
		<div class="grid grid-cols-12 col-span-12 justify-between items-center">
			<div class="grid col-span-5 text-left">Node Count:</div>
			<div class="grid col-span-7 text-right">{tag.nodes.length}</div>
		</div>
	</div>
	<CardSeparator />
	<div class="grid py-0 grid-cols-12">
		<div class="grid grid-cols-12 col-span-12 justify-between items-center">
			<div class="grid col-span-5 text-left">Online:</div>
			<div class="grid col-span-7 text-right">{onlineCount} / {tag.nodes.length}</div>
		</div>
	</div>
	<CardSeparator />
	<TagListNodes {tag} />
</CardListContainer>
