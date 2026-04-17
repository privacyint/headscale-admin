<script lang="ts">
	import type { PreAuthKey } from '$lib/common/types';

	import CardListEntry from '../CardListEntry.svelte';
	import PreAuthKeyInfo from './PreAuthKeyInfo.svelte';

	type PreAuthKeyListCardProps = {
		preAuthKey: PreAuthKey,
		open?: boolean,
	}

	let { preAuthKey = $bindable(), open = $bindable(true) }: PreAuthKeyListCardProps = $props()

</script>

<div class="backdrop-blur-xl backdrop-brightness-100 bg-white/25 dark:bg-white/5 rounded-md p-4">
	<div class="grid">
		<CardListEntry title="ID: {preAuthKey.id}">
			<span class="font-bold">User: {preAuthKey.user?.name || 'N/A'}</span>
		</CardListEntry>
	</div>
	<PreAuthKeyInfo {preAuthKey} />
</div>
