using PKHeX.Core;

namespace PKHeX.Facade.Pokemons;

/// <summary>
/// Ribbons currently held by a <see cref="PKM"/>.
///
/// PKHeX.Core's ribbon sets vary release to release (a <see cref="PKM"/>
/// subtype implements whichever <c>IRibbonSetXxx</c> marker interfaces apply
/// to its generation, e.g. <see cref="IRibbonSetCommon3"/> for Generation 3),
/// so there is no single interface to read ribbons off of. Core's own editors
/// face the same problem and solve it with <see cref="RibbonInfo.GetRibbonInfo"/>,
/// a reflection-based helper that lists every <c>Ribbon*</c>-prefixed property
/// the entity's concrete type actually declares and its current value; this
/// wraps that helper rather than hand-listing ribbon interfaces per generation.
///
/// One wrinkle: Generation 3's five contest ribbons are stored as a single
/// 0-4 tier count each (<c>RibbonCountG3Cool</c>, etc.), not as individual
/// booleans. Those are expanded here into the individual named tiers a count
/// implies (e.g. a count of 2 means both "Cool (G3)" and "Cool Super" are
/// held), matching how PKHeX.Core itself names those tiers when it converts a
/// Generation 3 entity forward to Generation 4's individual boolean ribbons.
/// </summary>
public class Ribbons(PKM pokemon)
{
    /// <summary>Tier name suffixes for a Generation 3/4 contest ribbon count (0-4).</summary>
    private static readonly string[] ContestTierSuffixes = ["", "Super", "Hyper", "Master"];

    /// <summary>All ribbons this Pokemon currently has, in Core's declaration order.</summary>
    public List<RibbonDefinition> Held
    {
        get
        {
            var result = new List<RibbonDefinition>();
            foreach (var info in RibbonInfo.GetRibbonInfo(pokemon))
            {
                switch (info.Type)
                {
                    case RibbonValueType.Boolean when info.HasRibbon:
                        result.Add(RibbonDefinition.FromPropertyName(info.Name));
                        break;
                    case RibbonValueType.Byte:
                        AddContestTiers(result, info);
                        break;
                }
            }
            return result;
        }
    }

    /// <summary>
    /// Expands a Generation 3 contest ribbon count into its named tiers.
    /// Byte-valued ribbons from other generations (e.g. Generation 6's
    /// memory-contest/battle counters) are not named-tier ribbons and are
    /// left alone; nothing in scope today (Generation 3) reaches them.
    /// </summary>
    private static void AddContestTiers(List<RibbonDefinition> result, RibbonInfo info)
    {
        const string countPrefix = "RibbonCountG3";
        if (!info.Name.StartsWith(countPrefix, StringComparison.Ordinal))
            return;

        var baseName = "RibbonG3" + info.Name[countPrefix.Length..];
        var tiers = Math.Min(info.RibbonCount, (byte)ContestTierSuffixes.Length);
        for (var tier = 0; tier < tiers; tier++)
        {
            result.Add(RibbonDefinition.FromPropertyName(baseName + ContestTierSuffixes[tier]));
        }
    }
}

/// <summary>
/// One held ribbon: its display name plus a stable id where Core defines one.
///
/// Core has no single ribbon id space; the closest things are the
/// <see cref="RibbonIndex"/> enum (the modern, post-Generation-3 ribbon set)
/// and, for ribbons that only ever existed within Generation 3
/// (<see cref="RibbonIndex3"/>, e.g. the Battle Tower ribbons and the
/// individual contest ribbon tiers), <see cref="RibbonIndex3"/>. Both enums
/// number from zero, so a <see cref="RibbonIndex3"/>-sourced id is offset by
/// <see cref="LegacyIdOffset"/> to keep the two spaces from colliding.
/// Ribbons in neither enum get <c>Id = -1</c>.
/// </summary>
public record RibbonDefinition(int Id, string Name, string PropertyName)
{
    /// <summary>Keeps <see cref="RibbonIndex3"/>-sourced ids out of <see cref="RibbonIndex"/>'s id space.</summary>
    public const int LegacyIdOffset = 1000;

    public static readonly RibbonDefinition None = new(-1, "(None)", "");

    /// <summary>
    /// Core's official <see cref="Name"/> disambiguates ribbons that repeat
    /// across generations (e.g. "Champion (Gen3)" vs. "Champion (ORAS)") for
    /// Core's own cross-generation UI, which lists every generation's
    /// ribbons together. This app is Generation-3-scoped, so those
    /// generation-qualified names read oddly ("Champion (Gen3)" when there's
    /// only ever one "Champion" a Gen 3 save can hold). This table overrides
    /// <see cref="ShortName"/> for exactly the property names that carry
    /// such a qualifier among what a Generation 3 <c>PKM</c> can actually
    /// hold (verified against
    /// PKHeX.Core/Resources/text/other/en/text_Ribbons_en.txt: every other
    /// Gen-3-reachable ribbon's official name has no qualifier to strip).
    /// </summary>
    private static readonly Dictionary<string, string> ShortNameOverrides = new()
    {
        ["RibbonChampionG3"] = "Champion",
        ["RibbonG3Cool"] = "Cool",
        ["RibbonG3Beauty"] = "Beauty",
        ["RibbonG3Cute"] = "Cute",
        ["RibbonG3Smart"] = "Smart",
        ["RibbonG3Tough"] = "Tough",
    };

    /// <summary>Display name with this app's Gen-3-scoped presentation applied (see <see cref="ShortNameOverrides"/>).</summary>
    public string ShortName => ShortNameOverrides.TryGetValue(PropertyName, out var shortName) ? shortName : Name;

    /// <summary>
    /// Filename (no directory) of this ribbon's icon within PKHeX.Core's
    /// <c>PKHeX.Drawing.Misc/Resources/img/ribbons/</c> set, which pkcamp
    /// ships at <c>public/ribbons/</c>. Verified convention:
    /// <c>lowercase(PropertyName) + ".png"</c> (e.g. <c>RibbonEffort</c> -&gt;
    /// <c>ribboneffort.png</c>). <c>""</c> for <see cref="None"/>, which has
    /// no property name.
    /// </summary>
    public string IconFile => PropertyName.Length == 0 ? "" : PropertyName.ToLowerInvariant() + ".png";

    public static RibbonDefinition FromPropertyName(string propertyName)
    {
        var name = GameInfo.Strings.Ribbons.GetNameSafe(propertyName, out var display)
            ? display
            : propertyName;

        return new RibbonDefinition(ResolveId(propertyName), name, propertyName);
    }

    private static int ResolveId(string propertyName)
    {
        var trimmed = propertyName.StartsWith(RibbonInfo.PropertyPrefix, StringComparison.Ordinal)
            ? propertyName[RibbonInfo.PropertyPrefix.Length..]
            : propertyName;

        if (Enum.TryParse<RibbonIndex>(trimmed, out var modern) && modern != RibbonIndex.MAX_COUNT)
            return (int)modern;

        // Generation 3 contest ribbon tiers are named "G3<Category>[Tier]" in
        // the modern property scheme but plain "<Category>[Tier]" in
        // RibbonIndex3; strip the "G3" to line the two naming schemes up.
        var legacyName = trimmed.StartsWith("G3", StringComparison.Ordinal) ? trimmed[2..] : trimmed;
        if (Enum.TryParse<RibbonIndex3>(legacyName, out var legacy) && legacy != RibbonIndex3.MAX_COUNT)
            return LegacyIdOffset + (int)legacy;

        return -1;
    }
}
