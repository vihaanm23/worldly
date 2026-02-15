#!/usr/bin/env python3
"""
World Labs API script: creates a 3D world from text, video, or image input.
Requires WORLD_LABS_API_KEY in the environment (e.g. export or .env); do not commit the key.

Usage:
  python create_world.py --type text
  python create_world.py --type video --file assets/tree_ground.mov
  python create_world.py --type video --file assets/tree_ground.mov --prompt "A forest scene"
  python create_world.py --type image --file path/to/image.jpg
"""

import argparse
import mimetypes
import os
import subprocess
import time
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv()

API_BASE = "https://api.worldlabs.ai/marble/v1"
# Set WORLD_LABS_API_KEY in env or .env (never commit the key)
API_KEY = os.environ.get("WORLD_LABS_API_KEY")
if not API_KEY:
    raise RuntimeError(
        "WORLD_LABS_API_KEY is not set. Set it in your environment or in a .env file (add .env to .gitignore)."
    )

# Allowed extensions per kind (World Labs recommended formats)
VIDEO_EXTENSIONS = {"mp4", "mov", "mkv"}
IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_VIDEO_UPLOAD_MB = 10
MAX_VIDEO_UPLOAD_FRAMES = 1800

WORLD_PROMPT = """I want a Create an expansive, fully explorable alien rainforest world inspired by Pandora-like ecology, rendered in cinematic ultra-realistic 3D with physically based materials, volumetric lighting, and dynamic weather.
🌍 Terrain & Macro Environment
Massive floating mountains suspended in the sky, with exposed rock undersides, hanging roots, drifting mist, and cascading multi-tier waterfalls that fall into a glowing cloud ocean below
Dense, layered jungle canopy with three vertical biomes: forest floor (dark, humid, foggy), mid-canopy (thick vegetation and giant trunks), and upper canopy (sunlit, windy, open platforms)
Winding bioluminescent rivers that glow cyan and violet at night, feeding into natural pools at cliff edges before spilling into waterfalls
Natural stone arches, vine bridges, and hollow megatrees large enough to walk inside
💡 Flora (Plant Life)
Gigantic bioluminescent trees with semi-transparent leaves that pulse slowly with light (blue, teal, magenta)
Reactive plants that glow when the player walks near them (proximity shader + particle pollen release)
Floating seed spores drifting through the air with soft emissive trails
Spiral ferns, glass-like mushrooms, hanging light pods, and fractal coral-style ground plants
Wet surfaces with subsurface scattering and water droplets
🌊 Water Systems
Physically simulated waterfalls with:
Mist volumes at impact zones
Light refraction through falling water
Rainbow diffraction in sunlight
Splash particle systems and ripples in pools
Shallow reflective pools with glowing algae and small bioluminescent fish
Slow moving fog hugging water surfaces
🌤️ Lighting & Atmosphere
Time-of-day cycle:
Golden god-rays at sunrise through canopy
Harsh white zenith light at noon with deep shadows
Neon bioluminescent dominance at night
Volumetric fog layers with height falloff
Light shafts through waterfalls
Dynamic cloud shadows moving across floating mountains
Firefly-like light creatures acting as moving light sources
🪨 Materials & Rendering
Photoreal PBR materials (wet rock, moss, bark, translucent leaves)
Tessellated terrain with parallax occlusion for roots and mud
Screen-space reflections on water and wet leaves
High poly foliage with wind animation (vertex shader sway)
🧬 Ambient Life (Non-sentient)
Schools of glowing airborne jellyfish drifting between cliffs
Small quadrupeds that leave faint glowing footprints
Distant silhouettes of massive flying creatures passing through clouds (no close interaction)
Procedural ambient soundscape: deep jungle drones, water thunder, echoing calls"""

