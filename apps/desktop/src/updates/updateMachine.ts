import type {
  DesktopRuntimeInfo,
  DesktopUpdateChannel,
  DesktopUpdateReleaseNote,
  DesktopUpdateState,
} from "@t4tools/contracts";

function nextStatusAfterDownloadFailure(
  currentState: DesktopUpdateState,
): DesktopUpdateState["status"] {
  return currentState.availableVersion ? "available" : "error";
}

function getCanRetryAfterDownloadFailure(currentState: DesktopUpdateState): boolean {
  return currentState.availableVersion !== null;
}

function withoutDownloadUnavailable(state: DesktopUpdateState) {
  const { downloadUnavailable: _downloadUnavailable, ...rest } = state;
  return rest;
}

export function createInitialDesktopUpdateState(
  currentVersion: string,
  runtimeInfo: DesktopRuntimeInfo,
  channel: DesktopUpdateChannel,
): DesktopUpdateState {
  return {
    enabled: false,
    status: "disabled",
    channel,
    currentVersion,
    hostArch: runtimeInfo.hostArch,
    appArch: runtimeInfo.appArch,
    runningUnderArm64Translation: runtimeInfo.runningUnderArm64Translation,
    availableVersion: null,
    downloadedVersion: null,
    releaseNotes: [],
    omittedReleaseCount: 0,
    downloadPercent: null,
    checkedAt: null,
    message: null,
    errorContext: null,
    canRetry: false,
  };
}

export function reduceDesktopUpdateStateOnCheckStart(
  state: DesktopUpdateState,
  checkedAt: string,
): DesktopUpdateState {
  const hasDownloadedUpdate = state.downloadedVersion !== null;
  return {
    ...state,
    status: "checking",
    checkedAt,
    releaseNotes: hasDownloadedUpdate ? state.releaseNotes : [],
    omittedReleaseCount: hasDownloadedUpdate ? state.omittedReleaseCount : 0,
    message: null,
    downloadPercent: hasDownloadedUpdate ? 100 : null,
    errorContext: null,
    canRetry: false,
  };
}

export function reduceDesktopUpdateStateOnCheckFailure(
  state: DesktopUpdateState,
  message: string,
  checkedAt: string,
): DesktopUpdateState {
  if (state.downloadedVersion !== null) {
    return {
      ...withoutDownloadUnavailable(state),
      status: "downloaded",
      message: null,
      checkedAt,
      downloadPercent: 100,
      errorContext: null,
      canRetry: true,
    };
  }

  return {
    ...withoutDownloadUnavailable(state),
    status: "error",
    message,
    checkedAt,
    downloadPercent: null,
    errorContext: "check",
    canRetry: true,
  };
}

export function reduceDesktopUpdateStateOnUpdateAvailable(
  state: DesktopUpdateState,
  version: string,
  checkedAt: string,
  releaseNotes: ReadonlyArray<DesktopUpdateReleaseNote> = [],
  omittedReleaseCount = 0,
  downloadable = true,
): DesktopUpdateState {
  const isDownloadedVersion = state.downloadedVersion === version;
  const preserveReleaseNotes = isDownloadedVersion && releaseNotes.length === 0;
  return {
    ...withoutDownloadUnavailable(state),
    status: isDownloadedVersion ? "downloaded" : "available",
    availableVersion: version,
    downloadedVersion: isDownloadedVersion ? version : null,
    releaseNotes: preserveReleaseNotes ? state.releaseNotes : releaseNotes,
    omittedReleaseCount: preserveReleaseNotes ? state.omittedReleaseCount : omittedReleaseCount,
    downloadPercent: isDownloadedVersion ? 100 : null,
    checkedAt,
    message: downloadable
      ? null
      : "This update is available, but its installer files were not published.",
    errorContext: null,
    canRetry: isDownloadedVersion,
    ...(downloadable ? {} : { downloadUnavailable: true as const }),
  };
}

export function reduceDesktopUpdateStateOnNoUpdate(
  state: DesktopUpdateState,
  checkedAt: string,
): DesktopUpdateState {
  if (state.downloadedVersion !== null) {
    return {
      ...withoutDownloadUnavailable(state),
      status: "downloaded",
      availableVersion: state.downloadedVersion,
      downloadPercent: 100,
      checkedAt,
      message: null,
      errorContext: null,
      canRetry: true,
    };
  }

  return {
    ...withoutDownloadUnavailable(state),
    status: "up-to-date",
    availableVersion: null,
    downloadedVersion: null,
    releaseNotes: [],
    omittedReleaseCount: 0,
    downloadPercent: null,
    checkedAt,
    message: null,
    errorContext: null,
    canRetry: false,
  };
}

export function reduceDesktopUpdateStateOnDownloadStart(
  state: DesktopUpdateState,
): DesktopUpdateState {
  return {
    ...withoutDownloadUnavailable(state),
    status: "downloading",
    downloadPercent: 0,
    message: null,
    errorContext: null,
    canRetry: false,
  };
}

export function reduceDesktopUpdateStateOnDownloadFailure(
  state: DesktopUpdateState,
  message: string,
): DesktopUpdateState {
  return {
    ...state,
    status: nextStatusAfterDownloadFailure(state),
    message,
    downloadPercent: null,
    errorContext: "download",
    canRetry: getCanRetryAfterDownloadFailure(state),
  };
}

export function reduceDesktopUpdateStateOnDownloadProgress(
  state: DesktopUpdateState,
  percent: number,
): DesktopUpdateState {
  return {
    ...state,
    status: "downloading",
    downloadPercent: percent,
    message: null,
    errorContext: null,
    canRetry: false,
  };
}

export function reduceDesktopUpdateStateOnDownloadComplete(
  state: DesktopUpdateState,
  version: string,
): DesktopUpdateState {
  return {
    ...state,
    status: "downloaded",
    availableVersion: version,
    downloadedVersion: version,
    downloadPercent: 100,
    message: null,
    errorContext: null,
    canRetry: true,
  };
}

export function reduceDesktopUpdateStateOnInstallFailure(
  state: DesktopUpdateState,
  message: string,
): DesktopUpdateState {
  return {
    ...state,
    status: "downloaded",
    message,
    errorContext: "install",
    canRetry: true,
  };
}

export interface DesktopUpdateInstallRecord {
  readonly fromVersion: string;
  readonly targetVersion: string;
}

export function resolveNotAppliedInstallVersion(
  record: DesktopUpdateInstallRecord,
  appVersion: string,
): string | null {
  return record.fromVersion === appVersion && record.targetVersion !== appVersion
    ? record.targetVersion
    : null;
}
