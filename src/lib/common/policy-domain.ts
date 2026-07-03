import { isValidCIDR, isValidIP } from './funcs'

export type PrefixType = 'group' | 'tag'

const PREFIXES: Record<PrefixType, string> = {
    group: 'group:',
    tag: 'tag:',
}

const REGEX_GROUP_NAME = /^[a-z0-9-\.]+$/
const REGEX_TAG_NAME = /^[^\s:]+$/
const REGEX_HOST_NAME = /^[a-z0-9-\.]+$/

export type PolicyAclReferenceRule = {
    src: string[]
    dst: string[]
}

export type PolicySshReferenceRule = {
    src: string[]
    dst: string[]
}

export type PolicyDomainState = {
    groups: Record<string, string[]>
    tagOwners: Record<string, string[]>
    hosts: Record<string, string>
    acls: PolicyAclReferenceRule[]
    ssh?: PolicySshReferenceRule[]
}

export function getPrefix(name: string): PrefixType | null {
    for (const [prefixType, prefix] of Object.entries(PREFIXES)) {
        if (name.startsWith(prefix)) {
            return prefixType as PrefixType
        }
    }
    return null
}

export function stripPrefix(name: string): string {
    const lower = name.toLowerCase()
    for (const prefix of Object.values(PREFIXES)) {
        if (lower.startsWith(prefix)) {
            return name.substring(prefix.length)
        }
    }
    return name
}

export function addPrefix(name: string, type: PrefixType): string {
    return PREFIXES[type] + name
}

export function normalizePrefix(name: string, type: PrefixType): { prefixed: string, stripped: string } {
    const stripped = stripPrefix(name)
    const prefixed = addPrefix(stripped, type)
    return { prefixed, stripped }
}

export function validateGroupName(name: string): string {
    name = stripPrefix(name)
    if (name.toLowerCase() !== name) {
        throw new Error('Group name must be lowercase')
    }
    if (!REGEX_GROUP_NAME.test(name)) {
        throw new Error('Group name is limited to: lowercase alphabet, digits, dashes, and periods')
    }
    return name
}

export function validateTagName(name: string): string {
    name = stripPrefix(name)
    if (!REGEX_TAG_NAME.test(name)) {
        throw new Error('Tag name must contain no spaces')
    }
    return name
}

export function validateHostName(name: string): string {
    name = name.toLowerCase()
    if (!REGEX_HOST_NAME.test(name)) {
        throw new Error('Host name is limited to: lowercase alphabet, digits, dashes, and periods')
    }
    return name
}

export function validateHostValue(value: string): string {
    if (isValidIP(value) || isValidCIDR(value)) {
        return value
    }
    throw new Error('Invalid Host IP or CIDR')
}

export function getPolicyDstHost(dst: string): string {
    const i = dst.lastIndexOf(':')
    return i < 0 ? dst : dst.substring(0, i)
}

export function getPolicyDstPorts(dst: string): string {
    const i = dst.lastIndexOf(':')
    return i < 0 ? dst : dst.substring(i + 1, dst.length)
}

export function createHostInPolicy(state: PolicyDomainState, name: string, cidr: string) {
    if (state.hosts[name] !== undefined) {
        throw new Error(`host "${name}" already exists`)
    }
    setHostInPolicy(state, name, cidr)
}

export function setHostInPolicy(state: PolicyDomainState, name: string, value: string) {
    name = validateHostName(name)
    value = validateHostValue(value)
    state.hosts[name] = value
}

export function renameHostInPolicy(state: PolicyDomainState, nameOld: string, nameNew: string) {
    nameOld = validateHostName(nameOld)
    nameNew = validateHostName(nameNew)

    if (state.hosts[nameOld] === undefined) {
        throw new Error(`Host '${nameOld}' does not exist`)
    }
    if (state.hosts[nameNew] !== undefined) {
        throw new Error(`Host '${nameNew}' already exists`)
    }

    const hosts: Record<string, string> = {}
    Object.entries(state.hosts).forEach(([name, value]) => {
        hosts[name === nameOld ? nameNew : name] = value
    })
    state.hosts = hosts

    state.acls.forEach((acl) => {
        acl.src = acl.src.map((src) => (src === nameOld ? nameNew : src))
        acl.dst = acl.dst.map((dst) => (getPolicyDstHost(dst) === nameOld ? `${nameNew}:${getPolicyDstPorts(dst)}` : dst))
    })
}

export function deleteHostFromPolicy(state: PolicyDomainState, name: string) {
    if (state.hosts[name] === undefined) {
        throw new Error(`Host '${name}' doesn't exist`)
    }

    delete state.hosts[name]

    for (const acl of state.acls) {
        acl.src = acl.src.filter((s) => s !== name)
        acl.dst = acl.dst.filter((d) => d !== name)
    }

    if (state.ssh !== undefined) {
        for (const ssh of state.ssh) {
            ssh.src = ssh.src.filter((s) => s !== name)
            ssh.dst = ssh.dst.filter((d) => d !== name)
        }
    }
}

export function createTagInPolicy(state: PolicyDomainState, name: string) {
    name = validateTagName(name)
    const { prefixed } = normalizePrefix(name, 'tag')
    state.tagOwners[prefixed] = []
}

