import { describe, it, expect } from 'vitest';
import {
	buildGraph,
	filterGraph,
	layoutGraph,
	neighboursOf,
	resolveEndpoint,
	userId,
	groupId,
	tagId,
	nodeId,
	WILDCARD_ID,
	DEFAULT_KIND_FILTER,
	DEFAULT_EDGE_FILTER,
	type KindFilter,
	type EdgeFilter,
} from '$lib/common/visualise';
import type { ACL } from '$lib/common/acl.svelte';
import type { Node, User } from '$lib/common/types';

function user(name: string, id = name): User {
	return {
		id,
		name,
		createdAt: '2025-01-01T00:00:00Z',
		displayName: name,
		email: '',
		providerId: '',
		provider: 'local',
		profilePicUrl: '',
	};
}

function node(id: string, givenName: string, u: User, tags: string[] = []): Node {
	return {
		id,
		machineKey: '',
		nodeKey: '',
		discoKey: '',
		ipAddresses: [],
		name: givenName,
		givenName,
		user: u,
		lastSeen: null,
		expiry: null,
		preAuthKey: null,
		createdAt: '2025-01-01T00:00:00Z',
		registerMethod: 'REGISTER_METHOD_CLI',
		online: true,
		approvedRoutes: [],
		availableRoutes: [],
		subnetRoutes: [],
		tags,
	};
}

const sampleAcl: ACL = {
	groups: { 'group:admin': ['alice'], 'group:dev': ['bob'] },
	tagOwners: { 'tag:web': ['group:admin'], 'tag:db': ['alice'] },
	hosts: {},
	acls: [
		{ action: 'accept', src: ['group:admin'], dst: ['*:*'] },
		{ action: 'accept', src: ['tag:web'], dst: ['tag:db:5432'] },
		{ action: 'accept', src: ['bob'], dst: ['tag:web:443'] },
	],
	ssh: [],
};

describe('resolveEndpoint', () => {
	it('strips dst ports', () => {
		expect(resolveEndpoint('tag:web:22')).toBe(tagId('tag:web'));
		expect(resolveEndpoint('tag:web:80-90')).toBe(tagId('tag:web'));
		expect(resolveEndpoint('*:*')).toBe(WILDCARD_ID);
	});

	it('resolves groups, tags, users, wildcards', () => {
		expect(resolveEndpoint('group:admin')).toBe(groupId('group:admin'));
		expect(resolveEndpoint('tag:web')).toBe(tagId('tag:web'));
		expect(resolveEndpoint('alice')).toBe(userId('alice'));
		expect(resolveEndpoint('*')).toBe(WILDCARD_ID);
	});

	it('returns null for CIDR and autogroup endpoints', () => {
		expect(resolveEndpoint('10.0.0.0/8')).toBeNull();
		expect(resolveEndpoint('192.168.1.1')).toBeNull();
		expect(resolveEndpoint('autogroup:internet')).toBeNull();
	});
});

describe('buildGraph', () => {
	const users = [user('alice'), user('bob')];
	const nodes = [
		node('1', 'alice-laptop', users[0]),
		node('2', 'bob-server', users[1], ['tag:web']),
	];

	it('creates one graph node per user/node/tag/group', () => {
		const g = buildGraph(users, nodes, sampleAcl);
		const ids = new Set(g.nodes.map((n) => n.id));
		expect(ids.has(userId('alice'))).toBe(true);
		expect(ids.has(userId('bob'))).toBe(true);
		expect(ids.has(nodeId('1'))).toBe(true);
		expect(ids.has(nodeId('2'))).toBe(true);
		expect(ids.has(groupId('group:admin'))).toBe(true);
		expect(ids.has(groupId('group:dev'))).toBe(true);
		expect(ids.has(tagId('tag:web'))).toBe(true);
		expect(ids.has(tagId('tag:db'))).toBe(true);
		expect(ids.has(WILDCARD_ID)).toBe(true);
	});

	it('does not duplicate a node if the user appears in several contexts', () => {
		const g = buildGraph(users, nodes, sampleAcl);
		const aliceCount = g.nodes.filter((n) => n.id === userId('alice')).length;
		expect(aliceCount).toBe(1);
	});

	it('adds user-node edges', () => {
		const g = buildGraph(users, nodes, sampleAcl);
		const e = g.edges.find(
			(x) => x.kind === 'user-node' && x.from === userId('alice') && x.to === nodeId('1'),
		);
		expect(e).toBeDefined();
	});

	it('adds tag-node edges for tagged nodes', () => {
		const g = buildGraph(users, nodes, sampleAcl);
		const e = g.edges.find(
			(x) => x.kind === 'tag-node' && x.from === tagId('tag:web') && x.to === nodeId('2'),
		);
		expect(e).toBeDefined();
	});

	it('adds user-group membership edges', () => {
		const g = buildGraph(users, nodes, sampleAcl);
		expect(
			g.edges.some(
				(x) =>
					x.kind === 'user-group' && x.from === userId('alice') && x.to === groupId('group:admin'),
			),
		).toBe(true);
	});

	it('adds group-tag and user-tag ownership edges', () => {
		const g = buildGraph(users, nodes, sampleAcl);
		expect(
			g.edges.some(
				(x) =>
					x.kind === 'group-tag' && x.from === groupId('group:admin') && x.to === tagId('tag:web'),
			),
		).toBe(true);
		expect(
			g.edges.some(
				(x) => x.kind === 'user-tag' && x.from === userId('alice') && x.to === tagId('tag:db'),
			),
		).toBe(true);
	});

	it('creates acl-accept edges resolving src/dst', () => {
		const g = buildGraph(users, nodes, sampleAcl);
		const aclEdges = g.edges.filter((e) => e.kind === 'acl-accept');
		// group:admin -> *
		expect(aclEdges.some((e) => e.from === groupId('group:admin') && e.to === WILDCARD_ID)).toBe(
			true,
		);
		// tag:web -> tag:db (port stripped)
		expect(aclEdges.some((e) => e.from === tagId('tag:web') && e.to === tagId('tag:db'))).toBe(
			true,
		);
		// bob (user) -> tag:web
		expect(aclEdges.some((e) => e.from === userId('bob') && e.to === tagId('tag:web'))).toBe(true);
	});

	it('tags every acl edge with its policy index', () => {
		const g = buildGraph(users, nodes, sampleAcl);
		const indexes = new Set(g.edges.filter((e) => e.kind === 'acl-accept').map((e) => e.policyIdx));
		expect(indexes).toEqual(new Set([0, 1, 2]));
	});

	it('respects a policy index filter', () => {
		const g = buildGraph(users, nodes, sampleAcl, { policyFilter: new Set([1]) });
		const aclEdges = g.edges.filter((e) => e.kind === 'acl-accept');
		expect(aclEdges.every((e) => e.policyIdx === 1)).toBe(true);
	});

	it('works when the ACL is missing', () => {
		const g = buildGraph(users, nodes, null);
		expect(g.nodes.length).toBeGreaterThan(0);
		expect(g.edges.some((e) => e.kind === 'acl-accept')).toBe(false);
	});
});

