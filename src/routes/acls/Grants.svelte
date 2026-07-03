<script lang="ts">
	import { getToastStore } from '@skeletonlabs/skeleton';
	import MultiSelect from '$lib/parts/MultiSelect.svelte';
	import Delete from '$lib/parts/Delete.svelte';
	import type { PolicyBuilder } from '$lib/common/policy-builder';
	import type { PolicyGrant } from '$lib/common/policy-types';
	import { App } from '$lib/States.svelte';
	import { deduplicate, toastError, toastSuccess } from '$lib/common/funcs';
	import { debug } from '$lib/common/debug';

	const ToastStore = getToastStore();

	let { acl = $bindable(), loading = $bindable(false) }: { acl: PolicyBuilder; loading?: boolean } = $props();

	const userNames = $derived(App.users.value.map((u) => (u.email ? u.email : u.name)).toSorted());
	const principalOptions = $derived(
		deduplicate([
			'*',
			...userNames,
			...acl.getGroupNames(true),
			...acl.getTagNames(true),
			...acl.getHostNames(),
		]),
	);
	const viaTagOptions = $derived(deduplicate(acl.getTagNames(true)));

	let appEditors = $state<Record<number, string>>({});

	const grants = $derived.by(() => {
		const list = acl.grants ?? [];
		for (const grant of list) {
			grant.ip ??= [];
			grant.srcPosture ??= [];
			grant.via ??= [];
		}
		return list;
	});

	function currentGrants(): PolicyGrant[] {
		return acl.grants ?? [];
	}

	function updateGrants(next: PolicyGrant[]) {
		acl.grants = next;
	}

	function addGrant() {
		const next = [
			...currentGrants(),
			{ src: ['*'], dst: ['*'], ip: [], srcPosture: [], via: [] } satisfies PolicyGrant,
		];
		updateGrants(next);
		toastSuccess(`Added grant #${next.length}`, ToastStore);
	}

	function deleteGrant(idx: number) {
		const next = [...currentGrants()];
		next.splice(idx, 1);
		updateGrants(next);
		delete appEditors[idx];
	}

	function removeItem(items: string[], item: string) {
		const idx = items.findIndex((v) => v === item);
		if (idx >= 0) {
			items.splice(idx, 1);
		}
	}

	function addTaildrivePreset(idx: number) {
		const grant = currentGrants()[idx];
		if (grant === undefined) {
			return;
		}
		if (grant.app === undefined) {
			grant.app = {};
		}
		grant.app['tailscale.com/cap/drive'] = [{ shares: ['*'] }, { access: ['*'] }];
		appEditors[idx] = JSON.stringify(grant.app, null, 2);
		updateGrants([...currentGrants()]);
		toastSuccess('Applied Taildrive app preset', ToastStore);
	}

	function applyAppJson(idx: number) {
		const grant = currentGrants()[idx];
		if (grant === undefined) {
			return;
		}
		try {
			const text = appEditors[idx] ?? '{}';
			const parsed = JSON.parse(text) as Record<string, unknown>;
			const normalised: Record<string, unknown[]> = {};
			for (const [key, value] of Object.entries(parsed)) {
				if (!Array.isArray(value)) {
					throw new Error(`Capability '${key}' must be a JSON array`);
				}
				normalised[key] = value;
			}
			grant.app = Object.keys(normalised).length > 0 ? normalised : undefined;
			updateGrants([...currentGrants()]);
			toastSuccess('Updated grant app capabilities', ToastStore);
		} catch (err) {
			if (err instanceof Error) {
				toastError('', ToastStore, err);
			}
			debug(err);
		}
	}

	function validateVia(idx: number) {
		const grant = currentGrants()[idx];
		if (grant?.via === undefined) {
			return;
		}
		const invalid = grant.via.filter((item) => !item.startsWith('tag:'));
		if (invalid.length > 0) {
			toastError('Via restrictions only support tag selectors (tag:...)', ToastStore);
			grant.via = grant.via.filter((item) => item.startsWith('tag:'));
			updateGrants([...currentGrants()]);
		}
	}
</script>


