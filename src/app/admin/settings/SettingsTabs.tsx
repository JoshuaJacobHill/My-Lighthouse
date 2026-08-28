'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Save, Loader2, Plus, Trash2, UserPlus, Pencil } from 'lucide-react'
import { format } from 'date-fns'
import { USER_ROLES, ASSIGNABLE_ADMIN_ROLES, ADMIN_ROLE_DESCRIPTIONS } from '@/lib/constants'

/** Badge colour per admin role — purple for the widest access, down to teal. */
const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  CARE_MANAGER: 'bg-orange-100 text-orange-700',
  CHURCH_MANAGER: 'bg-teal-100 text-teal-700',
}

interface AdminUser {
  id: string
  name: string | null
  email: string
  role: string
  isActive: boolean
  canViewDonations: boolean
  lastLoginAt: Date | string | null
}

interface SettingsTabsProps {
  settings: Record<string, string>
  admins: AdminUser[]
  isSuperAdmin: boolean
}

type Tab = 'email' | 'general' | 'availability' | 'induction' | 'admins'

async function saveSettings(
  settings: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('/api/admin/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  })
  return response.json()
}

export function SettingsTabs({ settings, admins, isSuperAdmin }: SettingsTabsProps) {
  const router = useRouter()
  const [tab, setTab] = React.useState<Tab>('email')
  const [values, setValues] = React.useState(settings)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = React.useState(false)

  // Add admin form
  const [addAdminOpen, setAddAdminOpen] = React.useState(false)
  const [addAdminForm, setAddAdminForm] = React.useState({
    name: '',
    email: '',
    password: '',
    role: 'ADMIN',
  })
  const [addAdminLoading, setAddAdminLoading] = React.useState(false)
  const [addAdminError, setAddAdminError] = React.useState<string | null>(null)

  // Edit admin
  const [editAdmin, setEditAdmin] = React.useState<AdminUser | null>(null)
  const [editForm, setEditForm] = React.useState({ name: '', email: '', role: 'ADMIN', password: '', canViewDonations: false })
  const [editLoading, setEditLoading] = React.useState(false)
  const [editError, setEditError] = React.useState<string | null>(null)

  function openEdit(admin: AdminUser) {
    setEditAdmin(admin)
    setEditForm({
      name: admin.name ?? '',
      email: admin.email,
      role: admin.role,
      password: '',
      canViewDonations: admin.canViewDonations,
    })
    setEditError(null)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editAdmin) return
    setEditError(null)
    setEditLoading(true)
    try {
      const body: Record<string, string | boolean> = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        canViewDonations: editForm.canViewDonations,
      }
      if (editForm.password) body.password = editForm.password
      const res = await fetch(`/api/admin/users/${editAdmin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json()
      if (!result.success) {
        setEditError(result.error ?? 'Failed to update user.')
      } else {
        setEditAdmin(null)
        router.refresh()
      }
    } catch {
      setEditError('Something went wrong.')
    }
    setEditLoading(false)
  }

  // Delete admin
  const [deleteAdmin, setDeleteAdmin] = React.useState<AdminUser | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  async function handleDelete() {
    if (!deleteAdmin) return
    setDeleteError(null)
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${deleteAdmin.id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!result.success) {
        setDeleteError(result.error ?? 'Failed to delete user.')
      } else {
        setDeleteAdmin(null)
        router.refresh()
      }
    } catch {
      setDeleteError('Something went wrong.')
    }
    setDeleteLoading(false)
  }

  function update(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    const result = await saveSettings(values)
    setSaving(false)
    if (result.success) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      router.refresh()
    } else {
      setSaveError(result.error ?? 'Save failed.')
    }
  }

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault()
    setAddAdminError(null)
    setAddAdminLoading(true)

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addAdminForm),
      })
      const result = await response.json()
      if (!result.success) {
        setAddAdminError(result.error ?? 'Failed to create admin user.')
      } else {
        setAddAdminOpen(false)
        setAddAdminForm({ name: '', email: '', password: '', role: 'ADMIN' })
        router.refresh()
      }
    } catch {
      setAddAdminError('Something went wrong.')
    } finally {
      setAddAdminLoading(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'email', label: 'Email' },
    { id: 'general', label: 'General' },
    { id: 'availability', label: 'Availability' },
    { id: 'induction', label: 'Induction' },
    ...(isSuperAdmin ? [{ id: 'admins' as Tab, label: 'Admin Users' }] : []),
  ]

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Email tab ─────────────────────────────────────────────────── */}
      {tab === 'email' && (
        <div className="space-y-5 max-w-xl">
          <SettingField
            label="From Name"
            settingKey="email_from_name"
            value={values.email_from_name ?? 'Lighthouse Care Volunteers'}
            onChange={update}
          />
          <SettingField
            label="From Email Address"
            settingKey="email_from_address"
            type="email"
            value={values.email_from_address ?? 'volunteers@lighthousecare.org.au'}
            onChange={update}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email Provider
            </label>
            <select
              value={values.email_provider ?? 'mock'}
              onChange={(e) => update('email_provider', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-white"
            >
              <option value="mock">Mock (development — logs to console)</option>
              <option value="resend">Resend</option>
              <option value="smtp">SMTP</option>
            </select>
          </div>

          {(values.email_provider === 'resend' || !values.email_provider) && (
            <SettingField
              label="Resend API Key"
              settingKey="resend_api_key"
              type="password"
              value={values.resend_api_key ?? ''}
              onChange={update}
              placeholder="re_..."
            />
          )}

          {values.email_provider === 'smtp' && (
            <>
              <SettingField
                label="SMTP Host"
                settingKey="smtp_host"
                value={values.smtp_host ?? ''}
                onChange={update}
                placeholder="mail.example.com"
              />
              <SettingField
                label="SMTP Port"
                settingKey="smtp_port"
                type="number"
                value={values.smtp_port ?? '587'}
                onChange={update}
              />
              <SettingField
                label="SMTP Username"
                settingKey="smtp_user"
                value={values.smtp_user ?? ''}
                onChange={update}
              />
              <SettingField
                label="SMTP Password"
                settingKey="smtp_pass"
                type="password"
                value={values.smtp_pass ?? ''}
                onChange={update}
              />
            </>
          )}

          <SettingField
            label="No-Show Grace Period (minutes)"
            settingKey="noshow_grace_mins"
            type="number"
            value={values.noshow_grace_mins ?? '15'}
            onChange={update}
            helpText="How long after a shift starts before an absent volunteer is marked as a no-show."
          />
          <SettingField
            label="Inactivity Reminder (days)"
            settingKey="inactivity_reminder_days"
            type="number"
            value={values.inactivity_reminder_days ?? '60'}
            onChange={update}
            helpText="Send an inactivity check-in email after this many days without a shift."
          />

          <SaveBar saving={saving} error={saveError} success={saveSuccess} onSave={handleSave} />
        </div>
      )}

      {/* ── General tab ───────────────────────────────────────────────── */}
      {tab === 'general' && (
        <div className="space-y-5 max-w-xl">
          <SettingField
            label="Organisation Name"
            settingKey="org_name"
            value={values.org_name ?? 'Lighthouse Care'}
            onChange={update}
          />
          <SettingField
            label="App Display Name"
            settingKey="app_name"
            value={values.app_name ?? 'Lighthouse Care Volunteers'}
            onChange={update}
          />
          <SettingField
            label="Default Kiosk Location"
            settingKey="kiosk_default_location"
            value={values.kiosk_default_location ?? 'Loganholme'}
            onChange={update}
            helpText="The location pre-selected when the kiosk first loads."
          />
          <SettingField
            label="App URL"
            settingKey="app_url"
            value={values.app_url ?? 'https://my.lighthousecare.org.au'}
            onChange={update}
          />
          <SettingField
            label="Login Page Image URL"
            settingKey="login_hero_image_url"
            value={values.login_hero_image_url ?? ''}
            onChange={update}
            placeholder="https://…"
            helpText="Shown on the left of the sign-in screen. Paste an image URL (e.g. from your website's media library). Leave blank for the default."
          />
          <SettingField
            label="Employment Hero URL"
            settingKey="employment_hero_url"
            value={values.employment_hero_url ?? 'https://secure.employmenthero.com'}
            onChange={update}
            placeholder="https://secure.employmenthero.com"
            helpText="Staff see a 'Payslips & leave' shortcut to this on their dashboard. We deliberately link out rather than pull payroll data into this portal."
          />
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-800">Wellbeing schedule</p>
            <p className="mt-0.5 text-xs text-gray-500">
              The weekly sessions staff see on the fitness challenge page. One per location if the two stores are
              doing different things.
            </p>
            <a
              href="/admin/settings/schedule"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:underline"
            >
              Manage the schedule
            </a>
          </div>
          <SettingField
            label="Apple Shortcut Install Link"
            settingKey="fitness_shortcut_url"
            value={values.fitness_shortcut_url ?? ''}
            onChange={update}
            placeholder="https://www.icloud.com/shortcuts/…"
            helpText="Build the 'Send my steps' shortcut once on an iPhone, share it, and paste the iCloud link here. Staff then install it in one tap instead of building it themselves. Leave blank to hide the button."
          />
          <SettingField
            label="Loganholme Coordinator Email"
            settingKey="loganholme_coordinator_email"
            type="email"
            value={values.loganholme_coordinator_email ?? 'rochelle@lighthousecare.org.au'}
            onChange={update}
            helpText="Receives new volunteer notifications for the Loganholme store."
          />
          <SettingField
            label="Hillcrest Coordinator Email"
            settingKey="hillcrest_coordinator_email"
            type="email"
            value={values.hillcrest_coordinator_email ?? 'georgina@lighthousecare.org.au'}
            onChange={update}
            helpText="Receives new volunteer notifications for the Hillcrest store."
          />

          <SaveBar saving={saving} error={saveError} success={saveSuccess} onSave={handleSave} />
        </div>
      )}

      {/* ── Availability tab ──────────────────────────────────────────── */}
      {tab === 'availability' && (
        <div className="space-y-6 max-w-xl">
          <p className="text-sm text-gray-600">
            Customise the labels and hour ranges shown on the volunteer availability grid and sign-up form.
            These three time periods appear as rows when volunteers set their weekly availability.
          </p>

          {/* Morning */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Morning</h3>
            <SettingField
              label="Label"
              settingKey="availability_morning_label"
              value={values.availability_morning_label ?? 'Morning'}
              onChange={update}
              placeholder="Morning"
            />
            <SettingField
              label="Hours"
              settingKey="availability_morning_hours"
              value={values.availability_morning_hours ?? '9 am – 12 pm'}
              onChange={update}
              placeholder="9 am – 12 pm"
              helpText="Shown below the label in the grid, e.g. &quot;9 am – 12 pm&quot;"
            />
          </div>

          {/* Afternoon */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Afternoon</h3>
            <SettingField
              label="Label"
              settingKey="availability_afternoon_label"
              value={values.availability_afternoon_label ?? 'Afternoon'}
              onChange={update}
              placeholder="Afternoon"
            />
            <SettingField
              label="Hours"
              settingKey="availability_afternoon_hours"
              value={values.availability_afternoon_hours ?? '12 pm – 5 pm'}
              onChange={update}
              placeholder="12 pm – 5 pm"
              helpText="Shown below the label in the grid, e.g. &quot;12 pm – 5 pm&quot;"
            />
          </div>

          {/* Evening */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Evening</h3>
            <SettingField
              label="Label"
              settingKey="availability_evening_label"
              value={values.availability_evening_label ?? 'Evening'}
              onChange={update}
              placeholder="Evening"
            />
            <SettingField
              label="Hours"
              settingKey="availability_evening_hours"
              value={values.availability_evening_hours ?? '5 pm – 9 pm'}
              onChange={update}
              placeholder="5 pm – 9 pm"
              helpText="Shown below the label in the grid, e.g. &quot;5 pm – 9 pm&quot;"
            />
          </div>

          <SaveBar saving={saving} error={saveError} success={saveSuccess} onSave={handleSave} />
        </div>
      )}

      {/* ── Induction tab ────────────────────────────────────────────── */}
      {tab === 'induction' && (
        <div className="space-y-4 max-w-xl">
          <p className="text-sm text-gray-600">
            Manage the content volunteers read and the quiz they complete as part of their
            induction.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/admin/settings/induction"
              className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-5 hover:border-orange-300 hover:bg-orange-50/50 transition-colors group"
            >
              <div className="text-base font-semibold text-gray-900 group-hover:text-orange-600">
                Induction Sections
              </div>
              <p className="text-sm text-gray-500">
                Edit the reading sections volunteers complete before their quiz.
              </p>
            </Link>
            <Link
              href="/admin/settings/quiz"
              className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-5 hover:border-orange-300 hover:bg-orange-50/50 transition-colors group"
            >
              <div className="text-base font-semibold text-gray-900 group-hover:text-orange-600">
                Quiz Questions
              </div>
              <p className="text-sm text-gray-500">
                Add, edit, or remove quiz questions and their correct answers.
              </p>
            </Link>
          </div>
        </div>
      )}

      {/* ── Admin Users tab ──────────────────────────────────────────── */}
      {tab === 'admins' && isSuperAdmin && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Admin Users</h2>
            <button
              onClick={() => setAddAdminOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Add Admin
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Last Login</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {admin.name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{admin.email}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          ROLE_BADGE[admin.role] ?? 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {USER_ROLES[admin.role as keyof typeof USER_ROLES] ?? 'Admin'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {admin.lastLoginAt
                        ? format(new Date(admin.lastLoginAt), 'dd/MM/yyyy h:mm a')
                        : 'Never'}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          admin.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {admin.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(admin)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { setDeleteAdmin(admin); setDeleteError(null) }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Edit admin modal ── */}
          {editAdmin && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Edit Admin User</h2>
                  <button
                    onClick={() => setEditAdmin(null)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  >×</button>
                </div>
                <form onSubmit={handleEdit} className="px-6 py-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={editForm.email}
                      onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none bg-white"
                    >
                      {ASSIGNABLE_ADMIN_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {USER_ROLES[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 space-y-3">
                    <p className="text-xs text-gray-500">
                      {ADMIN_ROLE_DESCRIPTIONS[editForm.role as keyof typeof ADMIN_ROLE_DESCRIPTIONS]}
                    </p>
                    {editForm.role !== 'ADMIN' ? null : (
                      <label className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={editForm.canViewDonations}
                          onChange={(e) => setEditForm((p) => ({ ...p, canViewDonations: e.target.checked }))}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span>
                          <span className="block text-sm font-medium text-gray-700">Can see donations &amp; donors</span>
                          <span className="block text-xs text-gray-500">
                            Access to Funds, Fundraisers, Events, Transactions and the Donors list. Leave off for
                            volunteer-only managers.
                          </span>
                        </span>
                      </label>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                    </label>
                    <input
                      type="password"
                      minLength={8}
                      value={editForm.password}
                      onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Leave blank to keep unchanged"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  {editError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      {editError}
                    </div>
                  )}
                </form>
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setEditAdmin(null)}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEdit}
                    disabled={editLoading}
                    className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  >
                    {editLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Delete confirmation modal ── */}
          {deleteAdmin && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-6 py-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                      <Trash2 className="h-5 w-5 text-red-600" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">Delete Admin User</h2>
                  </div>
                  <p className="text-sm text-gray-600">
                    Are you sure you want to delete <strong>{deleteAdmin.name ?? deleteAdmin.email}</strong>? This cannot be undone.
                  </p>
                  {deleteError && (
                    <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      {deleteError}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={() => setDeleteAdmin(null)}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add admin modal */}
          {addAdminOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Add Admin User</h2>
                  <button
                    onClick={() => {
                      setAddAdminOpen(false)
                      setAddAdminError(null)
                    }}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleAddAdmin} className="px-6 py-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      required
                      value={addAdminForm.name}
                      onChange={(e) =>
                        setAddAdminForm((p) => ({ ...p, name: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={addAdminForm.email}
                      onChange={(e) =>
                        setAddAdminForm((p) => ({ ...p, email: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={addAdminForm.password}
                      onChange={(e) =>
                        setAddAdminForm((p) => ({ ...p, password: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      value={addAdminForm.role}
                      onChange={(e) =>
                        setAddAdminForm((p) => ({ ...p, role: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none bg-white"
                    >
                      {ASSIGNABLE_ADMIN_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {USER_ROLES[r]}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs text-gray-500">
                      {ADMIN_ROLE_DESCRIPTIONS[addAdminForm.role as keyof typeof ADMIN_ROLE_DESCRIPTIONS]}
                    </p>
                  </div>

                  {addAdminError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      {addAdminError}
                    </div>
                  )}
                </form>

                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => {
                      setAddAdminOpen(false)
                      setAddAdminError(null)
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddAdmin}
                    disabled={addAdminLoading}
                    className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  >
                    {addAdminLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Create Admin
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function SettingField({
  label,
  settingKey,
  value,
  onChange,
  type = 'text',
  placeholder,
  helpText,
}: {
  label: string
  settingKey: string
  value: string
  onChange: (key: string, value: string) => void
  type?: string
  placeholder?: string
  helpText?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(settingKey, e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
      />
      {helpText && <p className="mt-1 text-xs text-gray-400">{helpText}</p>}
    </div>
  )
}

function SaveBar({
  saving,
  error,
  success,
  onSave,
}: {
  saving: boolean
  error: string | null
  success: boolean
  onSave: () => void
}) {
  return (
    <div className="pt-2 space-y-3">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Settings saved successfully.
        </div>
      )}
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Settings
      </button>
    </div>
  )
}
