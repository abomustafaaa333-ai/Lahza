package com.lahza.app;

import android.os.Bundle;
import android.content.Intent;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getBridge().getWebView().addJavascriptInterface(new LocationSettingsBridge(), "LahzaAndroid");
    }

    private final class LocationSettingsBridge {
        @JavascriptInterface
        public void openLocationSettings() {
            startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));
        }
    }
}
