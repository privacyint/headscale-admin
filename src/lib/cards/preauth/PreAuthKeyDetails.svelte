<script lang="ts">
	import CardListEntry from '../CardListEntry.svelte';
	import CardSeparator from '../CardSeparator.svelte';
	import type { PreAuthKey } from '$lib/common/types';
	import { onMount } from 'svelte';

	type PreAuthKeyDetailsProps = {
		preAuthKey: PreAuthKey,
	}
	let { preAuthKey }: PreAuthKeyDetailsProps = $props()

	let pakIsExpired = $state(isExpired(preAuthKey))
	const ownershipLabel = $derived(preAuthKey.user ? 'User:' : 'Tags:')
	const ownershipValue = $derived(preAuthKey.user ? preAuthKey.user.name : preAuthKey.aclTags.join(', '))

	function isExpired(preAuthKey: PreAuthKey): boolean {
		return new Date() > new Date(preAuthKey.expiration);
	}

	onMount(()=>{
		const interval = setInterval(() => {
			pakIsExpired = isExpired(preAuthKey)
		}, 1000)

		return () => {
			clearInterval(interval)
		}
	})
</script>

<div class="grid grid-cols-1">
	<CardListEntry title="Key:" top={true} valueClasses="text-right">
		<div class="grid grid-cols-1">
			<span class="block w-full font-mono text-sm whitespace-normal text-right [overflow-wrap:anywhere]">{preAuthKey.key}</span>
		</div>
	</CardListEntry>
	<CardSeparator />
	<CardListEntry title={ownershipLabel}>
		<span>{ownershipValue}</span>
	</CardListEntry>
	<CardSeparator />
	<CardListEntry title="Expiration:">
		<span class="{pakIsExpired ? 'text-red-500' : ''}">{new Date(preAuthKey.expiration).toLocaleString()}</span>
	</CardListEntry>
	<CardSeparator />
	<CardListEntry title="Used:">
		<span class="badge justify-self-end {preAuthKey.used ? 'variant-filled-success' : 'variant-filled-surface'}">
			{preAuthKey.used ? 'Yes' : 'No'}
		</span>
	</CardListEntry>
	<CardSeparator />
	<CardListEntry title="Ephemeral:">
		<span class="badge justify-self-end {preAuthKey.ephemeral ? 'variant-filled-secondary' : 'variant-filled-surface'}">
			{preAuthKey.ephemeral ? 'Yes' : 'No'}
		</span>
	</CardListEntry>
	<CardSeparator />
	<CardListEntry title="Reusable:">
		<span class="badge justify-self-end {preAuthKey.reusable ? 'variant-filled-tertiary' : 'variant-filled-surface'}">
			{preAuthKey.reusable ? 'Yes' : 'No'}
		</span>
	</CardListEntry>
</div>
