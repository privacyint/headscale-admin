/**
 * Lightweight mock Headscale API server.
 *
 * Responds to the endpoints the headscale-admin frontend actually calls,
 * returning realistic fixture data that matches the openapiv2.json schema
 * and the TypeScript types in src/lib/common/types.ts.
 *
 * Usage:
 *   node e2e/mock-api.mjs          # listens on :8081
 *   MOCK_PORT=9999 node e2e/mock-api.mjs
 *
 * Auth:
 *   Any request with `Authorization: Bearer test-api-key` is authorised.
 *   Anything else gets 401 "Unauthorized".
 */

import { createServer } from 'node:http';

const PORT = parseInt(process.env.MOCK_PORT ?? '8081', 10);
const VALID_KEY = 'test-api-key';

// ── Fixture data ────────────────────────────────────────────────────────────

const baseUsers = [
  {
    id: '1',
    name: 'alice',
    createdAt: '2025-01-01T00:00:00Z',
    displayName: 'Alice',
    email: '',
    providerId: '',
    provider: 'local',
    profilePicUrl: '',
  },
  {
    id: '2',
    name: 'bob',
    createdAt: '2025-02-01T00:00:00Z',
    displayName: 'Bob',
    email: '',
    providerId: '',
    provider: 'local',
    profilePicUrl: '',
  },
];

/** Virtual user that Headscale assigns to nodes carrying tags. */
const taggedDevicesUser = {
  id: '2147455555',
  name: 'tagged-devices',
  createdAt: '0001-01-01T00:00:00Z',
  displayName: 'Tagged Devices',
  email: '',
  providerId: '',
  provider: '',
  profilePicUrl: '',
};

function createNodes(users) {
  return [
    {
      id: '1',
      machineKey: 'mkey:abc123',
      nodeKey: 'nodekey:def456',
      discoKey: 'discokey:ghi789',
      ipAddresses: ['100.64.0.1', 'fd7a:115c:a1e0::1'],
      name: 'alice-laptop',
      user: users[0],
      lastSeen: new Date().toISOString(),
      expiry: '0001-01-01T00:00:00Z',
      preAuthKey: null,
      createdAt: '2025-01-10T00:00:00Z',
      registerMethod: 'REGISTER_METHOD_CLI',
      givenName: 'alice-laptop',
      online: true,
      approvedRoutes: [],
      availableRoutes: ['10.0.0.0/24'],
      subnetRoutes: [],
      tags: [],
    },
    {
      id: '2',
      machineKey: 'mkey:xyz321',
      nodeKey: 'nodekey:uvw654',
      discoKey: 'discokey:rst987',
      ipAddresses: ['100.64.0.2', 'fd7a:115c:a1e0::2'],
      name: 'bob-server',
      user: users[1],
      lastSeen: new Date(Date.now() - 86_400_000).toISOString(),
      expiry: '0001-01-01T00:00:00Z',
      preAuthKey: null,
      createdAt: '2025-02-10T00:00:00Z',
      registerMethod: 'REGISTER_METHOD_AUTH_KEY',
      givenName: 'bob-server',
      online: false,
      approvedRoutes: ['10.1.0.0/24'],
      availableRoutes: ['10.1.0.0/24', '10.2.0.0/24'],
      subnetRoutes: [],
      tags: ['tag:server'],
    },
    {
      id: '3',
      machineKey: 'mkey:jkl111',
      nodeKey: 'nodekey:mno222',
      discoKey: 'discokey:pqr333',
      ipAddresses: ['100.64.0.3', 'fd7a:115c:a1e0::3'],
      name: 'infra-gateway',
      user: users[0],
      lastSeen: new Date().toISOString(),
      expiry: '0001-01-01T00:00:00Z',
      preAuthKey: null,
      createdAt: '2025-03-10T00:00:00Z',
      registerMethod: 'REGISTER_METHOD_AUTH_KEY',
      givenName: 'infra-gateway',
      online: true,
      approvedRoutes: [],
      availableRoutes: [],
      subnetRoutes: [],
      tags: ['tag:server', 'tag:infra'],
    },
    // Tagged-device node: originally owned by alice, now under tagged-devices
    {
      id: '4',
      machineKey: 'mkey:tag001',
      nodeKey: 'nodekey:tag002',
      discoKey: 'discokey:tag003',
      ipAddresses: ['100.64.0.4', 'fd7a:115c:a1e0::4'],
      name: 'alice-tagged-node',
      user: taggedDevicesUser,
      lastSeen: new Date().toISOString(),
      expiry: '0001-01-01T00:00:00Z',
      preAuthKey: null,
      createdAt: '2025-04-01T00:00:00Z',
      registerMethod: 'REGISTER_METHOD_AUTH_KEY',
      givenName: 'alice-tagged-node',
      online: true,
      approvedRoutes: [],
      availableRoutes: [],
      subnetRoutes: [],
      tags: ['tag:manual'],
    },
  ];
}