<div class="flex items-center mr-2 ml-0 pt-2">
	<div class="w-full md:w-8/12 lg:w-9/12 xl:w-8/12 2xl:w-6/12 space-y-3">
	<div class="mb-4 flex flex-row space-x-2">
		<button class="btn-sm rounded-md variant-filled-success" onclick={addGrant} data-testid="grant-add-btn">Create Grant</button>
	</div>

	{#if grants.length === 0}
		<div class="rounded-md border border-surface-300-700-token bg-surface-100-800-token p-4 text-sm" data-testid="grant-empty-state">
			No grants configured yet. Create one to define modern policy access rules.
		</div>
	{/if}

	{#each grants as grant, idx}
		<div class="grid grid-cols-1 bg-white dark:bg-slate-800 rounded-md p-5">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="font-mono text-sm">Grant #{idx + 1}</h3>
				<Delete func={() => deleteGrant(idx)} disabled={loading} />
			</div>

			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid={`grant-card-${idx}`}>
				<div>
					<label class="label" for={`grant-src-${idx}-select-item`}>src</label>
					<MultiSelect
						id={`grant-src-${idx}`}
						items={grant.src}
						options={principalOptions}
						placeholder="Select source selectors"
						onItemClick={(item) => removeItem(grant.src, item)}
					/>
				</div>
				<div>
					<label class="label" for={`grant-dst-${idx}-select-item`}>dst</label>
					<MultiSelect
						id={`grant-dst-${idx}`}
						items={grant.dst}
						options={principalOptions}
						placeholder="Select destination selectors"
						onItemClick={(item) => removeItem(grant.dst, item)}
					/>
				</div>
				<div>
					<label class="label" for={`grant-ip-${idx}-select-item`}>ip (optional)</label>
					<MultiSelect
						id={`grant-ip-${idx}`}
						items={grant.ip ?? []}
						placeholder="Add CIDR or IP"
						onItemClick={(item) => removeItem(grant.ip ?? [], item)}
					/>
				</div>
				<div>
					<label class="label" for={`grant-posture-${idx}-select-item`}>srcPosture (optional)</label>
					<MultiSelect
						id={`grant-posture-${idx}`}
						items={grant.srcPosture ?? []}
						placeholder="Add posture selector"
						onItemClick={(item) => removeItem(grant.srcPosture ?? [], item)}
					/>
				</div>
				<div class="lg:col-span-2">
					<div class="flex items-center justify-between">
						<label class="label" for={`grant-via-${idx}-select-item`}>via (tags only, optional)</label>
						<button class="btn btn-xs variant-soft-primary rounded-md" onclick={() => validateVia(idx)}>Validate</button>
					</div>
					<MultiSelect
						id={`grant-via-${idx}`}
						items={grant.via ?? []}
						options={viaTagOptions}
						placeholder="Select tag:... selectors"
						onItemClick={(item) => removeItem(grant.via ?? [], item)}
					/>
					<p class="mt-1 text-xs opacity-80">Hint: via currently supports tag selectors only (for example `tag:relay`).</p>
				</div>
				<div class="lg:col-span-2" data-testid={`grant-app-editor-${idx}`}>
					<div class="mb-2 flex items-center justify-between">
						<label class="label" for={`grant-app-json-${idx}`}>app capabilities (optional)</label>
						<button class="btn btn-xs rounded-md variant-soft-secondary" onclick={() => addTaildrivePreset(idx)} data-testid={`grant-taildrive-preset-${idx}`}>
							Apply Taildrive preset
						</button>
					</div>
					<textarea
						id={`grant-app-json-${idx}`}
						class="textarea rounded-md w-full min-h-40"
						bind:value={appEditors[idx]}
						onfocus={() => {
							if (appEditors[idx] === undefined) {
								appEditors[idx] = JSON.stringify(grant.app ?? {}, null, 2);
							}
						}}
					></textarea>
					<div class="mt-2">
						<button class="btn btn-xs rounded-md variant-soft-primary" onclick={() => applyAppJson(idx)} data-testid={`grant-apply-app-${idx}`}>Apply app JSON</button>
					</div>
					<p class="mt-1 text-xs opacity-80">Each capability key maps to a JSON array value. Use the Taildrive preset for a safe starter payload.</p>
				</div>
			</div>
		</div>
	{/each}
	</div>
</div>
