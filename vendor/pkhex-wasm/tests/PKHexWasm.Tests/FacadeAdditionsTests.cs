using PKHeX.Core;
using PKHeX.Facade.Pokemons;
using PKHexWasm.TestSupport;

namespace PKHexWasm.Tests;

/// <summary>
/// The Facade-backed additions (pkcamp; see MODIFICATIONS.md): exact version
/// identity, positional box/party snapshots, form/egg/held-item reads, .pk*
/// file IO, explicit-index box placement, and idempotent release.
/// Blank fixtures only, like the rest of this suite.
/// </summary>
public sealed class FacadeAdditionsTests
{
    [Fact]
    public void Exact_version_is_reported_and_not_aggregated()
    {
        var game = PKHexApi.Load(TestSaves.WithBoxMon(EntityContext.Gen5));
        Assert.Equal(EntityContext.Gen5.ToString(), PKHexApi.GameGeneration(game));
        Assert.True(Enum.TryParse<GameVersion>(PKHexApi.GameSaveVersion(game), out var version));
        Assert.True(version.IsValidSavedVersion());
        Assert.False(PKHexApi.GameVersionIsAggregated(game));
    }

    [Fact]
    public void Gen1_version_is_an_aggregate_family()
    {
        // Gen 1 saves carry no version byte: Core can only say "Red/Blue".
        var game = PKHexApi.Load(TestSaves.WithBoxMon(EntityContext.Gen1));
        Assert.True(PKHexApi.GameVersionIsAggregated(game));
    }

    [Fact]
    public void Box_slots_are_positional_with_zero_for_empty()
    {
        var game = PKHexApi.Load(TestSaves.WithBoxMon(EntityContext.Gen5));
        var slots = PKHexApi.GameBoxSlotHandles(game, 0);
        Assert.Equal(30, slots.Length);
        Assert.NotEqual(0, slots[0]);
        Assert.All(slots[1..], h => Assert.Equal(0, h));
        // v1's compacted view is the same data with empties dropped.
        Assert.Single(PKHexApi.GameBoxMonHandles(game, 0));
    }

    [Fact]
    public void Party_slots_are_six_positional_entries()
    {
        var game = PKHexApi.Load(TestSaves.WithBoxMon(EntityContext.Gen5));
        Assert.Equal(6, PKHexApi.GamePartySlotHandles(game).Length);
    }

    [Fact]
    public void Form_egg_and_held_item_read_through_facade()
    {
        var game = PKHexApi.Load(TestSaves.WithBoxMon(EntityContext.Gen5));
        var mon = PKHexApi.GameBoxSlotHandles(game, 0)[0];
        Assert.Equal(0, PKHexApi.MonForm(mon));
        Assert.False(PKHexApi.MonIsEgg(mon));
        Assert.Equal(0, PKHexApi.MonHeldItem(mon));
    }

    [Fact]
    public void Pkm_file_round_trips_and_places_at_an_exact_slot()
    {
        var game = PKHexApi.Load(TestSaves.WithBoxMon(EntityContext.Gen5));
        var original = PKHexApi.GameBoxSlotHandles(game, 0)[0];
        var file = PKHexApi.MonToBytes(original);

        var parsed = PKHexApi.ParsePkm(file);
        Assert.Equal(file, PKHexApi.MonToBytes(parsed));

        PKHexApi.GameSetBoxSlot(game, 1, 7, parsed);
        var box1 = PKHexApi.GameBoxSlotHandles(game, 1);
        Assert.NotEqual(0, box1[7]);
        Assert.Equal(1, box1.Count(h => h != 0));
        Assert.Equal(TestSaves.Species, PKHexApi.MonSpecies(box1[7]));

        // The placement survives export + reload (Facade commit, no stale cache).
        var reloaded = PKHexApi.Load(PKHexApi.SaveBytes(game));
        Assert.Equal(TestSaves.Species, PKHexApi.MonSpecies(PKHexApi.GameBoxSlotHandles(reloaded, 1)[7]));
    }

    [Fact]
    public void Zero_handle_clears_a_box_slot_and_survives_export()
    {
        var game = PKHexApi.Load(TestSaves.WithBoxMon(EntityContext.Gen5));
        Assert.NotEqual(0, PKHexApi.GameBoxSlotHandles(game, 0)[0]);

        PKHexApi.GameSetBoxSlot(game, 0, 0, 0);
        Assert.Equal(0, PKHexApi.GameBoxSlotHandles(game, 0)[0]);

        var reloaded = PKHexApi.Load(PKHexApi.SaveBytes(game));
        Assert.Equal(0, PKHexApi.GameBoxSlotHandles(reloaded, 0)[0]);
    }

