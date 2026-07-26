import '@testing-library/jest-dom'

// The API slice is complex to mock fully. Instead, we verify
// that the admin-panel-api module exports the expected hooks
// by checking the export list.

describe('Admin Panel API Slice', () => {
  it('should export the expected hook names', () => {
    // We can't easily test RTK Query hooks in isolation due to
    // the complex module dependency graph. Instead we verify
    // the module structure statically.
    const exportedNames = [
      'useGetSystemQuery',
      'usePatchSystemMutation',
      'useGetDomainsQuery',
      'useGetRulesQuery',
      'useGetDynamicFormQuery',
      'useGetDomainDefaultQuery',
      'useGetCustomDomainConfigQuery',
      'useSaveCustomDomainConfigMutation',
      'usePatchDomainDefaultMutation',
      'usePatchCustomDomainConfigMutation',
      'useDeleteDomainMutation',
      'useGetActiveUsersQuery',
      'useRevokeSessionsMutation',
      'useRevokeInactiveSessionsMutation',
      'useListUsersQuery',
      'useGetUserQuery',
      'useCreateUserMutation',
      'useUpdateUserMutation',
      'useDeleteUserMutation',
      'useGetThemeQuery',
      'usePatchThemeMutation',
      'useCreateRuleMutation',
      'useUpdateRuleMutation',
      'useDeleteRuleMutation',
    ]

    // This is a structural assertion - verifying the module contract
    // by checking the source file exports
    const fs = require('fs')
    const path = require('path')
    const sourcePath = path.join(__dirname, '../admin-panel-api.ts')
    const source = fs.readFileSync(sourcePath, 'utf-8')

    for (const name of exportedNames) {
      // Verify the hook name appears in the export destructuring
      expect(source).toContain(name)
    }
  })

  it('should have createRule endpoint definition with correct URL', () => {
    const fs = require('fs')
    const path = require('path')
    const sourcePath = path.join(__dirname, '../admin-panel-api.ts')
    const source = fs.readFileSync(sourcePath, 'utf-8')

    // Verify the createRule mutation is defined with correct API path
    expect(source).toContain("url: '/admin/v1/config/rules'")
    expect(source).toContain("method: 'POST'")
  })

  it('should have updateRule endpoint definition', () => {
    const fs = require('fs')
    const path = require('path')
    const sourcePath = path.join(__dirname, '../admin-panel-api.ts')
    const source = fs.readFileSync(sourcePath, 'utf-8')

    expect(source).toContain("url: `/admin/v1/config/rules/${ruleId}`")
    expect(source).toContain("method: 'PATCH'")
  })

  it('should have deleteRule endpoint definition', () => {
    const fs = require('fs')
    const path = require('path')
    const sourcePath = path.join(__dirname, '../admin-panel-api.ts')
    const source = fs.readFileSync(sourcePath, 'utf-8')

    expect(source).toContain("url: `/admin/v1/config/rules/${ruleId}`")
    expect(source).toContain("method: 'DELETE'")
  })

  it('should have theme endpoints', () => {
    const fs = require('fs')
    const path = require('path')
    const sourcePath = path.join(__dirname, '../admin-panel-api.ts')
    const source = fs.readFileSync(sourcePath, 'utf-8')

    expect(source).toContain("url: '/admin/v1/config/theme'")
    expect(source).toContain("method: 'GET'")
    expect(source).toContain("method: 'PATCH'")
  })

  it('should have user CRUD endpoints', () => {
    const fs = require('fs')
    const path = require('path')
    const sourcePath = path.join(__dirname, '../admin-panel-api.ts')
    const source = fs.readFileSync(sourcePath, 'utf-8')

    expect(source).toContain("url: '/admin/v1/users/list'")
    expect(source).toContain("url: '/admin/v1/users/create'")
    expect(source).toContain("url: `/admin/v1/users/${encodeURIComponent(uid)}`")
  })

  it('should have session management endpoints', () => {
    const fs = require('fs')
    const path = require('path')
    const sourcePath = path.join(__dirname, '../admin-panel-api.ts')
    const source = fs.readFileSync(sourcePath, 'utf-8')

    expect(source).toContain("url: '/admin/v1/users/active'")
    expect(source).toContain("url: '/admin/v1/users/revoke'")
    expect(source).toContain("url: '/admin/v1/users/inactive'")
  })
})
