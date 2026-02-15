# Worldly – Meta Quest VR World Launcher

An app for **Meta Quest** that shows a list of **Marble world links**. When you pick a world, it opens the Marble web URL in the headset (Oculus Browser) so you can explore it in VR. You can add worlds manually now; a pipeline can be wired in later.

**New to Unity or Quest?** → **[Step-by-step setup guide](docs/SETUP_STEP_BY_STEP.md)** (from installing Unity to App Lab).

---

## What you get

- **Many worlds**: A launcher list (add entries manually).
- **Direct link**: Build for App Lab and share the store link with others.
- **Marble URLs**: Each entry is a Marble web URL (e.g. `https://marble.worldlabs.ai/world/...`). Tapping it opens that URL on Quest.

---

## Adding worlds manually

### Option A: ScriptableObject (Inspector)

1. In Unity: **Assets → Create → Worldly → World List Config**. Name it (e.g. `WorldListConfig`).
2. Select the asset. In the Inspector, expand **Worlds** and add elements.
3. For each element set:
   - **Display Name**: Label in the app (e.g. "Mystical Forest").
   - **Marble Url**: Full URL (e.g. `https://marble.worldlabs.ai/world/abc-123`).
4. Assign this asset to the **World Launcher** component (see Scene setup below).

### Option B: JSON file (StreamingAssets)

1. Edit `Assets/StreamingAssets/Worlds.json` (or create it). Format:

```json
{
  "worlds": [
    { "displayName": "My World", "marbleUrl": "https://marble.worldlabs.ai/world/your-id" }
  ]
}
```

2. On the **World Launcher** component, set **Streaming Json Path** to `Worlds.json`. If this is set and the file exists, it overrides the ScriptableObject.

---

## Scene setup (Unity)

1. **XR**: Add an XR Origin (OpenXR) and set up for Meta Quest (see [Quest setup](#meta-quest--app-lab-build) below).
2. **Canvas**: Create a World Space Canvas in front of the camera (or under XR Origin):
   - Add **World Launcher** to a GameObject (e.g. on the Canvas or a child).
   - Assign **World List Config** (your ScriptableObject).
   - Assign **Button Container**: create a Scroll View → **Content** (RectTransform with Vertical Layout Group) and assign its transform so the launcher can spawn buttons there.
   - Optional: create a **Button Prefab** (Button + Text for the label) and assign it; otherwise the launcher creates simple buttons.
3. **Interaction**: Ensure your Canvas has a **Graphic Raycaster** and that the XR Ray Interactor (or Event System) can hit the buttons so Quest controllers can tap them.

---

## Meta Quest & App Lab build

1. **Build Settings**: Platform = **Android**, switch and build.
2. **Player**: Package name (e.g. `com.yourcompany.worldly`), **IL2CPP**, **ARM64**.
3. **XR**: **Edit → Project Settings → XR Plug-in Management → Android**: enable **OpenXR**, add **Meta Quest Feature Group**.
4. Build the APK (or App Bundle). For **App Lab**, upload the build in the [Meta Quest Developer Dashboard](https://developer.oculus.com/manage/) and submit for App Lab. Once approved, you get a **direct link** to share (e.g. `https://www.meta.com/experiences/...`) so others can install the app on their Quest.

---

## Pipeline later

Right now the list is manual (ScriptableObject or `Worlds.json`). When you add a pipeline (e.g. API that returns world list), you can:

- Replace or extend `WorldLauncher.GetWorldEntries()` to fetch from your API, or
- Keep using `Worlds.json` and have your backend write that file into StreamingAssets at build time.

The launcher only needs a list of `WorldEntry` (display name + Marble URL); where that list comes from can be swapped later.
