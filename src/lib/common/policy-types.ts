export type JsonObject = Record<string, unknown>

export type PolicyRuleMeta = {
    name: string
    open: boolean
}

export type PolicyAclRule = {
    '#ha-meta'?: PolicyRuleMeta
    action: 'accept'
    proto?: string
    src: string[]
    dst: string[]
}

export type PolicySshRule = {
    action: 'accept'
    src: string[]
    dst: string[]
    users: string[]
}

export type PolicyGrant = {
    src: string[]
    dst: string[]
    ip?: string[]
    app?: Record<string, unknown[]>
    via?: string[]
    srcPosture?: string[]
}

export type PolicyNodeAttr = {
    target: string[]
    attr: string[]
}

export type PolicyTest = Record<string, unknown>
export type PolicySshTest = Record<string, unknown>
export type PolicyPosture = Record<string, unknown>

export type PolicySections = {
    groups: Record<string, string[]>
    tagOwners: Record<string, string[]>
    hosts: Record<string, string>
    acls: PolicyAclRule[]
    ssh?: PolicySshRule[]
    grants?: PolicyGrant[]
    nodeAttrs?: PolicyNodeAttr[]
    tests?: PolicyTest[]
    sshTests?: PolicySshTest[]
    postures?: PolicyPosture[]
    randomizeClientPort?: boolean
}
