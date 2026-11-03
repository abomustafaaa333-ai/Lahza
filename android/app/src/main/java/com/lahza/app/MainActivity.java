package com.lahza.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getBridge().getWebView().addJavascriptInterface(new LocationSettingsBridge(), "LahzaAndroid");
        getBridge().getWebView().addJavascriptInterface(new AppInfoBridge(), "LahzaApp");
    }

    private final class LocationSettingsBridge {
        @JavascriptInterface
        public void openLocationSettings() {
            startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));
        }
    }

    /** Lets the web layer offer updates from the place the app was installed from. */
    private final class AppInfoBridge {
        @JavascriptInterface
        public long getVersionCode() {
            try {
                PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
            } catch (PackageManager.NameNotFoundException error) {
                return 0;
            }
        }

        @JavascriptInterface
        public String getInstaller() {
            try {
                String installer = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? getPackageManager().getInstallSourceInfo(getPackageName()).getInstallingPackageName()
                    : getPackageManager().getInstallerPackageName(getPackageName());
                return installer == null ? "" : installer;
            } catch (Exception error) {
                return "";
            }
        }

        @JavascriptInterface
        public void openExternal(String url) {
            if (url == null || !(url.startsWith("https://") || url.startsWith("market://"))) return;
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        }
        /**
         * Saves an https image into the gallery (Pictures/Lahza) so it can be scanned from another app.
         * Needs no storage permission on Android 10+; older versions return false and the page falls back.
         */
        @JavascriptInterface
        public boolean saveImage(String url, String fileName) {
            if (url == null || !url.startsWith("https://") || Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false;
            String name = fileName == null || !fileName.matches("[A-Za-z0-9._-]{1,80}") ? "lahza-image.png" : fileName;
            ContentResolver resolver = getContentResolver();
            Uri item = null;
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(15000);
                if (connection.getResponseCode() != 200) return false;
                String type = connection.getContentType();
                String mime = type != null && type.startsWith("image/") ? type.split(";")[0].trim() : "image/png";
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                values.put(MediaStore.Images.Media.MIME_TYPE, mime);
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Lahza");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
                item = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (item == null) return false;
                try (InputStream in = connection.getInputStream(); OutputStream out = resolver.openOutputStream(item)) {
                    if (out == null) throw new java.io.IOException("no output");
                    byte[] buffer = new byte[16384];
                    int read;
                    while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
                }
                ContentValues done = new ContentValues();
                done.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(item, done, null, null);
                return true;
            } catch (Exception error) {
                if (item != null) resolver.delete(item, null, null);
                return false;
            } finally {
                if (connection != null) connection.disconnect();
            }
        }
    }
}
