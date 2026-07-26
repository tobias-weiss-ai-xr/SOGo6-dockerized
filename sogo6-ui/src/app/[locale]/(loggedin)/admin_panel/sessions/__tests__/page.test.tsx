import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, params?: Record<string, string>) => {
      const map: Record<string, string> = {
        // AP_SESSIONS namespace
        'title': 'Active Sessions',
        'description': 'View and manage active user sessions',
        'refresh': 'Refresh',
        'table.uid': 'User',
        'table.domain': 'Domain',
        'table.last_activity': 'Last Activity',
        'table.actions': 'Actions',
        'table.no_sessions': 'No active sessions found',
        'revoke.button': 'Revoke',
        'revoke.confirm': 'Are you sure you want to revoke this session?',
        'revoke.revoke_selected': 'Revoke Selected',
        'revoke.success': 'Session revoked successfully',
        'revoke.error': 'Failed to revoke session',
        'revoke_inactive.button': 'Revoke Inactive',
        'revoke_inactive.confirm': 'Are you sure you want to revoke all inactive sessions?',
        'revoke_inactive.days': 'Days of inactivity',
        'revoke_inactive.days_placeholder': 'e.g., 30',
        // AP_SESSIONS.revoke.revoke_selected_one with count param
        'revoke.revoke_selected_one': 'Revoke Selected ({count})',
        // AP_SESSIONS.revoke.success_multiple
        'revoke.success_multiple': '{count} sessions revoked successfully',
        // Root namespace (t('AP_SESSIONS.revoke.success_multiple.string'))
        'AP_SESSIONS.revoke.success_multiple': '{count} sessions revoked successfully',
        'AP_SESSIONS.revoke.revoke_selected_one': 'Revoke Selected ({count})',
        'AP_SESSIONS.cancel': 'Cancel',
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
  usePathname: () => '/en/admin_panel/sessions',
  useParams: () => ({ locale: 'en' }),
}))

// Mock sonner toast
const mockToast = { success: jest.fn(), error: jest.fn() }
jest.mock('sonner', () => ({
  toast: mockToast,
}))

// Mock RTK hooks
const mockGetActiveUsersQuery = jest.fn()
const mockRevokeSessions = jest.fn()
const mockRevokeInactiveSessions = jest.fn()

jest.mock('@/features/admin-panel/store/admin-panel-api', () => ({
  useGetActiveUsersQuery: (args?: any) => mockGetActiveUsersQuery(args),
  useRevokeSessionsMutation: () => [mockRevokeSessions, { isLoading: false }],
  useRevokeInactiveSessionsMutation: () => [mockRevokeInactiveSessions, { isLoading: false }],
}))

const setupUnwrap = (mockFn: jest.Mock, returnValue: any) => {
  mockFn.mockReturnValue(
    Promise.resolve({ unwrap: () => Promise.resolve(returnValue) })
  )
}

