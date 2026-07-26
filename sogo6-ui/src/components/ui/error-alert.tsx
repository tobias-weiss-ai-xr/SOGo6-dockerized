'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface ErrorAlertWithRetryProps {
  onRetry?: () => void
  title?: string
  message?: string
}

/** Displays an error card with an optional retry button. */
export const ErrorAlertWithRetry: React.FC<ErrorAlertWithRetryProps> = ({
  onRetry,
  title = 'Error',
  message = 'Failed to load data. Please try again.',
}) => (
  <Card className="border-destructive/50">
    <CardHeader>
      <CardTitle className="text-destructive text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground text-sm">{message}</p>
    </CardContent>
    {onRetry && (
      <CardFooter>
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </CardFooter>
    )}
  </Card>
)

export default ErrorAlertWithRetry
