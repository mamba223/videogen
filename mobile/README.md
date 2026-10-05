# ReelForge Mobile (iOS & Android)

A native mobile companion app for **ReelForge**, built with **React Native** and **Expo SDK 52**.

---

## Features
- **🔥 Native Full-Screen Reel Paging:** TikTok/Instagram-style vertical snap-scrolling video feed with hardware-accelerated video playback (`expo-av`).
- **📳 Haptic Touch:** Haptic feedback on liking, following, and generation triggers (`expo-haptics`).
- **✨ Instant Mobile Video Creation:** Generate quick videos directly from prompts on phone.
- **👤 Creator Profile:** Track rendering jobs, credits balance, and series.

---

## Quickstart

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Start the Expo Dev Server
```bash
npm start
# or
npx expo start
```

### 3. Open on Your Device
- **Physical Phone:** Download the free **Expo Go** app from the App Store (iOS) or Google Play (Android), and scan the QR code in your terminal.
- **iOS Simulator (Mac):** Press `i` in the terminal.
- **Android Emulator:** Press `a` in the terminal.

---

## Connecting to Local Backend
By default, `mobile/src/lib/api.ts` connects to `http://localhost:3000`.
When running on a physical phone via Expo Go, change `API_BASE_URL` in `mobile/src/lib/api.ts` to your machine's local Wi-Fi IP (e.g. `http://192.168.1.X:3000`) or your deployed production domain.