# Default text prompt when using video input (--type video without --prompt)
VIDEO_PROMPT = """Convert the provided video into a fully navigable, metrically accurate, hyperrealistic 3D scene.
The output must preserve real-world scale, geometry, lighting, and material properties, enabling free camera movement and real-time rendering.
📐 Geometry & Spatial Reconstruction
Perform multi-view reconstruction from all frames to recover accurate depth, camera poses, and scene scale
Generate a dense, watertight 3D mesh with clean topology
Preserve fine geometric detail (thin structures, foliage, wires, railings, edges)
Remove motion blur artifacts and reconstruct occluded regions using temporal inference
Maintain true perspective and correct lens distortion
🧱 Materials & Texturing
Extract physically based materials (PBR):
Albedo
Normal maps
Roughness
Metallic (if applicable)
Generate 8K photoreal textures with seamless projection
Preserve micro-details: cracks, dirt, water stains, fabric weave, skin pores, leaf veins
Separate reflective vs diffuse surfaces correctly
💡 Lighting Reconstruction
Recover original HDR lighting environment from the video
Estimate:
Directional light sources
Soft bounce lighting
Ambient occlusion
Shadow softness
Create a relightable scene with baked global illumination + dynamic light option
Preserve specular highlights and reflections
🌫️ Atmosphere & Effects
Reconstruct volumetric elements if present:
Fog
Mist
Smoke
Light shafts
Convert water surfaces into physically simulated materials with reflections and refraction
Add subtle particle systems for dust/pollen if visible
🎥 Camera System
Match original camera path exactly
Provide:
Original tracked camera
Free-fly cinematic camera
First-person navigation camera
Maintain real-world scale for VR compatibility
🧠 Temporal Consistency
Use cross-frame fusion to eliminate flicker and texture popping
Stabilize moving objects or separate them into distinct animated meshes
Preserve dynamic elements (people, vehicles, animals) as optional animated layers
🖥️ Rendering Targets
Hyperrealistic, cinematic quality
Real-time capable (Nanite / Gaussian splats / optimized mesh LODs)
Physically correct reflections, soft shadows, and global illumination
Parallax-correct depth at all distances"""


def upload_media_file(file_path: str, kind: str) -> str:
    """1) Prepare upload (POST). 2) Upload file (PUT to signed URL with required_headers). Returns media_asset id."""
    path = os.path.abspath(file_path)
    if not os.path.isfile(path):
        raise FileNotFoundError("File not found: %s" % path)
    file_name = os.path.basename(path)
    ext = (os.path.splitext(file_name)[1] or "").lstrip(".").lower()
    if kind == "video" and ext not in VIDEO_EXTENSIONS:
        raise ValueError("Video extension must be one of %s" % VIDEO_EXTENSIONS)
    if kind == "image" and ext not in IMAGE_EXTENSIONS:
        raise ValueError("Image extension must be one of %s" % IMAGE_EXTENSIONS)

    if kind == "video":
        path = compress_video_for_upload(
            path, max_size_mb=MAX_VIDEO_UPLOAD_MB, max_frames=MAX_VIDEO_UPLOAD_FRAMES
        )
        file_name = os.path.basename(path)
        ext = (os.path.splitext(file_name)[1] or "").lstrip(".").lower()

    # 1) Prepare upload
    print("Preparing upload for %s..." % file_name)
    prep = requests.post(
        f"{API_BASE}/media-assets:prepare_upload",
        headers={"Content-Type": "application/json", "WLT-Api-Key": API_KEY},
        json={"file_name": file_name, "kind": kind, "extension": ext or "bin"},
    )
    prep.raise_for_status()
    data = prep.json()
    media_asset = data["media_asset"]
    upload_url = data["upload_info"]["upload_url"]
    required_headers = data["upload_info"].get("required_headers") or {}

    # Preflight size check from signed upload policy, if provided.
    file_size = os.path.getsize(path)
    size_range = required_headers.get("x-goog-content-length-range")
    if size_range:
        try:
            lo_str, hi_str = size_range.split(",", 1)
            min_size = int(lo_str.strip())
            max_size = int(hi_str.strip())
            if not (min_size <= file_size <= max_size):
                raise RuntimeError(
                    "File too large for signed upload policy: file=%d bytes (%.2f MB), "
                    "allowed=%d-%d bytes (max %.2f MB). "
                    "Use a smaller/compressed video and retry."
                    % (
                        file_size,
                        file_size / (1024 * 1024),
                        min_size,
                        max_size,
                        max_size / (1024 * 1024),
                    )
                )
        except ValueError:
            # If parsing fails, continue and let server validate.
            pass

    # 2) Upload file with curl exactly like docs:
    # curl -X PUT "<signed_url>" -H "<k>: <v>" --data-binary "@/path/to/file"
    print("Uploading %s..." % file_name)
    guessed_type = mimetypes.guess_type(path)[0]

    def run_upload(extra_headers=None):
        curl_cmd = ["curl", "-sS", "-X", "PUT", upload_url]
        for header_key, header_val in required_headers.items():
            curl_cmd.extend(["-H", f"{header_key}: {header_val}"])
        for h in (extra_headers or []):
            curl_cmd.extend(["-H", h])
        # Include body on error and parse status deterministically.
        curl_cmd.extend(["--data-binary", f"@{path}", "-w", "\n__HTTP_STATUS__:%{http_code}"])
        return subprocess.run(curl_cmd, capture_output=True, text=True)

    # Attempt 1: strict docs flow (required_headers only)
    upload_proc = run_upload()
    output = (upload_proc.stdout or "").strip()
    status = output.split("__HTTP_STATUS__:")[-1].strip() if "__HTTP_STATUS__:" in output else ""
    body = output.split("__HTTP_STATUS__:")[0].strip() if "__HTTP_STATUS__:" in output else output
    if upload_proc.returncode == 0 and status.startswith("2"):
        media_asset_id = media_asset.get("id") or media_asset.get("media_asset_id")
        if not media_asset_id:
            raise KeyError("media_asset id not found in response: %s" % media_asset)
        return media_asset_id

    # Attempt 2: add Content-Type fallback for strict storage backends.
    extra = [f"Content-Type: {guessed_type or 'application/octet-stream'}"]
    upload_proc_2 = run_upload(extra_headers=extra)
    output_2 = (upload_proc_2.stdout or "").strip()
    status_2 = (
        output_2.split("__HTTP_STATUS__:")[-1].strip() if "__HTTP_STATUS__:" in output_2 else ""
    )
    body_2 = output_2.split("__HTTP_STATUS__:")[0].strip() if "__HTTP_STATUS__:" in output_2 else output_2
    if upload_proc_2.returncode == 0 and status_2.startswith("2"):
        media_asset_id = media_asset.get("id") or media_asset.get("media_asset_id")
        if not media_asset_id:
            raise KeyError("media_asset id not found in response: %s" % media_asset)
        return media_asset_id

    # Include as much detail as possible for debugging.
    err_parts = []
    if status:
        err_parts.append("attempt1_status=%s" % status)
    if body:
        err_parts.append("attempt1_body=%s" % body)
    if upload_proc.stderr.strip():
        err_parts.append("attempt1_stderr=%s" % upload_proc.stderr.strip())
    if status_2:
        err_parts.append("attempt2_status=%s" % status_2)
    if body_2:
        err_parts.append("attempt2_body=%s" % body_2)
    if upload_proc_2.stderr.strip():
        err_parts.append("attempt2_stderr=%s" % upload_proc_2.stderr.strip())
    raise RuntimeError("Signed upload failed: " + " | ".join(err_parts))


