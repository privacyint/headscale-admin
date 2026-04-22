/**
 * Pure helpers for the experimental "Visualise" node graph.
 *
 * Converts a Headscale configuration (users, nodes, ACL policy) into a
 * generic {nodes, edges} graph that can be rendered. Kept free of Svelte
 * state and DOM references so it can be exercised by unit tests.
 */

import type { ACL, AclPolicy } from '$lib/common/acl.svelte';
import type { Node as HNode, User } from '$lib/common/types';

export type GraphNodeKind = 'user' | 'group' | 'tag' | 'node' | 'host' | 'wildcard';

export type GraphNode = {
	/** Unique id across the whole graph, e.g. "user:alice", "tag:tag:web". */
	id: string;
	/** Classification used for column placement, colours and filtering. */
	kind: GraphNodeKind;
	/** Display label. */
	label: string;
	/** Underlying reference, useful for the details panel. */
	ref?: User | HNode | { name: string; members?: string[] } | { name: string; owners?: string[] };
};

export type GraphEdgeKind =
	| 'user-group' // user is a member of a group
	| 'group-tag' // group owns a tag
	| 'user-tag' // user owns a tag (tagOwners)
	| 'user-node' // node belongs to user
	| 'tag-node' // node has tag
	| 'acl-accept' // acl accept policy from src → dst
	| 'acl-deny'; // reserved; headscale only has accept today

export type GraphEdge = {
	id: string;
	from: string; // GraphNode.id
	to: string; // GraphNode.id
	kind: GraphEdgeKind;
	/** Optional index of the ACL policy that produced the edge. */
	policyIdx?: number;
};

export type Graph = {
	nodes: GraphNode[];
	edges: GraphEdge[];
};

// ── id helpers ──────────────────────────────────────────────────────────────

export function userId(name: string): string {
	return `user:${name}`;
}
export function groupId(name: string): string {
	// the raw policy key already starts with "group:"; don't double up.
	return name.startsWith('group:') ? `g:${name}` : `g:group:${name}`;
}
export function tagId(name: string): string {
	return name.startsWith('tag:') ? `t:${name}` : `t:tag:${name}`;
}
export function nodeId(id: string): string {
	return `node:${id}`;
}
export function hostId(name: string): string {
	return `host:${name}`;
}

export const WILDCARD_ID = 'wildcard:*';

// ── graph construction ──────────────────────────────────────────────────────

export type BuildOptions = {
	/** Only include ACL edges whose `policyIdx` is in this set. Omit for all. */
	policyFilter?: Set<number>;
};

/**
 * Build a graph from the supplied data. The returned arrays are stable with
 * respect to input order, so snapshot/visual tests are deterministic.
 */