export function renameTagInPolicy(state: PolicyDomainState, nameOld: string, nameNew: string) {
    nameNew = validateTagName(nameNew)
    const { prefixed: prefixedNew } = normalizePrefix(nameNew, 'tag')
    const { stripped: strippedOld, prefixed: prefixedOld } = normalizePrefix(nameOld, 'tag')

    if (prefixedNew === prefixedOld) {
        return
    }

    if (state.tagOwners[prefixedOld] === undefined) {
        throw new Error(`Tag '${strippedOld}' doesn't exist`)
    }

    const tagOwners: Record<string, string[]> = {}
    Object.entries(state.tagOwners).forEach(([name, owners]) => {
        tagOwners[name === prefixedOld ? prefixedNew : name] = owners
    })
    state.tagOwners = tagOwners

    state.acls.forEach((acl) => {
        acl.src = acl.src.map((src) => (src === prefixedOld ? prefixedNew : src))
        acl.dst = acl.dst.map((dst) => (getPolicyDstHost(dst) === prefixedOld ? `${prefixedNew}:${getPolicyDstPorts(dst)}` : dst))
    })

    if (state.ssh !== undefined) {
        for (const rule of state.ssh) {
            rule.src = rule.src.map((src) => (src === prefixedOld ? prefixedNew : src))
            rule.dst = rule.dst.map((dst) => (dst === prefixedOld ? prefixedNew : dst))
        }
    }
}

export function setTagOwnersInPolicy(state: PolicyDomainState, name: string, owners: string[]) {
    const { prefixed } = normalizePrefix(name, 'tag')
    state.tagOwners[prefixed] = [...owners]
}

export function deleteTagFromPolicy(state: PolicyDomainState, name: string) {
    const { stripped, prefixed } = normalizePrefix(name, 'tag')

    if (state.tagOwners[prefixed] === undefined) {
        throw new Error(`Tag '${stripped}' doesn't exist within the ACL`)
    }

    for (const acl of state.acls) {
        acl.src = acl.src.filter((s) => s !== prefixed)
        acl.dst = acl.dst.filter((d) => d !== prefixed)
    }

    if (state.ssh !== undefined) {
        for (const ssh of state.ssh) {
            ssh.src = ssh.src.filter((s) => s !== prefixed)
            ssh.dst = ssh.dst.filter((d) => d !== prefixed)
        }
    }

    delete state.tagOwners[prefixed]
}

export function createGroupInPolicy(state: PolicyDomainState, name: string) {
    name = validateGroupName(name)
    const { stripped, prefixed } = normalizePrefix(name, 'group')

    if (state.groups[prefixed] !== undefined) {
        throw new Error(`Group '${stripped}' already exists`)
    }

    state.groups[prefixed] = []
}

export function renameGroupInPolicy(state: PolicyDomainState, nameOld: string, nameNew: string) {
    nameNew = validateGroupName(nameNew)
    const { prefixed: prefixedNew } = normalizePrefix(nameNew, 'group')
    const { stripped: strippedOld, prefixed: prefixedOld } = normalizePrefix(nameOld, 'group')

    if (prefixedNew === prefixedOld) {
        return
    }

    if (state.groups[prefixedOld] === undefined) {
        throw new Error(`Group '${strippedOld}' doesn't exist`)
    }

    const groups: Record<string, string[]> = {}
    Object.entries(state.groups).forEach(([name, members]) => {
        groups[name === prefixedOld ? prefixedNew : name] = members
    })
    state.groups = groups

    state.acls.forEach((acl) => {
        acl.src = acl.src.map((src) => (src === prefixedOld ? prefixedNew : src))
        acl.dst = acl.dst.map((dst) => (getPolicyDstHost(dst) === prefixedOld ? `${prefixedNew}:${getPolicyDstPorts(dst)}` : dst))
    })

    for (const key in state.tagOwners) {
        state.tagOwners[key] = state.tagOwners[key].map((owner) => owner === prefixedOld ? prefixedNew : owner)
    }

    if (state.ssh !== undefined) {
        for (const rule of state.ssh) {
            rule.src = rule.src.map((src) => (src === prefixedOld ? prefixedNew : src))
            rule.dst = rule.dst.map((src) => (src === prefixedOld ? prefixedNew : src))
        }
    }
}

export function setGroupMembersInPolicy(state: PolicyDomainState, name: string, members: string[]) {
    const { prefixed } = normalizePrefix(name, 'group')
    state.groups[prefixed] = [...members]
}

export function deleteGroupFromPolicy(state: PolicyDomainState, name: string) {
    const { stripped, prefixed } = normalizePrefix(name, 'group')

    if (state.groups[prefixed] === undefined) {
        throw new Error(`Group '${stripped}' doesn't exist`)
    }

    for (const tag of Object.keys(state.tagOwners)) {
        state.tagOwners[tag] = state.tagOwners[tag].filter((t) => t !== prefixed)
    }

    for (const acl of state.acls) {
        acl.src = acl.src.filter((s) => s !== prefixed)
        acl.dst = acl.dst.filter((d) => d !== prefixed)
    }

    if (state.ssh !== undefined) {
        for (const ssh of state.ssh) {
            ssh.src = ssh.src.filter((s) => s !== prefixed)
        }
    }

    delete state.groups[prefixed]
}