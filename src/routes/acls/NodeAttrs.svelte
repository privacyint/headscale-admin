<script lang="ts">
	import { getToastStore } from '@skeletonlabs/skeleton';
	import MultiSelect from '$lib/parts/MultiSelect.svelte';
	import Delete from '$lib/parts/Delete.svelte';
	import type { PolicyBuilder } from '$lib/common/policy-builder';
	import type { PolicyNodeAttr } from '$lib/common/policy-types';
	import { App } from '$lib/States.svelte';
	import { deduplicate, toastSuccess } from '$lib/common/funcs';

	const ToastStore = getToastStore();

	let { acl = $bindable(), loading = $bindable(false) }: { acl: PolicyBuilder; loading?: boolean } = $props();

	const userNames = $derived(App.users.value.map((u) => (u.email ? u.email : u.name)).toSorted());
	const targetOptions = $derived(
		deduplicate([
			...userNames,
			...acl.getGroupNames(true),
			...acl.getTagNames(true),
			...acl.getHostNames(),
		]),
	);

	const nodeAttrs = $derived(acl.nodeAttrs ?? []);

	function currentNodeAttrs(): PolicyNodeAttr[] {
		return acl.nodeAttrs ?? [];
	}

	function updateNodeAttrs(next: PolicyNodeAttr[]) {
		acl.nodeAttrs = next;
	}

	function addNodeAttr() {
		const next = [...currentNodeAttrs(), { target: ['*'], attr: [] } satisfies PolicyNodeAttr];
		updateNodeAttrs(next);
		toastSuccess(`Added node attribute rule #${next.length}`, ToastStore);
	}

	function deleteNodeAttr(idx: number) {
		const next = [...currentNodeAttrs()];
		next.splice(idx, 1);
		updateNodeAttrs(next);
	}

	function removeItem(items: string[], item: string) {
		const idx = items.findIndex((v) => v === item);
		if (idx >= 0) {
			items.splice(idx, 1);
		}
	}

	function addPreset(idx: number, preset: 'drive:share' | 'drive:access') {
		const nodeAttr = currentNodeAttrs()[idx];
		if (nodeAttr === undefined) {
			return;
		}
		if (!nodeAttr.attr.includes(preset)) {
			nodeAttr.attr.push(preset);
			updateNodeAttrs([...currentNodeAttrs()]);
		}
	}
</script>

<div class="flex items-center mr-2 ml-0 pt-2">
	<div class="w-full md:w-8/12 lg:w-9/12 xl:w-8/12 2xl:w-6/12 space-y-3">
	<div class="mb-4 flex flex-row space-x-2">
		<button class="btn-sm rounded-md variant-filled-success" onclick={addNodeAttr} data-testid="nodeattr-add-btn">Create Node Attribute Rule</button>
	</div>

	{#if nodeAttrs.length === 0}
		<div class="rounded-md border border-surface-300-700-token bg-surface-100-800-token p-4 text-sm" data-testid="nodeattr-empty-state">
			No node attributes configured yet. Add one to target selectors and attach capabilities.
		</div>
	{/if}

	{#each nodeAttrs as nodeAttr, idx}
		<div class="grid grid-cols-1 bg-white dark:bg-slate-800 rounded-md p-5">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="font-mono text-sm">Node Attribute #{idx + 1}</h3>
				<Delete func={() => deleteNodeAttr(idx)} disabled={loading} />
			</div>

			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid={`nodeattr-card-${idx}`}>
				<div>
					<label class="label" for={`nodeattr-target-${idx}-select-item`}>target</label>
					<MultiSelect
						id={`nodeattr-target-${idx}`}
						items={nodeAttr.target}
						options={targetOptions}
						placeholder="Select users/groups/tags/hosts"
						onItemClick={(item) => removeItem(nodeAttr.target, item)}
					/>
				</div>
				<div>
					<div class="mb-2 flex items-center justify-between">
						<label class="label" for={`nodeattr-attr-${idx}-select-item`}>attr</label>
						<div class="flex space-x-1">
							<button class="btn btn-xs rounded-md variant-soft-secondary" onclick={() => addPreset(idx, 'drive:share')} data-testid={`nodeattr-drive-share-${idx}`}>drive:share</button>
							<button class="btn btn-xs rounded-md variant-soft-secondary" onclick={() => addPreset(idx, 'drive:access')} data-testid={`nodeattr-drive-access-${idx}`}>drive:access</button>
						</div>
					</div>
					<MultiSelect
						id={`nodeattr-attr-${idx}`}
						items={nodeAttr.attr}
						placeholder="Add attributes"
						onItemClick={(item) => removeItem(nodeAttr.attr, item)}
					/>
				</div>
			</div>
		</div>
	{/each}
	</div>
</div>
