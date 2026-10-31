package com.lahza.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

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
    }
}
