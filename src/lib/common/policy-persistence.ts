import { getPolicy, setPolicy } from './api'

export type PolicySerializable = {
    JSON: (space?: number) => string
}

export async function loadPolicyDocumentText(): Promise<string> {
    return await getPolicy()
}

export async function savePolicyDocument(policy: PolicySerializable): Promise<void> {
    await setPolicy(policy)
}
