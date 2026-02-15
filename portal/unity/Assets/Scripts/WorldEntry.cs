using System;
using UnityEngine;

namespace Worldly
{
    /// <summary>One world in the launcher: display name + Marble web URL to open on Quest.</summary>
    [Serializable]
    public class WorldEntry
    {
        [Tooltip("Label shown in the app (e.g. \"Mystical Forest\").")]
        public string displayName = "World";

        [Tooltip("Full Marble web URL (e.g. https://marble.worldlabs.ai/world/...). Opens in browser when selected.")]
        public string marbleUrl = "";
    }
}
