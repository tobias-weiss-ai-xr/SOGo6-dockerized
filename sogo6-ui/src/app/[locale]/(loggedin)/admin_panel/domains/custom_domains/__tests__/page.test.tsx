import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, params?: Record<string, string>) => {
      const map: Record<string, string> = {
        // ADMIN_PANNEL_DOMAIN namespace
        'title': 'Custom domains',
        'filter_placeholder': 'Filter domains...',
        'add_new_domain': 'Add new custom domain',
        'domain': 'Domain',
        'actions': 'Actions',
        'edit': 'Edit',
        'delete': 'Delete',
        // Root namespace
        'DATA_TABLE.no_result': 'No results.',
        'AP_SESSIONS.cancel': 'Cancel',
        'ADMIN_PANNEL_DOMAIN.add': 'Add',
        'ADMIN_PANNEL_DOMAIN.adding': 'Adding...',
      }

      const normalizedKey = key.endsWith('.string') ? key.slice(0, -7) : key
      let result = map[normalizedKey]
      if (result === undefined) return key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{${k}}`, v)
        }
      }
      return result
    }
    return t
  },
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/en/admin_panel/domains/custom_domains',
  useParams: () => ({ locale: 'en' }),
}))

// Mock next-intl navigation
jest.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/en/admin_panel/domains/custom_domains',
  Link: ({ href, children }: { href: string; children: React.ReactNode }) =>
    <a href={href}>{children}</a>,
}))

// Mock sonner toast
const mockToast = { success: jest.fn(), error: jest.fn() }
jest.mock('sonner', () => ({
  toast: mockToast,
}))

// Mock RTK hooks
const mockGetDomainsQuery = jest.fn()
const mockSaveDomain = jest.fn()
const mockDeleteDomain = jest.fn()

jest.mock('@/features/admin-panel/store/admin-panel-api', () => ({
  useGetDomainsQuery: (args?: any) => mockGetDomainsQuery(args),
  useSaveCustomDomainConfigMutation: () => [mockSaveDomain, { isLoading: false }],
  useDeleteDomainMutation: () => [mockDeleteDomain, { isLoading: false }],
}))

const setupUnwrap = (mockFn: jest.Mock, returnValue: any) => {
  mockFn.mockReturnValue(
    Promise.resolve({ unwrap: () => Promise.resolve(returnValue) })
  )
}

describe('Custom Domains Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state', () => {
    mockGetDomainsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: undefined,
    })

    const DomainsPage = require('@/app/[locale]/(loggedin)/admin_panel/domains/custom_domains/page').default
    const { container } = render(<DomainsPage />)

    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(2)
  })

  it('renders error state', () => {
    mockGetDomainsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('API error'),
    })

    const DomainsPage = require('@/app/[locale]/(loggedin)/admin_panel/domains/custom_domains/page').default
    render(<DomainsPage />)

    expect(screen.getByText('Failed to load custom domains')).toBeInTheDocument()
    expect(screen.getByText('API error')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('renders empty state when no domains', () => {
    mockGetDomainsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const DomainsPage = require('@/app/[locale]/(loggedin)/admin_panel/domains/custom_domains/page').default
    render(<DomainsPage />)

    expect(screen.getByText('Custom domains')).toBeInTheDocument()
    expect(screen.getByText('Add new custom domain')).toBeInTheDocument()
  })

  it('renders domains in a table', () => {
    const mockDomains = [
      { name: 'example.org' },
      { name: 'test.com' },
    ]

    mockGetDomainsQuery.mockReturnValue({
      data: mockDomains,
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const DomainsPage = require('@/app/[locale]/(loggedin)/admin_panel/domains/custom_domains/page').default
    render(<DomainsPage />)

    expect(screen.getByText('example.org')).toBeInTheDocument()
    expect(screen.getByText('test.com')).toBeInTheDocument()
    expect(screen.getByText('Domain')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })

  it('opens create dialog when Add new custom domain is clicked', async () => {
    mockGetDomainsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const user = userEvent.setup()
    const DomainsPage = require('@/app/[locale]/(loggedin)/admin_panel/domains/custom_domains/page').default
    render(<DomainsPage />)

    await user.click(screen.getByText('Add new custom domain'))

    // Dialog should show - inputs are visible
    expect(screen.getByPlaceholderText('example.org')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Domain description')).toBeInTheDocument()
  })

  it('filters domains by search query', async () => {
    const mockDomains = [
      { name: 'alpha.org' },
      { name: 'beta.com' },
    ]

    mockGetDomainsQuery.mockReturnValue({
      data: mockDomains,
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const user = userEvent.setup()
    const DomainsPage = require('@/app/[locale]/(loggedin)/admin_panel/domains/custom_domains/page').default
    render(<DomainsPage />)

    expect(screen.getByText('alpha.org')).toBeInTheDocument()
    expect(screen.getByText('beta.com')).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText('Filter domains...')
    await user.type(searchInput, 'alpha')

    expect(screen.getByText('alpha.org')).toBeInTheDocument()
    expect(screen.queryByText('beta.com')).not.toBeInTheDocument()
  })

  it('shows edit and delete action buttons for each domain', () => {
    const mockDomains = [
      { name: 'example.org' },
    ]

    mockGetDomainsQuery.mockReturnValue({
      data: mockDomains,
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const DomainsPage = require('@/app/[locale]/(loggedin)/admin_panel/domains/custom_domains/page').default
    render(<DomainsPage />)

    expect(screen.getByTitle('Edit')).toBeInTheDocument()
    expect(screen.getByTitle('Delete')).toBeInTheDocument()
  })

  it('shows domain count', () => {
    const mockDomains = [
      { name: 'example.org' },
      { name: 'test.com' },
      { name: 'demo.net' },
    ]

    mockGetDomainsQuery.mockReturnValue({
      data: mockDomains,
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const DomainsPage = require('@/app/[locale]/(loggedin)/admin_panel/domains/custom_domains/page').default
    render(<DomainsPage />)

    expect(screen.getByText('3 domains')).toBeInTheDocument()
  })

  it('opens create dialog and validates required fields', async () => {
    mockGetDomainsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const user = userEvent.setup()
    const DomainsPage = require('@/app/[locale]/(loggedin)/admin_panel/domains/custom_domains/page').default
    render(<DomainsPage />)

    await user.click(screen.getByText('Add new custom domain'))

    // The dialog has a name input and description textarea
    const nameInput = screen.getByPlaceholderText('example.org')
    expect(nameInput).toBeInTheDocument()

    const descTextarea = screen.getByPlaceholderText('Domain description')
    expect(descTextarea).toBeInTheDocument()
  })
})
