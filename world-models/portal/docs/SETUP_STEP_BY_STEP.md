# Worldly – Step-by-step setup (from zero to App Lab)

Follow these steps in order. If something doesn't match your screen (e.g. different Unity version), use the closest option and then we can adjust.

---

## Test first (no Unity required)

You can confirm the flow and that links work before installing Unity:

1. **Web launcher (see what it looks like)**  
   Open **`test/web-launcher.html`** in your browser (double-click the file or drag it into Chrome/Safari/Firefox). You'll see a simple list of worlds; click one and the Marble URL opens in a new tab. If that page loads and you can explore the world there, the same link will work from the Quest app (it will open in Oculus Browser).

2. **Check your world list**  
   From the project folder run:
   ```bash
   node test/check-worlds.js
   ```
   This checks that `unity/Assets/StreamingAssets/Worlds.json` is valid and that each Marble URL is reachable. Use a real Marble world URL in `Worlds.json` to test; the sample uses a placeholder.  
   To open the first world in your browser after the check, run:
   ```bash
   node test/check-worlds.js --open
   ```

---

## Part 1: Install Unity and create the project

### Step 1.1 – Install Unity Hub and Unity

1. Go to [https://unity.com/download](https://unity.com/download) and download **Unity Hub**.
2. Install and open Unity Hub. Sign in or create a Unity account.
3. In Hub, go to **Installs** → **Install Editor**. Pick a version like **2022.3 LTS** or **6000.x** (Unity 6).
4. In the installer, under **Platforms**, enable:
   - **Android Build Support**
   - If it asks, also install **Android SDK & NDK** and **OpenJDK**.
   - You don't need an Android phone—Quest runs on Android, so Unity is building an app for the headset, not for a phone.
5. Finish the install.

### Step 1.2 – Create a new project

1. In Unity Hub, click **New project**.
2. Choose a template: **Core** (empty 3D) or **XR** if you see it.
3. Set **Project name** to something like `Worldly`, pick a folder, then **Create project**.
4. Wait for Unity to open.

---

## Part 2: Put the Worldly scripts in your project

### Step 2.1 – Copy the scripts

1. On your computer, open the **worldly** folder (where this repo lives).
2. Go into `unity/Assets/Scripts/`. You should see:
   - `WorldEntry.cs`
   - `WorldListConfig.cs`
   - `WorldLauncher.cs`
3. In Unity, in the **Project** window, go to `Assets`. If there's no `Scripts` folder, right‑click in `Assets` → **Create** → **Folder** → name it `Scripts`.
4. Copy the **three .cs files** from `worldly/unity/Assets/Scripts/` into your project's `Assets/Scripts/` folder (drag and drop, or copy/paste in Finder/Explorer so they end up inside `Assets/Scripts/`).
5. Back in Unity, wait for it to compile (no errors at the bottom). If you see red errors, tell me the exact message.

### Step 2.2 – Copy the world list (optional but useful)

1. In the worldly repo, open `unity/Assets/StreamingAssets/`.
2. In your Unity project, under `Assets`, create a folder named **StreamingAssets** if it doesn't exist (right‑click **Assets** → **Create** → **Folder**).
3. Copy **Worlds.json** from the repo's `StreamingAssets` into your project's `Assets/StreamingAssets/`.
4. You can edit `Worlds.json` later to add your real Marble URLs.

---

## Part 3: Install XR (Meta Quest) support

### Step 3.1 – Open Package Manager

1. In Unity menu: **Window** → **Package Manager**.
2. Top-left dropdown: set to **Unity Registry** (not "In Project").

### Step 3.2 – Install XR packages

1. In the list, find **XR Plugin Management** → click **Install**.
2. Find **OpenXR Plugin** → **Install**.
3. If you see **XR Interaction Toolkit**, install that too (helps with controller input and UI).

### Step 3.3 – Enable OpenXR for Android (Quest)

1. **Edit** → **Project Settings**.
2. In the left list, open **XR Plug-in Management**.
3. Click the **Android** tab (phone icon).
4. Check **OpenXR**.
5. In Unity 6, there is no separate "Meta Quest Feature Group" to add—having **OpenXR** checked for Android is enough for Quest. If you see an "OpenXR Feature Groups" section with a **+** and "Meta Quest Feature Group" or "Oculus" in the list, add it; otherwise skip this and leave the rest as default.
6. Close Project Settings.

---

## Part 4: Create the world list (what users will see)

### Step 4.1 – Create the config asset

1. In the **Project** window, go to `Assets` (or a subfolder like `Assets/Data`).
2. Right‑click in the empty area → **Create** → **Worldly** → **World List Config**.
3. Name it something like `WorldListConfig`.
4. Click the asset. In the **Inspector** you'll see a list **Worlds** (size 0).

### Step 4.2 – Add your first worlds

1. With `WorldListConfig` selected, in the Inspector set **Worlds → Size** to `2` (or how many you want).
2. Expand **Element 0**:
   - **Display Name**: e.g. `Mystical Forest`
   - **Marble Url**: paste a full Marble link, e.g. `https://marble.worldlabs.ai/world/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
3. Fill **Element 1** the same way (and more elements if you added them).
4. Press **Ctrl+S** (or **Cmd+S** on Mac) to save.

You can add more entries later by increasing **Size** and filling in Display Name and Marble Url.

---

## Part 5: Build the launcher UI in the scene

### Step 5.1 – Add a Canvas (VR UI)

1. In the **Hierarchy**, right‑click → **UI** → **Canvas**.
2. Click the new **Canvas**:
   - In **Canvas**, set **Render Mode** to **World Space**.
   - Click the **Rect Transform** anchor preset (top-left icon) and set **Width** `800`, **Height** `600`.
   - Set **Pos X** `0`, **Pos Y** `0`, **Pos Z** `2` (so it sits in front of the camera).
   - Set **Scale** to `0.001` for all three (X, Y, Z) so it's not huge in world space.
3. Under the Canvas, right‑click the Canvas → **UI** → **Scroll View**. Delete the child **Viewport** if you don't need it, or keep it—we'll use **Content**.
4. Under **Scroll View**, find **Content** (it's inside Viewport). Select **Content**:
   - Add a component: **Add Component** → search **Vertical Layout Group**. Add it.
   - Set **Vertical Layout Group**: **Child Force Expand** width = on, height = off. **Spacing** `10`. **Child Alignment** Upper Center.
   - Add component **Content Size Fitter**: **Vertical Fit** = **Preferred Size**.
5. Optional: on the **Scroll View**'s **Scroll Rect**, set **Movement Type** to **Clamped** and **Scroll Sensitivity** to something like `20`.

### Step 5.2 – Add the World Launcher script

1. In the Hierarchy, right‑click → **Create Empty**. Rename it to `WorldLauncher`.
2. With **WorldLauncher** selected, **Add Component** → search **World Launcher** (our script). Add it.
3. In the **World Launcher** component:
   - **World List Config**: drag your `WorldListConfig` asset from the Project into this field.
   - **Button Container**: drag the **Content** object (under Scroll View → Viewport → Content) into this field.
   - **Button Prefab**: leave empty for now (the script will create simple buttons).
   - **Streaming Json Path**: leave empty to use only the config; or type `Worlds.json` if you want to use the JSON file in StreamingAssets.

### Step 5.3 – Make sure the UI can be clicked (Event System + XR)

1. When you added the Canvas, Unity may have created an **EventSystem**. If not: right‑click in Hierarchy → **UI** → **Event System**.
2. For **Quest controllers** to hit the buttons, you need either:
   - **XR Interaction Toolkit**: add an **XR Origin** to the scene and an **XR Ray Interactor** that uses the Canvas (and ensure the Canvas has a **Graphic Raycaster**), or  
   - For the **simplest test**: use the **Mouse** (Unity's Simulator or clicking in Game view). You can add XR input properly after the list works.

The Canvas already has a **Graphic Raycaster** by default, so once you add XR Origin and ray interactor later, controller taps will work.

**If you can't click the buttons with the mouse (e.g. "Mystical Forest" doesn't respond):**

1. **Use Screen Space – Camera for the Canvas (best for mouse in editor)**  
   - Select **Canvas** in the Hierarchy.  
   - In the **Inspector**, **Canvas** component: set **Render Mode** to **Screen Space - Camera**.  
   - Set **Render Camera** to the camera that shows the Game view when you press Play (drag **Main Camera** or the **Camera** under **XR Origin → Camera Offset** into this field).  
   - Leave **Plane Distance** at something like `100`.  
   Now the Canvas is drawn on top of that camera and mouse clicks in the Game view will hit it.

2. **Make sure the Event System accepts mouse**  
   - Select **EventSystem** in the Hierarchy.  
   - In **Input System UI Input Module**, set **Pointer Behavior** to **Single Mouse Or Pen But Multi Touch** (or anything that includes "Mouse") so the mouse is used for UI in the editor.

3. **Confirm the Canvas is visible when you play**  
   - Press **Play**, click the **Game** tab, and make sure you see the list. If you see the 3D scene but no UI, the Canvas might be on the wrong layer or the wrong camera is active; use step 1 and assign the camera that's actually rendering the Game view.

---

## Part 6: Scene and camera

### Step 6.1 – Simple setup (no headset yet)

1. Your scene should have a **Main Camera**. Place it so it looks at the Canvas (e.g. position `0, 0, 0`, the Canvas at Z = 2).
2. Press **Play**. You should see the Scroll View and, after a moment, a list of buttons (your world names). Click one—it should open the Marble URL in your **computer's default browser**. That's expected; on the headset it will open in Oculus Browser.

### Step 6.2 – Add XR Origin (for real Quest)

1. **Add XR Origin**
   - In the **Hierarchy**, right‑click in the empty area.
   - Go to **XR** → **XR Origin (XR Rig)** (or **GameObject** → **XR** → **XR Origin (XR Rig)** if your menu is different).
   - Unity adds an **XR Origin** object with a **Camera Offset** and usually **Main Camera** and hand/controller objects under it.

2. **Position the Canvas in front of the headset**
   - Select **Canvas** in the Hierarchy.
   - In the **Inspector**, set **Rect Transform** so the panel is in front of the camera. For example:
     - **Pos X** `0`, **Pos Y** `0`, **Pos Z** `2`
     - **Scale** `0.001` for X, Y, Z (so it's not huge in 3D space).
   - If the XR Origin is at `0, 0, 0`, the Canvas at Z = 2 will appear in front of the user in the headset.

3. **Wire the Event System to XR**
   - Select **EventSystem** in the Hierarchy.
   - In the **Inspector**, find the **Input System UI Input Module** (or **XR UI Input Module** if you have it).
   - Find the **XR Tracking Origin** (or **Tracked Device Model**) field.
   - Drag the **XR Origin** object from the Hierarchy into that field (use the root **XR Origin** or **Camera Offset**—whichever your version shows). This lets the UI receive controller/head rays.

4. **Let controller rays hit the UI**
   - Select **Canvas**. Ensure it has a **Graphic Raycaster** component (it usually does by default).
   - If you have **XR Interaction Toolkit**: the **XR Ray Interactor** on the controllers should hit UI by default. If not, select each hand/controller object, find **XR Ray Interactor**, and set **Raycast Mask** to include the layer your Canvas is on (e.g. **Default**).

5. **Optional: disable or move the old Main Camera**
   - If you had a standalone **Main Camera** before adding XR Origin, disable it (uncheck the camera component or the GameObject). The XR Origin's camera will be the active one when you run on the device.

---

## Part 7: Build for Meta Quest (Android)

### Step 7.1 – Switch platform to Android

1. In **Unity 6**: **File** → **Build Profiles** (or **⇧⌘B** / **Shift+Ctrl+B**). In older Unity: **File** → **Build Settings**.
2. In **Build Profiles**, add or select a profile and set its **Platform** to **Android** (or in Build Settings, select **Android** and click **Switch Platform**).
3. Wait for the platform switch if prompted.

### Step 7.2 – Player settings for Quest

1. **Edit** → **Project Settings** → **Player**.
2. Expand **Android** (Android icon / tab).
3. **Other Settings**:
   - **Package Name**: e.g. `com.yourname.worldly` (must be unique, use your name/company).
   - **Minimum API Level**: 29 or whatever the current Meta requirement is (check Meta's docs).
   - **Target API Level**: 33 or 34 (again, check Meta's latest).
4. **Configuration**:
   - **Scripting Backend**: **IL2CPP**.
   - **Target Architectures**: check **ARM64** only (uncheck ARMv7).

### Step 7.3 – Build the APK

1. **File** → **Build Profiles** (Unity 6) or **Build Settings** (older Unity). Ensure the active profile/platform is **Android**.
2. Optionally enable **Development Build** only if you're debugging (uncheck for release).
3. Click **Build** or **Build And Run**.
4. Pick a folder and a name (e.g. `Worldly.apk`) and save.
5. If you chose **Build And Run**, connect your Quest via USB, enable USB debugging on the headset, and the app will install and run.

---

## Part 8: Put the app on App Lab (shareable link)

1. Go to [https://developer.oculus.com/manage/](https://developer.oculus.com/manage/) and sign in with your Meta account.
2. Create an **organization** and/or **app** if you haven't already.
3. Create a new **App Lab** application. Fill in name, description, category, etc.
4. In the **Releases** (or **Builds**) section, upload your **APK** (or the **AAB** if you built an Android App Bundle).
5. Submit for **App Lab** review. Meta will review; once approved, you get a **direct link** (e.g. `https://www.meta.com/experiences/your-app/...`) that you can send to people. They open it on their phone or in the headset and can install the app on their Quest.

---

## Quick checklist

- [ ] Unity installed with Android Build Support  
- [ ] New project created  
- [ ] Worldly scripts in `Assets/Scripts/`  
- [ ] World List Config created and worlds added (names + Marble URLs)  
- [ ] Canvas + Scroll View + Content with Vertical Layout Group  
- [ ] WorldLauncher on a GameObject, config and Button Container assigned  
- [ ] XR Plugin Management → Android → OpenXR checked  
- [ ] (Optional) XR Origin added; Event System XR Tracking Origin set  
- [ ] (If mouse doesn’t work) Canvas Screen Space - Camera + Render Camera set  
- [ ] Build Settings → Android, Player → Package name, IL2CPP, ARM64  
- [ ] Build APK, then upload to App Lab and submit  

If you tell me which step you're on and what you see (or any error message), I can give you the exact next click or fix.
