!macro customUnInstall
  ; Clean up GhostLink user data so fresh install shows wizard
  MessageBox MB_YESNO "Remove GhostLink settings and data? (Select Yes for a clean uninstall)" IDNO SkipCleanup
    RMDir /r "$PROFILE\.ghostlink"
  SkipCleanup:
!macroend
