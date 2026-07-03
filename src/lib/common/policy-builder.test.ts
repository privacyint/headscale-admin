import { describe, expect, it } from 'vitest'
import JWCC from 'json5'
import { PolicyBuilder } from '$lib/common/policy-builder'

describe('PolicyBuilder bridge', () => {
    it('loads and serialises modern policy sections', () => {
        const source = {
            groups: { 'group:admins': ['alice'] },
            tagOwners: { 'tag:prod': ['group:admins'] },
            hosts: { db: '100.64.0.10' },
            acls: [{ action: 'accept', src: ['*'], dst: ['*:*'] }],
            grants: [{ src: ['group:admins'], dst: ['tag:prod'], via: ['tag:relay'] }],
            nodeAttrs: [{ target: ['tag:prod'], attr: ['funnel'] }],
            tests: [{ src: 'group:admins' }],
            sshTests: [{ src: 'group:admins' }],
            postures: [{ name: 'corp-devices', rules: [] }],
            randomizeClientPort: true,
            unknownTopLevel: { keep: true },
        }

        const builder = PolicyBuilder.fromPolicy(source)

        expect(builder.getGrants()).toEqual(source.grants)
        expect(builder.getNodeAttrs()).toEqual(source.nodeAttrs)
        expect(builder.getTests()).toEqual(source.tests)
        expect(builder.getSshTests()).toEqual(source.sshTests)
        expect(builder.getPostures()).toEqual(source.postures)
        expect(builder.getRandomizeClientPort()).toBe(true)
        expect(builder.hasUnsupportedPolicyFields()).toBe(true)
        expect(builder.getUnsupportedPolicyFields()).toContain('unknownTopLevel')

        const out = JWCC.parse(builder.JSON(2))
        expect((out as any).grants).toEqual(source.grants)
        expect((out as any).nodeAttrs).toEqual(source.nodeAttrs)
        expect((out as any).tests).toEqual(source.tests)
        expect((out as any).sshTests).toEqual(source.sshTests)
        expect((out as any).postures).toEqual(source.postures)
        expect((out as any).randomizeClientPort).toBe(true)
        expect((out as any).unknownTopLevel).toEqual({ keep: true })
    })

    it('updates modern sections through bridge setters', () => {
        const builder = PolicyBuilder.defaultACL()

        builder.setGrants([{ src: ['group:ops'], dst: ['tag:prod'] }])
        builder.setNodeAttrs([{ target: ['tag:prod'], attr: ['funnel'] }])
        builder.setTests([{ src: 'group:ops' }])
        builder.setSshTests([{ src: 'group:ops' }])
        builder.setPostures([{ name: 'corp', rules: [] }])
        builder.setRandomizeClientPort(false)

        expect(builder.getGrants()).toEqual([{ src: ['group:ops'], dst: ['tag:prod'] }])
        expect(builder.getNodeAttrs()).toEqual([{ target: ['tag:prod'], attr: ['funnel'] }])
        expect(builder.getTests()).toEqual([{ src: 'group:ops' }])
        expect(builder.getSshTests()).toEqual([{ src: 'group:ops' }])
        expect(builder.getPostures()).toEqual([{ name: 'corp', rules: [] }])
        expect(builder.getRandomizeClientPort()).toBe(false)
    })
})