    [Fact]
    public void Mutation_after_placement_is_not_reverted_by_export()
    {
        var game = PKHexApi.Load(TestSaves.WithBoxMon(EntityContext.Gen5));
        var mon = PKHexApi.GameBoxSlotHandles(game, 0)[0];
        PKHexApi.MonSetLevel(mon, 42);
        var reloaded = PKHexApi.Load(PKHexApi.SaveBytes(game));
        Assert.Equal(42, PKHexApi.MonLevel(PKHexApi.GameBoxSlotHandles(reloaded, 0)[0]));
    }

    [Fact]
    public void Unparseable_pkm_is_rejected()
    {
        Assert.Throws<InvalidDataException>(() => PKHexApi.ParsePkm([1, 2, 3]));
    }

    /// <summary>A detached Emerald PK3 Pikachu (blank Gen 3 saves are not in the loadable fixture set).</summary>
    private static int DetachedPk3(ushort heldItem = 0, Action<PK3>? configure = null)
    {
        var pk = new PK3
        {
            Species = TestSaves.Species,
            Version = GameVersion.E,
            HeldItem = heldItem,
            OriginalTrainerName = TestSaves.Trainer,
        };
        pk.CurrentLevel = 50;
        configure?.Invoke(pk);
        var bytes = new byte[pk.SIZE_PARTY];
        pk.WriteDecryptedDataParty(bytes);
        return PKHexApi.ParsePkm(bytes);
    }

    [Fact]
    public void Battle_stats_are_computed_for_boxed_entities()
    {
        // Boxed entities store no party stats; v1 MonStats (PKM.Stats) reads
        // zeros there, Facade's Pokemon.BaseStats recomputes them.
        var game = PKHexApi.Load(TestSaves.WithBoxMon(EntityContext.Gen5));
        var mon = PKHexApi.GameBoxSlotHandles(game, 0)[0];
        var stats = PKHexApi.MonBattleStats(mon);
        Assert.Equal(6, stats.Length);
        Assert.All(stats, s => Assert.True(s > 0));
        // HP = floor((2B + IV + EV/4) * L / 100) + L + 10, so at least L + 10.
        Assert.True(stats[0] >= TestSaves.Level + 10);
    }

    [Fact]
    public void Battle_stats_follow_the_standard_formula_on_gen3()
    {
        // Pikachu base 35/55/30/90/50/40 (HP/Atk/Def/Spe/SpA/SpD), level 50,
        // 0 IV / 0 EV, Hardy (neutral): HP = 35 + 50 + 10 = 95; others = floor(B) + 5.
        var mon = DetachedPk3();
        Assert.Equal(new[] { 95, 60, 35, 95, 55, 45 }, PKHexApi.MonBattleStats(mon));
    }

    [Fact]
    public void Ability_reads_through_facade()
    {
        // Pikachu has Static (id 9) as its only Gen 3 ability.
        var mon = DetachedPk3();
        Assert.Equal(9, PKHexApi.MonAbilityId(mon));
        Assert.Equal("Static", PKHexApi.MonAbilityName(mon));
    }

    [Fact]
    public void Ability_is_absent_before_gen3()
    {
        var game = PKHexApi.Load(TestSaves.WithBoxMon(EntityContext.Gen1));
        var mon = PKHexApi.GameBoxSlotHandles(game, 0)[0];
        Assert.Equal(-1, PKHexApi.MonAbilityId(mon));
        Assert.Equal(string.Empty, PKHexApi.MonAbilityName(mon));
    }

    [Fact]
    public void Held_item_name_uses_the_formats_own_item_index_space()
    {
        Assert.Equal(string.Empty, PKHexApi.MonHeldItemName(DetachedPk3()));
        // Gen 3 ids diverge from national ids: Gen 3 #133 is Cheri Berry (national #149).
        Assert.Equal(133, PKHexApi.MonHeldItem(DetachedPk3(heldItem: 133)));
        Assert.Equal("Cheri Berry", PKHexApi.MonHeldItemName(DetachedPk3(heldItem: 133)));
    }

