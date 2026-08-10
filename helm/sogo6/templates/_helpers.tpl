{{/* ── Name ─────────────────────────────────────────────────── */}}
{{- define "sogo6.name" -}}
sogo6
{{- end }}

{{- define "sogo6.fullname" -}}
{{- if .Values.global.fullnameOverride }}
{{- .Values.global.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default "sogo6" .Chart.Name }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "sogo6.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* ── Labels ────────────────────────────────────────────────── */}}
{{- define "sogo6.labels" -}}
helm.sh/chart: {{ include "sogo6.chart" . }}
{{ include "sogo6.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "sogo6.selectorLabels" -}}
app.kubernetes.io/name: {{ include "sogo6.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/* ── Image ─────────────────────────────────────────────────── */}}
{{- define "sogo6.image" -}}
{{- $registry := .Values.image.registry | default "" }}
{{- $repo := .repository }}
{{- $tag := .tag | default "latest" }}
{{- if $registry }}{{ printf "%s/%s:%s" $registry $repo $tag }}{{ else }}{{ printf "%s:%s" $repo $tag }}{{ end }}
{{- end }}

{{/* ── Secrets ───────────────────────────────────────────────── */}}
{{- define "sogo6.secret" -}}
{{- if .Values.secrets.existingSecretName }}
{{- .Values.secrets.existingSecretName }}
{{- else }}
{{- printf "%s-secrets" (include "sogo6.fullname" .) }}
{{- end }}
{{- end }}

{{/* ── ConfigMap ────────────────────────────────────────────── */}}
{{- define "sogo6.configmap" -}}
{{- printf "%s-config" (include "sogo6.fullname" .) }}
{{- end }}

{{/* ── Domain ───────────────────────────────────────────────── */}}
{{- define "sogo6.domain" -}}
{{- .Values.global.domain | default "example.org" }}
{{- end }}

{{/* ── LDAP Base DN ────────────────────────────────────────── */}}
{{- define "sogo6.ldapBaseDN" -}}
{{- .Values.global.ldapBaseDN | default (printf "dc=%s,dc=%s" (first (splitList "." (include "sogo6.domain" .))) (last (splitList "." (include "sogo6.domain" .)))) }}
{{- end }}

{{/* ── Postgres connection string ───────────────────────────── */}}
{{- define "sogo6.postgresURI" -}}
{{- printf "postgresql://sogo:$(SOGO_P_DB_PASS)@%s-postgres:5432/sogo" (include "sogo6.fullname" .) }}
{{- end }}

{{/* ── Redis connection string ──────────────────────────────── */}}
{{- define "sogo6.redisURI" -}}
{{- printf "redis://%s-redis:6379/0" (include "sogo6.fullname" .) }}
{{- end }}

{{/* ── LDAP connection string ───────────────────────────────── */}}
{{- define "sogo6.ldapURI" -}}
{{- .Values.env.ldapURI | default (printf "ldap://%s-openldap:389" (include "sogo6.fullname" .)) }}
{{- end }}

{{/* ── LDAP Bind DN ────────────────────────────────────────── */}}
{{- define "sogo6.ldapBindDN" -}}
{{- .Values.env.ldapBindDN | default (printf "cn=admin,%s" (include "sogo6.ldapBaseDN" .)) }}
{{- end }}

{{/* ── Probes ───────────────────────────────────────────────── */}}
{{- define "sogo6.serverProbe" -}}
httpGet:
  path: /api/user/v1/health
  port: 5000
initialDelaySeconds: 30
periodSeconds: 15
timeoutSeconds: 5
failureThreshold: 6
{{- end }}

{{- define "sogo6.uiProbe" -}}
httpGet:
  path: /env
  port: 3000
initialDelaySeconds: 15
periodSeconds: 15
timeoutSeconds: 5
failureThreshold: 6
{{- end }}
