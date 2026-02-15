using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Worldly
{
    /// <summary>
    /// Populates a list of world buttons from WorldListConfig. When a world is selected,
    /// opens its Marble URL (in Oculus Browser on Quest) so the user can explore it.
    /// </summary>
    public class WorldLauncher : MonoBehaviour
    {
        [Header("Config")]
        [Tooltip("Assign the World List Config asset. Add worlds in the Inspector.")]
        public WorldListConfig worldListConfig;

        [Header("UI")]
        [Tooltip("Parent transform where world buttons will be created (e.g. Scroll View → Content).")]
        public Transform buttonContainer;

        [Tooltip("Optional: prefab with a Button and a Text/TextMeshPro for the label. If null, simple buttons are created.")]
        public GameObject buttonPrefab;

        [Header("Fallback")]
        [Tooltip("If set, load world list from this JSON in StreamingAssets (e.g. Worlds.json). Overrides config when present.")]
        public string streamingJsonPath = "";

        private readonly List<GameObject> _spawnedButtons = new List<GameObject>();

        private void Start()
        {
            RefreshList();
        }

        /// <summary>Reload world list (from config or StreamingAssets JSON) and rebuild buttons.</summary>
        public void RefreshList()
        {
            ClearButtons();

            List<WorldEntry> entries = GetWorldEntries();
            if (entries == null || entries.Count == 0)
            {
                CreatePlaceholder("No worlds configured. Add entries in WorldListConfig or Worlds.json.");
                return;
            }

            foreach (WorldEntry entry in entries)
            {
                if (string.IsNullOrWhiteSpace(entry.marbleUrl))
                    continue;
                CreateWorldButton(entry);
            }
        }

        private List<WorldEntry> GetWorldEntries()
        {
            if (!string.IsNullOrEmpty(streamingJsonPath))
            {
                string path = System.IO.Path.Combine(Application.streamingAssetsPath, streamingJsonPath);
                if (System.IO.File.Exists(path))
                {
                    try
                    {
                        string json = System.IO.File.ReadAllText(path);
                        var wrapper = JsonUtility.FromJson<WorldListWrapper>(json);
                        if (wrapper?.worlds != null && wrapper.worlds.Count > 0)
                            return wrapper.worlds;
                    }
                    catch (System.Exception e)
                    {
                        Debug.LogWarning("[WorldLauncher] Could not load JSON: " + e.Message);
                    }
                }
            }

            if (worldListConfig != null && worldListConfig.worlds != null && worldListConfig.worlds.Count > 0)
                return worldListConfig.worlds;

            return null;
        }

        private void CreateWorldButton(WorldEntry entry)
        {
            GameObject go;
            Button btn;
            Text label;

            if (buttonPrefab != null && buttonContainer != null)
            {
                go = Instantiate(buttonPrefab, buttonContainer);
                btn = go.GetComponentInChildren<Button>(true);
                label = go.GetComponentInChildren<Text>(true);
                if (btn == null) btn = go.GetComponent<Button>();
                if (label == null) label = go.GetComponentInChildren<Text>(true);
            }
            else
            {
                go = CreateSimpleButton(entry.displayName, out btn, out label);
                if (buttonContainer != null)
                    go.transform.SetParent(buttonContainer, false);
            }

            if (label != null)
                label.text = string.IsNullOrEmpty(entry.displayName) ? entry.marbleUrl : entry.displayName;

            string url = entry.marbleUrl;
            if (btn != null)
                btn.onClick.AddListener(() => OpenWorld(url));

            _spawnedButtons.Add(go);
        }

        private void CreatePlaceholder(string message)
        {
            GameObject go = CreateSimpleButton(message, out _, out _);
            if (buttonContainer != null)
                go.transform.SetParent(buttonContainer, false);
            _spawnedButtons.Add(go);
        }

        private GameObject CreateSimpleButton(string labelText, out Button btn, out Text label)
        {
            var go = new GameObject("WorldButton");
            var rect = go.AddComponent<RectTransform>();
            rect.sizeDelta = new Vector2(400f, 60f);

            btn = go.AddComponent<Button>();

            var child = new GameObject("Label");
            child.transform.SetParent(go.transform, false);
            label = child.AddComponent<Text>();
            label.text = labelText;
            label.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            label.fontSize = 24;
            label.alignment = TextAnchor.MiddleCenter;
            var childRect = child.GetComponent<RectTransform>();
            childRect.anchorMin = Vector2.zero;
            childRect.anchorMax = Vector2.one;
            childRect.offsetMin = Vector2.zero;
            childRect.offsetMax = Vector2.zero;

            return go;
        }

        private void ClearButtons()
        {
            foreach (GameObject b in _spawnedButtons)
            {
                if (b != null)
                    Destroy(b);
            }
            _spawnedButtons.Clear();
        }

        /// <summary>Opens the Marble world URL. On Quest this opens in Oculus Browser.</summary>
        public void OpenWorld(string marbleUrl)
        {
            if (string.IsNullOrWhiteSpace(marbleUrl))
                return;
            Application.OpenURL(marbleUrl);
        }

        [System.Serializable]
        private class WorldListWrapper
        {
            public List<WorldEntry> worlds;
        }
    }
}