    [Fact]
    public void Owner_display_id_matches_the_16bit_pair_before_gen7()
    {
        var game = PKHexApi.Load(TestSaves.WithBoxMon(EntityContext.Gen5));
        var mon = PKHexApi.GameBoxSlotHandles(game, 0)[0];
        Assert.Equal(
            new[] { PKHexApi.MonOwnerId(mon), PKHexApi.MonOwnerSecretId(mon) },
            PKHexApi.MonOwnerDisplayId(mon));
    }

    [Fact]
    public void No_ribbons_reads_as_an_empty_list()
    {
        var mon = DetachedPk3();
        Assert.Empty(PKHexApi.MonRibbonIds(mon));
        Assert.Empty(PKHexApi.MonRibbonNames(mon));
    }

    [Fact]
    public void Boolean_ribbons_read_through_facade_with_display_names_and_stable_ids()
    {
        var mon = DetachedPk3(configure: pk =>
        {
            pk.RibbonChampionG3 = true;
            pk.RibbonArtist = true;
        });
        var names = PKHexApi.MonRibbonNames(mon);
        var ids = PKHexApi.MonRibbonIds(mon);
        Assert.Equal(2, names.Length);
        Assert.Equal(ids.Length, names.Length);
        Assert.Contains("Champion (Gen3)", names);
        Assert.Contains("Artist", names);
        // Both ribbons exist in the modern RibbonIndex enum, so they get real,
        // non-negative, non-offset ids rather than the -1/legacy-offset fallback.
        Assert.All(ids, id => Assert.InRange(id, 0, RibbonDefinition.LegacyIdOffset - 1));
    }

    [Fact]
    public void Gen3_only_ribbons_get_the_legacy_offset_id()
    {
        // RibbonWinning/RibbonVictory (Hoenn Battle Tower) have no modern
        // RibbonIndex member; they only exist in RibbonIndex3.
        var mon = DetachedPk3(configure: pk => pk.RibbonWinning = true);
        var names = PKHexApi.MonRibbonNames(mon);
        var ids = PKHexApi.MonRibbonIds(mon);
        Assert.Equal(["Winning"], names);
        Assert.True(ids[0] >= RibbonDefinition.LegacyIdOffset);
    }

    [Fact]
    public void Contest_ribbon_counts_expand_into_their_individual_named_tiers()
    {
        // A count of 2 means both the base tier and the "Super" tier are held.
        var mon = DetachedPk3(configure: pk => pk.RibbonCountG3Cool = 2);
        var names = PKHexApi.MonRibbonNames(mon);
        Assert.Equal(["Cool (G3)", "Cool Super"], names);
    }

    [Fact]
    public void Short_names_strip_the_generation_disambiguating_qualifier_where_present()
    {
        var mon = DetachedPk3(configure: pk =>
        {
            pk.RibbonChampionG3 = true;
            pk.RibbonArtist = true;
            pk.RibbonCountG3Cool = 2;
        });
        var shortNames = PKHexApi.MonRibbonShortNames(mon);
        // "Champion (Gen3)" -> "Champion", "Cool (G3)" -> "Cool", but the
        // "Super" tier and "Artist" have no qualifier to strip in the first
        // place, so they pass through unchanged. Contest-tier ribbons sort
        // ahead of the other boolean ribbons in Core's declaration order.
        Assert.Equal(["Cool", "Cool Super", "Champion", "Artist"], shortNames);
    }

    [Fact]
    public void Icon_files_are_the_lowercased_property_name_plus_png()
    {
        var mon = DetachedPk3(configure: pk =>
        {
            pk.RibbonChampionG3 = true;
            pk.RibbonEffort = true;
            pk.RibbonCountG3Cool = 1;
        });
        var iconFiles = PKHexApi.MonRibbonIconFiles(mon);
        Assert.Equal(["ribbong3cool.png", "ribbonchampiong3.png", "ribboneffort.png"], iconFiles);
    }

    [Fact]
    public void Close_and_CloseMon_are_idempotent()
    {
        var game = PKHexApi.Load(TestSaves.WithBoxMon(EntityContext.Gen5));
        var mon = PKHexApi.GameBoxSlotHandles(game, 0)[0];
        PKHexApi.CloseMon(mon);
        PKHexApi.CloseMon(mon);
        PKHexApi.Close(game);
        PKHexApi.Close(game);
        Assert.Throws<ArgumentOutOfRangeException>(() => PKHexApi.GameBoxCount(game));
    }
}
