import { ACLBuilder } from './acl.svelte'

// Bridge export for the modern policy model.
// The underlying implementation remains ACL-compatible while supporting
// additional 0.29.x policy sections (grants, nodeAttrs, tests, sshTests,
// postures, randomizeClientPort).
export const PolicyBuilder = ACLBuilder
export type PolicyBuilder = ACLBuilder
