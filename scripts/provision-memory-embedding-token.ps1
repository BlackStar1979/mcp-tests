[CmdletBinding()]
param(
  [string]$Path = (Join-Path $HOME '.romion\mcp-tests-memory-embedding-token.txt'),
  [switch]$TokenFromStdin,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'This provisioning helper currently supports Windows only.' }
if ((Test-Path -LiteralPath $Path) -and -not $Force) {
  throw 'Token file already exists; use Force only for an intentional rotation.'
}

$token = ''
if ($TokenFromStdin) {
  $token = [Console]::In.ReadLine()
} else {
  $secure = Read-Host 'OVH AI endpoint token' -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

$token = [string]$token
$tokenBytes = [Text.Encoding]::UTF8.GetByteCount($token)
if ([string]::IsNullOrWhiteSpace($token) -or $tokenBytes -gt 16384) {
  throw 'Token must be non-empty and no larger than 16384 UTF-8 bytes.'
}

$parent = Split-Path -Parent ([IO.Path]::GetFullPath($Path))
New-Item -ItemType Directory -Force -Path $parent | Out-Null
[IO.File]::WriteAllText($Path, $token, [Text.UTF8Encoding]::new($false))

$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$acl = [Security.AccessControl.FileSecurity]::new()
$acl.SetAccessRuleProtection($true, $false)
$acl.SetOwner([Security.Principal.NTAccount]::new($identity))
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
  $identity,
  [Security.AccessControl.FileSystemRights]::Read -bor [Security.AccessControl.FileSystemRights]::Write,
  [Security.AccessControl.AccessControlType]::Allow
))
Set-Acl -LiteralPath $Path -AclObject $acl
$token = ''

[PSCustomObject]@{
  ok = $true
  bytes = $tokenBytes
  acl_inheritance_disabled = (Get-Acl -LiteralPath $Path).AreAccessRulesProtected
  token_value_exposed = $false
  token_path_exposed = $false
} | ConvertTo-Json -Depth 3