def compress_video_for_upload(input_path: str, max_size_mb: int, max_frames: int) -> str:
    """Create an upload-safe MP4 capped by size and frame count."""
    input_path = os.path.abspath(input_path)
    output_path = os.path.splitext(input_path)[0] + ".upload.mp4"
    max_size_bytes = max_size_mb * 1024 * 1024

    ffmpeg_cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        input_path,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "30",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-frames:v",
        str(max_frames),
        "-fs",
        f"{max_size_mb}M",
        output_path,
    ]

    print(
        "Auto-compressing video for upload (<=%d MB, <=%d frames)..."
        % (max_size_mb, max_frames)
    )
    try:
        proc = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
    except FileNotFoundError:
        raise RuntimeError(
            "ffmpeg is required for auto-compression but was not found. "
            "Install ffmpeg or provide a pre-compressed video."
        )

    if proc.returncode != 0:
        raise RuntimeError(
            "Video compression failed: %s"
            % (proc.stderr.strip() or proc.stdout.strip() or "unknown ffmpeg error")
        )

    if not os.path.isfile(output_path):
        raise RuntimeError("Video compression failed: output file not created")

    output_size = os.path.getsize(output_path)
    if output_size > max_size_bytes:
        raise RuntimeError(
            "Compressed video still too large: %.2f MB > %d MB"
            % (output_size / (1024 * 1024), max_size_mb)
        )

    print(
        "Compressed video: %s (%.2f MB)"
        % (os.path.basename(output_path), output_size / (1024 * 1024))
    )
    return output_path


