import JWCC from 'json5'

type JsonObject = Record<string, unknown>

export type LegacyPolicySection = {
    groups: Record<string, string[]>
    tagOwners: Record<string, string[]>
    hosts: Record<string, string>
    acls: Array<Record<string, unknown>>
    ssh?: Array<Record<string, unknown>>
}

export type PolicyDocument = {
    raw: JsonObject
    legacy: LegacyPolicySection
    unsupportedFields: string[]
}

const LEGACY_TOP_LEVEL_KEYS = new Set(['groups', 'tagOwners', 'hosts', 'acls', 'ssh'])
const LEGACY_ACL_RULE_KEYS = new Set(['#ha-meta', 'action', 'proto', 'src', 'dst'])
const LEGACY_SSH_RULE_KEYS = new Set(['action', 'src', 'dst', 'users'])

function isObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
}

function asObject(value: unknown, fallback: JsonObject = {}): JsonObject {
    return isObject(value) ? value : fallback
}

function asArray(value: unknown, fallback: Array<Record<string, unknown>> = []): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) {
        return fallback
    }
    return value.filter(isObject)
}

function collectUnsupportedFields(raw: JsonObject): string[] {
    const unsupported = new Set<string>()

    for (const key of Object.keys(raw)) {
        if (!LEGACY_TOP_LEVEL_KEYS.has(key)) {
            unsupported.add(key)
        }
    }

    const acls = Array.isArray(raw.acls) ? raw.acls : []
    acls.forEach((rule, idx) => {
        if (!isObject(rule)) {
            unsupported.add(`acls[${idx}]`)
            return
        }
        for (const key of Object.keys(rule)) {
            if (!LEGACY_ACL_RULE_KEYS.has(key)) {
                unsupported.add(`acls[${idx}].${key}`)
            }
        }
    })

    const sshRules = Array.isArray(raw.ssh) ? raw.ssh : []
    sshRules.forEach((rule, idx) => {
        if (!isObject(rule)) {
            unsupported.add(`ssh[${idx}]`)
            return
        }
        for (const key of Object.keys(rule)) {
            if (!LEGACY_SSH_RULE_KEYS.has(key)) {
                unsupported.add(`ssh[${idx}].${key}`)
            }
        }
    })

    return [...unsupported].sort()
}

export function parsePolicyDocument(input: string | unknown): PolicyDocument {
    const parsed = typeof input === 'string' ? JWCC.parse<unknown>(input) : input
    if (!isObject(parsed)) {
        throw new Error('Policy must be a JSON object')
    }

    const raw = clone(parsed)
    const legacy: LegacyPolicySection = {
        groups: asObject(parsed.groups) as Record<string, string[]>,
        tagOwners: asObject(parsed.tagOwners) as Record<string, string[]>,
        hosts: asObject(parsed.hosts) as Record<string, string>,
        acls: asArray(parsed.acls),
        ssh: Array.isArray(parsed.ssh) ? asArray(parsed.ssh) : undefined,
    }

    return {
        raw,
        legacy,
        unsupportedFields: collectUnsupportedFields(raw),
    }
}

export function mergeLegacyPolicyDocument(raw: JsonObject, legacy: LegacyPolicySection): JsonObject {
    const merged = clone(raw)
    merged.groups = clone(legacy.groups)
    merged.tagOwners = clone(legacy.tagOwners)
    merged.hosts = clone(legacy.hosts)
    merged.acls = clone(legacy.acls)

    if (legacy.ssh === undefined) {
        delete merged.ssh
    } else {
        merged.ssh = clone(legacy.ssh)
    }

    return merged
}

export function serialisePolicyDocument(raw: JsonObject, legacy: LegacyPolicySection, space = 0): string {
    return JSON.stringify(mergeLegacyPolicyDocument(raw, legacy), null, space)
}