export function buildGraph(
	users: User[],
	nodes: HNode[],
	acl: ACL | null | undefined,
	options: BuildOptions = {},
): Graph {
	const gNodes: GraphNode[] = [];
	const gEdges: GraphEdge[] = [];
	const seenNodeIds = new Set<string>();

	function addNode(n: GraphNode): void {
		if (seenNodeIds.has(n.id)) return;
		seenNodeIds.add(n.id);
		gNodes.push(n);
	}

	function addEdge(e: GraphEdge): void {
		gEdges.push(e);
	}

	// Users
	for (const u of users ?? []) {
		addNode({ id: userId(u.name), kind: 'user', label: u.name, ref: u });
	}

	// Nodes and implicit edges (user owns node, node has tag)
	for (const n of nodes ?? []) {
		addNode({ id: nodeId(n.id), kind: 'node', label: n.givenName || n.name, ref: n });
		if (n.user?.name) {
			// ensure the user node exists even if not in `users` list
			addNode({ id: userId(n.user.name), kind: 'user', label: n.user.name, ref: n.user });
			addEdge({
				id: `un:${n.user.name}->${n.id}`,
				from: userId(n.user.name),
				to: nodeId(n.id),
				kind: 'user-node',
			});
		}
		for (const t of n.tags ?? []) {
			const normTag = t.startsWith('tag:') ? t : `tag:${t}`;
			addNode({ id: tagId(normTag), kind: 'tag', label: normTag, ref: { name: normTag } });
			addEdge({
				id: `tn:${normTag}->${n.id}`,
				from: tagId(normTag),
				to: nodeId(n.id),
				kind: 'tag-node',
			});
		}
	}

	if (!acl) {
		return { nodes: gNodes, edges: gEdges };
	}

	// Groups and memberships
	for (const [gname, members] of Object.entries(acl.groups ?? {})) {
		addNode({
			id: groupId(gname),
			kind: 'group',
			label: gname,
			ref: { name: gname, members: [...(members ?? [])] },
		});
		for (const m of members ?? []) {
			// Group members are user names (may or may not yet exist as User entities)
			addNode({ id: userId(m), kind: 'user', label: m });
			addEdge({
				id: `ug:${m}->${gname}`,
				from: userId(m),
				to: groupId(gname),
				kind: 'user-group',
			});
		}
	}

	// Tag owners
	for (const [tname, owners] of Object.entries(acl.tagOwners ?? {})) {
		addNode({
			id: tagId(tname),
			kind: 'tag',
			label: tname,
			ref: { name: tname, owners: [...(owners ?? [])] },
		});
		for (const owner of owners ?? []) {
			if (owner.startsWith('group:')) {
				addNode({ id: groupId(owner), kind: 'group', label: owner });
				addEdge({
					id: `gt:${owner}->${tname}`,
					from: groupId(owner),
					to: tagId(tname),
					kind: 'group-tag',
				});
			} else {
				addNode({ id: userId(owner), kind: 'user', label: owner });
				addEdge({
					id: `ut:${owner}->${tname}`,
					from: userId(owner),
					to: tagId(tname),
					kind: 'user-tag',
				});
			}
		}
	}

	// Hosts
	for (const hname of Object.keys(acl.hosts ?? {})) {
		addNode({ id: hostId(hname), kind: 'host', label: hname });
	}

	// ACL policies
	const policies: AclPolicy[] = acl.acls ?? [];
	policies.forEach((p, idx) => {
		if (options.policyFilter && !options.policyFilter.has(idx)) return;
		for (const src of p.src ?? []) {
			for (const dst of p.dst ?? []) {
				const srcId = resolveEndpoint(src);
				const dstId = resolveEndpoint(dst);
				// make sure the resolved endpoints have a corresponding node
				if (srcId) ensureEndpointNode(srcId, src);
				if (dstId) ensureEndpointNode(dstId, dst);
				if (!srcId || !dstId) continue;
				addEdge({
					id: `acl:${idx}:${srcId}->${dstId}`,
					from: srcId,
					to: dstId,
					kind: 'acl-accept',
					policyIdx: idx,
				});
			}
		}
	});

	function ensureEndpointNode(id: string, raw: string): void {
		if (seenNodeIds.has(id)) return;
		if (id === WILDCARD_ID) {
			addNode({ id: WILDCARD_ID, kind: 'wildcard', label: '*' });
		} else if (id.startsWith('g:')) {
			addNode({ id, kind: 'group', label: raw });
		} else if (id.startsWith('t:')) {
			addNode({ id, kind: 'tag', label: raw });
		} else if (id.startsWith('user:')) {
			addNode({ id, kind: 'user', label: raw });
		} else if (id.startsWith('host:')) {
			addNode({ id, kind: 'host', label: raw });
		}
	}

	return { nodes: gNodes, edges: gEdges };
}

/**
 * Resolve an ACL endpoint expression (src or dst entry) to the id of a graph
 * node. dst entries can contain `:port`; the port is stripped. Returns `null`
 * for CIDRs or anything else we don't represent as a distinct graph node.
 */
export function resolveEndpoint(raw: string): string | null {
	// strip dst port, e.g. "*:*" → "*", "tag:web:22" → "tag:web"
	let expr = raw;
	const lastColon = expr.lastIndexOf(':');
	if (lastColon > -1) {
		const tail = expr.slice(lastColon + 1);
		if (tail === '*' || /^\d+$/.test(tail) || /^\d+-\d+$/.test(tail)) {
			expr = expr.slice(0, lastColon);
		}
	}

	if (expr === '' || expr === '*') return WILDCARD_ID;
	if (expr.startsWith('group:')) return groupId(expr);
	if (expr.startsWith('tag:')) return tagId(expr);
	if (expr.startsWith('autogroup:')) return null; // not modelled
	if (/^\d/.test(expr)) return null; // CIDR / IP – not modelled as a graph node
	// otherwise treat as a user name
	return userId(expr);
}

