<script lang="ts">
	import { onMount } from 'svelte';
	import JWCC from 'json5';
	import { getToastStore } from '@skeletonlabs/skeleton';

	import Page from '$lib/page/Page.svelte';
	import PageHeader from '$lib/page/PageHeader.svelte';
	import { App } from '$lib/States.svelte';
	import { getPolicy } from '$lib/common/api';
	import { ACLBuilder, type ACL } from '$lib/common/acl.svelte';
	import { debug } from '$lib/common/debug';
	import { toastError } from '$lib/common/funcs';
	import {
		buildGraph,
		filterGraph,
		trimGraph,
		layoutGraph,
		neighboursOf,
		DEFAULT_EDGE_FILTER,
		DEFAULT_KIND_FILTER,
		MAX_NODES_PER_KIND,
		type EdgeFilter,
		type GraphEdgeKind,
		type GraphNodeKind,
		type KindFilter,
	} from '$lib/common/visualise';

	const ToastStore = getToastStore();

	/** Radius of an unselected node circle (px in SVG user-space). */
	const NODE_R = 20;
	/** Radius of the selected node circle. */
	const NODE_R_SEL = 26;

	/** MDI icon path data (24×24 viewBox) for each node kind. */
	const iconPaths: Record<GraphNodeKind, string> = {
		user: 'M12 4a4 4 0 0 1 4 4a4 4 0 0 1-4 4a4 4 0 0 1-4-4a4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4',
		group: 'M12 5.5A3.5 3.5 0 0 1 15.5 9a3.5 3.5 0 0 1-3.5 3.5A3.5 3.5 0 0 1 8.5 9A3.5 3.5 0 0 1 12 5.5M5 8c.56 0 1.08.15 1.53.42c-.15 1.43.27 2.85 1.13 3.96C7.16 13.34 6.16 14 5 14a3 3 0 0 1-3-3a3 3 0 0 1 3-3m14 0a3 3 0 0 1 3 3a3 3 0 0 1-3 3c-1.16 0-2.16-.66-2.66-1.62a5.54 5.54 0 0 0 1.13-3.96c.45-.27.97-.42 1.53-.42M5.5 18.25c0-2.07 2.91-3.75 6.5-3.75s6.5 1.68 6.5 3.75V20h-13zM0 20v-1.5c0-1.39 1.89-2.56 4.45-2.9c-.59.68-.95 1.62-.95 2.65V20zm24 0h-3.5v-1.75c0-1.03-.36-1.97-.95-2.65c2.56.34 4.45 1.51 4.45 2.9z',
		tag: 'M5.5 7A1.5 1.5 0 0 1 4 5.5A1.5 1.5 0 0 1 5.5 4A1.5 1.5 0 0 1 7 5.5A1.5 1.5 0 0 1 5.5 7m15.91 4.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.11 0-2 .89-2 2v7c0 .55.22 1.05.59 1.41l8.99 9c.37.36.87.59 1.42.59s1.05-.23 1.41-.59l7-7c.37-.36.59-.86.59-1.41c0-.56-.23-1.06-.59-1.42',
		node: 'M4 6h16v10H4m16 2a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4c-1.11 0-2 .89-2 2v10a2 2 0 0 0 2 2H0v2h24v-2z',
		host: 'M4 1h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1m0 8h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1m0 8h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1M9 5h1V3H9zm0 8h1v-2H9zm0 8h1v-2H9zM5 3v2h2V3zm0 8v2h2v-2zm0 8v2h2v-2z',
		wildcard:
			'M21 13h-6.6l4.7 4.7l-1.4 1.4l-4.7-4.7V21h-2v-6.7L6.3 19l-1.4-1.4L9.4 13H3v-2h6.6L4.9 6.3l1.4-1.4L11 9.6V3h2v6.4l4.6-4.6L19 6.3L14.3 11H21z',
	};

	let acl = $state<ACL | null>(null);
	let kindFilter = $state<KindFilter>({ ...DEFAULT_KIND_FILTER });
	let edgeFilter = $state<EdgeFilter>({ ...DEFAULT_EDGE_FILTER });
	let search = $state('');
	let selectedId = $state<string | null>(null);

	onMount(() => {
		getPolicy()
			.then((policy) => {
				acl = ACLBuilder.fromPolicy(JWCC.parse<ACL>(policy));
			})
			.catch((reason) => {
				debug('visualise: unable to get policy', reason);
				toastError(`Unable to load ACL policy.`, ToastStore, reason);
			});
	});

	const fullGraph = $derived(buildGraph(App.users.value, App.nodes.value, acl));
	const filtered = $derived(filterGraph(fullGraph, kindFilter, edgeFilter, search));
	const trimmed = $derived(trimGraph(filtered));
	const layout = $derived(layoutGraph(trimmed.graph));
	const selectedNeighbours = $derived(
		selectedId ? neighboursOf(trimmed.graph, selectedId) : new Set<string>(),
	);
	const selected = $derived(
		selectedId ? (trimmed.graph.nodes.find((n) => n.id === selectedId) ?? null) : null,
	);

	const positionById = $derived.by(() => {
		const m = new Map<string, { x: number; y: number }>();
		for (const n of layout.nodes) m.set(n.id, { x: n.x, y: n.y });
		return m;
	});

	const kindColour: Record<GraphNodeKind, string> = {
		user: '#3b82f6',
		group: '#a855f7',
		tag: '#10b981',
		node: '#f59e0b',
		host: '#64748b',
		wildcard: '#ef4444',
	};

	const edgeColour: Record<GraphEdgeKind, string> = {
		'user-group': '#94a3b8',
		'group-tag': '#94a3b8',
		'user-tag': '#94a3b8',
		'user-node': '#cbd5e1',
		'tag-node': '#cbd5e1',
		'acl-accept': '#10b981',
		'acl-deny': '#ef4444',
	};

	const nodeKinds: { key: GraphNodeKind; label: string }[] = [
		{ key: 'user', label: 'Users' },
		{ key: 'group', label: 'Groups' },
		{ key: 'tag', label: 'Tags' },
		{ key: 'node', label: 'Nodes' },
		{ key: 'host', label: 'Hosts' },
		{ key: 'wildcard', label: 'Wildcard' },
	];

	const edgeKinds: { key: GraphEdgeKind; label: string }[] = [
		{ key: 'user-group', label: 'User → Group' },
		{ key: 'group-tag', label: 'Group → Tag' },
		{ key: 'user-tag', label: 'User → Tag' },
		{ key: 'user-node', label: 'User → Node' },
		{ key: 'tag-node', label: 'Tag → Node' },
		{ key: 'acl-accept', label: 'ACL accept' },
	];

	function edgeVisible(from: string, to: string): boolean {
		if (!selectedId) return true;
		return from === selectedId || to === selectedId;
	}

	function nodeDimmed(id: string): boolean {
		if (!selectedId) return false;
		return id !== selectedId && !selectedNeighbours.has(id);
	}

	function selectNode(id: string) {
		selectedId = selectedId === id ? null : id;
	}

	function resetFilters() {
		kindFilter = { ...DEFAULT_KIND_FILTER };
		edgeFilter = { ...DEFAULT_EDGE_FILTER };
		search = '';
		selectedId = null;
	}

	/**
	 * Return the point on the circumference of the circle centred at `anchor`
	 * (radius `r`) that faces toward `toward`.  Used to stop edge lines at the
	 * node boundary rather than at its centre.
	 */
	function edgeEndpoint(
		anchor: { x: number; y: number },
		toward: { x: number; y: number },
		r: number,
	): { x: number; y: number } {
		const dx = toward.x - anchor.x;
		const dy = toward.y - anchor.y;
		const dist = Math.sqrt(dx * dx + dy * dy) || 1;
		return { x: anchor.x + (dx / dist) * r, y: anchor.y + (dy / dist) * r };
	}
