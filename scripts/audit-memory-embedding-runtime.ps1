[CmdletBinding()]
param(
  [int]$ProcessId = 0,
  [int]$Port = 3008,
  [string]$CachePath = "",
  [switch]$AllowNonServerProcess
)

$ErrorActionPreference = 'Stop'

if (-not $IsWindows) {
  [PSCustomObject]@{
    ok = $false
    error = 'windows_only_process_environment_audit'
  } | ConvertTo-Json -Depth 4
  exit 2
}

$targetVerified = $false
if ($AllowNonServerProcess) {
  if ($ProcessId -le 0) { throw 'AllowNonServerProcess requires an explicit ProcessId.' }
} else {
  $listener = Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $Port -State Listen -ErrorAction Stop |
    Select-Object -First 1
  if (-not $listener) {
    throw "No listener found on 127.0.0.1:$Port."
  }
  if ($ProcessId -le 0) {
    $ProcessId = [int]$listener.OwningProcess
  }

  $targetProcess = Get-Process -Id $ProcessId -ErrorAction Stop
  $health = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/healthz" -f $Port) -Method Get -TimeoutSec 2 -ErrorAction Stop
  $targetVerified = (
    [int]$listener.OwningProcess -eq $ProcessId -and
    [string]$targetProcess.Name -eq 'node' -and
    [string]$health.server -eq 'mcp-tests-response-shape' -and
    [string]$health.profile -eq 'internal' -and
    [string]$health.auth.mode -eq 'oauth21'
  )
  if (-not $targetVerified) {
    throw 'Target process is not the expected mcp-tests OAuth21 runtime.'
  }
}

if (-not $CachePath) {
  $CachePath = Join-Path (Split-Path -Parent $PSScriptRoot) '_logs\.mcp-agent-embeddings.sqlite'
}

$readerSource = @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

public static class BoundedRemoteEnvironmentReader {
  [StructLayout(LayoutKind.Sequential)]
  private struct ProcessBasicInformation {
    public IntPtr Reserved1;
    public IntPtr PebBaseAddress;
    public IntPtr Reserved2_0;
    public IntPtr Reserved2_1;
    public IntPtr UniqueProcessId;
    public IntPtr Reserved3;
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct MemoryBasicInformation {
    public IntPtr BaseAddress;
    public IntPtr AllocationBase;
    public uint AllocationProtect;
    public UIntPtr RegionSize;
    public uint State;
    public uint Protect;
    public uint Type;
  }

  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern IntPtr OpenProcess(uint access, bool inheritHandle, int processId);

  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern bool ReadProcessMemory(
    IntPtr process,
    IntPtr address,
    byte[] buffer,
    int size,
    out IntPtr bytesRead
  );

  [DllImport("kernel32.dll")]
  private static extern bool CloseHandle(IntPtr handle);

  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern UIntPtr VirtualQueryEx(
    IntPtr process,
    IntPtr address,
    out MemoryBasicInformation information,
    UIntPtr length
  );

  [DllImport("ntdll.dll")]
  private static extern int NtQueryInformationProcess(
    IntPtr process,
    int informationClass,
    ref ProcessBasicInformation information,
    int informationLength,
    out int returnLength
  );

  private static IntPtr ReadPointer(IntPtr process, IntPtr address) {
    var bytes = new byte[IntPtr.Size];
    IntPtr bytesRead;
    if (!ReadProcessMemory(process, address, bytes, bytes.Length, out bytesRead) ||
        bytesRead.ToInt64() != bytes.Length) {
      throw new Win32Exception(Marshal.GetLastWin32Error());
    }
    return IntPtr.Size == 8
      ? new IntPtr(BitConverter.ToInt64(bytes, 0))
      : new IntPtr(BitConverter.ToInt32(bytes, 0));
  }