/**
 * Map of user name → node IDs that the server considers owned by that user
 * (even if the node's .user is tagged-devices).
 */
const userNodeMap = {
  alice: ['1', '3', '4'],
  bob: ['2'],
};

function createPreAuthKeys(users) {
  return [
    {
      user: users[0],
      id: '1',
      key: 'pak_alice_0001',
      reusable: false,
      ephemeral: false,
      used: false,
      expiration: new Date(Date.now() + 86_400_000 * 30).toISOString(),
      createdAt: '2025-03-01T00:00:00Z',
      aclTags: [],
    },
  ];
}

function createApiKeys() {
  return [
    {
      id: '1',
      createdAt: '2025-01-01T00:00:00Z',
      prefix: 'test-api-key'.slice(0, 10),
      expiration: new Date(Date.now() + 86_400_000 * 90).toISOString(),
      lastSeen: new Date().toISOString(),
    },
  ];
}

let users;
let nodes;
let preAuthKeys;
let apiKeys;

function resetState() {
  users = structuredClone(baseUsers);
  nodes = createNodes(users);
  preAuthKeys = createPreAuthKeys(users);
  apiKeys = createApiKeys();
}

resetState();

const policy = JSON.stringify({
  groups: { 'group:admin': ['alice'] },
  hosts: {},
  acls: [{ action: 'accept', src: ['group:admin'], dst: ['*:*'] }],
  tagOwners: {},
  ssh: [],
});

const versionInfo = {
  version: 'v0.28.0',
  commit: '97fa117c48a58bee3941e5e8b4393873501afe14',
  buildTime: '2026-02-04T20:26:22Z',
  go: {
    version: 'go1.25.5',
    os: 'linux',
    arch: 'amd64',
  },
};

const healthInfo = {
  databaseConnectivity: true,
};

// ── Router ──────────────────────────────────────────────────────────────────

function isAuthorised(req) {
  const auth = req.headers['authorization'] ?? '';
  return auth === `Bearer ${VALID_KEY}`;
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function unauthorized(res) {
  res.writeHead(401, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
  res.end('Unauthorized');
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ code: 5, message: 'Not Found', details: [] }));
}

