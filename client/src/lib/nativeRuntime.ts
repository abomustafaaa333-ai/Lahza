export type NativeLahzaBridge = {
  getVersionCode?: () => number | string;
  getInstaller?: () => string;
  openExternal?: (url: string) => void;
  saveImage?: (url: string, fileName: string) => boolean;
};

export type NativeRuntimeLike = {
  LahzaApp?: NativeLahzaBridge;
};

export function isNativeLahzaApp(runtime: NativeRuntimeLike | undefined = typeof window === "undefined" ? undefined : window) {
  return Boolean(runtime?.LahzaApp?.getVersionCode || runtime?.LahzaApp?.openExternal);
}
