import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next-intl - System page uses useTranslations('AP_SYSTEM')
jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, params?: Record<string, string>) => {
      const map: Record<string, string> = {
        // AP_SYSTEM namespace
        'title': 'System Settings',
        'description': 'Configure system-wide behaviour for the SOGo instance.',
        'form_title': 'Configuration',
        'form_description': 'Modify global system settings below.',
        'save': 'Save',
        'saving': 'Saving\u2026',
        'saved': 'System settings saved successfully.',
        'save_error': 'Failed to save: {message}',
        'load_error': 'Failed to load system settings.',
        'retry': 'Retry',
        'unsaved_changes': 'You have unsaved changes.',
        'fields.SOGO_S_DIRECT_LOGIN.label': 'Direct Login',
        'fields.SOGO_S_DIRECT_LOGIN.description': 'Allow users to log in without selecting a domain.',
        'fields.SOGO_S_DOMAINLESS_LOGIN.label': 'Domainless Login',
        'fields.SOGO_S_DOMAINLESS_LOGIN.description': 'Allow login with username only (no @domain).',
        'fields.SOGO_S_DO_DOMAIN.label': 'Enable Domains',
        'fields.SOGO_S_DO_DOMAIN.description': 'Enable multi-domain support for this instance.',
        'fields.SOGO_S_REJECT_UNKNOWN_DOMAIN.label': 'Reject Unknown Domains',
        'fields.SOGO_S_REJECT_UNKNOWN_DOMAIN.description': 'Reject login attempts from domains not configured in SOGo.',
        'fields.SOGO_S_SENDMAIL.label': 'Sendmail Path',
        'fields.SOGO_S_SENDMAIL.description': 'Absolute path to the sendmail binary used for outgoing mail.',
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
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/en/admin_panel/system',
  useParams: () => ({ locale: 'en' }),
}))

// Mock sonner toast
const mockToast = { success: jest.fn(), error: jest.fn() }
jest.mock('sonner', () => ({
  toast: mockToast,
}))

// Mock RTK hooks
const mockGetSystemQuery = jest.fn()
const mockPatchSystem = jest.fn()

jest.mock('@/features/admin-panel/store/admin-panel-api', () => ({
  useGetSystemQuery: (args?: any) => mockGetSystemQuery(args),
  usePatchSystemMutation: () => [mockPatchSystem, { isLoading: false }],
}))

const setupUnwrap = (mockFn: jest.Mock, returnValue: any) => {
  mockFn.mockReturnValue(
    Promise.resolve({ unwrap: () => Promise.resolve(returnValue) })
  )
}

