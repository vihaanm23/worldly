using System.Collections.Generic;
using UnityEngine;

namespace Worldly
{
    /// <summary>
    /// List of worlds to show in the launcher. Add entries manually in the Inspector.
    /// Create via Assets → Create → Worldly → World List Config.
    /// </summary>
    [CreateAssetMenu(fileName = "WorldListConfig", menuName = "Worldly/World List Config", order = 0)]
    public class WorldListConfig : ScriptableObject
    {
        [Tooltip("Worlds to show. Add or edit entries here; they appear in the launcher list.")]
        public List<WorldEntry> worlds = new List<WorldEntry>();
    }
}
