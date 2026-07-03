import { ACLBuilder } from './acl.svelte'

export class PolicyEditor extends ACLBuilder {
    static fromPolicy(policy: Parameters<typeof ACLBuilder.fromPolicy>[0]): PolicyEditor {
        return ACLBuilder.fromPolicy(policy) as PolicyEditor
    }

    static defaultPolicy(): PolicyEditor {
        return ACLBuilder.defaultACL() as PolicyEditor
    }

    static emptyPolicy(): PolicyEditor {
        return ACLBuilder.emptyACL() as PolicyEditor
    }
}
