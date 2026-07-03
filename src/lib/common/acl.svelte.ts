import JWCC from 'json5'
import { parsePolicyDocument, serialisePolicyDocument, type LegacyPolicySection } from './policy-document'
import type { PolicyGrant, PolicyNodeAttr, PolicyPosture, PolicySshTest, PolicyTest } from './policy-types'
import {
    addPrefix,
    createGroupInPolicy,
    createHostInPolicy,
    createTagInPolicy,
    deleteGroupFromPolicy,
    deleteHostFromPolicy,
    deleteTagFromPolicy,
    getPolicyDstHost,
    getPolicyDstPorts,
    getPrefix,
    normalizePrefix,
    renameGroupInPolicy,
    renameHostInPolicy,
    renameTagInPolicy,
    setGroupMembersInPolicy,
    setHostInPolicy,
    setTagOwnersInPolicy,
    stripPrefix,
    validateGroupName,
    validateHostName,
    validateHostValue,
    validateTagName,
    type PrefixType,
} from './policy-domain'

export type TagOwners = string[]
export type TagOwnersTyped = { users: string[], groups: string[], tags: string[] }

export type AclGroups = { [key: string]: string[] }
export type AclTagOwners = { [key: string]: TagOwners }
export type AclHosts = { [key: string]: string }
export type AclPolicies = AclPolicy[]
export type AclSshRules = AclSshRule[]
export type AclPoliciesIndexed = {policy: AclPolicy, idx: number}[]
export type AclSshRulesIndexed = {rule: AclSshRule, idx: number}[]

// metadata for ACL policy entries
export type HAMeta = {
    name: string,
    open: boolean,
}

export function normHAMeta(meta: Partial<HAMeta>): HAMeta {
    let def = HAMetaDefault
    return {
        name: meta.name ?? def.name,
        open: meta.open ?? def.open,
    }
}

export const HAMetaDefault = {
    name: "",
    open: true,
}

export type AclPolicy = {
    "#ha-meta"?: HAMeta,
    action: 'accept',
    proto?: string,
    src: string[],
    dst: string[],
}
export type AclSshRule = {
    action: 'accept',
    src: string[],
    dst: string[],
    users: string[],
}

export type ACL = {
    groups: AclGroups, // keys must start with "group:"
    tagOwners: AclTagOwners, // keys must start with "tag:"
    hosts: AclHosts, // keys are DNS-style hostnames
    acls: AclPolicies,
    ssh?: AclSshRules,
    grants?: PolicyGrant[],
    nodeAttrs?: PolicyNodeAttr[],
    tests?: PolicyTest[],
    sshTests?: PolicySshTest[],
    postures?: PolicyPosture[],
    randomizeClientPort?: boolean,
}

export class ACLBuilder implements ACL {
    #policyRaw: Record<string, unknown> | undefined
    #unsupportedPolicyFields: string[]

    groups = $state<AclGroups>({})
    tagOwners = $state<AclTagOwners>({})
    hosts = $state<AclHosts>({})
    acls = $state<AclPolicies>([])
    ssh = $state<AclSshRules|undefined>(undefined)
    grants = $state<PolicyGrant[] | undefined>(undefined)
    nodeAttrs = $state<PolicyNodeAttr[] | undefined>(undefined)
    tests = $state<PolicyTest[] | undefined>(undefined)
    sshTests = $state<PolicySshTest[] | undefined>(undefined)
    postures = $state<PolicyPosture[] | undefined>(undefined)
    randomizeClientPort = $state<boolean | undefined>(undefined)

