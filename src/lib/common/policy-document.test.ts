import { describe, expect, it } from 'vitest'
import JWCC from 'json5'
import { mergeLegacyPolicyDocument, parsePolicyDocument, serialisePolicyDocument } from '$lib/common/policy-document'

describe('policy-document parse/serialise', () => {
    it('round-trips mixed ACL + modern policy sections without data loss', () => {
        const source = `{
            // legacy sections
            "groups": { "group:admins": ["alice"] },
            "tagOwners": { "tag:prod": ["group:admins"] },
            "hosts": { "db": "100.64.0.10" },
            "acls": [{ "action": "accept", "src": ["*"], "dst": ["*:*"] }],
            "ssh": [{ "action": "accept", "src": ["group:admins"], "dst": ["db"], "users": ["root"] }],

            // modern fields that must be preserved
            "grants": [{ "src": ["group:admins"], "dst": ["tag:prod"], "app": { "tailscale.com/cap/drive": [{"share": "rw"}] } }],
            "nodeAttrs": [{ "target": ["tag:prod"], "attr": ["funnel"] }],
            "randomizeClientPort": true
        }`

        const doc = parsePolicyDocument(source)
        const out = serialisePolicyDocument(doc.raw, doc.legacy, 2)

        expect(JWCC.parse(out)).toEqual(JWCC.parse(source))
        expect(doc.unsupportedFields).toContain('grants')
        expect(doc.unsupportedFields).toContain('nodeAttrs')
        expect(doc.unsupportedFields).toContain('randomizeClientPort')
    })

    it('merges edited legacy ACL sections while keeping unknown top-level fields', () => {
        const doc = parsePolicyDocument({
            groups: { 'group:admins': ['alice'] },
            tagOwners: { 'tag:prod': ['group:admins'] },
            hosts: { db: '100.64.0.10' },
            acls: [{ action: 'accept', src: ['*'], dst: ['*:*'] }],
            grants: [{ src: ['group:admins'], dst: ['tag:prod'] }],
            postures: [{ name: 'corp-devices' }],
        })

        const merged = mergeLegacyPolicyDocument(doc.raw, {
            ...doc.legacy,
            groups: { ...doc.legacy.groups, 'group:ops': ['bob'] },
            acls: [{ action: 'accept', src: ['group:ops'], dst: ['db:5432'] }],
        })

        expect((merged as any).grants).toEqual([{ src: ['group:admins'], dst: ['tag:prod'] }])
        expect((merged as any).postures).toEqual([{ name: 'corp-devices' }])
        expect((merged as any).groups).toEqual({ 'group:admins': ['alice'], 'group:ops': ['bob'] })
        expect((merged as any).acls).toEqual([{ action: 'accept', src: ['group:ops'], dst: ['db:5432'] }])
    })
})