// ── layout ──────────────────────────────────────────────────────────────────

/** Columns used by the default layout. */
export const COLUMN_ORDER: GraphNodeKind[] = ['user', 'group', 'tag', 'node', 'host', 'wildcard'];

export type LayoutOptions = {
	width?: number;
	height?: number;
	paddingX?: number;
	paddingY?: number;
	rowSpacing?: number;
};

export type PositionedNode = GraphNode & { x: number; y: number };

/**
 * Deterministic columnar layout: kinds are placed left-to-right following
 * {@link COLUMN_ORDER}; within a column, nodes are stacked top-to-bottom in
 * their insertion order.
 */
export function layoutGraph(
	graph: Graph,
	options: LayoutOptions = {},
): { nodes: PositionedNode[]; width: number; height: number } {
	const paddingX = options.paddingX ?? 80;
	const paddingY = options.paddingY ?? 40;
	const rowSpacing = options.rowSpacing ?? 56;

	const byKind: Record<GraphNodeKind, GraphNode[]> = {
		user: [],
		group: [],
		tag: [],
		node: [],
		host: [],
		wildcard: [],
	};
	for (const n of graph.nodes) byKind[n.kind].push(n);

	// Only keep columns with entries so the layout tightens gracefully.
	const activeColumns = COLUMN_ORDER.filter((k) => byKind[k].length > 0);
	const colCount = Math.max(activeColumns.length, 1);
	const tallest = Math.max(1, ...activeColumns.map((k) => byKind[k].length));

	const innerWidth = options.width ?? Math.max(640, colCount * 220);
	const colGap = (innerWidth - paddingX * 2) / Math.max(1, colCount - 1 || 1);
	const height = options.height ?? paddingY * 2 + (tallest - 1) * rowSpacing + rowSpacing;

	const positioned: PositionedNode[] = [];
	activeColumns.forEach((kind, colIdx) => {
		const col = byKind[kind];
		// centre the column vertically around the canvas midpoint
		const colHeight = (col.length - 1) * rowSpacing;
		const yStart = (height - colHeight) / 2;
		col.forEach((n, rowIdx) => {
			const x = activeColumns.length === 1 ? innerWidth / 2 : paddingX + colIdx * colGap;
			const y = yStart + rowIdx * rowSpacing;
			positioned.push({ ...n, x, y });
		});
	});

	return { nodes: positioned, width: innerWidth, height };
}

// ── filtering helpers ───────────────────────────────────────────────────────

export type KindFilter = Record<GraphNodeKind, boolean>;
export type EdgeFilter = Record<GraphEdgeKind, boolean>;

export const DEFAULT_KIND_FILTER: KindFilter = {
	user: true,
	group: true,
	tag: true,
	node: true,
	host: true,
	wildcard: true,
};

export const DEFAULT_EDGE_FILTER: EdgeFilter = {
	'user-group': true,
	'group-tag': true,
	'user-tag': true,
	'user-node': true,
	'tag-node': true,
	'acl-accept': true,
	'acl-deny': true,
};

/**
 * Apply kind and edge filters and an optional search string (case-insensitive
 * substring match against node labels). Edges whose endpoints are hidden are
 * dropped.
 */
export function filterGraph(
	graph: Graph,
	kindFilter: KindFilter,
	edgeFilter: EdgeFilter,
	search = '',
): Graph {
	const needle = search.trim().toLowerCase();
	const visible = new Set<string>();
	for (const n of graph.nodes) {
		if (!kindFilter[n.kind]) continue;
		if (needle && !n.label.toLowerCase().includes(needle)) continue;
		visible.add(n.id);
	}
	const nodes = graph.nodes.filter((n) => visible.has(n.id));
	const edges = graph.edges.filter(
		(e) => edgeFilter[e.kind] && visible.has(e.from) && visible.has(e.to),
	);
	return { nodes, edges };
}

/** Return the set of node ids directly connected to `id` via any edge. */
export function neighboursOf(graph: Graph, id: string): Set<string> {
	const out = new Set<string>();
	for (const e of graph.edges) {
		if (e.from === id) out.add(e.to);
		if (e.to === id) out.add(e.from);
	}
	return out;
}
