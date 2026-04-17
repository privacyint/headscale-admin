<script lang="ts">
	import { AccordionItem } from '@skeletonlabs/skeleton';

	import type { PreAuthKey } from '$lib/common/types';

	import CardListEntry from '../CardListEntry.svelte';
	import PreAuthKeyInfo from './PreAuthKeyInfo.svelte';

	type PreAuthKeyListCardProps = {
		preAuthKey: PreAuthKey,
		open?: boolean,
	}

	let { preAuthKey = $bindable(), open = $bindable(false) }: PreAuthKeyListCardProps = $props()

</script>

<AccordionItem
	{open}
	id={preAuthKey.id}
	class="backdrop-blur-xl backdrop-brightness-100 bg-white/25 dark:bg-white/5 rounded-md"
	padding="py-4 px-4"
	regionControl="!rounded-none"
>
	<svelte:fragment slot="summary">
		<div class="grid">
			<CardListEntry title="ID: {preAuthKey.id}">
				<span class="font-bold">User: {preAuthKey.user?.name || 'N/A'}</span>
			</CardListEntry>
		</div>
	</svelte:fragment>
	<svelte:fragment slot="content">
		<PreAuthKeyInfo {preAuthKey} />
	</svelte:fragment>
</AccordionItem>
