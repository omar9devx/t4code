import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";

import { startBrowserProfileReporting } from "./browser/BrowserProfileReporter";
import { startPreviewTitleRecording } from "./browserHistoryStore";
import { retainThreadOverlaysForThread } from "./components/chat/threadOverlayRetention";
import { registerOpenFavoriteEditorCommand } from "./components/chat/OpenInPickerShortcut";
import { startBackgroundThreadAnnouncements } from "./components/BackgroundThreadAnnouncer";
import { startSshPasswordPromptQueue } from "./components/desktop/SshPasswordPromptDialog";
import { startHostFreezeToasts } from "./components/HostFreezeToastCoordinator";
import { startKeybindingsUpdateToasts } from "./components/KeybindingsUpdateToast";
import { startLegacyThreadMigrationToast } from "./components/LegacyThreadMigrationToast";
import { startPermissionUpdateNotices } from "./components/PermissionUpdateNotice";
import { startAgentOpenedPreviews } from "./components/preview/agentOpenedPreviews";
import { startMainAppLocationTracking } from "./components/sidebar/mainAppLocation";
import { startDesktopUpdateLaunchNotice } from "./components/sidebar/updateEverythingRun";
import { startSlowRpcRequestToasts } from "./components/SlowRpcRequestToastCoordinator";
import { startThreadNotifications } from "./components/ThreadNotificationCoordinator";
import { startGuideRunNotifications } from "./components/pullRequest/guide/PullRequestGuideRunCoordinator";
import { useComposerDraftStore } from "./composerDraftStore";
import { installChatRouteCommands } from "./shortcuts/chatRouteCommands";
import { installCommandPaletteCommands } from "./shortcuts/commandPaletteCommands";
import { startThreadVisitedMigration } from "./hooks/useThreadVisitedMigration";
import { isElectron } from "./env";
import type { AppRouter } from "./router";
import { appAtomRegistry } from "./rpc/atomRegistry";
import { resolveThreadRouteTarget } from "./threadRoutes";

/** Starts services that can wait until after the initial app render. */
export function startBackgroundAppServices(router: AppRouter): void {
  startAgentOpenedPreviews();
  startPreviewTitleRecording();
  startBrowserProfileReporting();
  installChatRouteCommands(router);
  installCommandPaletteCommands(router);
  registerOpenFavoriteEditorCommand();
  startThreadOverlayRetention(router);
  startMainAppLocationTracking(router);
  startBackgroundThreadAnnouncements(appAtomRegistry, router);
  startThreadVisitedMigration(appAtomRegistry);
  startSshPasswordPromptQueue();
  startKeybindingsUpdateToasts();
  startSlowRpcRequestToasts();
  startHostFreezeToasts();
  startLegacyThreadMigrationToast();
  startPermissionUpdateNotices(router);
  startThreadNotifications(appAtomRegistry, router);
  startGuideRunNotifications(appAtomRegistry, router);
  if (isElectron) startDesktopUpdateLaunchNotice();
}

function startThreadOverlayRetention(router: AppRouter): void {
  const retainCurrentThread = () => {
    const target = resolveThreadRouteTarget(router.state.matches.at(-1)?.params ?? {});
    const draftSession =
      target?.kind === "draft"
        ? useComposerDraftStore.getState().getDraftSession(target.draftId)
        : null;
    const threadRef =
      target?.kind === "server"
        ? target.threadRef
        : draftSession
          ? scopeThreadRef(draftSession.environmentId, draftSession.threadId)
          : null;
    retainThreadOverlaysForThread(threadRef ? scopedThreadKey(threadRef) : null);
  };

  router.subscribe("onResolved", retainCurrentThread);
  retainCurrentThread();
}
