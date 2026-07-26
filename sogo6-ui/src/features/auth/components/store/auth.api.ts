import { apiSlice } from '@/lib/redux/api/api-slice'

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  data: { jwt_token: string }
  error_code: string
  error_msg: string
}

export interface AuthModeResponse {
  data: { kind: 'plain' | 'sso' | 'ldap'; location: string }
  error_code: string
  error_msg: string
}

export interface SystemResponse {
  data: { system: { SOGO_S_DIRECT_LOGIN: boolean } }
  error_code: string
  error_msg: string
}

export interface WebAuthnBeginResponse {
  data: { publicKey: PublicKeyCredentialCreationOptions | PublicKeyCredentialRequestOptions }
  error_code: string
  error_msg: string
}

export interface WebAuthnRegisterCompleteResponse {
  data: { credential_id: string; device_name: string }
  error_code: string
  error_msg: string
}

export interface WebAuthnLoginCompleteResponse {
  data: { credential_id: string; user_uid: string; new_sign_count: number }
  error_code: string
  error_msg: string
}

export interface WebAuthnCredentialsResponse {
  data: {
    credentials: Array<{
      id: number
      credential_id: string
      device_name: string
      transports: string[] | null
      enabled: boolean
      created_at: string
      last_used_at: string | null
    }>
  }
  error_code: string
  error_msg: string
}

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: 'auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),

    getAuthMode: builder.query<AuthModeResponse, { username: string }>({
      query: ({ username }) => ({
        url: 'auth/mode',
        params: { username },
      }),
      keepUnusedDataFor: 0,
    }),

    getSystem: builder.query<SystemResponse, void>({
      query: () => 'system',
      keepUnusedDataFor: 3600,
    }),

    webauthnBeginRegistration: builder.mutation<WebAuthnBeginResponse, void>({
      query: () => ({
        url: 'auth/webauthn/register/begin',
        method: 'POST',
      }),
    }),

    webauthnCompleteRegistration: builder.mutation<
      WebAuthnRegisterCompleteResponse,
      { credential: unknown; device_name?: string }
    >({
      query: (body) => ({
        url: 'auth/webauthn/register/complete',
        method: 'POST',
        body,
      }),
    }),

    webauthnBeginLogin: builder.mutation<WebAuthnBeginResponse, void>({
      query: () => ({
        url: 'auth/webauthn/login/begin',
        method: 'POST',
      }),
    }),

    webauthnCompleteLogin: builder.mutation<
      WebAuthnLoginCompleteResponse,
      { credential: unknown }
    >({
      query: (body) => ({
        url: 'auth/webauthn/login/complete',
        method: 'POST',
        body,
      }),
    }),

    webauthnGetCredentials: builder.query<WebAuthnCredentialsResponse, void>({
      query: () => 'auth/webauthn/credentials',
      providesTags: ['WebAuthnCredentials'],
    }),

    webauthnDeleteCredential: builder.mutation<
      { error_code: string; error_msg: string },
      { credential_id: string }
    >({
      query: (body) => ({
        url: 'auth/webauthn/credentials/delete',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['WebAuthnCredentials'],
    }),
  }),
})

export const {
  useLoginMutation,
  useGetAuthModeQuery,
  useLazyGetAuthModeQuery,
  useGetSystemQuery,
  useWebauthnBeginRegistrationMutation,
  useWebauthnCompleteRegistrationMutation,
  useWebauthnBeginLoginMutation,
  useWebauthnCompleteLoginMutation,
  useWebauthnGetCredentialsQuery,
  useWebauthnDeleteCredentialMutation,
} = authApi
