<script lang="ts">
	import CardListPage from "$lib/cards/CardListPage.svelte";
    import type { ACL } from "$lib/common/acl.svelte";
    import type { PolicyBuilder } from '$lib/common/policy-builder';
    import { PolicyBuilder as PolicyBuilderCtor } from '$lib/common/policy-builder';
    import { loadPolicyDocumentText, savePolicyDocument } from '$lib/common/policy-persistence';
    import { isTextContent, JSONEditor, Mode, type TextContent } from 'svelte-jsoneditor'
    import 'svelte-jsoneditor/themes/jse-theme-dark.css'
	import { debug } from "$lib/common/debug";
	import { toastError, toastSuccess } from "$lib/common/funcs";
	import { CodeBlock, /*getModalStore,*/ getToastStore, modeCurrent, type ModalSettings } from "@skeletonlabs/skeleton";
    
	// import LoaderModal from "$lib/parts/LoaderModal.svelte";
    import JWCC from 'json5'
	import { onMount } from "svelte";
	import { get } from "svelte/store";

    const ToastStore = getToastStore()
    let isLightMode = $state(get(modeCurrent))
    //const ModalStore = getModalStore()

    /*
    const modal: ModalSettings = {
        type: "component",
        component: {
            ref: LoaderModal,
            props: {
                title: "Load ACL Config",
                body: "Import an existing HuJSON configuration.",
                callback: callback,
            }
        },
    };
    */

    let {acl = $bindable(), loading = $bindable(false)}: {acl: PolicyBuilder, loading?: boolean} = $props();
	const aclJSON = $derived(acl.JSON(2))
    let editing = $state(false)
    let aclEditJSON = $state<TextContent>({text:""})

    /*
    function callback(data: string): boolean {
        const policy = JWCC.parse<ACL>(data);
        acl = ACLBuilder.fromPolicy(policy)
        return true
    }
    */

    function applyConfig(config: TextContent) {
        acl = PolicyBuilderCtor.fromPolicy(config.text)
        editing = false
    }

    function resetConfig() {
        acl = PolicyBuilderCtor.defaultACL()
    }

    function loadConfig() {
        loading = true
        loadPolicyDocumentText().then(policy => {
            acl = PolicyBuilderCtor.fromPolicy(JWCC.parse<ACL>(policy))
            toastSuccess("Loaded ACL policy from server", ToastStore)
		}).catch(reason => {
			debug("failed to get policy:", reason)
			toastError(`Unable to get ACL policy from server.`, ToastStore, reason)
		}).finally(() => {
            loading = false
        })
        // ModalStore.trigger(modal)
    }

    async function saveCurrentPolicy() {
        loading = true
        try {
            await savePolicyDocument(acl)
            toastSuccess('Saved ACL Configuration', ToastStore)
        } catch (err) {
            if (err instanceof Error) {
                toastError('', ToastStore, err)
            }
            debug(err)
        } finally {
            loading = false
        }
    }

    onMount(()=>{
        const unsubModeCurrent = modeCurrent.subscribe(m => {
            isLightMode = m
        })
        return ()=>{
            unsubModeCurrent()
        }
    })

</script>

<CardListPage>
    {#if acl.hasUnsupportedPolicyFields()}
        <div class="mb-4 rounded-md border border-warning-500/50 bg-warning-50 p-3 text-sm text-warning-900 dark:bg-warning-900/20 dark:text-warning-100">
            <div class="font-semibold">Advanced policy fields detected</div>
            <div class="mt-1">
                Unknown or unsupported fields are preserved on save. Review advanced fields directly in JSON if needed.
            </div>
            <div class="mt-2 opacity-90">
                {acl.getUnsupportedPolicyFields().slice(0, 8).join(', ')}{#if acl.getUnsupportedPolicyFields().length > 8}, …{/if}
            </div>
        </div>
    {/if}
	<div class="mb-2">
		<button disabled={loading || editing} class="btn-sm rounded-md variant-filled-success disabled:opacity-50 w-32" onclick={() => { 
            saveCurrentPolicy()
        }}>
			Save Config
		</button>
		<button disabled={loading || editing} class="btn-sm rounded-md variant-filled-secondary disabled:opacity-50 w-32" onclick={() => { loadConfig() }}>
			Load Config
		</button>
		<button 
            disabled={loading}
            class="btn-sm rounded-md variant-filled-warning w-32 disabled:opacity-50"
            onclick={() => {
                if(editing){
                    applyConfig(aclEditJSON)
                } else {
                    aclEditJSON.text = acl.JSON(2); 
                    editing = true; 
                }
            }}
        >
            {#if editing}
                Apply Config
            {:else}
                Edit Config
            {/if}
		</button>
        {#if editing}
            <button disabled={loading} class="btn-sm rounded-md variant-filled-error disabled:opacity-50 w-32" onclick={() => { editing = false }}>
                Cancel Editing
            </button>
        {:else}
            <button disabled={loading || editing} class="btn-sm rounded-md variant-filled-error disabled:opacity-50 w-32" onclick={() => { resetConfig() }}>
                Reset Config
            </button>
        {/if}
		<!--button disabled={loading} class="btn-sm rounded-md variant-filled-success" onclick={() => { if(aclEditJSON !== undefined) applyConfig(aclEditJSON) }}>
			Apply Config
		</button-->
	</div>
    {#if !editing}
    <CodeBlock language="json" code={aclJSON} />
    {:else}
    <div class={isLightMode ? "" : "jse-theme-dark" }>
    <JSONEditor parser={JWCC} mode={Mode.text} tabSize={4} bind:content={aclEditJSON} onChange={(updatedContent) => {
        if(isTextContent(updatedContent)){
            aclEditJSON = updatedContent
        }
    }} />
    </div>
    {/if}
</CardListPage>
