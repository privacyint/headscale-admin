<script lang="ts">
	import { getToastStore } from '@skeletonlabs/skeleton';
	import MultiSelect from '$lib/parts/MultiSelect.svelte';
	import Delete from '$lib/parts/Delete.svelte';
	import type { PolicyBuilder } from '$lib/common/policy-builder';
	import type { PolicyGrant } from '$lib/common/policy-types';
	import { App } from '$lib/States.svelte';
	import { deduplicate, toastError, toastSuccess } from '$lib/common/funcs';
	import { debug } from '$lib/common/debug';

	type CapabilityFormRow = {
		id: string;
		key: string;
		value: string;
	};

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

	let capabilityForms = $state<Record<number, CapabilityFormRow[]>>({});
	let capabilityRowCounter = $state(0);

	const grants = $derived.by(() => {
		const list = acl.grants ?? [];
		for (const grant of list) {
			grant.ip ??= [];
			grant.srcPosture ??= [];
			grant.via ??= [];
		}
		return list;
	});

	$effect(() => {
		const list = grants;
		const next: Record<number, CapabilityFormRow[]> = { ...capabilityForms };
		let changed = false;

		for (let idx = 0; idx < list.length; idx += 1) {
			if (next[idx] === undefined) {
				next[idx] = rowsFromGrant(list[idx]);
				changed = true;
			}
		}

		for (const k of Object.keys(next)) {
			const idx = Number.parseInt(k, 10);
			if (idx >= list.length) {
				delete next[idx];
				changed = true;
			}
		}

		if (changed) {
			capabilityForms = next;
		}
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
		const idx = next.length - 1;
		capabilityForms[idx] = [{ id: `cap-${capabilityRowCounter++}`, key: '', value: '[]' }];
		updateGrants(next);
		toastSuccess(`Added grant #${next.length}`, ToastStore);
	}

	function deleteGrant(idx: number) {
		const next = [...currentGrants()];
		next.splice(idx, 1);
		updateGrants(next);
		reindexCapabilityFormsAfterDelete(idx);
	}

	function reindexCapabilityFormsAfterDelete(deletedIdx: number) {
		const next: Record<number, CapabilityFormRow[]> = {};
		for (const [k, v] of Object.entries(capabilityForms)) {
			const idx = Number.parseInt(k, 10);
			if (idx < deletedIdx) {
				next[idx] = v;
			} else if (idx > deletedIdx) {
				next[idx - 1] = v;
			}
		}
		capabilityForms = next;
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
		capabilityForms[idx] = [
			{
				id: `cap-${capabilityRowCounter++}`,
				key: 'tailscale.com/cap/drive',
				value: JSON.stringify([{ shares: ['*'] }, { access: ['*'] }], null, 2),
			},
		];
		updateGrants([...currentGrants()]);
		toastSuccess('Applied Taildrive app preset', ToastStore);
	}

	function rowsFromGrant(grant: PolicyGrant): CapabilityFormRow[] {
		const rows: CapabilityFormRow[] = Object.entries(grant.app ?? {}).map(([key, value]) => ({
			id: `cap-${capabilityRowCounter++}`,
			key,
			value: JSON.stringify(value, null, 2),
		}));
		return rows.length > 0
			? rows
			: [{ id: `cap-${capabilityRowCounter++}`, key: '', value: '[]' }];
	}

	function addCapabilityRow(idx: number) {
		const rows = capabilityForms[idx] ?? [];
		rows.push({ id: `cap-${capabilityRowCounter++}`, key: '', value: '[]' });
		capabilityForms[idx] = rows;
	}

	function removeCapabilityRow(idx: number, id: string) {
		const rows = capabilityForms[idx] ?? [];
		capabilityForms[idx] = rows.filter((row) => row.id !== id);
	}

	function applyCapabilityForm(idx: number) {
		const grant = currentGrants()[idx];
		if (grant === undefined) {
			return;
		}
		try {
			const rows = capabilityForms[idx] ?? [];
			const normalised: Record<string, unknown[]> = {};
			for (const row of rows) {
				const key = row.key.trim();
				if (key.length === 0) {
					continue;
				}
				const value = JSON.parse(row.value) as unknown;
				if (!Array.isArray(value)) {
					throw new Error(`Capability '${key}' must be a JSON array`);
				}
				if (Object.prototype.hasOwnProperty.call(normalised, key)) {
					throw new Error(`Duplicate capability key '${key}'`);
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
						<label class="label">app capabilities (optional)</label>
						<button class="btn btn-xs rounded-md variant-soft-secondary" onclick={() => addTaildrivePreset(idx)} data-testid={`grant-taildrive-preset-${idx}`}>
							Apply Taildrive preset
						</button>
					</div>
					<div class="space-y-3">
						{#each (capabilityForms[idx] ?? []) as row (row.id)}
							<div class="rounded-md border border-surface-300-700-token p-3">
								<div class="mb-2 grid grid-cols-12 gap-2 items-end">
									<div class="col-span-10">
										<label class="label" for={`grant-app-key-${idx}-${row.id}`}>Capability key</label>
										<input
											id={`grant-app-key-${idx}-${row.id}`}
											class="input rounded-md w-full"
											placeholder="tailscale.com/cap/drive"
											bind:value={row.key}
										/>
									</div>
									<div class="col-span-2 text-right">
										<button
											class="btn btn-xs rounded-md variant-soft-error"
											onclick={() => removeCapabilityRow(idx, row.id)}
										>
											Remove
										</button>
									</div>
								</div>
								<label class="label" for={`grant-app-value-${idx}-${row.id}`}>Capability value (JSON array)</label>
								<textarea
									id={`grant-app-value-${idx}-${row.id}`}
									class="textarea rounded-md w-full min-h-24"
									bind:value={row.value}
								></textarea>
							</div>
						{/each}
					</div>
					<div class="mt-2">
						<button class="btn btn-xs rounded-md variant-soft-tertiary mr-2" onclick={() => addCapabilityRow(idx)}>Add capability</button>
						<button class="btn btn-xs rounded-md variant-soft-primary" onclick={() => applyCapabilityForm(idx)} data-testid={`grant-apply-app-${idx}`}>Apply capability form</button>
					</div>
					<p class="mt-1 text-xs opacity-80">Each capability key maps to a JSON array value. Use the Taildrive preset for a safe starter payload.</p>
				</div>
			</div>
		</div>
	{/each}
	</div>
</div>
