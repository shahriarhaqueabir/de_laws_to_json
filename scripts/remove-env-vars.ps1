$vars = @(
    'SUPABASE_DB_PASSWORD',
    'QDRANT_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_ACCESS_TOKEN',
    'SUPABASE_PROJECT_REF',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'QDRANT_API_KEY'
)

foreach ($v in $vars) {
    [System.Environment]::SetEnvironmentVariable($v, $null, 'User')
    Write-Output "Removed user env: $v"
}
