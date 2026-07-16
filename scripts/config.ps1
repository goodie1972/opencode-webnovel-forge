param(
    [Parameter(Position = 0)]
    [string]$Command = '',
    [string]$ConfigPath = '',
    [string]$OpenCodeConfigPath = '',
    [string]$PresetName = ''
)

$DefaultConfigPath = Join-Path $env:USERPROFILE '.config\opencode\opencode-webnovel-forge.json'
$DefaultOpenCodeConfigPath = Join-Path $env:USERPROFILE '.config\opencode\opencode.json'
$PluginRoot = Split-Path -Parent $PSScriptRoot
$PresetsDir = Join-Path $PluginRoot 'presets'
if (-not $ConfigPath) { $ConfigPath = $DefaultConfigPath }
if (-not $OpenCodeConfigPath) { $OpenCodeConfigPath = $DefaultOpenCodeConfigPath }

function Read-Config {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }
    try {
        $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
        if ($Path -match '\.ya?ml$') {
            # Basic YAML-like parser for agent config (preserves flat structure)
            $cfg = @{}
            $agents = @{}
            $inAgents = $false
            $currentAgent = $null
            foreach ($line in $raw -split "`n") {
                $trimmed = $line.Trim()
                if ($trimmed -eq '' -or $trimmed -match '^#') { continue }
                if ($trimmed -match '^agents:') { $inAgents = $true; continue }
                if ($inAgents) {
                    if ($trimmed -match '^[a-z_]+\w*:' -and $trimmed -notmatch '^\s{2,}') {
                        # top-level key, exit agents
                        $inAgents = $false
                    } elseif ($trimmed -match '^  (\w+):') {
                        $currentAgent = $Matches[1]
                        $agents[$currentAgent] = @{}
                        continue
                    } elseif ($trimmed -match '^\s+model:\s*(.+)$') {
                        if ($currentAgent) { $agents[$currentAgent].model = $Matches[1].Trim() }
                    } elseif ($trimmed -match '^\s+temperature:\s*(.+)$') {
                        if ($currentAgent) { $agents[$currentAgent].temperature = [double]$Matches[1].Trim() }
                    } elseif ($trimmed -match '^\s+disabled:\s*(.+)$') {
                        if ($currentAgent) { $agents[$currentAgent].disabled = $Matches[1].Trim() -eq 'true' }
                    }
                }
            }
            if ($agents.Count -gt 0) { $cfg.agents = $agents }
            return $cfg
        }
        return ($raw | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Write-Config {
    param($Cfg, [string]$Path)
    if (Test-Path -LiteralPath $Path) {
        $backupPath = $Path + '.bak'
        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        if (Test-Path -LiteralPath $backupPath) {
            $backupPath = $Path + '.' + $timestamp + '.bak'
        }
        Copy-Item -LiteralPath $Path -Destination $backupPath -Force
        Write-Host "已备份原配置: $backupPath" -ForegroundColor DarkGray
    }
    $dir = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $json = $Cfg | ConvertTo-Json -Depth 5
    Set-Content -LiteralPath $Path -Value $json -NoNewline
}

function Get-OpenCodeProviders {
    $path = $args[0]
    if (-not (Test-Path -LiteralPath $path)) { return @{} }
    try {
        $raw = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
        $config = $raw | ConvertFrom-Json
    } catch { return @{} }
    if (-not $config -or -not $config.provider) { return @{} }
    $providers = @{}
    foreach ($prop in $config.provider.PSObject.Properties) {
        $provName = $prop.Name
        $provData = $prop.Value
        if ($provData.models) {
            $models = @($provData.models.PSObject.Properties.Name | Sort-Object)
            $providers[$provName] = $models
        }
    }
    return $providers
}

function Split-ModelName {
    $name = $args[0]
    if ($name -match '/') {
        $idx = $name.LastIndexOf('/')
        return @{ Provider = $name.Substring(0, $idx); Model = $name.Substring($idx + 1) }
    }
    return @{ Provider = ''; Model = $name }
}

function Merge-ProviderModels {
    param([object]$ConfigProviders, [object]$OpenCodeProviders)
    $merged = @{}
    foreach ($key in $ConfigProviders.Keys) { $merged[$key] = $ConfigProviders[$key] }
    foreach ($key in $OpenCodeProviders.Keys) {
        if ($merged.ContainsKey($key)) {
            $combined = @($merged[$key] + $OpenCodeProviders[$key])
            $merged[$key] = @($combined | Sort-Object -Unique)
        } else {
            $merged[$key] = $OpenCodeProviders[$key]
        }
    }
    return $merged
}

function Select-FromList {
    param([string]$Title, [array]$Labels, [array]$Values, [bool]$AllowQuit = $true)
    if ($AllowQuit) {
        $Labels = $Labels + '[退出]'
        $Values = $Values + '__quit__'
    }
    Write-Host ""
    Write-Host $Title -ForegroundColor Cyan
    Write-Host ("-" * 60) -ForegroundColor DarkGray
    for ($i = 0; $i -lt $Labels.Count; $i++) {
        Write-Host ("  [{0}] {1}" -f ($i + 1), $Labels[$i])
    }
    Write-Host ""
    $idx = 0
    while ($true) {
        $inputVal = Read-Host "请选择 (1-$($Labels.Count))"
        if ([int]::TryParse($inputVal, [ref]$idx)) { $idx = $idx - 1 }
        if ($idx -ge 0 -and $idx -lt $Labels.Count) { break }
        Write-Host "请输入有效编号" -ForegroundColor Yellow
    }
    return $Values[$idx]
}

function Show-Help {
    Write-Host ""
    Write-Host "opencode-webnovel-forge 配置工具" -ForegroundColor Cyan
    Write-Host ("=" * 50) -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "用法:"
    Write-Host "  .\scripts\config.ps1                          交互式修改 agent 模型"
    Write-Host "  .\scripts\config.ps1 list                     列出当前配置"
    Write-Host "  .\scripts\config.ps1 init <plan-a|plan-b|plan-c>  从预设初始化"
    Write-Host "  .\scripts\config.ps1 help                     显示帮助"
    Write-Host ""
    Write-Host "预设文件 (presets/):"
    Get-ChildItem -LiteralPath $PresetsDir -Filter *.yaml -Name | ForEach-Object { Write-Host "  - $_" }
    Write-Host ""
    Write-Host "参数:"
    Write-Host "  -ConfigPath <路径>             指定 webnovel-forge 配置文件路径"
    Write-Host "  -OpenCodeConfigPath <路径>     指定 opencode 配置文件路径"
    Write-Host "  -PresetName <名称>             init 时使用的预设名 (plan-a/plan-b/plan-c)"
    Write-Host ""
}

function Show-List {
    $cfg = Read-Config -Path $ConfigPath
    if (-not $cfg -or -not $cfg.agents) {
        Write-Host "没有配置或配置文件不存在" -ForegroundColor Yellow
        Write-Host "使用 'init' 从预设创建：" -ForegroundColor DarkGray
        Write-Host "  .\scripts\config.ps1 init plan-a" -ForegroundColor DarkGray
        return
    }
    $agents = $cfg.agents.PSObject.Properties | Sort-Object Name
    Write-Host ""
    Write-Host "WebNovel Forge Agent 配置" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor DarkGray
    Write-Host ("{0,-28} {1,-35} {2}" -f 'Agent', 'Model', 'Temp') -ForegroundColor White
    Write-Host ("-" * 70) -ForegroundColor DarkGray
    foreach ($prop in $agents) {
        $name = $prop.Name
        $agent = $prop.Value
        $model = $agent.model
        $temp = ''
        if ($null -ne $agent.temperature) { $temp = $agent.temperature.ToString() }
        if ($agent.disabled) { $model = '[已禁用]' }
        Write-Host ("{0,-28} {1,-35} {2}" -f $name, $model, $temp)
    }
    Write-Host ""
    Write-Host "配置文件: $ConfigPath" -ForegroundColor DarkGray
    Write-Host ""
}

function Run-Init {
    param([string]$Preset)
    $presetFile = Join-Path $PresetsDir "$Preset.yaml"
    if (-not (Test-Path -LiteralPath $presetFile)) {
        Write-Host "预设 '$Preset' 不存在" -ForegroundColor Red
        Write-Host "可用预设:" -ForegroundColor Yellow
        Get-ChildItem -LiteralPath $PresetsDir -Filter *.yaml -Name | ForEach-Object {
            Write-Host "  - $($_.Replace('.yaml',''))" -ForegroundColor DarkGray
        }
        return
    }
    $raw = Get-Content -LiteralPath $presetFile -Raw
    Write-Host ""
    Write-Host "从预设 '$Preset' 创建配置..." -ForegroundColor Cyan
    Write-Host "配置文件: $ConfigPath" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "=== 预设内容 ===" -ForegroundColor White
    Write-Host $raw -ForegroundColor DarkGray
    Write-Host ""
    $confirm = Read-Host "确认写入? ([Y]/n)"
    if ($confirm -match '^[nN]') {
        Write-Host "已取消" -ForegroundColor Yellow
        return
    }
    # Parse YAML manually (simple version)
    $agents = @{}
    $currentAgent = $null
    foreach ($line in $raw -split "`n") {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed -match '^#') { continue }
        if ($trimmed -match '^  (\w+):') {
            $currentAgent = $Matches[1]
            $agents[$currentAgent] = @{}
        } elseif ($trimmed -match '^\s+model:\s*(.+)$') {
            if ($currentAgent) { $agents[$currentAgent].model = $Matches[1].Trim() }
        } elseif ($trimmed -match '^\s+temperature:\s*(.+)$') {
            if ($currentAgent) { $agents[$currentAgent].temperature = [double]$Matches[1].Trim() }
        } elseif ($trimmed -match '^\s+disabled:\s*(.+)$') {
            if ($currentAgent) { $agents[$currentAgent].disabled = $Matches[1].Trim() -eq 'true' }
        }
    }
    $cfg = @{ agents = $agents; language = 'zh' }
    Write-Config -Cfg $cfg -Path $ConfigPath
    Write-Host "配置已创建!" -ForegroundColor Green
    Write-Host "可以继续运行 'list' 查看，或直接运行交互式修改" -ForegroundColor DarkGray
}

function Run-Interactive {
    $running = $true
    while ($running) {
        $cfg = Read-Config -Path $ConfigPath
        if (-not $cfg) {
            Write-Host "配置文件不存在，先创建一个？" -ForegroundColor Yellow
            Write-Host "可用预设：" -ForegroundColor DarkGray
            Get-ChildItem -LiteralPath $PresetsDir -Filter *.yaml -Name | ForEach-Object {
                Write-Host "  $($_.Replace('.yaml',''))" -ForegroundColor DarkGray
            }
            $preset = Read-Host "输入预设名 (或回车退出)"
            if ([string]::IsNullOrWhiteSpace($preset)) {
                Write-Host "再见!" -ForegroundColor Cyan
                return
            }
            Run-Init -Preset $preset
            $cfg = Read-Config -Path $ConfigPath
            if (-not $cfg) {
                Write-Host "创建失败，请检查预设名" -ForegroundColor Red
                return
            }
        }
        $openCodeProviders = Get-OpenCodeProviders $OpenCodeConfigPath
        $agentNames = @($cfg.agents.PSObject.Properties.Name | Sort-Object)
        if ($agentNames.Count -eq 0) {
            Write-Host "没有可配置的 agent" -ForegroundColor Red
            return
        }
        $allProviderModels = @{}
        $agentModels = @{}
        foreach ($prop in $cfg.agents.PSObject.Properties) {
            if ($prop.Value.model) {
                $parts = Split-ModelName $prop.Value.model
                $agentModels[$parts.Provider + '/' + $parts.Model] = $true
            }
        }
        foreach ($key in $agentModels.Keys) { $p = ($key -split '/')[0]; $m = ($key -split '/')[1]; if (-not $allProviderModels.ContainsKey($p)) { $allProviderModels[$p] = @() }; $allProviderModels[$p] += $m }
        foreach ($key in $openCodeProviders.Keys) {
            if ($allProviderModels.ContainsKey($key)) {
                $allProviderModels[$key] = @($allProviderModels[$key] + $openCodeProviders[$key] | Sort-Object -Unique)
            } else {
                $allProviderModels[$key] = $openCodeProviders[$key]
            }
        }
        Write-Host ""
        Write-Host "=== WebNovel Forge 模型配置工具 ===" -ForegroundColor Cyan
        Write-Host "检测到 $($allProviderModels.Count) 个 provider ($( ($allProviderModels.Keys -join ', ') ))" -ForegroundColor DarkGray
        # Step 1: Select agent
        $agentLabels = @()
        foreach ($name in $agentNames) {
            $agent = $cfg.agents.$name
            $label = "$name | $($agent.model)"
            if ($agent.disabled) { $label = "$name | [已禁用]" }
            $agentLabels += $label
        }
        $selectedAgent = Select-FromList -Title "选择要修改的 Agent" -Labels $agentLabels -Values $agentNames
        if ($selectedAgent -eq '__quit__') { break }
        $currentAgent = $cfg.agents.$selectedAgent
        $currentParts = Split-ModelName $currentAgent.model
        $currentProvider = $currentParts.Provider
        $currentModelName = $currentParts.Model
        Write-Host ""
        Write-Host "当前: $selectedAgent = $($currentAgent.model) (temp=$($currentAgent.temperature))" -ForegroundColor Green
        # Step 2: Select provider
        $providerNames = @($allProviderModels.Keys | Sort-Object)
        $providerLabels = @()
        foreach ($p in $providerNames) {
            $count = $allProviderModels[$p].Count
            $marker = ''; if ($p -eq $currentProvider) { $marker = ' [当前]' }
            $providerLabels += "$p ($count 个模型)$marker"
        }
        $providerLabels += '[自定义 provider]'
        $providerValues = $providerNames + '__custom__'
        $selectedProvider = Select-FromList -Title "选择 Provider (模型服务商)" -Labels $providerLabels -Values $providerValues
        if ($selectedProvider -eq '__quit__') { break }
        if ($selectedProvider -eq '__custom__') {
            $selectedProvider = ''
            while ($true) {
                $selectedProvider = Read-Host "输入 Provider 名称"
                if ([string]::IsNullOrWhiteSpace($selectedProvider)) {
                    Write-Host "Provider 名称不能为空" -ForegroundColor Red
                } else { break }
            }
        }
        # Step 3: Select model
        $providerModels = @()
        if ($allProviderModels.ContainsKey($selectedProvider)) {
            $providerModels = $allProviderModels[$selectedProvider]
        }
        if ($providerModels.Count -eq 0) {
            $selectedModel = ''
            while ($true) {
                $selectedModel = Read-Host "该 Provider 下没有已有模型，输入模型名"
                if ([string]::IsNullOrWhiteSpace($selectedModel)) {
                    Write-Host "模型名称不能为空" -ForegroundColor Red
                } else { break }
            }
        } else {
            $modelLabels = @()
            foreach ($m in $providerModels) {
                $marker = ''; if ($m -eq $currentModelName -and $selectedProvider -eq $currentProvider) { $marker = ' [当前]' }
                $modelLabels += "$selectedProvider/$m$marker"
            }
            $modelLabels += '[自定义 model]'
            $modelValues = $providerModels + '__custom__'
            $selectedModel = Select-FromList -Title "选择模型 ($selectedProvider)" -Labels $modelLabels -Values $modelValues
            if ($selectedModel -eq '__quit__') { break }
            if ($selectedModel -eq '__custom__') {
                $selectedModel = ''
                while ($true) {
                    $selectedModel = Read-Host "输入模型名称"
                    if ([string]::IsNullOrWhiteSpace($selectedModel)) {
                        Write-Host "模型名称不能为空" -ForegroundColor Red
                    } else { break }
                }
            }
        }
        if ($selectedProvider) { $fullModel = "$selectedProvider/$selectedModel" }
        else { $fullModel = $selectedModel }
        # Step 4: Temperature
        Write-Host ""
        Write-Host "Temperature 设置" -ForegroundColor Cyan
        Write-Host "当前温度: $($currentAgent.temperature)" -ForegroundColor DarkGray
        $tempInput = Read-Host "新温度值 (0.0-2.0, 回车保持 [$($currentAgent.temperature)])"
        $newTemp = $currentAgent.temperature
        if ($tempInput -and $tempInput.Trim() -ne '') {
            $tempNum = 0
            if ([double]::TryParse($tempInput.Trim(), [ref]$tempNum)) {
                if ($tempNum -lt 0 -or $tempNum -gt 2) {
                    Write-Host "温度必须在 0.0 到 2.0 之间，保持当前值" -ForegroundColor Yellow
                } else { $newTemp = $tempNum }
            } else { Write-Host "无效数值，保持当前值" -ForegroundColor Yellow }
        }
        # Step 5: Confirm
        Write-Host ""
        Write-Host "=== 确认变更 ===" -ForegroundColor Cyan
        Write-Host ("-" * 50) -ForegroundColor DarkGray
        Write-Host "  Agent:       $selectedAgent" -ForegroundColor White
        Write-Host "  Model:       $($currentAgent.model) -> $fullModel" -ForegroundColor White
        Write-Host "  Temperature: $($currentAgent.temperature) -> $newTemp" -ForegroundColor White
        Write-Host ""
        $confirm = Read-Host "确认修改? ([Y]/n)"
        if ($confirm -match '^[nN]') { Write-Host "已取消" -ForegroundColor Yellow; continue }
        $cfg.agents.$selectedAgent.model = $fullModel
        $cfg.agents.$selectedAgent.temperature = $newTemp
        Write-Config -Cfg $cfg -Path $ConfigPath
        Write-Host ""
        Write-Host "配置已更新!" -ForegroundColor Green
        Write-Host "  $selectedAgent = $fullModel (temp=$newTemp)" -ForegroundColor Green
        Write-Host ""
        $contLabel = @('继续修改其他 agent', '退出')
        $contValue = @('continue', '__quit__')
        $choice = Select-FromList -Title "下一步" -Labels $contLabel -Values $contValue -AllowQuit $false
        if ($choice -eq '__quit__') {
            Write-Host "再见!" -ForegroundColor Cyan
            $running = $false
        }
    }
}

# ---------- Main ----------

if ($Command -eq 'list') {
    Show-List
} elseif ($Command -eq 'init') {
    if (-not $PresetName -and $args.Count -gt 0) { $PresetName = $args[0] }
    if (-not $PresetName) {
        Write-Host "请指定预设名: init plan-a|plan-b|plan-c" -ForegroundColor Yellow
        Write-Host "可用预设:" -ForegroundColor DarkGray
        Get-ChildItem -LiteralPath $PresetsDir -Filter *.yaml -Name | ForEach-Object {
            Write-Host "  $($_.Replace('.yaml',''))" -ForegroundColor DarkGray
        }
        exit 1
    }
    Run-Init -Preset $PresetName
} elseif ($Command -in 'help', '--help', '-h', '/?') {
    Show-Help
} else {
    Run-Interactive
}
