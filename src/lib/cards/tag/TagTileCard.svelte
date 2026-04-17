<script lang="ts">
	import { xxHash32 } from 'js-xxhash';
	import type { Tag } from '$lib/common/types';
	import { openDrawer } from '$lib/common/funcs';
	import { getDrawerStore } from '@skeletonlabs/skeleton';
	import CardTileContainer from '../CardTileContainer.svelte';
	import CardTileEntry from '../CardTileEntry.svelte';

	type TagTileCardProps = {
		tag: Tag,
	}

	let { tag = $bindable() }: TagTileCardProps = $props()

	const onlineCount = $derived(tag.nodes.filter((n) => n.online).length);
	const drawerStore = getDrawerStore();
	const color = $derived(
		(xxHash32(tag.name, 0xbeefbabe) & 0xff_ff_ff)
			.toString(16)
			.padStart(6, '0')
	);
</script>

<CardTileContainer onclick={(_) => openDrawer(drawerStore, 'tagDrawer-' + tag.name, tag)}>
	<div class="flex justify-between items-center mb-4 mt-2">
		<div class="flex items-center">
			<span class="badge-icon variant-filled-secondary text-xs">{tag.nodes.length}</span>
			<span class="ml-2 text-lg font-semibold">{tag.name}</span>
		</div>
	</div>
	<CardTileEntry title="Nodes:">
		{tag.nodes.length}
	</CardTileEntry>
	<CardTileEntry title="Online:">
		{onlineCount} / {tag.nodes.length}
	</CardTileEntry>
	<hr style="background-color: #{color}" class="w-full h-0.5 mx-auto my-4 border-0 rounded" />
</CardTileContainer>
