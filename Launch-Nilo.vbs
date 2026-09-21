Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
exePath = chr(34) & currentDir & "\release\Nilo\Nilo.exe" & chr(34)
WshShell.Run exePath, 0, False
Set WshShell = Nothing
