'use client'

import { useActionState } from 'react'
import { Plus, X } from 'lucide-react'
import {
  createGiftProgramAction,
  enrolOrganisationAction,
  removeEnrolmentAction,
  setAllocationAction,
} from '@/lib/actions/slh.actions'

/**
 * The buttons that approve a referring organisation.
 *
 * Thin wrappers around the server actions, here only so a failure is visible.
 * A plain `<form action={…}>` throws the result away, and "did that save?" is a
 * bad question to leave somebody asking about an allocation.
 *
 * The guards are all in the actions. Nothing here is a permission check.
 */
type Result = { success: boolean; error?: string }

/** `useActionState` wants (prev, formData); the actions only want formData. */
function useFormAction(run: (formData: FormData) => Promise<Result>) {
  return useActionState<Result | null, FormData>(async (_prev, formData) => run(formData), null)
}

function Problem({ state }: { state: Result | null }) {
  if (!state || state.success) return null
  return (
    <span role="alert" className="text-[13px] font-semibold text-[#c8102e]">
      {state.error ?? 'That didn’t save.'}
    </span>
  )
}

export function StartProgramButton({ year }: { year: number }) {
  const [state, action, pending] = useFormAction(() => createGiftProgramAction())
  return (
    <form action={action} className="mt-5 grid justify-items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[#c8102e] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#9d0b23] disabled:opacity-60"
      >
        {pending ? 'Starting…' : `Start Santa’s Little Helpers ${year}`}
      </button>
      <Problem state={state} />
    </form>
  )
}

export function ApproveButton({ organisationId }: { organisationId: string }) {
  const [state, action, pending] = useFormAction(enrolOrganisationAction)
  return (
    <form action={action} className="shrink-0 text-right">
      <input type="hidden" name="organisationId" value={organisationId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-3.5 py-1.5 text-[13px] font-bold hover:border-neutral-900 hover:bg-neutral-900 hover:text-white disabled:opacity-60"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {pending ? 'Approving…' : 'Approve'}
      </button>
      <Problem state={state} />
    </form>
  )
}

/** How many children this organisation may nominate. 0 = approved, not yet set. */
export function AllocationForm({
  organisationId,
  allocation,
}: {
  organisationId: string
  allocation: number
}) {
  const [state, action, pending] = useFormAction(setAllocationAction)
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="organisationId" value={organisationId} />
      <label htmlFor={`alloc-${organisationId}`} className="text-[13px] text-neutral-500">
        May nominate
      </label>
      <input
        id={`alloc-${organisationId}`}
        name="allocation"
        type="number"
        min={0}
        max={1000}
        defaultValue={allocation}
        className="w-20 rounded-full border border-neutral-200 px-3 py-1 text-[13px] font-semibold tabular-nums focus:border-neutral-400 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-neutral-200 px-3 py-1 text-[13px] font-semibold hover:bg-neutral-50 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      {state?.success && !pending && (
        <span className="text-[13px] font-semibold text-neutral-400">Saved</span>
      )}
      <Problem state={state} />
    </form>
  )
}

export function RemoveButton({
  organisationId,
  name,
}: {
  organisationId: string
  name: string
}) {
  const [state, action, pending] = useFormAction(removeEnrolmentAction)
  return (
    <form
      action={action}
      className="ml-auto"
      onSubmit={(e) => {
        // Withdrawing an approval takes an organisation's whole program area
        // away. Cheap to undo — approve again — but not something to do by
        // brushing past a button.
        if (!window.confirm(`Remove ${name} from this year's program?`)) e.preventDefault()
      }}
    >
      <input type="hidden" name="organisationId" value={organisationId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-semibold text-neutral-400 hover:bg-red-50 hover:text-[#c8102e] disabled:opacity-60"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        {pending ? 'Removing…' : 'Remove'}
      </button>
      <Problem state={state} />
    </form>
  )
}
