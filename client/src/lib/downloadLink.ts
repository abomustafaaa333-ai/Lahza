export const APP_DOWNLOAD_PATH = "/download";

export function buildAppDownloadUrl(origin: string) {
  return new URL(APP_DOWNLOAD_PATH, origin).toString();
}
