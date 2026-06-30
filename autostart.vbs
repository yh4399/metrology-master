Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Change working directory to server folder
WshShell.CurrentDirectory = scriptDir & "\server"

' Run node app.js silently (0 = hidden window)
WshShell.Run "node app.js", 0, False
