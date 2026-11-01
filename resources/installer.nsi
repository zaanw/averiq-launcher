; Per-user x64 installer. Application data is intentionally retained on uninstall.
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
Name "${PRODUCT_NAME}"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\Averiq Launcher"
InstallDirRegKey HKCU "Software\Averiq\Launcher" "InstallDir"
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro addLangs
Function .onInit
 ${IfNot} ${RunningX64}
  MessageBox MB_ICONSTOP "Averiq Launcher requires 64-bit Windows 10 or 11."
  Abort
 ${EndIf}
FunctionEnd
Function CheckInstallDirectory
 IfFileExists "$INSTDIR\*.*" 0 done
 IfFileExists "$INSTDIR\averiq-install.marker" done 0
 MessageBox MB_ICONSTOP "Choose an empty folder or an existing Averiq Launcher installation."
 Abort
 done:
FunctionEnd
Function .onVerifyInstDir
 Call CheckInstallDirectory
FunctionEnd
Section "Averiq Launcher" Main
 Call CheckInstallDirectory
 SetShellVarContext current
 SetOutPath "$INSTDIR"
 File /r "${PROJECT_DIR}/release/win-unpacked/*"
 FileOpen $0 "$INSTDIR\averiq-install.marker" w
 FileWrite $0 "dev.averiq.launcher"
 FileClose $0
 WriteUninstaller "$INSTDIR\Uninstall Averiq.exe"
 CreateDirectory "$SMPROGRAMS\Averiq Launcher"
 CreateShortcut "$SMPROGRAMS\Averiq Launcher\Averiq Launcher.lnk" "$INSTDIR\Averiq Launcher.exe"
 CreateShortcut "$SMPROGRAMS\Averiq Launcher\Uninstall.lnk" "$INSTDIR\Uninstall Averiq.exe"
 CreateShortcut "$DESKTOP\Averiq Launcher.lnk" "$INSTDIR\Averiq Launcher.exe"
 WriteRegStr HKCU "Software\Averiq\Launcher" "InstallDir" "$INSTDIR"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AveriqLauncher" "DisplayName" "Averiq Launcher"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AveriqLauncher" "DisplayVersion" "${VERSION}"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AveriqLauncher" "Publisher" "Averiq"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AveriqLauncher" "DisplayIcon" "$INSTDIR\Averiq Launcher.exe"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AveriqLauncher" "UninstallString" '$\"$INSTDIR\Uninstall Averiq.exe$\"'
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AveriqLauncher" "NoModify" 1
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AveriqLauncher" "NoRepair" 1
SectionEnd
Section "Uninstall"
 SetShellVarContext current
 IfFileExists "$INSTDIR\averiq-install.marker" +3 0
  MessageBox MB_ICONSTOP "Installation marker missing. Refusing to remove files."
  Abort
 Delete "$DESKTOP\Averiq Launcher.lnk"
 Delete "$SMPROGRAMS\Averiq Launcher\Averiq Launcher.lnk"
 Delete "$SMPROGRAMS\Averiq Launcher\Uninstall.lnk"
 RMDir "$SMPROGRAMS\Averiq Launcher"
 ; Remove only shipped application resources, never arbitrary directories or game data.
 RMDir /r "$INSTDIR\resources"
 RMDir /r "$INSTDIR\locales"
 Delete "$INSTDIR\*.dll"
 Delete "$INSTDIR\*.pak"
 Delete "$INSTDIR\*.bin"
 Delete "$INSTDIR\*.dat"
 Delete "$INSTDIR\*.json"
 Delete "$INSTDIR\*.txt"
 Delete "$INSTDIR\LICENSE*"
 Delete "$INSTDIR\Averiq Launcher.exe"
 Delete "$INSTDIR\averiq-install.marker"
 Delete "$INSTDIR\Uninstall Averiq.exe"
 RMDir "$INSTDIR"
 DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AveriqLauncher"
 DeleteRegKey HKCU "Software\Averiq\Launcher"
SectionEnd
