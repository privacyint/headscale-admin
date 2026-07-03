import { describe, expect, it } from 'vitest'
import {
    createGroupInPolicy,
    createHostInPolicy,
    createTagInPolicy,
    deleteGroupFromPolicy,
    deleteHostFromPolicy,
    deleteTagFromPolicy,
    renameGroupInPolicy,
    renameHostInPolicy,
    renameTagInPolicy,
    setGroupMembersInPolicy,
    setTagOwnersInPolicy,
    type PolicyDomainState,
} from '$lib/common/policy-domain'

function makeState(): PolicyDomainState {
    return {
        groups: { 'group:admins': ['alice'] },
        tagOwners: { 'tag:prod': ['group:admins'] },
        hosts: { db: '100.64.0.10' },
        acls: [
            {
                src: ['group:admins', 'db', 'tag:prod'],
                dst: ['db:5432', 'tag:prod:443', 'group:admins:*'],
            },
        ],
        ssh: [
            {
                src: ['group:admins', 'db', 'tag:prod'],
                dst: ['db', 'tag:prod'],
            },
        ],
    }
}

describe('policy-domain extracted mutations', () => {
    it('renames host and updates ACL/SSH references', () => {
        const state = makeState()
        renameHostInPolicy(state, 'db', 'database')

        expect(state.hosts).toEqual({ database: '100.64.0.10' })
        expect(state.acls[0].src).toContain('database')
        expect(state.acls[0].dst).toContain('database:5432')
        // Existing ACLBuilder behaviour keeps SSH references unchanged on host rename.
        expect(state.ssh?.[0].src).toContain('db')
        expect(state.ssh?.[0].dst).toContain('db')
    })

    it('renames tag and updates ACL/SSH references', () => {
        const state = makeState()
        renameTagInPolicy(state, 'prod', 'production')

        expect(state.tagOwners['tag:production']).toEqual(['group:admins'])
        expect(state.tagOwners['tag:prod']).toBeUndefined()
        expect(state.acls[0].src).toContain('tag:production')
        expect(state.acls[0].dst).toContain('tag:production:443')
        expect(state.ssh?.[0].src).toContain('tag:production')
        expect(state.ssh?.[0].dst).toContain('tag:production')
    })

    it('renames group and updates references in ACL, tagOwners, and SSH', () => {
        const state = makeState()
        renameGroupInPolicy(state, 'admins', 'ops')

        expect(state.groups['group:ops']).toEqual(['alice'])
        expect(state.groups['group:admins']).toBeUndefined()
        expect(state.tagOwners['tag:prod']).toContain('group:ops')
        expect(state.acls[0].src).toContain('group:ops')
        expect(state.acls[0].dst).toContain('group:ops:*')
        expect(state.ssh?.[0].src).toContain('group:ops')
    })

    it('deletes group/tag/host and removes linked ACL/SSH references', () => {
        const state = makeState()
        deleteGroupFromPolicy(state, 'admins')
        deleteTagFromPolicy(state, 'prod')
        deleteHostFromPolicy(state, 'db')

        expect(state.groups).toEqual({})
        expect(state.tagOwners).toEqual({})
        expect(state.hosts).toEqual({})
        expect(state.acls[0].src).toEqual([])
        // Existing ACLBuilder behaviour only removes exact destination matches.
        expect(state.acls[0].dst).toEqual(['db:5432', 'tag:prod:443', 'group:admins:*'])
        expect(state.ssh?.[0].src).toEqual([])
        expect(state.ssh?.[0].dst).toEqual([])
    })

    it('creates and sets group/tag data with normalised keys', () => {
        const state: PolicyDomainState = {
            groups: {},
            tagOwners: {},
            hosts: {},
            acls: [],
        }

        createGroupInPolicy(state, 'new-team')
        setGroupMembersInPolicy(state, 'new-team', ['bob'])
        createTagInPolicy(state, 'backend')
        setTagOwnersInPolicy(state, 'backend', ['group:new-team'])
        createHostInPolicy(state, 'api', '100.64.0.20')

        expect(state.groups['group:new-team']).toEqual(['bob'])
        expect(state.tagOwners['tag:backend']).toEqual(['group:new-team'])
        expect(state.hosts.api).toEqual('100.64.0.20')
    })
})