describe('System Settings Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state', () => {
    mockGetSystemQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: undefined,
    })

    const SystemPage = require('@/app/[locale]/(loggedin)/admin_panel/system/page').default
    const { container } = render(<SystemPage />)

    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })

  it('renders error state on API error', () => {
    mockGetSystemQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
    })

    const SystemPage = require('@/app/[locale]/(loggedin)/admin_panel/system/page').default
    render(<SystemPage />)

    expect(screen.getByText('Failed to load system settings.')).toBeInTheDocument()
    expect(screen.getByText('Network error')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('renders the setting fields when data loads', () => {
    mockGetSystemQuery.mockReturnValue({
      data: {
        SYSTEM_SETTINGS: {
          SOGO_S_DIRECT_LOGIN: false,
          SOGO_S_DOMAINLESS_LOGIN: true,
          SOGO_S_DO_DOMAIN: false,
          SOGO_S_REJECT_UNKNOWN_DOMAIN: false,
          SOGO_S_SENDMAIL: '/usr/lib/sendmail',
        },
      },
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const SystemPage = require('@/app/[locale]/(loggedin)/admin_panel/system/page').default
    render(<SystemPage />)

    expect(screen.getByText('Direct Login')).toBeInTheDocument()
    expect(screen.getByText('Domainless Login')).toBeInTheDocument()
    expect(screen.getByText('Enable Domains')).toBeInTheDocument()
    expect(screen.getByText('Reject Unknown Domains')).toBeInTheDocument()
    expect(screen.getByText('Sendmail Path')).toBeInTheDocument()

    // Save button should be present
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('renders the page title and description', () => {
    mockGetSystemQuery.mockReturnValue({
      data: {
        SYSTEM_SETTINGS: {
          SOGO_S_DIRECT_LOGIN: false,
        },
      },
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const SystemPage = require('@/app/[locale]/(loggedin)/admin_panel/system/page').default
    render(<SystemPage />)

    expect(screen.getByText('System Settings')).toBeInTheDocument()
    expect(screen.getByText('Configure system-wide behaviour for the SOGo instance.')).toBeInTheDocument()
  })

  it('shows sendmail text input with correct value', () => {
    mockGetSystemQuery.mockReturnValue({
      data: {
        SYSTEM_SETTINGS: {
          SOGO_S_SENDMAIL: '/usr/local/bin/sendmail',
        },
      },
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const SystemPage = require('@/app/[locale]/(loggedin)/admin_panel/system/page').default
    render(<SystemPage />)

    const sendmailInput = screen.getByLabelText('Sendmail Path')
    expect(sendmailInput).toBeInTheDocument()
    expect(sendmailInput).toHaveValue('/usr/local/bin/sendmail')
  })

  it('shows switch toggles for boolean settings', () => {
    mockGetSystemQuery.mockReturnValue({
      data: {
        SYSTEM_SETTINGS: {
          SOGO_S_DIRECT_LOGIN: false,
          SOGO_S_DOMAINLESS_LOGIN: true,
        },
      },
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const SystemPage = require('@/app/[locale]/(loggedin)/admin_panel/system/page').default
    render(<SystemPage />)

    // Switches are rendered with aria-label from the field label
    const directLoginSwitch = screen.getByLabelText('Direct Login')
    expect(directLoginSwitch).toBeInTheDocument()

    const domainlessLoginSwitch = screen.getByLabelText('Domainless Login')
    expect(domainlessLoginSwitch).toBeInTheDocument()
  })

  it('shows unsaved changes indicator after modifying a field', async () => {
    mockGetSystemQuery.mockReturnValue({
      data: {
        SYSTEM_SETTINGS: {
          SOGO_S_SENDMAIL: '/usr/lib/sendmail',
        },
      },
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const user = userEvent.setup()
    const SystemPage = require('@/app/[locale]/(loggedin)/admin_panel/system/page').default
    render(<SystemPage />)

    // Modify the sendmail input
    const sendmailInput = screen.getByLabelText('Sendmail Path')
    await user.clear(sendmailInput)
    await user.type(sendmailInput, '/usr/local/bin/sendmail')

    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument()
  })

  it('calls patchSystem when Save is clicked', async () => {
    const initialSettings = {
      SOGO_S_DIRECT_LOGIN: false,
      SOGO_S_DOMAINLESS_LOGIN: false,
      SOGO_S_DO_DOMAIN: false,
      SOGO_S_REJECT_UNKNOWN_DOMAIN: false,
      SOGO_S_SENDMAIL: '/usr/lib/sendmail',
    }

    mockGetSystemQuery.mockReturnValue({
      data: { SYSTEM_SETTINGS: initialSettings },
      isLoading: false,
      isError: false,
      error: undefined,
    })

    setupUnwrap(mockPatchSystem, { success: true })

    const user = userEvent.setup()
    const SystemPage = require('@/app/[locale]/(loggedin)/admin_panel/system/page').default
    render(<SystemPage />)

    // Modify sendmail to make a change
    const sendmailInput = screen.getByLabelText('Sendmail Path')
    await user.clear(sendmailInput)
    await user.type(sendmailInput, '/usr/local/bin/sendmail')

    // Click Save
    await user.click(screen.getByText('Save'))

    expect(mockPatchSystem).toHaveBeenCalledWith({
      config: {
        SYSTEM_SETTINGS: {
          ...initialSettings,
          SOGO_S_SENDMAIL: '/usr/local/bin/sendmail',
        },
      },
    })
  })
})
