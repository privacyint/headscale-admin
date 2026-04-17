import { describe, it, expect } from 'vitest';
import {
	arraysEqual,
	clone,
	isExpired,
	isValidTag,
	isValidCIDR,
	setsEqual,
	getTimeDifference,
	getTime,
	getTimeDifferenceColor,
	deduplicate,
	dateToStr,
	getSortedUsers,
	getSortedNodes,
	getTagsFromNodes,
	getSortedTags,
	filterTag,
	getSortedFilteredTags,
} from '$lib/common/funcs';
import type { User, Node, Tag } from '$lib/common/types';

// ---- clone ----

describe('clone', () => {
	it('produces a deep copy', () => {
		const original = { a: 1, nested: { b: 2 } };
		const copy = clone(original);
		expect(copy).toEqual(original);
		copy.nested.b = 99;
		expect(original.nested.b).toBe(2);
	});
});

// ---- arraysEqual ----

describe('arraysEqual', () => {
	it('returns true for identical primitive arrays', () => {
		expect(arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
	});

	it('returns false when lengths differ', () => {
		expect(arraysEqual([1], [1, 2])).toBe(false);
	});

	it('returns false when values differ', () => {
		expect(arraysEqual([1, 2], [1, 3])).toBe(false);
	});

	it('returns true for empty arrays', () => {
		expect(arraysEqual([], [])).toBe(true);
	});
});

// ---- setsEqual ----

describe('setsEqual', () => {
	it('returns true for identical sets', () => {
		expect(setsEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true);
	});

	it('returns false when sizes differ', () => {
		expect(setsEqual(new Set([1]), new Set([1, 2]))).toBe(false);
	});

	it('returns false when values differ', () => {
		expect(setsEqual(new Set([1, 3]), new Set([1, 2]))).toBe(false);
	});
});

// ---- isExpired ----

describe('isExpired', () => {
	it('treats a past date as expired', () => {
		expect(isExpired('2000-01-01T00:00:00Z')).toBe(true);
	});

	it('treats a future date as not expired', () => {
		const future = new Date(Date.now() + 86_400_000).toISOString();
		expect(isExpired(future)).toBe(false);
	});

	it('treats the zero date as never-expiring', () => {
		expect(isExpired('0001-01-01T00:00:00Z')).toBe(false);
	});
});

// ---- isValidTag ----

describe('isValidTag', () => {
	it('accepts lowercase alphanumeric with dashes/underscores', () => {
		expect(isValidTag('my-tag_1')).toBe(true);
	});

	it('rejects uppercase', () => {
		expect(isValidTag('MyTag')).toBe(false);
	});

	it('rejects spaces', () => {
		expect(isValidTag('my tag')).toBe(false);
	});

	it('rejects empty string', () => {
		expect(isValidTag('')).toBe(false);
	});
});

// ---- isValidCIDR ----

describe('isValidCIDR', () => {
	it('accepts a valid IPv4 CIDR', () => {
		expect(isValidCIDR('10.0.0.0/8')).toBe(true);
	});

	it('rejects an address with host bits set', () => {
		expect(isValidCIDR('10.0.0.1/8')).toBe(false);
	});

	it('rejects non-CIDR strings', () => {
		expect(isValidCIDR('not-a-cidr')).toBe(false);
	});
});

// ---- getTimeDifference ----

describe('getTimeDifference', () => {
	it('reports a future time correctly', () => {
		const future = Date.now() + 3_600_000; // +1 hour
		const result = getTimeDifference(future);
		expect(result.future).toBe(true);
		expect(result.finite).toBe(true);
		expect(result.message).toContain('hour');
	});

	it('reports a past time correctly', () => {
		const past = Date.now() - 86_400_000 * 3; // -3 days
		const result = getTimeDifference(past);
		expect(result.future).toBe(false);
		expect(result.finite).toBe(true);
		expect(result.message).toContain('day');
	});

	it('treats the infinite date as non-finite', () => {
		const result = getTimeDifference(new Date('0001-01-01T00:00:00Z').getTime());
		expect(result.finite).toBe(false);
	});
});

// ---- getTimeDifferenceColor ----

describe('getTimeDifferenceColor', () => {
	it('returns success colour for future finite times', () => {
		const color = getTimeDifferenceColor({ future: true, finite: true, message: '' });
		expect(color).toContain('success');
	});

	it('returns error colour for past finite times', () => {
		const color = getTimeDifferenceColor({ future: false, finite: true, message: '' });
		expect(color).toContain('error');
	});
});

// ---- deduplicate ----

describe('deduplicate', () => {
	it('removes duplicate values', () => {
		expect(deduplicate([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
	});

	it('returns empty for empty', () => {
		expect(deduplicate([])).toEqual([]);
	});
});

// ---- dateToStr ----

describe('dateToStr', () => {
	it('formats a Date object to a string', () => {
		const result = dateToStr(new Date('2024-06-15T14:30:00Z'));
		expect(typeof result).toBe('string');
		expect(result.length).toBeGreaterThan(0);
	});

	it('accepts an ISO string', () => {
		const result = dateToStr('2024-06-15T14:30:00Z');
		expect(typeof result).toBe('string');
	});
});

// ---- getSortedUsers ----

describe('getSortedUsers', () => {
	const users = [
		{ id: '2', name: 'bravo' },
		{ id: '1', name: 'alpha' },
		{ id: '3', name: 'charlie' },
	] as User[];

	it('sorts by id ascending', () => {
		const sorted = getSortedUsers([...users], 'id', 'up');
		expect(sorted.map((u) => u.id)).toEqual(['1', '2', '3']);
	});

	it('sorts by name ascending', () => {
		const sorted = getSortedUsers([...users], 'name', 'up');
		expect(sorted.map((u) => u.name)).toEqual(['alpha', 'bravo', 'charlie']);
	});

	it('reverses when direction is down', () => {
		const sorted = getSortedUsers([...users], 'id', 'down');
		expect(sorted.map((u) => u.id)).toEqual(['3', '2', '1']);
	});
});

// ---- getSortedNodes ----

describe('getSortedNodes', () => {
	const nodes = [
		{ id: '2', givenName: 'beta', user: { name: 'b' } },
		{ id: '1', givenName: 'alpha', user: { name: 'a' } },
		{ id: '3', givenName: 'gamma', user: { name: 'c' } },
	] as unknown as Node[];

	it('sorts by id ascending', () => {
		const sorted = getSortedNodes([...nodes], 'id', 'up');
		expect(sorted.map((n) => n.id)).toEqual(['1', '2', '3']);
	});

	it('sorts by givenName ascending', () => {
		const sorted = getSortedNodes([...nodes], 'name', 'up');
		expect(sorted.map((n) => n.givenName)).toEqual(['alpha', 'beta', 'gamma']);
	});
});

// ---- Tag helpers ----

function makeNode(overrides: Partial<Node> & { id: string; givenName: string; name: string; tags: string[] }): Node {
	return {
		machineKey: '',
		nodeKey: '',
		discoKey: '',
		ipAddresses: [],
		user: { id: '1', name: 'alice', createdAt: '', displayName: '', email: '', providerId: '', provider: 'local', profilePicUrl: '' },
		lastSeen: null,
		expiry: null,
		preAuthKey: null,
		createdAt: '2025-01-01T00:00:00Z',
		registerMethod: 'REGISTER_METHOD_CLI',
		online: false,
		approvedRoutes: [],
		availableRoutes: [],
		subnetRoutes: [],
		...overrides,
	} as Node;
}

describe('getTagsFromNodes', () => {
	it('returns empty array when no nodes have tags', () => {
		const nodes = [makeNode({ id: '1', name: 'a', givenName: 'a', tags: [] })];
		expect(getTagsFromNodes(nodes)).toEqual([]);
	});

	it('groups nodes by tag', () => {
		const nodes = [
			makeNode({ id: '1', name: 'a', givenName: 'a', tags: ['tag:web'] }),
			makeNode({ id: '2', name: 'b', givenName: 'b', tags: ['tag:web', 'tag:db'] }),
			makeNode({ id: '3', name: 'c', givenName: 'c', tags: ['tag:db'] }),
		];
		const tags = getTagsFromNodes(nodes);
		expect(tags).toHaveLength(2);

		const webTag = tags.find((t) => t.name === 'tag:web');
		expect(webTag).toBeDefined();
		expect(webTag!.nodes).toHaveLength(2);

		const dbTag = tags.find((t) => t.name === 'tag:db');
		expect(dbTag).toBeDefined();
		expect(dbTag!.nodes).toHaveLength(2);
	});

	it('adds tag: prefix if missing', () => {
		const nodes = [makeNode({ id: '1', name: 'a', givenName: 'a', tags: ['server'] })];
		const tags = getTagsFromNodes(nodes);
		expect(tags[0].name).toBe('tag:server');
	});
});

describe('filterTag', () => {
	const webTag: Tag = {
		name: 'tag:web',
		nodes: [
			makeNode({ id: '1', name: 'web1', givenName: 'web-server-1', tags: ['tag:web'], online: true }),
			makeNode({ id: '2', name: 'web2', givenName: 'web-server-2', tags: ['tag:web'], online: false }),
		],
	};

	it('returns true for empty filter string', () => {
		expect(filterTag(webTag, '')).toBe(true);
	});

	it('matches tag name', () => {
		expect(filterTag(webTag, 'web')).toBe(true);
	});

	it('matches node givenName', () => {
		expect(filterTag(webTag, 'web-server-1')).toBe(true);
	});

	it('returns false for non-matching filter', () => {
		expect(filterTag(webTag, 'database')).toBe(false);
	});

	it('filters by online status', () => {
		expect(filterTag(webTag, '', 'online')).toBe(true);

		const offlineTag: Tag = {
			name: 'tag:offline',
			nodes: [makeNode({ id: '3', name: 'off', givenName: 'offline-node', tags: ['tag:offline'], online: false })],
		};
		expect(filterTag(offlineTag, '', 'online')).toBe(false);
		expect(filterTag(offlineTag, '', 'offline')).toBe(true);
	});
});

describe('getSortedTags', () => {
	const tags: Tag[] = [
		{ name: 'tag:db', nodes: [makeNode({ id: '1', name: 'a', givenName: 'a', tags: [] })] },
		{ name: 'tag:web', nodes: [
			makeNode({ id: '2', name: 'b', givenName: 'b', tags: [] }),
			makeNode({ id: '3', name: 'c', givenName: 'c', tags: [] }),
		]},
		{ name: 'tag:api', nodes: [] },
	];

	it('sorts by name ascending', () => {
		const sorted = getSortedTags([...tags], 'name', 'up');
		expect(sorted.map((t) => t.name)).toEqual(['tag:api', 'tag:db', 'tag:web']);
	});

	it('sorts by name descending', () => {
		const sorted = getSortedTags([...tags], 'name', 'down');
		expect(sorted.map((t) => t.name)).toEqual(['tag:web', 'tag:db', 'tag:api']);
	});

	it('sorts by node count ascending', () => {
		const sorted = getSortedTags([...tags], 'nodes', 'up');
		expect(sorted.map((t) => t.nodes.length)).toEqual([0, 1, 2]);
	});

	it('sorts by node count descending', () => {
		const sorted = getSortedTags([...tags], 'nodes', 'down');
		expect(sorted.map((t) => t.nodes.length)).toEqual([2, 1, 0]);
	});
});

describe('getSortedFilteredTags', () => {
	const tags: Tag[] = [
		{ name: 'tag:web', nodes: [makeNode({ id: '1', name: 'w', givenName: 'web1', tags: [], online: true })] },
		{ name: 'tag:db', nodes: [makeNode({ id: '2', name: 'd', givenName: 'db1', tags: [], online: false })] },
	];

	it('filters and sorts combined', () => {
		const result = getSortedFilteredTags(tags, 'web', 'name', 'up', 'all');
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('tag:web');
	});

	it('filters by online status and sorts', () => {
		const result = getSortedFilteredTags(tags, '', 'name', 'up', 'online');
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('tag:web');
	});
});
