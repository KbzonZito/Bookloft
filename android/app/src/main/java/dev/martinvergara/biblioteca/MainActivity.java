package dev.martinvergara.biblioteca;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins propios de la app (no vienen de npm)
        registerPlugin(SystemColorsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
