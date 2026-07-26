'use client'

import { ErrorAlertWithRetry } from '@/components/ui/error-alert'
import { PageLoader } from '@/components/lazy-components'
import {
  useGetUserPreferencesQuery,
  useUpdateUserPreferencesMailGeneralMutation,
} from '@/features/user-settings/store/user-preferences-api'
import { useTranslations } from 'next-intl'
import React from 'react'
import MailGeneralSettingsForm from './components/mail-general-form'

const MailGeneralSettings: React.FC = () => {
  const t = useTranslations('US_MAIL_GENERAL')
  const { data, error, isFetching, refetch } = useGetUserPreferencesQuery()
  const [updateData] = useUpdateUserPreferencesMailGeneralMutation()
  if (error) {
    return <ErrorAlertWithRetry onRetry={() => refetch()} />
  }
  return (
    <div className="grid grid-cols-1 gap-4">
      <h2 className="text-2xl">{t('title.string')}</h2>
      {isFetching ? (
        <PageLoader />
      ) : (
        <MailGeneralSettingsForm data={data?.data} update={updateData} />
      )}
    </div>
  )
}

export default MailGeneralSettings
