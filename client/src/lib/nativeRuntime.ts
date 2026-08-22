export type NativeLahzaBridge = {
  getVersionCode?: () => number | string;
  openExternal?: (url: string) => void;
};

export type NativeRuntimeLike = {
  LahzaApp?: NativeLahzaBridge;
};

export function isNativeLahzaApp(runtime: NativeRuntimeLike | undefined = typeof window === "undefined" ? undefined : window) {
  return Boolean(runtime?.LahzaApp?.getVersionCode || runtime?.LahzaApp?.openExternal);
}