function cors(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Max-Age': '3600',
  });
  res.end();
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    return cors(res);
  }

  // Health check — used by CI readiness probe
  if (path === '/healthz') {
    return json(res, { status: 'ok' });
  }

  // Version endpoint (public, no auth required on real Headscale)
  if (method === 'GET' && path === '/version') {
    return json(res, versionInfo);
  }

  if (method === 'POST' && path === '/test/reset') {
    resetState();
    return json(res, { status: 'reset' });
  }

  // Auth check
  if (!isAuthorised(req)) {
    return unauthorized(res);
  }

  // ── GET endpoints ───────────────────────────────────────────────────────
  if (method === 'GET') {
    if (path === '/api/v1/user')       return json(res, { users });
    if (path === '/api/v1/node') {
      const userParam = url.searchParams.get('user');
      if (userParam) {
        // Filter nodes by real owner (simulates Headscale's ?user= behaviour)
        const ids = userNodeMap[userParam] ?? [];
        return json(res, { nodes: nodes.filter((n) => ids.includes(n.id)) });
      }
      return json(res, { nodes });
    }
    if (path === '/api/v1/preauthkey') return json(res, { preAuthKeys });
    if (path === '/api/v1/apikey')     return json(res, { apiKeys });
    if (path === '/api/v1/policy')     return json(res, { policy, updatedAt: new Date().toISOString() });
    if (path === '/api/v1/health')     return json(res, healthInfo);

    // Single node GET: /api/v1/node/{id}
    const nodeMatch = path.match(/^\/api\/v1\/node\/(\d+)$/);
    if (nodeMatch) {
      const node = nodes.find((n) => n.id === nodeMatch[1]);
      return node ? json(res, { node }) : notFound(res);
    }
  }

  // ── POST endpoints ──────────────────────────────────────────────────────
  if (method === 'POST') {
    if (path === '/api/v1/user')             return json(res, { user: { ...users[0], id: '99', name: 'new-user' } });
    if (path === '/api/v1/preauthkey') {
      // Parse request body to create appropriate preauth key
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const user = data.user ? users.find(u => u.id === data.user) : null;
          const aclTags = data.aclTags || [];
          const newKey = {
            user,
            id: String(preAuthKeys.length + 1),
            key: `pak_${user ? user.name : aclTags.length > 0 ? 'tagged' : 'global'}_${Date.now()}`,
            reusable: data.reusable || false,
            ephemeral: data.ephemeral || false,
            used: false,
            expiration: data.expiration || new Date(Date.now() + 86_400_000).toISOString(),
            createdAt: new Date().toISOString(),
            aclTags,
          };
          preAuthKeys.push(newKey);
          return json(res, { preAuthKey: newKey });
        } catch (e) {
          return json(res, { preAuthKey: preAuthKeys[0] });
        }
      });
      return; // Async handling
    }
    if (path === '/api/v1/apikey')           return json(res, { apiKey: 'new-api-key-value' });
    if (path === '/api/v1/apikey/expire')    return json(res, {});

    // Node routes, rename, expire, tags
    const approveMatch = path.match(/^\/api\/v1\/node\/(\d+)\/approve_routes$/);
    if (approveMatch) {
      const node = nodes.find((n) => n.id === approveMatch[1]);
      if (node) return json(res, { node: { ...node } });
      return notFound(res);
    }
    const expireMatch = path.match(/^\/api\/v1\/node\/(\d+)\/expire$/);
    if (expireMatch) {
      const node = nodes.find((n) => n.id === expireMatch[1]);
      if (node) return json(res, { node: { ...node, online: false } });
      return notFound(res);
    }
    const renameNodeMatch = path.match(/^\/api\/v1\/node\/(\d+)\/rename\/(.+)$/);
    if (renameNodeMatch) {
      const node = nodes.find((n) => n.id === renameNodeMatch[1]);
      if (node) return json(res, { node: { ...node, givenName: renameNodeMatch[2] } });
      return notFound(res);
    }
    const tagsMatch = path.match(/^\/api\/v1\/node\/(\d+)\/tags$/);
    if (tagsMatch) {
      const node = nodes.find((n) => n.id === tagsMatch[1]);
      if (node) return json(res, { node: { ...node } });
      return notFound(res);
    }
    const renameUserMatch = path.match(/^\/api\/v1\/user\/(\d+)\/rename\/(.+)$/);
    if (renameUserMatch) {
      const user = users.find((u) => u.id === renameUserMatch[1]);
      if (user) return json(res, { user: { ...user, name: renameUserMatch[2] } });
      return notFound(res);
    }
    // Node register: /api/v1/node/register?user=...&key=...
    if (path === '/api/v1/node/register') {
      return json(res, { node: { ...nodes[0], id: '99', givenName: 'new-node' } });
    }
  }

  // ── PUT endpoints ───────────────────────────────────────────────────────
  if (method === 'PUT') {
    if (path === '/api/v1/policy') return json(res, { policy, updatedAt: new Date().toISOString() });
  }

  // ── DELETE endpoints ────────────────────────────────────────────────────
  if (method === 'DELETE') {
    const deleteUserMatch = path.match(/^\/api\/v1\/user\/(\d+)$/);
    if (deleteUserMatch) return json(res, {});
    const deleteNodeMatch = path.match(/^\/api\/v1\/node\/(\d+)$/);
    if (deleteNodeMatch) return json(res, {});
    if (path === '/api/v1/preauthkey') {
      const id = url.searchParams.get('id');
      if (!id) {
        return notFound(res);
      }
      const index = preAuthKeys.findIndex(pak => pak.id === id);
      if (index !== -1) {
        preAuthKeys.splice(index, 1);
        return json(res, {});
      }
      return notFound(res);
    }
  }

  return notFound(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock Headscale API running on http://0.0.0.0:${PORT}`);
});