describe('Sessions Admin Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state', () => {
    mockGetActiveUsersQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: jest.fn(),
    })

    const SessionsPage = require('@/app/[locale]/(loggedin)/admin_panel/sessions/page').default
    const { container } = render(<SessionsPage />)

    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(2)
  })

  it('renders empty state with no sessions', () => {
    mockGetActiveUsersQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    })

    const SessionsPage = require('@/app/[locale]/(loggedin)/admin_panel/sessions/page').default
    render(<SessionsPage />)

    expect(screen.getByText('No active sessions found')).toBeInTheDocument()
    expect(screen.getByText('Active Sessions')).toBeInTheDocument()
  })

  it('renders sessions in a table when data exists', () => {
    const mockSessions = [
      { uid: 'user1', domain: 'example.org', last_activity: '1700000000', session_key: 'key1' },
      { uid: 'user2', domain: 'example.org', last_activity: '1700001000', session_key: 'key2' },
    ]

    mockGetActiveUsersQuery.mockReturnValue({
      data: mockSessions,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    })

    const SessionsPage = require('@/app/[locale]/(loggedin)/admin_panel/sessions/page').default
    render(<SessionsPage />)

    expect(screen.getByText('user1')).toBeInTheDocument()
    expect(screen.getByText('user2')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getByText('Domain')).toBeInTheDocument()
    expect(screen.getByText('Last Activity')).toBeInTheDocument()
    expect(screen.getAllByText('Actions').length).toBeGreaterThanOrEqual(1)
  })

  it('shows domain badges', () => {
    const mockSessions = [
      { uid: 'user1', domain: 'example.org', last_activity: '1700000000', session_key: 'key1' },
    ]

    mockGetActiveUsersQuery.mockReturnValue({
      data: mockSessions,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    })

    const SessionsPage = require('@/app/[locale]/(loggedin)/admin_panel/sessions/page').default
    render(<SessionsPage />)

    expect(screen.getByText('example.org')).toBeInTheDocument()
  })

  it('renders error state on API error', () => {
    mockGetActiveUsersQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: jest.fn(),
    })

    const SessionsPage = require('@/app/[locale]/(loggedin)/admin_panel/sessions/page').default
    render(<SessionsPage />)

    expect(screen.getByText(/Failed to load active sessions/)).toBeInTheDocument()
  })

  it('shows refresh and revoke inactive buttons in toolbar', () => {
    mockGetActiveUsersQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    })

    const SessionsPage = require('@/app/[locale]/(loggedin)/admin_panel/sessions/page').default
    render(<SessionsPage />)

    expect(screen.getByText('Refresh')).toBeInTheDocument()
    expect(screen.getByText('Revoke Inactive')).toBeInTheDocument()
  })

  it('opens revoke dialog when revoke button is clicked', async () => {
    const mockSessions = [
      { uid: 'user1', domain: 'example.org', last_activity: '1700000000', session_key: 'key1' },
    ]

    mockGetActiveUsersQuery.mockReturnValue({
      data: mockSessions,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    })

    const user = userEvent.setup()
    const SessionsPage = require('@/app/[locale]/(loggedin)/admin_panel/sessions/page').default
    render(<SessionsPage />)

    // Find the revoke button (trash icon with aria-label)
    const revokeBtn = screen.getByLabelText('Revoke session for user1')
    expect(revokeBtn).toBeTruthy()
    await user.click(revokeBtn)

    expect(screen.getByText('Are you sure you want to revoke this session?')).toBeInTheDocument()
  })

  it('opens revoke inactive dialog', async () => {
    mockGetActiveUsersQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    })

    const user = userEvent.setup()
    const SessionsPage = require('@/app/[locale]/(loggedin)/admin_panel/sessions/page').default
    render(<SessionsPage />)

    await user.click(screen.getByText('Revoke Inactive'))

    expect(screen.getByText('Are you sure you want to revoke all inactive sessions?')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g., 30')).toBeInTheDocument()
  })

  it('shows select all checkbox', () => {
    const mockSessions = [
      { uid: 'user1', domain: 'example.org', last_activity: '1700000000', session_key: 'key1' },
      { uid: 'user2', domain: 'example.org', last_activity: '1700001000', session_key: 'key2' },
    ]

    mockGetActiveUsersQuery.mockReturnValue({
      data: mockSessions,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    })

    const SessionsPage = require('@/app/[locale]/(loggedin)/admin_panel/sessions/page').default
    render(<SessionsPage />)

    const selectAllCheckbox = screen.getByLabelText('Select all sessions')
    expect(selectAllCheckbox).toBeInTheDocument()
  })

  it('renders the page title and description', () => {
    mockGetActiveUsersQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    })

    const SessionsPage = require('@/app/[locale]/(loggedin)/admin_panel/sessions/page').default
    render(<SessionsPage />)

    expect(screen.getByText('Active Sessions')).toBeInTheDocument()
    expect(screen.getByText('View and manage active user sessions')).toBeInTheDocument()
  })
})