def create_world(input_type: str, file_path: Optional[str], display_name: str, text_prompt: Optional[str]):
    headers = {"Content-Type": "application/json", "WLT-Api-Key": API_KEY}

    using_default_video_prompt = False

    if input_type == "text":
        world_prompt = {"type": "text", "text_prompt": (text_prompt or WORLD_PROMPT).strip()}
    elif input_type == "video":
        if not file_path:
            raise ValueError("--file is required for video input")
        media_asset_id = upload_media_file(file_path, "video")
        world_prompt = {
            "type": "video",
            "video_prompt": {"source": "media_asset", "media_asset_id": media_asset_id},
        }
        # Use VIDEO_PROMPT by default; override with --prompt if provided
        using_default_video_prompt = text_prompt is None
        world_prompt["text_prompt"] = (text_prompt or VIDEO_PROMPT).strip()
    elif input_type == "image":
        if not file_path:
            raise ValueError("--file is required for image input")
        media_asset_id = upload_media_file(file_path, "image")
        world_prompt = {
            "type": "image",
            "image_prompt": {"source": "media_asset", "media_asset_id": media_asset_id},
        }
        if text_prompt:
            world_prompt["text_prompt"] = text_prompt.strip()
    else:
        raise ValueError("input_type must be text, video, or image")

    payload = {
        "display_name": display_name,
        "world_prompt": world_prompt,
        "permission": {"public": True},  # world is publicly viewable
        # "model": "Marble 0.1-mini",  # uncomment for faster drafts
    }

    print("Starting world generation...")
    active_payload = payload
    r = requests.post(f"{API_BASE}/worlds:generate", json=active_payload, headers=headers)
    if not r.ok and input_type == "video" and using_default_video_prompt:
        # If default video prompt is too long/strict for API validation, retry without text_prompt.
        print("World generation failed with default video prompt. Retrying without text_prompt...")
        active_payload = {
            "display_name": display_name,
            "world_prompt": {
                "type": "video",
                "video_prompt": payload["world_prompt"]["video_prompt"],
            },
            "permission": {"public": True},
        }
        r = requests.post(f"{API_BASE}/worlds:generate", json=active_payload, headers=headers)

    # Upload can take a short moment to become visible to world generation.
    if (
        not r.ok
        and input_type in ("video", "image")
        and "has not been uploaded yet" in (r.text or "")
    ):
        for attempt in range(1, 7):
            wait_s = 2 * attempt
            print(
                "Media asset not ready yet. Retrying worlds:generate in %ss (attempt %s/6)..."
                % (wait_s, attempt)
            )
            time.sleep(wait_s)
            r = requests.post(f"{API_BASE}/worlds:generate", json=active_payload, headers=headers)
            if r.ok:
                break

    if not r.ok:
        raise RuntimeError("worlds:generate failed (%s): %s" % (r.status_code, (r.text or r.reason)))
    op = r.json()
    operation_id = op.get("operation_id")
    if not operation_id:
        raise RuntimeError("No operation_id in response: %s" % op)
    print("Operation ID:", operation_id)
    return operation_id


def poll_until_done(operation_id, interval=15):
    headers = {"WLT-Api-Key": API_KEY}
    url = f"{API_BASE}/operations/{operation_id}"

    while True:
        r = requests.get(url, headers=headers)
        r.raise_for_status()
        op = r.json()
        done = op.get("done", False)
        meta = op.get("metadata") or {}
        progress = (meta.get("progress") or {}).get("description", "")

        print("[%s] %s" % (time.strftime("%H:%M:%S"), progress or "Waiting..."))

        if done:
            if op.get("error"):
                raise RuntimeError("Operation failed: %s" % op["error"])
            return op
        time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(
        description="Create a 3D world via World Labs API (text, video, or image input)."
    )
    parser.add_argument(
        "--type",
        choices=["text", "video", "image"],
        required=True,
        help="Input type: text (prompt only), video (local file), or image (local file)",
    )
    parser.add_argument(
        "--file",
        metavar="PATH",
        help="Path to video or image file (required for --type video or --type image)",
    )
    parser.add_argument(
        "--prompt",
        metavar="TEXT",
        help="Text prompt. For text type this is the full prompt; for video/image it is optional guidance.",
    )
    parser.add_argument(
        "--name",
        default="Generated World",
        help="Display name for the world (default: Generated World)",
    )
    args = parser.parse_args()

    if args.type in ("video", "image") and not args.file:
        parser.error("--file is required when --type is %s" % args.type)
    if args.type == "text" and not args.prompt:
        args.prompt = WORLD_PROMPT  # use built-in long prompt

    operation_id = create_world(args.type, args.file, args.name, args.prompt)
    print("Polling every 15s (world generation can take ~5 minutes)...")
    result = poll_until_done(operation_id)

    response = result.get("response")
    if response:
        world_id = response.get("id")
        marble_url = response.get("world_marble_url")
        print("\nDone!")
        print("World ID:", world_id)
        base = marble_url or f"https://marble.worldlabs.ai/world/{world_id}"
        print("View in Marble:", base)
        print("View in WorldVR:", base.replace("/world/", "/worldvr/"))
    else:
        world_id = (result.get("metadata") or {}).get("world_id")
        print("\nDone! World ID:", world_id)
        marble_base = "https://marble.worldlabs.ai/world/%s" % world_id
        print("View in Marble:", marble_base)
        print("View in WorldVR:", "https://marble.worldlabs.ai/worldvr/%s" % world_id)


if __name__ == "__main__":
    main()
