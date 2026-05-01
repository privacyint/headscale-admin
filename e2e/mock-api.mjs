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
 *
 * Fixture scope (approximate):
 *   • 25 regular users  (various providers, display names, empty fields)
 *   • 85 nodes          (distributed unevenly across users + tagged-devices)
 *   • 14 distinct tags
 *   • 20 nodes owned only by tagged-devices (orphaned)
 *   •  6 exit nodes     (dual-stack, IPv4-only, IPv6-only, unapproved)
 *   •  8 route-only nodes (mix of RFC1918, IPv6 ULA, overlapping, huge prefix)
 *   • Various expiry states, register methods, online/offline mix
 */

import { createServer } from 'node:http';

const PORT = parseInt(process.env.MOCK_PORT ?? '8081', 10);
const VALID_KEY = 'test-api-key';

// ── Fixture helpers ──────────────────────────────────────────────────────────

const ago = (ms) => new Date(Date.now() - ms).toISOString();
const future = (ms) => new Date(Date.now() + ms).toISOString();
const MIN  = 60_000;
const HOUR = 3_600_000;
const DAY  = 86_400_000;

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

// ── Base users ───────────────────────────────────────────────────────────────
// 25 users: mix of providers, display names, emails, empty fields.

const baseUsers = [
  // ── local users ────────────────────────────────────────────────────────
  { id:  '1', name: 'alice',       createdAt: '2024-01-01T00:00:00Z', displayName: 'Alice Andersen',   email: 'alice@example.com',   providerId: '',         provider: 'local', profilePicUrl: '' },
  { id:  '2', name: 'bob',         createdAt: '2024-01-15T00:00:00Z', displayName: 'Bob Baker',        email: 'bob@example.com',     providerId: '',         provider: 'local', profilePicUrl: '' },
  { id:  '3', name: 'carol',       createdAt: '2024-02-01T00:00:00Z', displayName: 'Carol Chen',       email: 'carol@corp.example',  providerId: '',         provider: 'local', profilePicUrl: '' },
  { id:  '4', name: 'dave',        createdAt: '2024-02-14T00:00:00Z', displayName: 'Dave Deschamps',   email: '',                    providerId: '',         provider: 'local', profilePicUrl: '' },
  { id:  '5', name: 'eve',         createdAt: '2024-03-01T00:00:00Z', displayName: '',                 email: '',                    providerId: '',         provider: 'local', profilePicUrl: '' },
  // ── OIDC / Google ──────────────────────────────────────────────────────
  { id:  '6', name: 'frank.garcia', createdAt: '2024-03-10T00:00:00Z', displayName: 'Frank García',   email: 'frank@google-user.example', providerId: 'google-oauth2|1234567890', provider: 'oidc', profilePicUrl: 'https://example.com/frank.jpg' },
  { id:  '7', name: 'grace',        createdAt: '2024-03-20T00:00:00Z', displayName: 'Grace Hopper',   email: 'grace@example.com',   providerId: 'google-oauth2|9876543210', provider: 'oidc', profilePicUrl: '' },
  // ── OIDC / Azure AD ────────────────────────────────────────────────────
  { id:  '8', name: 'heidi',        createdAt: '2024-04-01T00:00:00Z', displayName: 'Heidi Schmidt',  email: 'heidi@corp.onmicrosoft.com', providerId: 'aad|abc-def-ghi', provider: 'oidc', profilePicUrl: '' },
  { id:  '9', name: 'ivan',         createdAt: '2024-04-10T00:00:00Z', displayName: '',               email: 'ivan@corp.onmicrosoft.com',  providerId: 'aad|jkl-mno-pqr', provider: 'oidc', profilePicUrl: '' },
  // ── local, no display name, no email ─────────────────────────────────
  { id: '10', name: 'judy',         createdAt: '2024-05-01T00:00:00Z', displayName: '',               email: '',                    providerId: '',         provider: 'local', profilePicUrl: '' },
  { id: '11', name: 'kim',          createdAt: '2024-05-15T00:00:00Z', displayName: 'Kim Lee',        email: 'kim@example.com',     providerId: '',         provider: 'local', profilePicUrl: '' },
  { id: '12', name: 'liam',         createdAt: '2024-06-01T00:00:00Z', displayName: 'Liam O\'Brien',  email: '',                    providerId: '',         provider: 'local', profilePicUrl: '' },
  { id: '13', name: 'mallory',      createdAt: '2024-06-15T00:00:00Z', displayName: 'Mallory Martin', email: 'mallory@example.com', providerId: '',         provider: 'local', profilePicUrl: '' },
  { id: '14', name: 'niaj',         createdAt: '2024-07-01T00:00:00Z', displayName: 'Niaj Nowak',     email: '',                    providerId: '',         provider: 'local', profilePicUrl: '' },
  { id: '15', name: 'olivia',       createdAt: '2024-07-20T00:00:00Z', displayName: 'Olivia Osei',    email: 'olivia@example.com',  providerId: '',         provider: 'local', profilePicUrl: '' },
  // ── long name edge-case ────────────────────────────────────────────────
  { id: '16', name: 'peter-the-very-long-username-that-may-overflow-ui', createdAt: '2024-08-01T00:00:00Z', displayName: 'Peter Papadopoulos-Konstantinidis', email: 'peter@example.com', providerId: '', provider: 'local', profilePicUrl: '' },
  // ── service / automation accounts ─────────────────────────────────────
  { id: '17', name: 'ci-bot',       createdAt: '2024-08-10T00:00:00Z', displayName: 'CI Bot',         email: '',                    providerId: '',         provider: 'local', profilePicUrl: '' },
  { id: '18', name: 'deploy-svc',   createdAt: '2024-08-20T00:00:00Z', displayName: 'Deploy Service', email: '',                    providerId: '',         provider: 'local', profilePicUrl: '' },
  // ── OIDC / GitHub ──────────────────────────────────────────────────────
  { id: '19', name: 'quinn',        createdAt: '2024-09-01T00:00:00Z', displayName: 'Quinn Rivera',   email: 'quinn@github-user.example', providerId: 'github|55443322', provider: 'oidc', profilePicUrl: 'https://example.com/quinn.png' },
  { id: '20', name: 'ruth',         createdAt: '2024-09-10T00:00:00Z', displayName: 'Ruth Rubio',     email: 'ruth@github-user.example',  providerId: 'github|11223344', provider: 'oidc', profilePicUrl: '' },
  // ── unicode / special chars ────────────────────────────────────────────
  { id: '21', name: 'sven',         createdAt: '2024-10-01T00:00:00Z', displayName: 'Sven Åström',    email: 'sven@example.se',     providerId: '',         provider: 'local', profilePicUrl: '' },
  { id: '22', name: 'tanya',        createdAt: '2024-10-15T00:00:00Z', displayName: 'Tánya Волкова', email: '',                    providerId: '',         provider: 'local', profilePicUrl: '' },
  // ── recently-created user with no nodes yet ────────────────────────────
  { id: '23', name: 'ulrich',       createdAt: '2026-04-28T00:00:00Z', displayName: 'Ulrich Unger',   email: '',                    providerId: '',         provider: 'local', profilePicUrl: '' },
  // ── user whose account was created at the Unix epoch boundary ─────────
  { id: '24', name: 'vera',         createdAt: '1970-01-01T00:00:01Z', displayName: '',               email: 'vera@legacy.example', providerId: '',         provider: 'local', profilePicUrl: '' },
  // ── numeric-heavy name ─────────────────────────────────────────────────
  { id: '25', name: 'user-42',      createdAt: '2024-11-01T00:00:00Z', displayName: '',               email: '',                    providerId: '',         provider: 'local', profilePicUrl: '' },
];

