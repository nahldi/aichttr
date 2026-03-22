!macro customUnInstall
  ; Only ask about cleanup in non-silent mode (manual uninstall)
  ; Auto-updates run silently and should NEVER delete user data
  IfSilent SkipCleanup
    MessageBox MB_YESNO "Remove GhostLink settings and data? (Select Yes for a clean uninstall)" IDNO SkipCleanup
      RMDir /r "$PROFILE\.ghostlink"
  SkipCleanup:
!macroend
