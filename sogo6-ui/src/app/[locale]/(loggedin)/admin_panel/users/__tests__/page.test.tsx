import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, params?: Record<string, string>) => {
      const map: Record<string, string> = {
        // AP_USERS namespace
        'title': 'User Management',
        'description': 'Create, edit, and delete user accounts in the LDAP directory',
        'search.placeholder': 'Search by name, email, or UID...',
        'table.uid': 'UID',
        'table.cn': 'Full Name',
        'table.mail': 'Email',
        'table.uidNumber': 'UID Number',
        'table.actions': 'Actions',
        'table.no_users': 'No users found',
        'create.button': 'Create User',
        'create.title': 'Create New User',
        'create.success': 'User created successfully',
        'create.error': 'Failed to create user',
        'edit.button': 'Edit',
        'edit.title': 'Edit User',
        'edit.save': 'Save Changes',
        'edit.success': 'User updated successfully',
        'edit.error': 'Failed to update user',
        'delete.button': 'Delete',
        'delete.confirm': 'Are you sure you want to delete user {uid}?',
        'delete.success': 'User deleted successfully',
        'delete.error': 'Failed to delete user',
        'form.uid': 'User ID (email)',
        'form.cn': 'Full Name',
        'form.sn': 'Surname',
        'form.givenName': 'Given Name',
        'form.mail': 'Email Address',
        'form.password': 'Password',
        // Root namespace (t('AP_SESSIONS.cancel.string'))
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
  usePathname: () => '/en/admin_panel/users',
  useParams: () => ({ locale: 'en' }),
}))

// Mock sonner toast
const mockToast = { success: jest.fn(), error: jest.fn() }
jest.mock('sonner', () => ({
  toast: mockToast,
}))

// Mock RTK hooks
const mockListUsersQuery = jest.fn()
const mockCreateUser = jest.fn()
const mockUpdateUser = jest.fn()
const mockDeleteUser = jest.fn()

jest.mock('@/features/admin-panel/store/admin-panel-api', () => ({
  useListUsersQuery: (args?: any) => mockListUsersQuery(args),
  useCreateUserMutation: () => [mockCreateUser, { isLoading: false }],
  useUpdateUserMutation: () => [mockUpdateUser, { isLoading: false }],
  useDeleteUserMutation: () => [mockDeleteUser, { isLoading: false }],
}))

describe('Users Admin Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading skeleton while fetching', () => {
    mockListUsersQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: true,
      error: undefined,
    })

    const UsersPage = require('@/app/[locale]/(loggedin)/admin_panel/users/page').default
    const { container } = render(<UsersPage />)

    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })

  it('renders empty state with no users', () => {
    mockListUsersQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
      isFetching: false,
      error: undefined,
    })

    const UsersPage = require('@/app/[locale]/(loggedin)/admin_panel/users/page').default
    render(<UsersPage />)

    expect(screen.getByText('No users found')).toBeInTheDocument()
    expect(screen.getByText('Create User')).toBeInTheDocument()
  })

  it('renders users in a table when data exists', () => {
    const mockUsers = {
      data: [
        { uid: ['user1'], cn: ['User One'], mail: ['user1@example.org'], uidNumber: ['1001'] },
        { uid: ['user2'], cn: ['User Two'], mail: ['user2@example.org'], uidNumber: ['1002'] },
      ],
    }

    mockListUsersQuery.mockReturnValue({
      data: mockUsers,
      isLoading: false,
      isError: false,
      isFetching: false,
      error: undefined,
    })

    const UsersPage = require('@/app/[locale]/(loggedin)/admin_panel/users/page').default
    render(<UsersPage />)

    expect(screen.getByText('User One')).toBeInTheDocument()
    expect(screen.getByText('User Two')).toBeInTheDocument()
    expect(screen.getByText('UID')).toBeInTheDocument()
    expect(screen.getByText('Full Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('UID Number')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })

  it('renders error state on API error', () => {
    mockListUsersQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      error: new Error('Failed to load'),
    })

    const UsersPage = require('@/app/[locale]/(loggedin)/admin_panel/users/page').default
    render(<UsersPage />)

    expect(screen.getByText('Error: Failed to load')).toBeInTheDocument()
  })

  it('shows uid and email in the table', () => {
    const mockUsers = {
      data: [
        { uid: ['admin'], cn: ['Admin User'], mail: ['admin@example.org'] },
      ],
    }

    mockListUsersQuery.mockReturnValue({
      data: mockUsers,
      isLoading: false,
      isError: false,
      isFetching: false,
      error: undefined,
    })

    const UsersPage = require('@/app/[locale]/(loggedin)/admin_panel/users/page').default
    render(<UsersPage />)

    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByText('Admin User')).toBeInTheDocument()
    expect(screen.getByText('admin@example.org')).toBeInTheDocument()
  })

  it('opens create dialog when Create User is clicked', async () => {
    mockListUsersQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
      isFetching: false,
      error: undefined,
    })

    const user = userEvent.setup()
    const UsersPage = require('@/app/[locale]/(loggedin)/admin_panel/users/page').default
    render(<UsersPage />)

    await user.click(screen.getByText('Create User'))

    expect(screen.getByText('Create New User')).toBeInTheDocument()
  })

  it('opens edit dialog when edit button is clicked', async () => {
    const mockUsers = {
      data: [
        { uid: ['user1'], cn: ['User One'], mail: ['user1@example.org'] },
      ],
    }

    mockListUsersQuery.mockReturnValue({
      data: mockUsers,
      isLoading: false,
      isError: false,
      isFetching: false,
      error: undefined,
    })

    const user = userEvent.setup()
    const UsersPage = require('@/app/[locale]/(loggedin)/admin_panel/users/page').default
    render(<UsersPage />)

    const editBtn = screen.getByTitle('Edit')
    expect(editBtn).toBeTruthy()
    await user.click(editBtn)

    expect(screen.getByText('Edit User')).toBeInTheDocument()
  })

  it('opens delete confirmation dialog', async () => {
    const mockUsers = {
      data: [
        { uid: ['user_to_delete'], cn: ['Delete Me'], mail: ['delete@example.org'] },
      ],
    }

    mockListUsersQuery.mockReturnValue({
      data: mockUsers,
      isLoading: false,
      isError: false,
      isFetching: false,
      error: undefined,
    })

    const user = userEvent.setup()
    const UsersPage = require('@/app/[locale]/(loggedin)/admin_panel/users/page').default
    render(<UsersPage />)

    const deleteBtn = screen.getByTitle('Delete')
    expect(deleteBtn).toBeTruthy()
    await user.click(deleteBtn)

    expect(screen.getByText('Are you sure you want to delete user user_to_delete?')).toBeInTheDocument()
  })

  it('renders the page title and description', () => {
    mockListUsersQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
      isFetching: false,
      error: undefined,
    })

    const UsersPage = require('@/app/[locale]/(loggedin)/admin_panel/users/page').default
    render(<UsersPage />)

    expect(screen.getByText('User Management')).toBeInTheDocument()
    expect(screen.getByText('Create, edit, and delete user accounts in the LDAP directory')).toBeInTheDocument()
  })
})
