// Escanear el código de barras (ISBN) con el lector de Google Play Services: no pide permiso de cámara
import { Capacitor } from '@capacitor/core';
import {
  BarcodeFormat,
  BarcodeScanner,
  GoogleBarcodeScannerModuleInstallState as State,
} from '@capacitor-mlkit/barcode-scanning';
import { findIsbns } from './text';

export const canScan = Capacitor.isNativePlatform();

/** La primera vez Google descarga el lector (~2 MB); se espera a que termine */
async function ensureModule(onInstalling: () => void) {
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (available) return;
  onInstalling();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 90_000);
    void BarcodeScanner.addListener('googleBarcodeScannerModuleInstallProgress', (e) => {
      if (e.state === State.COMPLETED) {
        clearTimeout(timer);
        resolve();
      } else if (e.state === State.FAILED || e.state === State.CANCELED) {
        clearTimeout(timer);
        reject(new Error('install failed'));
      }
    });
    void BarcodeScanner.installGoogleBarcodeScannerModule().catch(reject);
  }).finally(() => void BarcodeScanner.removeAllListeners());
}

/** Devuelve el ISBN-13 escaneado, o null si se canceló o no era un libro */
export async function scanIsbn(onInstalling: () => void): Promise<string | null> {
  await ensureModule(onInstalling);
  try {
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.Ean13] });
    return findIsbns(barcodes.map((b) => b.rawValue ?? '').join(' '))[0] ?? null;
  } catch {
    // Cerrar el lector sin escanear también llega como error
    return null;
  }
}
