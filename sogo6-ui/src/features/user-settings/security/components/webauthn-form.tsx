'use client'

import { useTranslations } from 'next-intl'
import { useWebauthnBeginRegistrationMutation, useWebauthnCompleteRegistrationMutation, useWebauthnGetCredentialsQuery, useWebauthnDeleteCredentialMutation } from '@/features/auth/components/store/auth.api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, KeyRound, Trash2, AlertCircle, CheckCircle2, Smartphone } from 'lucide-react'
import { useState, useCallback } from 'react'
import { getErrorMessage } from '@/lib/redux/api/error-handlers'

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

export function WebauthnSettingsForm() {
  const t = useTranslations('US_SECURITY')
  const { data: credsData, isLoading: credsLoading, refetch: refetchCreds } = useWebauthnGetCredentialsQuery()
  const [beginRegistration] = useWebauthnBeginRegistrationMutation()
  const [completeRegistration] = useWebauthnCompleteRegistrationMutation()
  const [deleteCredential] = useWebauthnDeleteCredentialMutation()
  const [deviceName, setDeviceName] = useState('')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'waiting' | 'error' | 'success'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const credentials = credsData?.data?.credentials ?? []

  const handleRegister = useCallback(async () => {
    if (!window.PublicKeyCredential) {
      setErrorMsg('Passkeys are not supported on this device')
      setStatus('error')
      return
    }

    setStatus('waiting')
    setErrorMsg('')

    try {
      const beginResult = await beginRegistration().unwrap()
      const publicKey = beginResult.data.publicKey as PublicKeyCredentialCreationOptions
      publicKey.challenge = base64urlToBuffer(publicKey.challenge as unknown as string)
      publicKey.user.id = base64urlToBuffer(publicKey.user.id as unknown as string)
      if (publicKey.excludeCredentials) {
        publicKey.excludeCredentials = publicKey.excludeCredentials.map((cred) => ({
          ...cred,
          id: base64urlToBuffer(cred.id as unknown as string),
          type: 'public-key' as const,
        }))
      }

      const credential = (await navigator.credentials.create({
        publicKey,
      })) as PublicKeyCredential | null

      if (!credential) {
        setStatus('idle')
        return
      }

      const credentialResponse = credential.response as AuthenticatorAttestationResponse
      const credentialData = {
        id: credential.id,
        rawId: base64urlEncode(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: base64urlEncode(credentialResponse.clientDataJSON),
          attestationObject: base64urlEncode(credentialResponse.attestationObject),
        },
        clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
      }

      await completeRegistration({
        credential: credentialData,
        device_name: deviceName || undefined,
      }).unwrap()

      setStatus('success')
      refetchCreds()
      setTimeout(() => {
        setRegisterOpen(false)
        setStatus('idle')
        setDeviceName('')
      }, 1500)
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error) || 'Registration failed')
      setStatus('error')
    }
  }, [beginRegistration, completeRegistration, deviceName, refetchCreds])

  const handleDelete = async (credentialId: string) => {
    setDeletingId(credentialId)
    try {
      await deleteCredential({ credential_id: credentialId }).unwrap()
      refetchCreds()
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          {t('webauthn.title.string')}
        </CardTitle>
        <CardDescription>{t('webauthn.description.string')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {credsLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : credentials.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('webauthn.registered_credentials.string')}</p>
            {credentials.map((cred) => (
              <div key={cred.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{cred.device_name || 'Passkey'}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('webauthn.registered_at.string')}: {cred.created_at
                        ? new Date(cred.created_at).toLocaleDateString()
                        : '—'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(cred.credential_id)}
                  disabled={deletingId === cred.credential_id}
                >
                  {deletingId === cred.credential_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-red-500" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('webauthn.no_credentials.string')}</p>
        )}

        <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <KeyRound className="mr-2 h-4 w-4" />
              {t('webauthn.register.string')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('webauthn.register.title.string')}</DialogTitle>
              <DialogDescription>{t('webauthn.register.description.string')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="device-name">{t('webauthn.device_name.string')}</Label>
                <Input
                  id="device-name"
                  placeholder="e.g. My YubiKey 5"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  disabled={status === 'waiting'}
                />
              </div>
              {status === 'waiting' && (
                <div className="flex flex-col items-center py-4 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="mt-2 text-sm text-muted-foreground">{t('webauthn.register.waiting.string')}</p>
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <p>{errorMsg}</p>
                </div>
              )}
              {status === 'success' && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <p>{t('webauthn.register.success.string')}</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRegisterOpen(false)
                    setStatus('idle')
                    setDeviceName('')
                  }}
                  disabled={status === 'waiting'}
                >
                  {status === 'success' ? 'Close' : 'Cancel'}
                </Button>
                {status !== 'success' && (
                  <Button onClick={handleRegister} disabled={status === 'waiting'}>
                    {status === 'waiting' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      t('webauthn.register.button.string')
                    )}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
