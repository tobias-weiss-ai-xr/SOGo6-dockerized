'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  useWebauthnBeginLoginMutation,
  useWebauthnCompleteLoginMutation,
  useLoginMutation,
} from '@/features/auth/components/store/auth.api'
import { setCredentials } from '@/features/auth/components/store/auth.slice'
import { useAppDispatch } from '@/lib/redux/hooks'
import { getErrorMessage } from '@/lib/redux/api/error-handlers'
import { KeyRound, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useCallback } from 'react'

interface JwtPayload {
  uid: string
  cn: string
  email: string
}

function decodeJwtPayload(token: string): JwtPayload {
  const [, payloadB64] = token.split('.')
  const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(base64)) as JwtPayload
}

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

interface Props {
  email?: string
  onSuccess?: () => void
}

export function WebauthnLoginDialog({ email, onSuccess }: Props) {
  const t = useTranslations('AUTH')
  const dispatch = useAppDispatch()
  const [beginLogin] = useWebauthnBeginLoginMutation()
  const [completeLogin] = useWebauthnCompleteLoginMutation()
  const [login] = useLoginMutation()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'waiting' | 'error' | 'success'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handlePasskeyLogin = useCallback(async () => {
    if (!window.PublicKeyCredential) {
      setErrorMsg(t('passkey.error.not_supported.string'))
      setStatus('error')
      return
    }
    setStatus('waiting')
    setErrorMsg('')

    try {
      const beginResult = await beginLogin().unwrap()
      const publicKey = beginResult.data.publicKey as PublicKeyCredentialRequestOptions
      publicKey.challenge = base64urlToBuffer(publicKey.challenge as unknown as string)
      if (publicKey.allowCredentials) {
        publicKey.allowCredentials = publicKey.allowCredentials.map((cred) => ({
          ...cred,
          id: base64urlToBuffer(cred.id as unknown as string),
          type: 'public-key' as const,
        }))
      }

      const credential = (await navigator.credentials.get({
        publicKey,
      })) as PublicKeyCredential | null

      if (!credential) {
        setStatus('idle')
        return
      }

      const credentialResponse = credential.response as AuthenticatorAssertionResponse
      const credentialData = {
        id: credential.id,
        rawId: base64urlEncode(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: base64urlEncode(credentialResponse.clientDataJSON),
          authenticatorData: base64urlEncode(credentialResponse.authenticatorData),
          signature: base64urlEncode(credentialResponse.signature),
          userHandle: credentialResponse.userHandle
            ? base64urlEncode(credentialResponse.userHandle)
            : null,
        },
        clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
      }

      const completeResult = await completeLogin({ credential: credentialData }).unwrap()
      const userUid = completeResult.data.user_uid

      const loginResult = await login({
        username: userUid,
        password: 'webauthn',
      }).unwrap()

      if (loginResult.data?.jwt_token) {
        const payload = decodeJwtPayload(loginResult.data.jwt_token)
        dispatch(
          setCredentials({
            token: loginResult.data.jwt_token,
            user: {
              uid: payload.uid,
              cn: payload.cn,
              email: payload.email,
            },
            rememberMe: true,
          })
        )
      }

      setStatus('success')
      onSuccess?.()
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error) || t('passkey.error.authentication_failed.string'))
      setStatus('error')
    }
  }, [beginLogin, completeLogin, login, dispatch, onSuccess, t])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 w-full border text-sm"
        onClick={() => {
          setOpen(true)
          handlePasskeyLogin()
        }}
      >
        <KeyRound className="mr-2 h-4 w-4" />
        {t('passkey.sign_in.string')}
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('passkey.sign_in.string')}</DialogTitle>
          <DialogDescription>
            {status === 'waiting' && t('passkey.authenticating.string')}
            {status === 'error' && t('passkey.error.title.string')}
            {status === 'success' && t('passkey.success.string')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-8">
          {status === 'waiting' && (
            <div className="text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-500" />
              <p className="mt-4 text-sm text-muted-foreground">
                {t('passkey.authenticating_description.string')}
              </p>
            </div>
          )}
          {status === 'error' && (
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
              <p className="mt-4 text-sm text-red-600">{errorMsg}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setStatus('idle')
                  handlePasskeyLogin()
                }}
              >
                {t('passkey.retry.string')}
              </Button>
            </div>
          )}
          {status === 'success' && (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
              <p className="mt-4 text-sm text-green-600">{t('passkey.login_success.string')}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
