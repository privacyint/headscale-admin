<script lang="ts">
	import CardListEntry from '../CardListEntry.svelte';
	import type { PreAuthKey } from '$lib/common/types';
	import { onMount } from 'svelte';

	type PreAuthKeyDetailsProps = {
		preAuthKey: PreAuthKey,
	}
	let { preAuthKey }: PreAuthKeyDetailsProps = $props()

	let pakIsExpired = $state(isExpired(preAuthKey))

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

<CardListEntry title="Key">
	<span class="font-mono text-sm">{preAuthKey.key.substring(0, 10)}…</span>
</CardListEntry>
<CardListEntry title="User">
	<span>{preAuthKey.user?.name || 'N/A'}</span>
</CardListEntry>
<CardListEntry title="Expiration">
	<span class="{pakIsExpired ? 'text-red-500' : ''}">{new Date(preAuthKey.expiration).toLocaleString()}</span>
</CardListEntry>
<CardListEntry title="Used">
	<span class="badge {preAuthKey.used ? 'variant-filled-success' : 'variant-filled-surface'}">
		{preAuthKey.used ? 'Yes' : 'No'}
	</span>
</CardListEntry>
<CardListEntry title="Ephemeral">
	<span class="badge {preAuthKey.ephemeral ? 'variant-filled-secondary' : 'variant-filled-surface'}">
		{preAuthKey.ephemeral ? 'Yes' : 'No'}
	</span>
</CardListEntry>
<CardListEntry title="Reusable">
	<span class="badge {preAuthKey.reusable ? 'variant-filled-tertiary' : 'variant-filled-surface'}">
		{preAuthKey.reusable ? 'Yes' : 'No'}
	</span>
</CardListEntry>
{#if preAuthKey.aclTags.length > 0}
<CardListEntry title="ACL Tags">
	<span>{preAuthKey.aclTags.join(', ')}</span>
</CardListEntry>
{/if}
