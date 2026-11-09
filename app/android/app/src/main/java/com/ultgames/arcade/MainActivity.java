package com.ultgames.arcade;

import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // A game turns this on (AndroidVolumeKeys.setActive(true)) when it wants the volume buttons as controls.
    // Only Up does that while you're playing with the phone sideways. Everywhere else they change the volume as usual.
    private volatile boolean volumeKeys = false;

    public class VolumeKeys {
        @JavascriptInterface
        public void setActive(boolean on) { volumeKeys = on; }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // WebView puts this object in every page and frame it loads from now on, including the game's iframe
        getBridge().getWebView().addJavascriptInterface(new VolumeKeys(), "AndroidVolumeKeys");
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int code = e.getKeyCode();
        if (volumeKeys && (code == KeyEvent.KEYCODE_VOLUME_UP || code == KeyEvent.KEYCODE_VOLUME_DOWN)) {
            int action = e.getAction();
            // Android repeats key-down while a button is held; the game only needs the first press and the release
            boolean change = (action == KeyEvent.ACTION_DOWN && e.getRepeatCount() == 0) || action == KeyEvent.ACTION_UP;
            if (change) {
                String key = code == KeyEvent.KEYCODE_VOLUME_UP ? "up" : "down";
                boolean down = action == KeyEvent.ACTION_DOWN;
                // send it to the open game (the #game iframe of index.html), or to the page itself if there isn't one
                String js = "(function(){var f=document.getElementById('game');"
                    + "var w=(f&&f.style.display==='block'&&f.contentWindow)||window;"
                    + "w.dispatchEvent(new w.CustomEvent('volumekey',{detail:{key:'" + key + "',down:" + down + "}}));})()";
                getBridge().getWebView().evaluateJavascript(js, null);
            }
            return true;   // used by the game, so no volume change and no volume slider
        }
        return super.dispatchKeyEvent(e);
    }

    @Override
    public void onPause() {
        super.onPause();
        volumeKeys = false;   // the game pauses when the app goes to the background; it turns this back on when you resume
    }
}