    constructor(
        groups: AclGroups,
        tagOwners: AclTagOwners,
        hosts: AclHosts,
        acls: AclPolicies,
        ssh?: AclSshRules,
        grants?: PolicyGrant[],
        nodeAttrs?: PolicyNodeAttr[],
        tests?: PolicyTest[],
        sshTests?: PolicySshTest[],
        postures?: PolicyPosture[],
        randomizeClientPort?: boolean,
        policyRaw?: Record<string, unknown>,
        unsupportedPolicyFields: string[] = [],
    ) {
        this.groups = groups
        this.tagOwners = tagOwners
        this.hosts = hosts
        this.acls = acls
        this.ssh = ssh
        this.grants = grants
        this.nodeAttrs = nodeAttrs
        this.tests = tests
        this.sshTests = sshTests
        this.postures = postures
        this.randomizeClientPort = randomizeClientPort
        this.#policyRaw = policyRaw
        this.#unsupportedPolicyFields = unsupportedPolicyFields
    }

    JSON(space: number = 0): string {
        const legacyPolicy: LegacyPolicySection = {
            groups: this.groups,
            tagOwners: this.tagOwners,
            hosts: this.hosts,
            acls: this.acls,
            ssh: this.ssh,
            grants: this.grants,
            nodeAttrs: this.nodeAttrs,
            tests: this.tests,
            sshTests: this.sshTests,
            postures: this.postures,
            randomizeClientPort: this.randomizeClientPort,
        }

        if (this.#policyRaw !== undefined) {
            return serialisePolicyDocument(this.#policyRaw, legacyPolicy, space)
        }

        return JSON.stringify(legacyPolicy, null, space)
    }

    hasUnsupportedPolicyFields(): boolean {
        return this.#unsupportedPolicyFields.length > 0
    }

    getUnsupportedPolicyFields(): string[] {
        return [...this.#unsupportedPolicyFields]
    }

    static emptyACL(): ACLBuilder {
        return new ACLBuilder({}, {}, {}, [], [], [], [], [], [], [], undefined)
    }

    static defaultACL(): ACLBuilder {
        return new ACLBuilder({}, {}, {}, [{
            "#ha-meta": HAMetaDefault,
            action: "accept",
            src: ["*"],
            dst: ["*:*"],
        }], [], [], [], [], [], [], undefined)
    }

    static addPolicyMeta(policy: AclPolicy): boolean {
		if (policy["#ha-meta"] === undefined){
			policy["#ha-meta"] = HAMetaDefault
		}
        return policy["#ha-meta"] !== undefined
    }

    static fromPolicy(acl: ACL | string | Record<string, unknown>): ACLBuilder {
        const doc = parsePolicyDocument(acl)
        const ssh = doc.legacy.ssh ? [...doc.legacy.ssh as AclSshRules] : []

        return new ACLBuilder(
            { ...doc.legacy.groups },
            { ...doc.legacy.tagOwners },
            { ...doc.legacy.hosts },
            [...doc.legacy.acls as AclPolicies],
            [...ssh],
            doc.legacy.grants ? [...doc.legacy.grants] : undefined,
            doc.legacy.nodeAttrs ? [...doc.legacy.nodeAttrs] : undefined,
            doc.legacy.tests ? [...doc.legacy.tests] : undefined,
            doc.legacy.sshTests ? [...doc.legacy.sshTests] : undefined,
            doc.legacy.postures ? [...doc.legacy.postures] : undefined,
            doc.legacy.randomizeClientPort,
            doc.raw,
            doc.unsupportedFields,
        )
    }

    setGrants(grants: PolicyGrant[] | undefined) {
        this.grants = grants === undefined ? undefined : [...grants]
    }

    getGrants(): PolicyGrant[] | undefined {
        return this.grants
    }

    setNodeAttrs(nodeAttrs: PolicyNodeAttr[] | undefined) {
        this.nodeAttrs = nodeAttrs === undefined ? undefined : [...nodeAttrs]
    }

    getNodeAttrs(): PolicyNodeAttr[] | undefined {
        return this.nodeAttrs
    }

    setTests(tests: PolicyTest[] | undefined) {
        this.tests = tests === undefined ? undefined : [...tests]
    }

    getTests(): PolicyTest[] | undefined {
        return this.tests
    }

    setSshTests(sshTests: PolicySshTest[] | undefined) {
        this.sshTests = sshTests === undefined ? undefined : [...sshTests]
    }

    getSshTests(): PolicySshTest[] | undefined {
        return this.sshTests
    }

    setPostures(postures: PolicyPosture[] | undefined) {
        this.postures = postures === undefined ? undefined : [...postures]
    }

    getPostures(): PolicyPosture[] | undefined {
        return this.postures
    }

    setRandomizeClientPort(randomizeClientPort: boolean | undefined) {
        this.randomizeClientPort = randomizeClientPort
    }

    getRandomizeClientPort(): boolean | undefined {
        return this.randomizeClientPort
    }

    private static getPrefix(name: string): PrefixType | null {
        return getPrefix(name)
    }

    // remove the group: prefix if it exists
    private static stripPrefix(name: string): string {
        return stripPrefix(name)
    }

    private static addPrefix(name: string, type: PrefixType): string {
        return addPrefix(name, type)
    }

    private static normalizePrefix(name: string, type: PrefixType): { prefixed: string, stripped: string } {
        return normalizePrefix(name, type)
    }

    static normalizeTag(tag: string): {prefixed: string, stripped: string} {
        return ACLBuilder.normalizePrefix(tag, "tag")
    }

    static normalizeGroup(group: string): {prefixed: string, stripped: string} {
        return ACLBuilder.normalizePrefix(group, "group")
    }

    // throws an error if the name is invalid, otherwise returns the normalized group name
    static validateGroupName(name: string): string {
        return validateGroupName(name)
    }

    // tag names can contain anything but spaces
    static validateTagName(name: string): string {
        return validateTagName(name)
    }

    // host names can contain anything but spaces
    static validateHostName(name: string): string {
        return validateHostName(name)
    }

    static validateHostValue(value: string): string {
        return validateHostValue(value)
    }

    // deep clone of current ACL
    clone(): ACLBuilder {
        return JSON.parse(JSON.stringify(this)) as ACLBuilder
    }

    /*
     * Host:
     * --------------------------------
     * createHost(name, cidr)
     * getHostCIDR(name)
     * setHost(name, cidr)
     * renameHost(nameOld, nameNew)
     * getHostNames() string[]
     * getHosts(name) [string, string][]
     * hostExists(name)
     * deleteHost(name)
     */


    createHost(name: string, cidr: string) {
        createHostInPolicy(this, name, cidr)
    }

    getHostCIDR(name: string): string | undefined {
        return this.hosts[name]
    }

    setHost(name: string, value: string) {
        setHostInPolicy(this, name, value)
    }

    renameHost(nameOld: string, nameNew: string) {
        renameHostInPolicy(this, nameOld, nameNew)
    }

    getHostNames(): string[] {
        return Object.keys(this.hosts)
    }

    getHosts(): [string, string][] {
        return Object.entries(this.hosts)
    }

    deleteHost(name: string) {
        deleteHostFromPolicy(this, name)
    }


    /*
     * Tags:
     * --------------------------------
     * createTag(name)
     * renameTag(nameOld, nameNew)
     * setTagOwners(name, members[])
     * getTagNames() string[]
     * getTagOwners(name) [string, string[]]
     * getTagOwnersTyped(name) {users: string[], groups: string[], tags: string[]}
     * tagExists(name)
     * deleteTag(name)
     */

    createTag(name: string) {
        createTagInPolicy(this, name)
    }

    renameTag(nameOld: string, nameNew: string) {
        renameTagInPolicy(this, nameOld, nameNew)
    }

    setTagOwners(name: string, owners: TagOwners) {
        setTagOwnersInPolicy(this, name, owners)
    }

    getTagNames(withPrefix: boolean = false): string[] {
        return Object.keys(this.tagOwners).map(name => {
            let {stripped, prefixed} = ACLBuilder.normalizePrefix(name, 'tag')
            return withPrefix ? prefixed : stripped
        })
    }

    getTagOwners(name: string): string[]{
        const { stripped, prefixed } = ACLBuilder.normalizePrefix(name, 'tag')
        const owners = this.tagOwners[prefixed] 
        if (owners === undefined) {
            throw new Error(`Tag ${stripped} does not exist`)
        }
        return owners
    }

    static TagOwnersByType(owners: TagOwners): TagOwnersTyped {
        const ownersTyped: TagOwnersTyped = {
            users: [],
            groups: [],
            tags: [],
        }

        for (const owner of owners) {
            const prefix = ACLBuilder.getPrefix(owner)
            if (prefix === 'group') {
                ownersTyped.groups.push(owner)
            } else if (prefix === 'tag') {
                ownersTyped.tags.push(owner)
            } else {
                ownersTyped.users.push(owner)
            }
        }

        return ownersTyped
    }

    getTagOwnersTyped(name: string): TagOwnersTyped {
        const { stripped, prefixed } = ACLBuilder.normalizePrefix(name, 'tag')
        const owners = this.tagOwners[prefixed]
        if (owners === undefined) {
            throw new Error(`Tag ${stripped} does not exist`)
        }
        return ACLBuilder.TagOwnersByType(owners)
    }

    tagExists(name: string): boolean {
        const { prefixed } = ACLBuilder.normalizePrefix(name, 'tag')
        return this.tagOwners[prefixed] !== undefined
    }

    deleteTag(name: string) {
        deleteTagFromPolicy(this, name)
    }


    /*
     * GROUPS:
     * --------------------------------
     * createGroup(name)
     * renameGroup(nameOld, nameNew)
     * setGroupMembers(name, members[])
     * getGroupNames() string[]
     * getGroupMembers(name)
     * groupExists(name)
     * deleteGroup(name)
     */
    createGroup(name: string) {
        createGroupInPolicy(this, name)
    }

    renameGroup(nameOld: string, nameNew: string) {
        renameGroupInPolicy(this, nameOld, nameNew)
    }

    setGroupMembers(name: string, members: string[]) {
        setGroupMembersInPolicy(this, name, members)
    }

    getGroupByName(name: string): string[] {
        const { stripped, prefixed } = ACLBuilder.normalizePrefix(name, 'group')
        return this.groups[name]
    }

    getGroupNames(withPrefix: boolean = false): string[] {
        const names = []
        for (const name of Object.keys(this.groups)) {
            const { stripped, prefixed } = ACLBuilder.normalizePrefix(name, 'group')
            names.push(withPrefix ? prefixed : stripped)
        }
        return names
    }

    getGroupMembers(name: string): string[] | undefined {
        const { prefixed } = ACLBuilder.normalizePrefix(name, 'group')
        return this.groups[prefixed]
    }

    groupExists(name: string): boolean {
        const { prefixed } = ACLBuilder.normalizePrefix(name, 'group')
        return this.groups[prefixed] !== undefined
    }

    deleteGroup(name: string) {
        deleteGroupFromPolicy(this, name)
    }
    /*
     * POLICIES:
     * --------------------------------
     * createPolicy(policy)
     * getAllPolicies()
     * getPolicy(idx)
     * setPolicy(idx, policy)
     * delPolicy(idx)
     * setPolicySrc(idx, src)
     * setPolicyDst(idx, dst)
     * setPolicyProto(idx, proto)
     */

	public static getPolicyDstHost(dst: string): string {
        return getPolicyDstHost(dst)
	}

	public static getPolicyDstPorts(dst: string): string {
        return getPolicyDstPorts(dst)
	}


    createPolicy(policy: AclPolicy) {
        if (policy["#ha-meta"] === undefined) {
            policy["#ha-meta"] = HAMetaDefault
        }

        this.acls.push(policy)
    }

    getAllPolicies(): AclPolicies {
        return this.acls
    }

    getPolicy(idx: number): AclPolicy {
        this.validatePolicyIndex(idx)
        return this.acls[idx]
    }

    private validatePolicyIndex(idx: number) {
        if (idx >= this.acls.length || idx < 0) {
            throw new Error(`Policy does not exist at index '${idx}'`)
        }
    }

    public static EmptyPolicy(): AclPolicy {
        return {
            "#ha-meta": HAMetaDefault,
            action: "accept",
            proto: undefined,
            src: [],
            dst: [],
        }
    }

    public static DefaultPolicy(): AclPolicy {
        return {
            "#ha-meta": HAMetaDefault,
            action: "accept",
            proto: undefined,
            src: [ "*" ],
            dst: [ "*:*" ],
        }
    }

    setPolicySrc(idx: number, src: string[]) {
        this.validatePolicyIndex(idx)
        this.acls[idx].src = src
    }

    setPolicyDst(idx: number, dst: string[]) {
        this.validatePolicyIndex(idx)
        this.acls[idx].dst = dst
    }

    setPolicyProto(idx: number, proto: string | undefined) {
        this.validatePolicyIndex(idx)
        this.acls[idx].proto = proto
    }

    setPolicy(idx: number, policy: AclPolicy) {
        this.validatePolicyIndex(idx)
        this.acls[idx] = {
            action: policy.action,
            proto: policy.proto,
            src: policy.src,
            dst: policy.dst,
        }
    }

    delPolicy(idx: number) {
        this.validatePolicyIndex(idx)
        this.acls.splice(idx, 1)
    }

    /*
     * SSH Rules:
     * --------------------------------
     * createSshRule(rule)
     * getAllPolicies()
     * getPolicy(idx)
     * setPolicy(idx, policy)
     * delPolicy(idx)
     * setPolicySrc(idx, src)
     * setPolicyDst(idx, dst)
     * setPolicyProto(idx, proto)
     */

    createSshRule(rule: AclSshRule) {
        if (this.ssh === undefined){
            this.ssh = []
        }
        this.ssh.push(rule)
    }

    getAllSshRules(): AclSshRules|undefined {
        return this.ssh
    }

    getSshRule(idx: number): AclSshRule {
        this.validateSshRuleIndex(idx)
        if (this.ssh !== undefined){
            return this.ssh[idx]
        }
        throw new Error("No SSH Rules defined")
    }

    private validateSshRuleIndex(idx: number) {
        if (this.ssh === undefined || idx >= this.ssh.length || idx < 0) {
            throw new Error(`SSH Rule does not exist at index '${idx}'`)
        }
    }

    public static DefaultSshRule(): AclSshRule {
        return {
            action: "accept",
            src: [],
            dst: [],
            users: [],
        }
    }

    public static getPolicyTitle(pol: AclPolicy, idx: number): string {
		const pfx = "#" + (idx + 1) + ": "
		if (pol["#ha-meta"] === undefined || pol["#ha-meta"].name === "") {
			return pfx + "Policy #" + (idx + 1)
		}
		return pfx + pol["#ha-meta"].name
	}

    setSshRuleSrc(idx: number, src: string[]) {
        this.validateSshRuleIndex(idx)
        if (this.ssh != undefined) {
            this.ssh[idx].src = src
        }
    }

    setSshRuleDst(idx: number, dst: string[]) {
        this.validateSshRuleIndex(idx)
        if (this.ssh !== undefined) {
            this.ssh[idx].dst = dst
        }
    }

    setSshRuleUsers(idx: number, users: string[]) {
        this.validateSshRuleIndex(idx)
        if (this.ssh !== undefined) {
            this.ssh[idx].users = users
        }
    }

    setSshRule(idx: number, rule: AclSshRule) {
        this.validateSshRuleIndex(idx)
        if (this.ssh !== undefined) {
            this.ssh[idx] = {
                action: rule.action,
                src: rule.src,
                dst: rule.dst,
                users: rule.users,
            }
        }
    }

    delSshRule(idx: number) {
        this.validateSshRuleIndex(idx)
        if (this.ssh !== undefined) {
            this.ssh.splice(idx, 1)
        }
    }
}
