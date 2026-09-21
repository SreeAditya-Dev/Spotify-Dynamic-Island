$WshShell = New-Object -comObject WScript.Shell
$Desktop = [System.Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$Desktop\Nilo.lnk")
$Shortcut.TargetPath = "$PSScriptRoot\..\release\Nilo\Nilo.exe"
$Shortcut.WorkingDirectory = "$PSScriptRoot\..\release\Nilo"
$Shortcut.Description = "Nilo - Spotify Dynamic Island"
if (Test-Path "$PSScriptRoot\..\public\logo.png") {
    $Shortcut.IconLocation = "$PSScriptRoot\..\release\Nilo\Nilo.exe,0"
}
$Shortcut.Save()
Write-Host "Desktop shortcut created at: $Desktop\Nilo.lnk"
