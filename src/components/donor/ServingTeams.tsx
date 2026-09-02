'use client'

import * as React from 'react'
import { Check, ArrowRight } from 'lucide-react'
import { expressTeamInterestAction, withdrawTeamInterestAction } from '@/lib/actions/team.actions'

export interface ServingTeamCard {
  id: string
  name: string
  description: string | null
  joined: boolean
}

export function ServingTeams({ teams }: { teams: ServingTeamCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {teams.map((t) => (
        <TeamCard key={t.id} team={t} />
      ))}
    </div>
  )
}

function TeamCard({ team }: { team: ServingTeamCard }) {
  const [pending, startTransition] = React.useTransition()

  function toggle() {
    startTransition(async () => {
      if (team.joined) await withdrawTeamInterestAction(team.id)
      else await expressTeamInterestAction(team.id)
    })
  }

  return (
    <div className="flex flex-col justify-between rounded-[28px] border border-neutral-200 p-6">
      <div>
        <h3 className="text-lg font-bold tracking-tight">{team.name}</h3>
        {team.description && <p className="mt-1.5 text-sm text-neutral-500">{team.description}</p>}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={
          'mt-5 inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ' +
          (team.joined
            ? 'bg-green-100 text-green-800 hover:bg-green-200'
            : 'bg-orange-500 text-white hover:bg-orange-600')
        }
      >
        {team.joined ? (
          <>
            <Check className="h-4 w-4" /> Interested — tap to withdraw
          </>
        ) : (
          <>
            I&rsquo;m interested <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  )
}
