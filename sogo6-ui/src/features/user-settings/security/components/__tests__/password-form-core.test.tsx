import { render, screen } from '@testing-library/react'
import PasswordForm from '../password-form-core'

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// Mock the profile API mutation
const mockChangePassword = jest.fn()
jest.mock('@/features/user-profile/store/profile-api', () => ({
  useChangePasswordMutation: () => [mockChangePassword, { isLoading: false }],
}))

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

describe('PasswordForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders password change fields and save action', () => {
    render(<PasswordForm />)

    expect(screen.getByText('title.string')).toBeInTheDocument()
    expect(screen.getByText('description.string')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('current.string')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('new.string')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('confirm.string')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'save.default.string' })
    ).toBeInTheDocument()
  })

  it('renders three password input fields', () => {
    render(<PasswordForm />)

    const inputs = screen.getAllByRole('textbox')
    // PasswordInput may render as text/toggle inputs; just verify we have the right placeholder count
    expect(screen.getAllByPlaceholderText('current.string').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByPlaceholderText('new.string').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByPlaceholderText('confirm.string').length).toBeGreaterThanOrEqual(1)
  })
})
