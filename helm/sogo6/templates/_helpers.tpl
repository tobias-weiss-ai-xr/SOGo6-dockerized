{{/* Helper templates */}}
{{- define "sogo6.name" -}}
sogo6
{{- end }}

{{- define "sogo6.fullname" -}}
{{- if contains "sogo6" .Release.Name }}
{{ .Release.Name }}
{{- else }}
sogo6
{{- end }}
{{- end }}

{{- define "sogo6.labels" -}}
app.kubernetes.io/name: {{ include "sogo6.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
{{- end }}

{{- define "sogo6.selectorLabels" -}}
app.kubernetes.io/name: {{ include "sogo6.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
