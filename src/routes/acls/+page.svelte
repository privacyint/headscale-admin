<script lang="ts">
	import { TabGroup, getToastStore } from '@skeletonlabs/skeleton';
	import { onMount } from 'svelte';
	import JWCC from 'json5'
	import RawMdiCodeJSON from '~icons/mdi/code-json';
	import RawMdiConsole from '~icons/mdi/console';
	import RawMdiDevices from '~icons/mdi/devices';
	import RawMdiTune from '~icons/mdi/tune';
	import RawMdiGroups from '~icons/mdi/account-group';
	import RawMdiKeyChain from '~icons/mdi/key-chain-variant';
	import RawMdiVectorPolyline from '~icons/mdi/vector-polyline';
	import RawMdiSecurity from '~icons/mdi/security';
	import RawMdiTag from '~icons/mdi/tag';

	import type { ACL } from '$lib/common/acl.svelte';
	import { PolicyBuilder } from '$lib/common/policy-builder';
	import { debug } from '$lib/common/debug';
	import { loadPolicyDocumentText } from '$lib/common/policy-persistence';
	import { toastError } from '$lib/common/funcs';
	import Page from '$lib/page/Page.svelte';
	import PageHeader from '$lib/page/PageHeader.svelte';
	import Tabbed from '$lib/parts/Tabbed.svelte';

	import Config from './Config.svelte';
	import Groups from './Groups.svelte';
	import Hosts from './Hosts.svelte';
	import NodeAttrs from './NodeAttrs.svelte';
	import PolicySettings from './PolicySettings.svelte';
	import Policies from './Policies.svelte';
	import Grants from './Grants.svelte';
	import TagOwners from './TagOwners.svelte'
	import SshRules from './SshRules.svelte';

	const ToastStore = getToastStore()

	let acl = $state(PolicyBuilder.defaultACL());
	let loading = $state(false)

	// Navigation tabs
	let tabSet: number = $state(0);
	const tabs = [
		{ name: 'groups', title: 'Groups', logo: RawMdiGroups },
		{ name: 'tag-owners', title: 'Tag Owners', logo: RawMdiTag },
		{ name: 'hosts', title: 'Hosts', logo: RawMdiDevices },
		{ name: 'policies', title: 'Policies', logo: RawMdiSecurity },
		{ name: 'grants', title: 'Grants', logo: RawMdiKeyChain },
		{ name: 'node-attrs', title: 'Node Attributes', logo: RawMdiVectorPolyline },
		{ name: 'policy-settings', title: 'Policy Settings', logo: RawMdiTune },
		{ name: 'ssh', title: 'SSH', logo: RawMdiConsole },
		{ name: 'config', title: 'Config', logo: RawMdiCodeJSON },
	];

	onMount(() => {
		loadPolicyDocumentText().then(policy => {
			acl = PolicyBuilder.fromPolicy(JWCC.parse<ACL>(policy))
		}).catch(reason => {
			debug("failed to get policy:", reason)
			toastError(`Unable to get policy from server.`, ToastStore, reason)
		})
	});
</script>

<Page>
	<PageHeader title="Policy Builder" />
	{#if acl.hasUnsupportedPolicyFields()}
		<div class="mb-4 rounded-md border border-warning-500/50 bg-warning-50 p-3 text-sm text-warning-900 dark:bg-warning-900/20 dark:text-warning-100">
			<div class="font-semibold">Compatibility warning</div>
			<div>
				This policy includes fields outside the current editor model. Saving keeps those fields, but ACL tabs may not expose all advanced settings.
			</div>
		</div>
	{/if}
	<TabGroup
		justify="justify-left"
		active="variant-filled-secondary"
		hover="hover:variant-soft-secondary"
		flex="flex-1 lg:flex-none"
		rounded="rounded-md"
		border=""
		class="bg-surface-100-800-token w-full px-2 py-2"
	>
		<div class="flex text-center">
			<Tabbed {tabs} bind:tabSet />
		</div>
		<svelte:fragment slot="panel">
			{#if tabs[tabSet].name == 'groups'}
				<Groups bind:loading bind:acl />
			{:else if tabs[tabSet].name == 'tag-owners'}
				<TagOwners bind:loading bind:acl />
			{:else if tabs[tabSet].name == 'hosts'}
				<Hosts bind:loading bind:acl />
			{:else if tabs[tabSet].name == 'policies'}
				<Policies bind:loading bind:acl />
			{:else if tabs[tabSet].name == 'grants'}
				<Grants bind:loading bind:acl />
			{:else if tabs[tabSet].name == 'node-attrs'}
				<NodeAttrs bind:loading bind:acl />
			{:else if tabs[tabSet].name == 'policy-settings'}
				<PolicySettings bind:loading bind:acl />
			{:else if tabs[tabSet].name == 'ssh'}
				<SshRules bind:loading bind:acl />
			{:else if tabs[tabSet].name == 'config'}
				<Config bind:loading bind:acl />
			{/if}
		</svelte:fragment>
	</TabGroup>
</Page>
