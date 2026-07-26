import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next-intl - Theme page uses useTranslations('AP_THEME')
jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, params?: Record<string, string>) => {
      const map: Record<string, string> = {
        // AP_THEME namespace
        'title': 'Theme Settings',
        'description': 'Customize the look and feel of the SOGo interface',
        'form_title': 'Custom Theme',
        'form_description': 'Configure colors, logo, and custom CSS for the groupware interface',
        'save': 'Save Changes',
        'saving': 'Saving\u2026',
        'saved': 'Theme settings saved successfully',
        'save_error': 'Failed to save: {message}',
        'load_error': 'Failed to load theme settings',
        'retry': 'Retry',
        'unsaved_changes': 'You have unsaved changes',
        'fields.primary.label': 'Primary Color',
        'fields.primary.description': 'HSL values for the primary color (e.g. 180 25% 40%)',
        'fields.primary_foreground.label': 'Primary Foreground',
        'fields.primary_foreground.description': 'Text color on primary backgrounds',
        'fields.background.label': 'Background',
        'fields.background.description': 'HSL values for the page background',
        'fields.foreground.label': 'Foreground',
        'fields.foreground.description': 'Default text color',
        'fields.sidebar_background.label': 'Sidebar Background',
        'fields.sidebar_background.description': 'HSL values for the sidebar background',
        'fields.sidebar_foreground.label': 'Sidebar Foreground',
        'fields.sidebar_foreground.description': 'Text color in the sidebar',
        'fields.sidebar_primary.label': 'Sidebar Primary',
        'fields.sidebar_primary.description': 'Primary accent color in the sidebar',
        'fields.sidebar_accent.label': 'Sidebar Accent',
        'fields.sidebar_accent.description': 'Accent color in the sidebar',
        'fields.header_background.label': 'Header Background',
        'fields.header_background.description': 'HSL values for the top header bar',
        'fields.header_foreground.label': 'Header Foreground',
        'fields.header_foreground.description': 'Text color in the header',
        'fields.logo_url.label': 'Logo URL',
        'fields.logo_url.description': 'URL of the custom logo image (optional)',
        'fields.custom_css.label': 'Custom CSS',
        'fields.custom_css.description': 'Additional CSS rules to inject (optional)',
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
  usePathname: () => '/en/admin_panel/theme',
  useParams: () => ({ locale: 'en' }),
}))

// Mock sonner toast
const mockToast = { success: jest.fn(), error: jest.fn() }
jest.mock('sonner', () => ({
  toast: mockToast,
}))

// Mock RTK hooks
const mockGetThemeQuery = jest.fn()
const mockPatchTheme = jest.fn()

jest.mock('@/features/admin-panel/store/admin-panel-api', () => ({
  useGetThemeQuery: (args?: any) => mockGetThemeQuery(args),
  usePatchThemeMutation: () => [mockPatchTheme, { isLoading: false }],
}))

const setupUnwrap = (mockFn: jest.Mock, returnValue: any) => {
  mockFn.mockReturnValue(
    Promise.resolve({ unwrap: () => Promise.resolve(returnValue) })
  )
}

