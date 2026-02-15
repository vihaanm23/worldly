#!/usr/bin/env python3
"""
HTTP server for video-to-World generation.

POST /generate-worldvr (multipart/form-data):
  - video: required file field
  - prompt: optional text prompt
  - name: optional world display name (default: "Generated World")

Response JSON:
  {
    "operation_id": "...",
    "world_id": "...",
    "marble_url": "https://marble.worldlabs.ai/world/<id>",
    "worldvr_url": "https://marble.worldlabs.ai/worldvr/<id>"
  }
"""

import os
import tempfile

from flask import Flask, jsonify, request

from create_world import create_world, poll_until_done

app = Flask(__name__)


@app.post("/generate-worldvr")
def generate_worldvr():
    if "video" not in request.files:
        return jsonify({"error": "Missing file field: video"}), 400

    video_file = request.files["video"]
    if not video_file or not video_file.filename:
        return jsonify({"error": "No video file provided"}), 400

    ext = os.path.splitext(video_file.filename)[1] or ".mp4"
    prompt = request.form.get("prompt")
    display_name = request.form.get("name", "Generated World")

    temp_path = None
    compressed_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            temp_path = tmp.name
            video_file.save(temp_path)

        operation_id = create_world("video", temp_path, display_name, prompt)
        result = poll_until_done(operation_id)

        response = result.get("response") or {}
        world_id = response.get("id") or (result.get("metadata") or {}).get("world_id")
        marble_url = response.get("world_marble_url") or f"https://marble.worldlabs.ai/world/{world_id}"
        worldvr_url = marble_url.replace("/world/", "/worldvr/")

        return jsonify(
            {
                "operation_id": operation_id,
                "world_id": world_id,
                "marble_url": marble_url,
                "worldvr_url": worldvr_url,
            }
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass

        # create_world.py compresses to "<input>.upload.mp4" for videos.
        if temp_path:
            compressed_path = os.path.splitext(temp_path)[0] + ".upload.mp4"
            if os.path.exists(compressed_path):
                try:
                    os.remove(compressed_path)
                except OSError:
                    pass


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
