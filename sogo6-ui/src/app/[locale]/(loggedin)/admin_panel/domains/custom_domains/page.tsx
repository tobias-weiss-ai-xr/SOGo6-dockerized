'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useGetDomainsQuery,
  useSaveCustomDomainConfigMutation,
  useDeleteDomainMutation,
} from '@/features/admin-panel/store/admin-panel-api'
import { useRouter } from '@/lib/i18n/navigation'
import { useTranslations } from 'next-intl'
import { ReactNode, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, ExternalLink, Search, X } from 'lucide-react'

type DomainItem = {
  name: string
  extra_infos?: Record<string, string>
}

export default function CustomDomainsPage(): ReactNode {
  const tRoot = useTranslations('')
  const ts = useTranslations('ADMIN_PANNEL_DOMAIN')
  const router = useRouter()

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Data
  const { data: rawDomains = [], isLoading, isError, error } = useGetDomainsQuery() as {
    data?: DomainItem[]
    isLoading: boolean
    isError: boolean
    error?: any
  }
  const domains: DomainItem[] = Array.isArray(rawDomains) ? rawDomains : []

  // Mutations
  const [saveDomain, { isLoading: isCreating }] = useSaveCustomDomainConfigMutation()
  const [deleteDomain, { isLoading: isDeleting }] = useDeleteDomainMutation()

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')

  // Delete dialog
  const [deletingDomain, setDeletingDomain] = useState<DomainItem | null>(null)

  const resetCreateForm = useCallback(() => {
    setNewName('')
    setNewDescription('')
  }, [])

  const handleCreate = useCallback(async () => {
    const name = newName.trim()
    const desc = newDescription.trim()
    if (!name) {
      toast.error('Domain name is required')
      return
    }
    if (!desc) {
      toast.error('Domain description is required')
      return
    }

    const domainId = encodeURIComponent(name.toLowerCase())
    const target = `/admin_panel/domains/custom_domains/${domainId}`

    try {
      await saveDomain({
        customDomainId: domainId,
        config: {
          domain_name: name,
          domain_description: desc,
        },
      }).unwrap()
      toast.success('Custom domain created')
      setShowCreate(false)
      resetCreateForm()
      router.push(target)
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'data' in err
          ? String((err as { data: { error_msg?: string; message?: string } }).data?.error_msg ??
              (err as { data: { error_msg?: string; message?: string } }).data?.message ?? '')
          : ''
      toast.error(`Failed to create domain${msg ? `: ${msg}` : ''}`)
    }
  }, [newName, newDescription, saveDomain, router, resetCreateForm])

  const handleDelete = useCallback(async () => {
    if (!deletingDomain) return
    const domainName = deletingDomain.name
    try {
      await deleteDomain(domainName).unwrap()
      toast.success(`Domain "${domainName}" deleted`)
      setDeletingDomain(null)
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'data' in err
          ? String((err as { data: { error_msg?: string; message?: string } }).data?.error_msg ??
              (err as { data: { error_msg?: string; message?: string } }).data?.message ?? '')
          : ''
      toast.error(`Failed to delete domain${msg ? `: ${msg}` : ''}`)
    }
  }, [deletingDomain, deleteDomain])

  // Filter domains by search
  const filteredDomains = searchQuery
    ? domains.filter((d) =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : domains

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <h2 className="mb-2 text-xl font-semibold text-destructive">
          Failed to load custom domains
        </h2>
        <p className="mb-4 text-muted-foreground">
          {error instanceof Error
            ? error.message
            : String(error?.status ?? '')}
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          {ts('title.string')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {ts('filter_placeholder.string')}
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={ts('filter_placeholder.string')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {ts('add_new_domain.string')}
        </Button>
      </div>

      {/* Domains Table */}
      {filteredDomains.length === 0 ? (
        <div className="text-muted-foreground text-center py-8">
          {searchQuery
            ? tRoot('DATA_TABLE.no_result.string') || 'No matching domains'
            : ts('add_new_domain.string')
              ? 'No custom domains yet. Add one above.'
              : 'No results.'}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ts('domain.string')}</TableHead>
                <TableHead className="w-[120px]">{ts('actions.string')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDomains.map((domain) => (
                <TableRow key={domain.name}>
                  <TableCell className="font-medium">
                    <a
                      href={`/admin_panel/domains/custom_domains/${encodeURIComponent(domain.name)}`}
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {domain.name}
                      <ExternalLink className="h-3 w-3 inline" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          router.push(
                            `/admin_panel/domains/custom_domains/${encodeURIComponent(domain.name)}`,
                          )
                        }
                        title={ts('edit.string')}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingDomain(domain)}
                        title={ts('delete.string')}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Page info */}
      <div className="text-xs text-muted-foreground mt-2">
        {domains.length} domain{domains.length !== 1 ? 's' : ''}
      </div>

      {/* Create Dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open)
          if (!open) resetCreateForm()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ts('add_new_domain.string')}</DialogTitle>
            <DialogDescription>
              Enter the custom domain name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                {ts('domain.string')} *
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="example.org"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Description *</label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Domain description"
                className="min-h-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false)
                resetCreateForm()
              }}
            >
              {tRoot('AP_SESSIONS.cancel.string') || 'Cancel'}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !newName.trim() || !newDescription.trim()}
            >
              {isCreating ? 'Creating...' : tRoot('ADMIN_PANNEL_DOMAIN.add.string') || 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={!!deletingDomain}
        onOpenChange={(open) => {
          if (!open) setDeletingDomain(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{ts('delete.string')}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete domain{' '}
              <strong>{deletingDomain?.name}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingDomain(null)}>
              {tRoot('AP_SESSIONS.cancel.string') || 'Cancel'}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : ts('delete.string')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