</script>

<Page>
	<PageHeader title="Visualise" />

	<div
		class="mb-4 px-4 py-2 rounded-md variant-ghost-warning border border-warning-500 flex items-center gap-2"
		data-testid="experimental-banner"
	>
		<span class="badge variant-filled-warning">Experimental</span>
		<span class="text-sm">
			This page is under active development. Rendering of complex ACLs may be incomplete.
		</span>
	</div>

	{#if trimmed.truncated}
		<div
			class="mb-4 px-4 py-2 rounded-md variant-ghost-surface border border-surface-400 flex items-center gap-2"
			data-testid="truncation-banner"
		>
			<span class="badge variant-filled-surface">Note</span>
			<span class="text-sm">
				Large graph: only the first {MAX_NODES_PER_KIND} entities of each type are shown. Use the
				search or entity filters to focus on a subset.
			</span>
		</div>
	{/if}

	<div class="grid grid-cols-1 lg:grid-cols-4 gap-4" data-testid="visualise-root">
		<aside class="card p-4 lg:col-span-1 space-y-4" data-testid="visualise-filters">
			<div>
				<label class="label">
					<span class="text-sm font-semibold">Search</span>
					<input
						type="text"
						class="input rounded-md text-sm"
						placeholder="Filter by label..."
						bind:value={search}
						data-testid="visualise-search"
					/>
				</label>
			</div>

			<div>
				<div class="text-sm font-semibold mb-2">Entities</div>
				<ul class="space-y-1">
					{#each nodeKinds as k}
						<li class="flex items-center justify-between">
							<label class="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									class="checkbox"
									bind:checked={kindFilter[k.key]}
									data-testid="kind-toggle-{k.key}"
								/>
								<svg
									viewBox="0 0 24 24"
									class="w-5 h-5 shrink-0"
									style="color: {kindColour[k.key]}"
									aria-hidden="true"
								>
									<path fill="currentColor" d={iconPaths[k.key]} />
								</svg>
								{k.label}
							</label>
						</li>
					{/each}
				</ul>
			</div>

			<div>
				<div class="text-sm font-semibold mb-2">Relations</div>
				<ul class="space-y-1">
					{#each edgeKinds as e}
						<li>
							<label class="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									class="checkbox"
									bind:checked={edgeFilter[e.key]}
									data-testid="edge-toggle-{e.key}"
								/>
								<span class="inline-block w-4 h-[2px]" style="background: {edgeColour[e.key]}"
								></span>
								{e.label}
							</label>
						</li>
					{/each}
				</ul>
			</div>

			<button
				type="button"
				class="btn btn-sm variant-soft w-full"
				onclick={resetFilters}
				data-testid="visualise-reset"
			>
				Reset filters
			</button>

			<div class="text-xs opacity-70" data-testid="visualise-counts">
				Entities: {trimmed.graph.nodes.length} · Relations: {trimmed.graph.edges.length}
			</div>
		</aside>

		<div class="lg:col-span-3 space-y-4">
			<div class="card p-2 bg-surface-100-800-token overflow-auto" data-testid="visualise-canvas">
				{#if trimmed.graph.nodes.length === 0}
					<div class="p-8 text-center opacity-70" data-testid="visualise-empty">
						No entities match the current filters.
					</div>
				{:else}
					<svg
						role="img"
						aria-label="ACL node graph"
						viewBox="0 0 {layout.width} {layout.height}"
						width="100%"
						height={layout.height}
						data-testid="visualise-svg"
					>
						<defs>
							<marker
								id="arrow-acl"
								viewBox="0 0 10 10"
								refX="10"
								refY="5"
								markerWidth="8"
								markerHeight="8"
								orient="auto-start-reverse"
							>
								<path d="M0,0 L10,5 L0,10 z" fill={edgeColour['acl-accept']} />
							</marker>
							<marker
								id="arrow-default"
								viewBox="0 0 10 10"
								refX="10"
								refY="5"
								markerWidth="8"
								markerHeight="8"
								orient="auto-start-reverse"
							>
								<path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
							</marker>
						</defs>

						<g class="edges">
							{#each trimmed.graph.edges as e (e.id)}
								{@const from = positionById.get(e.from)}
								{@const to = positionById.get(e.to)}
								{#if from && to}
									{@const fromR = selectedId === e.from ? NODE_R_SEL : NODE_R}
									{@const toR = selectedId === e.to ? NODE_R_SEL : NODE_R}
									{@const ep1 = edgeEndpoint(from, to, fromR)}
									{@const ep2 = edgeEndpoint(to, from, toR)}
									<line
										x1={ep1.x}
										y1={ep1.y}
										x2={ep2.x}
										y2={ep2.y}
										stroke={edgeColour[e.kind]}
										stroke-width={e.kind === 'acl-accept' ? 2.5 : 1.5}
										stroke-dasharray={e.kind === 'tag-node' ? '5 5' : undefined}
										opacity={edgeVisible(e.from, e.to) ? 0.85 : 0.1}
										marker-end={e.kind === 'acl-accept' ? 'url(#arrow-acl)' : 'url(#arrow-default)'}
										data-testid="edge-{e.kind}"
									/>
								{/if}
							{/each}
						</g>

						<g class="nodes">
							{#each layout.nodes as n (n.id)}
								{@const isSelected = selectedId === n.id}
								{@const r = isSelected ? NODE_R_SEL : NODE_R}
								<g
									transform="translate({n.x},{n.y})"
									class="cursor-pointer"
									opacity={nodeDimmed(n.id) ? 0.2 : 1}
									role="button"
									tabindex="0"
									aria-label="{n.kind} {n.label}"
									data-testid="graph-node"
									data-node-id={n.id}
									data-node-kind={n.kind}
									onclick={() => selectNode(n.id)}
									onkeydown={(ev) => {
										if (ev.key === 'Enter' || ev.key === ' ') {
											ev.preventDefault();
											selectNode(n.id);
										}
									}}
								>
									<!-- Coloured background circle -->
									<circle
										{r}
										fill={kindColour[n.kind]}
										stroke="white"
										stroke-width={isSelected ? 3 : 2}
									/>
									<!-- MDI icon centred on the node, scaled to fit inside the circle -->
									<g transform="translate(-12,-12) scale(1)">
										<path d={iconPaths[n.kind]} fill="white" />
									</g>
									<!-- Label centred below the circle -->
									<text
										x="0"
										y={r + 18}
										font-size="13"
										text-anchor="middle"
										fill="currentColor"
										class="select-none"
									>
										{n.label}
									</text>
								</g>
							{/each}
						</g>
					</svg>
				{/if}
			</div>

			<div class="card p-4" data-testid="visualise-details">
				{#if selected}
					<div class="flex items-center justify-between mb-2">
						<div class="flex items-center gap-2">
							<svg
								viewBox="0 0 24 24"
								class="w-5 h-5 shrink-0"
								style="color: {kindColour[selected.kind]}"
								aria-hidden="true"
							>
								<path fill="currentColor" d={iconPaths[selected.kind]} />
							</svg>
							<span class="font-semibold">{selected.label}</span>
							<span class="badge variant-soft text-xs uppercase">{selected.kind}</span>
						</div>
						<button
							type="button"
							class="btn btn-sm variant-soft"
							onclick={() => (selectedId = null)}
							data-testid="visualise-clear-selection"
						>
							Clear
						</button>
					</div>
					<div class="text-sm">
						<div class="font-semibold mb-1">Connected to:</div>
						{#if selectedNeighbours.size === 0}
							<div class="opacity-70">No connections under the current filters.</div>
						{:else}
							<ul class="flex flex-wrap gap-2">
								{#each trimmed.graph.nodes.filter((n) => selectedNeighbours.has(n.id)) as n}
									<li>
										<button
											type="button"
											class="chip variant-soft hover:variant-filled"
											onclick={() => selectNode(n.id)}
											data-testid="neighbour-chip"
										>
											<svg
												viewBox="0 0 24 24"
												class="w-3 h-3 mr-1 shrink-0"
												style="color: {kindColour[n.kind]}"
												aria-hidden="true"
											>
												<path fill="currentColor" d={iconPaths[n.kind]} />
											</svg>
											{n.label}
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{:else}
					<div class="text-sm opacity-70" data-testid="visualise-no-selection">
						Click an entity to inspect its direct relationships.
					</div>
				{/if}
			</div>
		</div>
	</div>
</Page>