describe('filterGraph', () => {
	const users = [user('alice'), user('bob')];
	const nodes = [
		node('1', 'alice-laptop', users[0]),
		node('2', 'bob-server', users[1], ['tag:web']),
	];
	const graph = buildGraph(users, nodes, sampleAcl);

	it('returns the graph untouched with default filters', () => {
		const f = filterGraph(graph, DEFAULT_KIND_FILTER, DEFAULT_EDGE_FILTER);
		expect(f.nodes.length).toBe(graph.nodes.length);
		expect(f.edges.length).toBe(graph.edges.length);
	});

	it('hides nodes of a disabled kind and drops their edges', () => {
		const kf: KindFilter = { ...DEFAULT_KIND_FILTER, tag: false };
		const f = filterGraph(graph, kf, DEFAULT_EDGE_FILTER);
		expect(f.nodes.some((n) => n.kind === 'tag')).toBe(false);
		expect(f.edges.some((e) => e.kind === 'tag-node')).toBe(false);
		expect(f.edges.some((e) => e.kind === 'group-tag')).toBe(false);
	});

	it('hides edges of a disabled kind but keeps endpoints', () => {
		const ef: EdgeFilter = { ...DEFAULT_EDGE_FILTER, 'acl-accept': false };
		const f = filterGraph(graph, DEFAULT_KIND_FILTER, ef);
		expect(f.edges.some((e) => e.kind === 'acl-accept')).toBe(false);
		expect(f.nodes.length).toBe(graph.nodes.length);
	});

	it('applies a case-insensitive search', () => {
		const f = filterGraph(graph, DEFAULT_KIND_FILTER, DEFAULT_EDGE_FILTER, 'ALICE');
		expect(f.nodes.some((n) => n.label === 'alice')).toBe(true);
		expect(f.nodes.some((n) => n.label === 'bob')).toBe(false);
	});
});

describe('neighboursOf', () => {
	const users = [user('alice')];
	const nodes = [node('1', 'alice-laptop', users[0], ['tag:web'])];
	const g = buildGraph(users, nodes, {
		groups: {},
		tagOwners: {},
		hosts: {},
		acls: [],
		ssh: [],
	});

	it('returns nodes connected by any edge, in either direction', () => {
		const n = neighboursOf(g, nodeId('1'));
		expect(n.has(userId('alice'))).toBe(true);
		expect(n.has(tagId('tag:web'))).toBe(true);
	});

	it('returns empty for isolated nodes', () => {
		expect(neighboursOf(g, 'does-not-exist').size).toBe(0);
	});
});

describe('layoutGraph', () => {
	const users = [user('alice'), user('bob')];
	const nodes = [
		node('1', 'alice-laptop', users[0]),
		node('2', 'bob-server', users[1], ['tag:web']),
	];
	const g = buildGraph(users, nodes, sampleAcl);

	it('assigns an (x,y) to every graph node', () => {
		const laid = layoutGraph(g);
		expect(laid.nodes.length).toBe(g.nodes.length);
		for (const n of laid.nodes) {
			expect(Number.isFinite(n.x)).toBe(true);
			expect(Number.isFinite(n.y)).toBe(true);
		}
	});

	it('places nodes of the same kind in a single column (shared x)', () => {
		const laid = layoutGraph(g);
		const userXs = new Set(laid.nodes.filter((n) => n.kind === 'user').map((n) => n.x));
		expect(userXs.size).toBe(1);
		const tagXs = new Set(laid.nodes.filter((n) => n.kind === 'tag').map((n) => n.x));
		expect(tagXs.size).toBe(1);
	});

	it('places kinds in the documented left-to-right order', () => {
		const laid = layoutGraph(g);
		const xOf = (k: string) => laid.nodes.find((n) => n.kind === k)?.x ?? 0;
		expect(xOf('user')).toBeLessThan(xOf('group'));
		expect(xOf('group')).toBeLessThan(xOf('tag'));
		expect(xOf('tag')).toBeLessThan(xOf('node'));
	});

	it('is deterministic for identical input', () => {
		const a = layoutGraph(g);
		const b = layoutGraph(g);
		expect(a.nodes.map((n) => [n.id, n.x, n.y])).toEqual(b.nodes.map((n) => [n.id, n.x, n.y]));
	});
});