describe('Theme Settings Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state', () => {
    mockGetThemeQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: undefined,
    })

    const ThemePage = require('@/app/[locale]/(loggedin)/admin_panel/theme/page').default
    const { container } = render(<ThemePage />)

    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })

  it('renders error state on API error', () => {
    mockGetThemeQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to load'),
    })

    const ThemePage = require('@/app/[locale]/(loggedin)/admin_panel/theme/page').default
    render(<ThemePage />)

    expect(screen.getByText('Failed to load theme settings')).toBeInTheDocument()
    expect(screen.getByText('Failed to load')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('renders the theme fields when data loads', () => {
    mockGetThemeQuery.mockReturnValue({
      data: {
        data: {
          primary: '180 25% 40%',
          primary_foreground: '0 0% 100%',
          background: '0 0% 100%',
          foreground: '240 5% 10%',
          sidebar_background: '180 25% 40%',
          sidebar_foreground: '0 0% 100%',
          sidebar_primary: '180 60% 45%',
          sidebar_accent: '180 25% 60%',
          header_background: '0 0% 100%',
          header_foreground: '270 60% 60%',
          logo_url: '',
          custom_css: '',
        },
      },
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const ThemePage = require('@/app/[locale]/(loggedin)/admin_panel/theme/page').default
    render(<ThemePage />)

    // Check a few field labels
    expect(screen.getByText('Primary Color')).toBeInTheDocument()
    expect(screen.getByText('Sidebar Background')).toBeInTheDocument()
    expect(screen.getByText('Logo URL')).toBeInTheDocument()
    expect(screen.getByText('Custom CSS')).toBeInTheDocument()

    // Save button
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
  })

  it('renders the page title and description', () => {
    mockGetThemeQuery.mockReturnValue({
      data: {
        data: {
          primary: '180 25% 40%',
        },
      },
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const ThemePage = require('@/app/[locale]/(loggedin)/admin_panel/theme/page').default
    render(<ThemePage />)

    expect(screen.getByText('Theme Settings')).toBeInTheDocument()
    expect(screen.getByText('Customize the look and feel of the SOGo interface')).toBeInTheDocument()
  })

  it('shows color input fields with values', () => {
    mockGetThemeQuery.mockReturnValue({
      data: {
        data: {
          primary: '200 50% 50%',
          sidebar_background: '220 30% 30%',
        },
      },
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const ThemePage = require('@/app/[locale]/(loggedin)/admin_panel/theme/page').default
    render(<ThemePage />)

    const primaryInput = screen.getByLabelText('Primary Color')
    expect(primaryInput).toHaveValue('200 50% 50%')

    const sidebarInput = screen.getByLabelText('Sidebar Background')
    expect(sidebarInput).toHaveValue('220 30% 30%')
  })

  it('shows text input for logo_url', () => {
    mockGetThemeQuery.mockReturnValue({
      data: {
        data: {
          logo_url: 'https://example.com/logo.png',
        },
      },
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const ThemePage = require('@/app/[locale]/(loggedin)/admin_panel/theme/page').default
    render(<ThemePage />)

    const logoInput = screen.getByLabelText('Logo URL')
    expect(logoInput).toHaveValue('https://example.com/logo.png')
  })

  it('shows textarea for custom CSS', () => {
    const customCss = ':root { --custom: value; }'

    mockGetThemeQuery.mockReturnValue({
      data: {
        data: {
          custom_css: customCss,
        },
      },
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const ThemePage = require('@/app/[locale]/(loggedin)/admin_panel/theme/page').default
    render(<ThemePage />)

    const cssInput = screen.getByLabelText('Custom CSS')
    expect(cssInput).toHaveValue(customCss)
  })

  it('shows unsaved changes indicator after modifying a field', async () => {
    mockGetThemeQuery.mockReturnValue({
      data: {
        data: {
          primary: '180 25% 40%',
          logo_url: '',
          custom_css: '',
        },
      },
      isLoading: false,
      isError: false,
      error: undefined,
    })

    const user = userEvent.setup()
    const ThemePage = require('@/app/[locale]/(loggedin)/admin_panel/theme/page').default
    render(<ThemePage />)

    // Modify the primary color input
    const primaryInput = screen.getByLabelText('Primary Color')
    await user.clear(primaryInput)
    await user.type(primaryInput, '200 50% 50%')

    expect(screen.getByText('You have unsaved changes')).toBeInTheDocument()
  })

  it('calls patchTheme when Save Changes is clicked', async () => {
    const initialData = {
      primary: '180 25% 40%',
      primary_foreground: '0 0% 100%',
      background: '0 0% 100%',
      foreground: '240 5% 10%',
      sidebar_background: '180 25% 40%',
      sidebar_foreground: '0 0% 100%',
      sidebar_primary: '180 60% 45%',
      sidebar_accent: '180 25% 60%',
      header_background: '0 0% 100%',
      header_foreground: '270 60% 60%',
      logo_url: '',
      custom_css: '',
    }

    mockGetThemeQuery.mockReturnValue({
      data: { data: initialData },
      isLoading: false,
      isError: false,
      error: undefined,
    })

    setupUnwrap(mockPatchTheme, { success: true })

    const user = userEvent.setup()
    const ThemePage = require('@/app/[locale]/(loggedin)/admin_panel/theme/page').default
    render(<ThemePage />)

    // Modify primary color
    const primaryInput = screen.getByLabelText('Primary Color')
    await user.clear(primaryInput)
    await user.type(primaryInput, '200 50% 50%')

    // Click Save Changes
    await user.click(screen.getByText('Save Changes'))

    expect(mockPatchTheme).toHaveBeenCalledWith({
      config: {
        ...initialData,
        primary: '200 50% 50%',
      },
    })
  })
})
