package dev.martinvergara.biblioteca;

import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Los colores del sistema (Material You, Android 12+), sacados del fondo de pantalla.
 * Devuelve las paletas tonales accent1, neutral1 y neutral2 como "#rrggbb", tono por tono
 * (0 = blanco … 1000 = negro). En Android 11 o anterior devuelve {supported: false}.
 */
@CapacitorPlugin(name = "SystemColors")
public class SystemColorsPlugin extends Plugin {

    private static final int[] TONES = { 0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000 };

    @PluginMethod
    public void get(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            result.put("supported", false);
            call.resolve(result);
            return;
        }
        Context context = getContext();
        result.put("supported", true);
        for (String palette : new String[] { "accent1", "accent2", "neutral1", "neutral2" }) {
            JSObject tones = new JSObject();
            for (int tone : TONES) {
                int id = context.getResources().getIdentifier("system_" + palette + "_" + tone, "color", "android");
                if (id == 0) continue;
                int color = context.getColor(id);
                tones.put(String.valueOf(tone), String.format("#%06x", color & 0xffffff));
            }
            result.put(palette, tones);
        }
        call.resolve(result);
    }

    /**
     * Pinta el fondo de la ventana con el papel de la paleta actual. Se ve detrás de las barras del
     * sistema cuando el WebView queda con márgenes (Chromium anterior a 140).
     */
    @PluginMethod
    public void setWindowBackground(PluginCall call) {
        String color = call.getString("color");
        if (color == null) {
            call.reject("Falta color");
            return;
        }
        int parsed;
        try {
            parsed = Color.parseColor(color);
        } catch (IllegalArgumentException e) {
            call.reject("Color inválido: " + color);
            return;
        }
        getActivity().runOnUiThread(() -> {
            android.view.Window window = getActivity().getWindow();
            window.getDecorView().setBackgroundColor(parsed);
            // Sin edge-to-edge, Android pinta las barras con colorPrimaryDark: que sigan a la paleta
            window.setStatusBarColor(parsed);
            window.setNavigationBarColor(parsed);
            call.resolve();
        });
    }
}