// ── Node factory ─────────────────────────────────────────────────────────────

let _nodeId = 0;
function node(overrides) {
  _nodeId++;
  const id = String(_nodeId);
  return {
    id,
    machineKey:  `mkey:${id.padStart(6,'0')}aabbccdd`,
    nodeKey:     `nodekey:${id.padStart(6,'0')}eeff0011`,
    discoKey:    `discokey:${id.padStart(6,'0')}22334455`,
    ipAddresses: [`100.64.${Math.floor((_nodeId-1)/254)}.${((_nodeId-1)%254)+1}`,
                  `fd7a:115c:a1e0::${_nodeId.toString(16)}`],
    expiry: '0001-01-01T00:00:00Z',
    preAuthKey: null,
    registerMethod: 'REGISTER_METHOD_CLI',
    online: true,
    approvedRoutes: [],
    availableRoutes: [],
    subnetRoutes: [],
    tags: [],
    ...overrides,
    // givenName defaults to name when not supplied
    givenName: overrides.givenName ?? overrides.name,
  };
}

function createNodes(users) {
  // Lookup by 1-based index into baseUsers array
  const u = (idx) => users[idx - 1];

  return [
    // ─────────────────────────────────────────────────────────────────────
    // GROUP A: Regular personal workstations / laptops — mixed online state
    // ─────────────────────────────────────────────────────────────────────
    node({ name: 'alice-laptop',    user: u(1), lastSeen: ago(2*MIN),    createdAt: '2024-01-10T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI',      online: true,  availableRoutes: ['10.10.0.0/24'] }),
    node({ name: 'alice-desktop',   user: u(1), lastSeen: ago(30*MIN),   createdAt: '2024-02-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  availableRoutes: [] }),
    node({ name: 'alice-iphone',    user: u(1), lastSeen: ago(3*HOUR),   createdAt: '2024-03-15T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC',     online: false, availableRoutes: [] }),
    // Alice node with expiry in the future
    node({ name: 'alice-work-vm',   user: u(1), lastSeen: ago(5*MIN),    createdAt: '2024-06-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  expiry: future(30*DAY), availableRoutes: [] }),
    // Alice node with expiry in the past (expired)
    node({ name: 'alice-old-mbp',   user: u(1), lastSeen: ago(60*DAY),   createdAt: '2023-06-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI',      online: false, expiry: ago(45*DAY),   availableRoutes: [] }),

    node({ name: 'bob-thinkpad',    user: u(2), lastSeen: ago(10*MIN),   createdAt: '2024-01-20T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI',      online: true,  availableRoutes: ['192.168.10.0/24'] }),
    node({ name: 'bob-nuc',         user: u(2), lastSeen: ago(2*DAY),    createdAt: '2024-02-15T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false, availableRoutes: ['192.168.20.0/24', '192.168.30.0/24'] }),
    node({ name: 'bob-android',     user: u(2), lastSeen: ago(1*HOUR),   createdAt: '2024-05-10T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC',     online: true,  availableRoutes: [] }),

    node({ name: 'carol-macbook',   user: u(3), lastSeen: ago(20*MIN),   createdAt: '2024-02-10T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC',     online: true,  availableRoutes: [] }),
    node({ name: 'carol-devbox',    user: u(3), lastSeen: ago(4*HOUR),   createdAt: '2024-04-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false, availableRoutes: ['172.16.0.0/12'] }),

    node({ name: 'dave-laptop',     user: u(4), lastSeen: ago(1*MIN),    createdAt: '2024-02-20T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI',      online: true,  availableRoutes: [] }),
    node({ name: 'dave-nas',        user: u(4), lastSeen: ago(15*MIN),   createdAt: '2024-03-05T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  availableRoutes: ['10.20.0.0/16'] }),
    node({ name: 'dave-pi',         user: u(4), lastSeen: ago(7*DAY),    createdAt: '2024-04-10T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false, availableRoutes: [] }),

    // eve: no display name, no email — only one node, currently offline
    node({ name: 'eve-only-node',   user: u(5), lastSeen: ago(90*DAY),   createdAt: '2024-03-10T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI',      online: false, availableRoutes: [] }),

    // frank: OIDC user, multiple devices
    node({ name: 'frank-macpro',    user: u(6), lastSeen: ago(3*MIN),    createdAt: '2024-03-15T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC',     online: true,  availableRoutes: [] }),
    node({ name: 'frank-linux-vm',  user: u(6), lastSeen: ago(25*MIN),   createdAt: '2024-05-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  availableRoutes: [] }),
    node({ name: 'frank-ipad',      user: u(6), lastSeen: ago(6*HOUR),   createdAt: '2024-07-15T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC',     online: false, availableRoutes: [] }),

    node({ name: 'grace-workstation', user: u(7), lastSeen: ago(8*MIN),  createdAt: '2024-03-25T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC',    online: true,  availableRoutes: [] }),

    node({ name: 'heidi-surface',   user: u(8), lastSeen: ago(45*MIN),   createdAt: '2024-04-05T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC',     online: false, availableRoutes: [] }),
    node({ name: 'heidi-server',    user: u(8), lastSeen: ago(5*MIN),    createdAt: '2024-05-20T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  availableRoutes: ['10.30.0.0/24'] }),

    // ivan: no display name, OIDC, expiry near
    node({ name: 'ivan-laptop',     user: u(9), lastSeen: ago(10*MIN),   createdAt: '2024-04-15T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC',     online: true,  expiry: future(3*DAY), availableRoutes: [] }),

    node({ name: 'judy-chromebook', user: u(10), lastSeen: ago(2*HOUR),  createdAt: '2024-05-05T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC',    online: false, availableRoutes: [] }),
    node({ name: 'judy-desktop',    user: u(10), lastSeen: ago(12*MIN),  createdAt: '2024-06-10T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI',     online: true,  availableRoutes: [] }),

    node({ name: 'kim-laptop',      user: u(11), lastSeen: ago(1*MIN),   createdAt: '2024-05-20T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI',     online: true,  availableRoutes: [] }),
    node({ name: 'kim-homelab',     user: u(11), lastSeen: ago(3*DAY),   createdAt: '2024-06-25T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY',online: false, availableRoutes: ['10.40.0.0/24', '10.41.0.0/24', '10.42.0.0/24'] }),

    node({ name: 'liam-macbook',    user: u(12), lastSeen: ago(20*MIN),  createdAt: '2024-06-05T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC',    online: true,  availableRoutes: [] }),

    node({ name: 'mallory-laptop',  user: u(13), lastSeen: ago(35*MIN),  createdAt: '2024-06-20T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI',     online: true,  availableRoutes: [] }),
    node({ name: 'mallory-phone',   user: u(13), lastSeen: ago(2*HOUR),  createdAt: '2024-08-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY',online: false, availableRoutes: [] }),

    node({ name: 'niaj-workstation',user: u(14), lastSeen: ago(7*MIN),   createdAt: '2024-07-05T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI',     online: true,  availableRoutes: [] }),

    node({ name: 'olivia-laptop',   user: u(15), lastSeen: ago(50*MIN),  createdAt: '2024-07-25T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC',    online: false, availableRoutes: [] }),
    node({ name: 'olivia-tablet',   user: u(15), lastSeen: ago(22*MIN),  createdAt: '2024-08-05T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC',    online: true,  availableRoutes: [] }),
    // Olivia node: expiry imminent (within 24 h)
    node({ name: 'olivia-vpn-node', user: u(15), lastSeen: ago(1*MIN),   createdAt: '2024-09-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY',online: true,  expiry: future(18*HOUR), availableRoutes: [] }),

    // peter: long username / display name overflow test
    node({ name: 'peter-macbook-pro-16-inch-2023-space-grey', user: u(16), lastSeen: ago(4*MIN), createdAt: '2024-08-05T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI', online: true, availableRoutes: [] }),
    // peter node with very long givenName override
    node({ name: 'peter-vm', givenName: 'peter-vm-with-an-unreasonably-long-given-name-for-testing-overflow-scenarios', user: u(16), lastSeen: ago(1*HOUR), createdAt: '2024-09-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false, availableRoutes: [] }),

    // ci-bot: automation account, many nodes, all AUTH_KEY
    node({ name: 'ci-runner-01',    user: u(17), lastSeen: ago(5*MIN),   createdAt: '2024-08-15T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  availableRoutes: [] }),
    node({ name: 'ci-runner-02',    user: u(17), lastSeen: ago(3*MIN),   createdAt: '2024-08-15T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  availableRoutes: [] }),
    node({ name: 'ci-runner-03',    user: u(17), lastSeen: ago(8*MIN),   createdAt: '2024-09-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false, availableRoutes: [] }),
    node({ name: 'ci-runner-04',    user: u(17), lastSeen: ago(1*MIN),   createdAt: '2024-09-10T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  availableRoutes: [] }),
    node({ name: 'ci-runner-05',    user: u(17), lastSeen: ago(12*MIN),  createdAt: '2024-10-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  availableRoutes: [] }),

    // deploy-svc: service account
    node({ name: 'deploy-prod-01',  user: u(18), lastSeen: ago(2*MIN),   createdAt: '2024-08-25T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  availableRoutes: [] }),
    node({ name: 'deploy-staging',  user: u(18), lastSeen: ago(1*HOUR),  createdAt: '2024-09-05T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false, availableRoutes: [] }),

    node({ name: 'quinn-macbook',   user: u(19), lastSeen: ago(6*MIN),   createdAt: '2024-09-05T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC',    online: true,  availableRoutes: [] }),
    node({ name: 'quinn-linux',     user: u(19), lastSeen: ago(40*MIN),  createdAt: '2024-10-10T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC',    online: false, availableRoutes: [] }),

    node({ name: 'ruth-laptop',     user: u(20), lastSeen: ago(9*MIN),   createdAt: '2024-09-15T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC',    online: true,  availableRoutes: [] }),

    node({ name: 'sven-linux',      user: u(21), lastSeen: ago(11*MIN),  createdAt: '2024-10-05T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI',     online: true,  availableRoutes: [] }),

    // tanya: unicode display name
    node({ name: 'tanya-laptop',    user: u(22), lastSeen: ago(55*MIN),  createdAt: '2024-10-20T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI',     online: false, availableRoutes: [] }),

    // vera: legacy epoch creation date user
    node({ name: 'vera-retro',      user: u(24), lastSeen: ago(200*DAY), createdAt: '2004-06-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI',     online: false, availableRoutes: [] }),

    // user-42: numeric username
    node({ name: 'user-42-node-a',  user: u(25), lastSeen: ago(3*MIN),   createdAt: '2024-11-05T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY',online: true,  availableRoutes: [] }),
    node({ name: 'user-42-node-b',  user: u(25), lastSeen: ago(22*HOUR), createdAt: '2024-11-10T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY',online: false, availableRoutes: [] }),

    // ─────────────────────────────────────────────────────────────────────
    // GROUP B: Exit nodes (dual-stack, IPv4-only, IPv6-only, unapproved)
    // ─────────────────────────────────────────────────────────────────────
    // Exit 1: full dual-stack, approved
    node({ name: 'exit-amsterdam',  user: u(3), lastSeen: ago(1*MIN),    createdAt: '2024-05-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      approvedRoutes: ['0.0.0.0/0', '::/0'], availableRoutes: ['0.0.0.0/0', '::/0'] }),
    // Exit 2: IPv4 approved, IPv6 not yet approved
    node({ name: 'exit-london',     user: u(8), lastSeen: ago(3*MIN),    createdAt: '2024-06-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      approvedRoutes: ['0.0.0.0/0'], availableRoutes: ['0.0.0.0/0', '::/0'] }),
    // Exit 3: dual-stack, currently offline
    node({ name: 'exit-singapore',  user: u(17), lastSeen: ago(2*DAY),   createdAt: '2024-07-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false,
      approvedRoutes: ['0.0.0.0/0', '::/0'], availableRoutes: ['0.0.0.0/0', '::/0'] }),
    // Exit 4: advertised but not yet approved by admin
    node({ name: 'exit-toronto',    user: u(18), lastSeen: ago(10*MIN),  createdAt: '2024-08-15T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      approvedRoutes: [], availableRoutes: ['0.0.0.0/0', '::/0'] }),
    // Exit 5: IPv6-only approved
    node({ name: 'exit-tokyo-v6',   user: u(2), lastSeen: ago(4*MIN),    createdAt: '2025-01-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      approvedRoutes: ['::/0'], availableRoutes: ['::/0'] }),
    // Exit 6: dual-stack, approved, expiry in 7 days
    node({ name: 'exit-frankfurt',  user: u(6), lastSeen: ago(2*MIN),    createdAt: '2025-02-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      expiry: future(7*DAY), approvedRoutes: ['0.0.0.0/0', '::/0'], availableRoutes: ['0.0.0.0/0', '::/0'] }),

    // ─────────────────────────────────────────────────────────────────────
    // GROUP C: Route-provider nodes (various prefix combinations)
    // ─────────────────────────────────────────────────────────────────────
    // RFC 1918 /24 subnet
    node({ name: 'router-office-lan',   user: u(4), lastSeen: ago(2*MIN),  createdAt: '2024-04-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      approvedRoutes: ['192.168.1.0/24'], availableRoutes: ['192.168.1.0/24'] }),
    // RFC 1918 /16 subnet — large
    node({ name: 'router-campus',       user: u(8), lastSeen: ago(6*MIN),  createdAt: '2024-05-15T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      approvedRoutes: ['10.0.0.0/16'], availableRoutes: ['10.0.0.0/16'] }),
    // Overlapping subnets (both /24 and parent /16 advertised)
    node({ name: 'router-overlap',      user: u(11), lastSeen: ago(15*MIN), createdAt: '2024-06-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      approvedRoutes: ['172.20.0.0/16', '172.20.1.0/24'], availableRoutes: ['172.20.0.0/16', '172.20.1.0/24'] }),
    // IPv6 ULA only
    node({ name: 'router-ipv6-ula',     user: u(7), lastSeen: ago(20*MIN), createdAt: '2024-07-10T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      approvedRoutes: ['fd00::/8'], availableRoutes: ['fd00::/8'] }),
    // Dual-stack routes (IPv4 + IPv6 ULA)
    node({ name: 'router-dualstack',    user: u(13), lastSeen: ago(9*MIN), createdAt: '2024-08-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      approvedRoutes: ['10.50.0.0/24', 'fd12:3456:789a::/48'], availableRoutes: ['10.50.0.0/24', 'fd12:3456:789a::/48'] }),
    // Advertised but none approved
    node({ name: 'router-pending',      user: u(15), lastSeen: ago(30*MIN), createdAt: '2024-09-10T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false,
      approvedRoutes: [], availableRoutes: ['192.168.200.0/24', '192.168.201.0/24', '192.168.202.0/24'] }),
    // Very large prefix (/8)
    node({ name: 'router-big-prefix',   user: u(2), lastSeen: ago(1*MIN),  createdAt: '2024-10-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      approvedRoutes: ['10.0.0.0/8'], availableRoutes: ['10.0.0.0/8'] }),
    // Many routes at once (overflow test)
    node({ name: 'router-many-routes',  user: u(17), lastSeen: ago(7*MIN), createdAt: '2024-11-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      approvedRoutes: ['10.100.0.0/24','10.101.0.0/24','10.102.0.0/24','10.103.0.0/24','10.104.0.0/24','10.105.0.0/24'],
      availableRoutes: ['10.100.0.0/24','10.101.0.0/24','10.102.0.0/24','10.103.0.0/24','10.104.0.0/24','10.105.0.0/24','10.106.0.0/24','10.107.0.0/24'] }),

    // ─────────────────────────────────────────────────────────────────────
    // GROUP D: Tagged nodes (under tagged-devices user)
    // Each has a distinct tag combination and an originalUser pointing at
    // the real owner for the UI to display.
    // ─────────────────────────────────────────────────────────────────────
    // Single tag, original user alice
    node({ name: 'server-web-01',   user: taggedDevicesUser, originalUser: u(1), lastSeen: ago(1*MIN),    createdAt: '2024-05-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  tags: ['tag:server'] }),
    // Multiple tags, original user bob
    node({ name: 'server-db-01',    user: taggedDevicesUser, originalUser: u(2), lastSeen: ago(4*MIN),    createdAt: '2024-05-10T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  tags: ['tag:server', 'tag:database'] }),
    // Offline tagged server
    node({ name: 'server-db-02',    user: taggedDevicesUser, originalUser: u(2), lastSeen: ago(3*DAY),    createdAt: '2024-06-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false, tags: ['tag:server', 'tag:database'] }),
    // Infra tag
    node({ name: 'infra-gateway-a', user: taggedDevicesUser, originalUser: u(1), lastSeen: ago(2*MIN),    createdAt: '2024-06-15T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  tags: ['tag:infra', 'tag:server'] }),
    // Monitoring node
    node({ name: 'monitor-01',      user: taggedDevicesUser, originalUser: u(3), lastSeen: ago(8*MIN),    createdAt: '2024-07-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  tags: ['tag:monitoring'] }),
    // Printer (non-server, unusual tag)
    node({ name: 'printer-hq',      user: taggedDevicesUser, originalUser: u(4), lastSeen: ago(6*HOUR),   createdAt: '2024-07-10T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false, tags: ['tag:printer'] }),
    // IoT device
    node({ name: 'iot-sensor-01',   user: taggedDevicesUser, originalUser: u(5), lastSeen: ago(1*HOUR),   createdAt: '2024-07-20T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  tags: ['tag:iot'] }),
    node({ name: 'iot-sensor-02',   user: taggedDevicesUser, originalUser: u(5), lastSeen: ago(5*DAY),    createdAt: '2024-07-21T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false, tags: ['tag:iot'] }),
    // Camera (IoT adjacent)
    node({ name: 'camera-front',    user: taggedDevicesUser, originalUser: u(14), lastSeen: ago(10*MIN),  createdAt: '2024-08-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  tags: ['tag:iot', 'tag:camera'] }),
    // K8s control-plane
    node({ name: 'k8s-master-01',   user: taggedDevicesUser, originalUser: u(17), lastSeen: ago(2*MIN),   createdAt: '2024-08-15T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  tags: ['tag:k8s', 'tag:infra'] }),
    node({ name: 'k8s-worker-01',   user: taggedDevicesUser, originalUser: u(17), lastSeen: ago(3*MIN),   createdAt: '2024-08-16T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  tags: ['tag:k8s'] }),
    node({ name: 'k8s-worker-02',   user: taggedDevicesUser, originalUser: u(17), lastSeen: ago(4*MIN),   createdAt: '2024-08-17T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,  tags: ['tag:k8s'] }),
    node({ name: 'k8s-worker-03',   user: taggedDevicesUser, originalUser: u(17), lastSeen: ago(11*MIN),  createdAt: '2024-08-18T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false, tags: ['tag:k8s'] }),
    // Builds a long tags list — overflow test
    node({ name: 'multi-tag-node',  user: taggedDevicesUser, originalUser: u(11), lastSeen: ago(5*MIN),   createdAt: '2024-09-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      tags: ['tag:server', 'tag:database', 'tag:monitoring', 'tag:infra', 'tag:k8s', 'tag:backup', 'tag:legacy'] }),
    // Tagged exit node (unusual but valid)
    node({ name: 'tagged-exit-eu',  user: taggedDevicesUser, originalUser: u(8), lastSeen: ago(1*MIN),    createdAt: '2024-09-15T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      approvedRoutes: ['0.0.0.0/0', '::/0'], availableRoutes: ['0.0.0.0/0', '::/0'], tags: ['tag:exit', 'tag:infra'] }),
    // Tagged node with routes
    node({ name: 'tagged-router',   user: taggedDevicesUser, originalUser: u(4), lastSeen: ago(12*MIN),   createdAt: '2024-10-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      approvedRoutes: ['10.200.0.0/24'], availableRoutes: ['10.200.0.0/24'], tags: ['tag:server', 'tag:infra'] }),
    // Truly orphaned tagged nodes — no originalUser
    node({ name: 'orphan-node-01',  user: taggedDevicesUser, lastSeen: ago(30*DAY),  createdAt: '2023-12-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false, tags: ['tag:legacy'] }),
    node({ name: 'orphan-node-02',  user: taggedDevicesUser, lastSeen: ago(180*DAY), createdAt: '2023-01-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false, tags: ['tag:legacy'] }),
    // Orphan with long name
    node({ name: 'orphan-with-an-extremely-long-hostname-that-will-test-overflow-in-every-ui-component', user: taggedDevicesUser, lastSeen: ago(400*DAY), createdAt: '2022-06-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI', online: false, tags: ['tag:legacy', 'tag:server'] }),
    // Tagged node never seen (null lastSeen)
    node({ name: 'never-seen-tagged', user: taggedDevicesUser, originalUser: u(23), lastSeen: null, createdAt: '2026-04-28T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false, tags: ['tag:server'] }),

    // ─────────────────────────────────────────────────────────────────────
    // GROUP E: Edge-case nodes
    // ─────────────────────────────────────────────────────────────────────
    // Node that has never been seen (null lastSeen)
    node({ name: 'freshly-registered', user: u(23), lastSeen: null, createdAt: '2026-04-28T08:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: false, availableRoutes: [] }),
    // Node with only IPv4 (no IPv6 address assigned)
    node({ name: 'ipv4-only-node',  user: u(12), lastSeen: ago(20*MIN), createdAt: '2024-07-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI', online: true,
      ipAddresses: ['100.64.9.100'], availableRoutes: [] }),
    // Node with only IPv6
    node({ name: 'ipv6-only-node',  user: u(7), lastSeen: ago(15*MIN),  createdAt: '2024-07-05T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI', online: true,
      ipAddresses: ['fd7a:115c:a1e0::9999'], availableRoutes: [] }),
    // Node registered via OIDC with expiry and tags
    node({ name: 'oidc-tagged-expiring', user: taggedDevicesUser, originalUser: u(19), lastSeen: ago(5*MIN), createdAt: '2025-06-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_OIDC', online: true,
      expiry: future(1*DAY), tags: ['tag:server', 'tag:monitoring'] }),
    // REGISTER_METHOD_UNSPECIFIED (uncommon, seen in some migrations)
    node({ name: 'legacy-unspecified', user: u(24), lastSeen: ago(500*DAY), createdAt: '2020-01-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_UNSPECIFIED', online: false, availableRoutes: [] }),
    // Node whose name contains special characters / URL chars
    node({ name: 'node-with-dashes-and-123', user: u(21), lastSeen: ago(10*MIN), createdAt: '2024-10-10T00:00:00Z', registerMethod: 'REGISTER_METHOD_CLI', online: true, availableRoutes: [] }),
    // Node with very many IP addresses (rare but possible in multi-NIC scenarios)
    node({ name: 'multi-ip-node', user: u(2), lastSeen: ago(2*MIN), createdAt: '2025-01-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      ipAddresses: ['100.64.10.1','100.64.10.2','fd7a:115c:a1e0::a001','fd7a:115c:a1e0::a002','fd7a:115c:a1e0::a003'], availableRoutes: [] }),
    // Node that is online but has a far-future expiry with routes and tags
    node({ name: 'prod-server-all-features', user: taggedDevicesUser, originalUser: u(3), lastSeen: ago(30*MIN), createdAt: '2025-02-01T00:00:00Z', registerMethod: 'REGISTER_METHOD_AUTH_KEY', online: true,
      expiry: future(365*DAY), approvedRoutes: ['10.60.0.0/24'], availableRoutes: ['10.60.0.0/24', '10.61.0.0/24'], tags: ['tag:server', 'tag:k8s', 'tag:monitoring'] }),
  ];
}

// ── User → node ownership map ─────────────────────────────────────────────
// Built dynamically after createNodes() runs; used by the ?user= filter.

function buildUserNodeMap(nodes, users) {
  const map = {};
  for (const u of users) {
    map[u.name] = [];
  }
  for (const n of nodes) {
    if (n.user.name === 'tagged-devices') {
      // Attribute to originalUser when available
      const owner = n.originalUser;
      if (owner && map[owner.name]) {
        map[owner.name].push(n.id);
      }
    } else if (map[n.user.name]) {
      map[n.user.name].push(n.id);
    }
  }
  return map;
}

function createPreAuthKeys(users) {
  const u = (idx) => users[idx - 1];
  return [
    // Standard unexpired user key
    { user: u(1), id: '1', key: 'pak_alice_000001', reusable: false, ephemeral: false, used: false,
      expiration: future(30*DAY), createdAt: '2025-03-01T00:00:00Z', aclTags: [] },
    // Reusable key
    { user: u(2), id: '2', key: 'pak_bob_reusable', reusable: true, ephemeral: false, used: false,
      expiration: future(90*DAY), createdAt: '2025-04-01T00:00:00Z', aclTags: [] },
    // Ephemeral key
    { user: u(3), id: '3', key: 'pak_carol_ephemeral', reusable: false, ephemeral: true, used: false,
      expiration: future(7*DAY), createdAt: '2025-04-10T00:00:00Z', aclTags: [] },
    // Already used key
    { user: u(1), id: '4', key: 'pak_alice_used', reusable: false, ephemeral: false, used: true,
      expiration: future(14*DAY), createdAt: '2025-02-01T00:00:00Z', aclTags: [] },
    // Expired key
    { user: u(4), id: '5', key: 'pak_dave_expired', reusable: false, ephemeral: false, used: false,
      expiration: ago(5*DAY), createdAt: '2025-01-01T00:00:00Z', aclTags: [] },
    // Tagged key (server tag)
    { user: null, id: '6', key: 'pak_tag_server', reusable: true, ephemeral: false, used: false,
      expiration: future(60*DAY), createdAt: '2025-03-15T00:00:00Z', aclTags: ['tag:server'] },
    // Tagged key (multiple tags)
    { user: null, id: '7', key: 'pak_tag_k8s_infra', reusable: true, ephemeral: false, used: false,
      expiration: future(45*DAY), createdAt: '2025-04-01T00:00:00Z', aclTags: ['tag:k8s', 'tag:infra'] },
    // Reusable + ephemeral tagged key
    { user: null, id: '8', key: 'pak_tag_iot', reusable: true, ephemeral: true, used: false,
      expiration: future(1*DAY), createdAt: '2025-05-01T00:00:00Z', aclTags: ['tag:iot'] },
    // Key expiring very soon (within 2 hours)
    { user: u(8), id: '9', key: 'pak_heidi_soon', reusable: false, ephemeral: false, used: false,
      expiration: future(1*HOUR), createdAt: '2025-04-25T00:00:00Z', aclTags: [] },
    // Key for service account
    { user: u(17), id: '10', key: 'pak_ci_bot_runner', reusable: true, ephemeral: true, used: false,
      expiration: future(180*DAY), createdAt: '2025-01-10T00:00:00Z', aclTags: [] },
    // Long-tag name key (overflow test)
    { user: null, id: '11', key: 'pak_tag_overflow', reusable: false, ephemeral: false, used: false,
      expiration: future(30*DAY), createdAt: '2025-05-01T00:00:00Z',
      aclTags: ['tag:server', 'tag:database', 'tag:monitoring', 'tag:infra', 'tag:k8s', 'tag:backup', 'tag:legacy'] },
  ];
}

function createApiKeys() {
  return [
    {
      id: '1',
      createdAt: '2025-01-01T00:00:00Z',
      prefix: 'test-api-key'.slice(0, 10),
      expiration: future(90*DAY),
      lastSeen: new Date().toISOString(),
    },
    // Expiring soon
    {
      id: '2',
      createdAt: '2024-11-01T00:00:00Z',
      prefix: 'old-key-pre',
      expiration: future(7*DAY),
      lastSeen: ago(2*DAY),
    },
    // Already expired
    {
      id: '3',
      createdAt: '2024-06-01T00:00:00Z',
      prefix: 'expired-key',
      expiration: ago(10*DAY),
      lastSeen: ago(10*DAY),
    },
  ];
}

let users;
let nodes;
let preAuthKeys;
let apiKeys;
let userNodeMap;

function resetState() {
  _nodeId = 0;
  users = structuredClone(baseUsers);
  nodes = createNodes(users);
  preAuthKeys = createPreAuthKeys(users);
  apiKeys = createApiKeys();
  userNodeMap = buildUserNodeMap(nodes, users);
}

resetState();

const policy = JSON.stringify({
  groups: {
    'group:admin':   ['alice', 'bob'],
    'group:dev':     ['carol', 'dave', 'eve', 'frank.garcia', 'grace'],
    'group:ops':     ['heidi', 'ivan', 'ci-bot', 'deploy-svc'],
    'group:all':     ['*'],
  },
  hosts: {
    'prod-subnet':   '10.60.0.0/24',
    'office-lan':    '192.168.1.0/24',
    'campus-net':    '10.0.0.0/16',
  },
  acls: [
    { action: 'accept', src: ['group:admin'],    dst: ['*:*'] },
    { action: 'accept', src: ['group:dev'],      dst: ['tag:server:*', 'tag:k8s:*'] },
    { action: 'accept', src: ['group:ops'],      dst: ['tag:infra:*'] },
    { action: 'accept', src: ['tag:monitoring'], dst: ['*:9090', '*:9093', '*:9100'] },
    { action: 'accept', src: ['*'],              dst: ['tag:exit:*'] },
  ],
  tagOwners: {
    'tag:server':     ['group:admin', 'group:ops'],
    'tag:database':   ['group:admin'],
    'tag:infra':      ['group:admin', 'group:ops'],
    'tag:k8s':        ['group:ops'],
    'tag:monitoring': ['group:ops'],
    'tag:iot':        ['group:admin'],
    'tag:camera':     ['group:admin'],
    'tag:printer':    ['group:admin'],
    'tag:exit':       ['group:admin'],
    'tag:backup':     ['group:admin'],
    'tag:legacy':     ['group:admin'],
  },
  ssh: [
    { action: 'accept', src: ['group:admin'], dst: ['*'], users: ['root', 'headscale-user'] },
    { action: 'accept', src: ['group:dev'],   dst: ['tag:server'], users: ['deploy'] },
  ],
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