  public static Dictionary<string, string> ReadAllowlisted(int processId, string[] allowlist) {
    const uint ProcessQueryInformationAndVmRead = 0x0410;
    var process = OpenProcess(ProcessQueryInformationAndVmRead, false, processId);
    if (process == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());

    try {
      var basic = new ProcessBasicInformation();
      int returnLength;
      var status = NtQueryInformationProcess(
        process,
        0,
        ref basic,
        Marshal.SizeOf<ProcessBasicInformation>(),
        out returnLength
      );
      if (status != 0) throw new InvalidOperationException("NtQueryInformationProcess failed: " + status);

      var processParameters = ReadPointer(
        process,
        IntPtr.Add(basic.PebBaseAddress, IntPtr.Size == 8 ? 0x20 : 0x10)
      );
      var environment = ReadPointer(
        process,
        IntPtr.Add(processParameters, IntPtr.Size == 8 ? 0x80 : 0x48)
      );

      MemoryBasicInformation region;
      if (VirtualQueryEx(
        process,
        environment,
        out region,
        (UIntPtr)Marshal.SizeOf<MemoryBasicInformation>()
      ) == UIntPtr.Zero) {
        throw new Win32Exception(Marshal.GetLastWin32Error());
      }

      var offset = environment.ToInt64() - region.BaseAddress.ToInt64();
      var available = (long)region.RegionSize.ToUInt64() - offset;
      var size = (int)Math.Min(available, 131072);
      if (size <= 0) throw new InvalidOperationException("Remote environment region is empty.");

      var bytes = new byte[size];
      IntPtr bytesRead;
      if (!ReadProcessMemory(process, environment, bytes, size, out bytesRead)) {
        throw new Win32Exception(Marshal.GetLastWin32Error());
      }

      var block = Encoding.Unicode.GetString(bytes, 0, (int)bytesRead.ToInt64());
      var terminator = block.IndexOf("\0\0", StringComparison.Ordinal);
      if (terminator >= 0) block = block.Substring(0, terminator);

      var wanted = new HashSet<string>(allowlist, StringComparer.OrdinalIgnoreCase);
      var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
      foreach (var entry in block.Split('\0')) {
        if (String.IsNullOrEmpty(entry) || entry[0] == '=') continue;
        var separator = entry.IndexOf('=');
        if (separator <= 0) continue;
        var name = entry.Substring(0, separator);
        if (wanted.Contains(name)) result[name] = entry.Substring(separator + 1);
      }
      return result;
    } finally {
      CloseHandle(process);
    }
  }
}
'@

Add-Type -TypeDefinition $readerSource -Language CSharp

$allowlist = @(
  'MCP_TEST_MEMORY_EMBEDDING_PROVIDER',
  'MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS',
  'MCP_TEST_MEMORY_EMBEDDING_TOKEN_FILE',
  'OVH_AI_ENDPOINTS_ACCESS_TOKEN',
  'MCP_TEST_MEMORY_EMBEDDING_TIMEOUT_MS'
)
$environment = [BoundedRemoteEnvironmentReader]::ReadAllowlisted($ProcessId, $allowlist)

function Get-AllowlistedValue {
  param([Parameter(Mandatory = $true)][string]$Name)
  if (-not $environment.ContainsKey($Name)) { return '' }
  return [string]$environment[$Name]
}

$provider = Get-AllowlistedValue -Name 'MCP_TEST_MEMORY_EMBEDDING_PROVIDER'
$egress = Get-AllowlistedValue -Name 'MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS'
$tokenFile = Get-AllowlistedValue -Name 'MCP_TEST_MEMORY_EMBEDDING_TOKEN_FILE'
$legacyToken = Get-AllowlistedValue -Name 'OVH_AI_ENDPOINTS_ACCESS_TOKEN'
$timeout = Get-AllowlistedValue -Name 'MCP_TEST_MEMORY_EMBEDDING_TIMEOUT_MS'
$normalizedProvider = $provider.Trim().ToLowerInvariant()
$timeoutNumber = 0
$timeoutValid = (-not $timeout) -or (
  [int]::TryParse($timeout, [ref]$timeoutNumber) -and
  $timeoutNumber -ge 500 -and
  $timeoutNumber -le 15000
)
$cache = Get-Item -LiteralPath $CachePath -ErrorAction SilentlyContinue
$tokenFileReady = $false
if ($tokenFile) {
  try {
    $tokenFileItem = Get-Item -LiteralPath $tokenFile -ErrorAction Stop
    if (-not $tokenFileItem.PSIsContainer -and $tokenFileItem.Length -gt 0 -and $tokenFileItem.Length -le 16384) {
      $tokenFileReady = -not [string]::IsNullOrWhiteSpace(
        [IO.File]::ReadAllText($tokenFileItem.FullName)
      )
    }
  } catch {
    $tokenFileReady = $false
  }
}
$legacyTokenPresent = -not [string]::IsNullOrWhiteSpace($legacyToken)
$tokenSourceConflict = $legacyTokenPresent -and (-not [string]::IsNullOrWhiteSpace($tokenFile))

$config = [ordered]@{
  provider_present = -not [string]::IsNullOrWhiteSpace($provider)
  provider_supported = $normalizedProvider -eq 'ovh'
  external_egress_present = -not [string]::IsNullOrWhiteSpace($egress)
  external_egress_enabled = $egress -eq '1'
  token_file_configured = -not [string]::IsNullOrWhiteSpace($tokenFile)
  token_file_ready = $tokenFileReady
  legacy_token_present = $legacyTokenPresent
  token_source_conflict = $tokenSourceConflict
  token_present = (-not $tokenSourceConflict) -and ($tokenFileReady -or $legacyTokenPresent)
  timeout_override_present = -not [string]::IsNullOrWhiteSpace($timeout)
  timeout_effective_valid = $timeoutValid
}

[PSCustomObject]@{
  ok = $true
  process_id = $ProcessId
  port = $Port
  target_verified = $targetVerified
  config = $config
  activation_ready = (
    $config.provider_supported -and
    $config.external_egress_enabled -and
    $config.token_present -and
    $config.timeout_effective_valid
  )
  cache = [ordered]@{
    present = $null -ne $cache
    bytes = if ($cache) { [long]$cache.Length } else { 0 }
  }
  secret_values_exposed = $false
} | ConvertTo-Json -Depth 5
