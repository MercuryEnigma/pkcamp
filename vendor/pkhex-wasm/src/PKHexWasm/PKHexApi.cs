using System.Collections.Concurrent;
using System.Runtime.InteropServices.JavaScript;
using PKHeX.Core;
using PKHeX.Facade.Repositories;

// PKHeX.Facade (MIT) owns the save/entity model; the binding holds its objects
// in the handle registry and delegates to them. Aliased because PKHeX.Core
// spells several of the same type names.
using FacadeGame = PKHeX.Facade.Game;
using FacadePokemon = PKHeX.Facade.Pokemons.Pokemon;

namespace PKHexWasm;

/// <summary>
/// Synchronous entry points of the pkhex-wasm Binding, exposed to JavaScript
/// via <c>[JSExport]</c>. .NET JS interop exposes static methods only, so
/// entity/game Handles are represented as integer handle ids into a wasm-side
/// registry; the TypeScript layer wraps them behind the locked Handle API.
///
/// Contracts follow docs/spec/v1-api.md: defensive copy-in on load, fresh
/// arrays out on export, snapshot accessors materializing write-through
/// handles. The registry persists for the process lifetime - bounded by how
/// many saves/entities a consumer materializes (documented v1 trade-off).
/// </summary>
public static partial class PKHexApi
{
    private static int _nextHandle;
    private static readonly ConcurrentDictionary<int, GameEntry> Games = new();
    private static readonly ConcurrentDictionary<int, MonEntry> Mons = new();

    /// <summary>
    /// One loaded save, held as a <see cref="FacadeGame"/>.
    ///
    /// The Facade object is cached but rebuilt after any slot write the binding
    /// makes behind its back: Facade's <c>Trainer</c> captures its box/party
    /// lists once, and <c>Game.ToByteArray()</c> commits those lists back over
    /// the save - a stale Facade object would silently revert the write.
    /// </summary>
    private sealed class GameEntry(FacadeGame facade)
    {
        private FacadeGame? _facade = facade;

        public SaveFile Sav { get; } = facade.SaveFile;
        public FacadeGame Facade => _facade ??= new FacadeGame(Sav);
        public void Invalidate() => _facade = null;
    }

    private const int BoxParty = -1;
    /// <summary>Entity parsed from a standalone .pk* file, not (yet) in any save.</summary>
    private const int BoxDetached = -2;

    /// <summary>One entity, held as a <see cref="FacadePokemon"/>. <see cref="Owner"/> is null when detached.</summary>
    private sealed record MonEntry(GameEntry? Owner, FacadePokemon Mon, int Box, int Slot)
    {
        public PKM Pk => Mon.Pkm;
        public bool IsParty => Box == BoxParty;
        public bool IsDetached => Box == BoxDetached;
    }

    // ---- lifecycle ---------------------------------------------------------

    private static int _cryptoRegistered;

    /// <summary>
    /// Registers the Managed crypto providers onto RuntimeCryptographyProvider
    /// (spec bootstrap step 2). Must run before any save can be parsed so the
    /// BDSP/Gen 7/HOME seams work transparently the first time they are
    /// reached; idempotent, and never overrides an explicitly-set provider.
    /// </summary>
    [JSExport]
    public static string Initialize()
    {
        if (Interlocked.CompareExchange(ref _cryptoRegistered, 1, 0) == 0)
        {
            RuntimeCryptographyProvider.Aes = new ManagedAes();
            RuntimeCryptographyProvider.Md5 = new ManagedMd5();
        }
        return GetApiVersion();
    }

    /// <summary>API version stamp (semver contract per the API-surface decision).</summary>
    [JSExport]
    public static string GetApiVersion() => "v0-binding";

    /// <summary>
    /// Parse one complete logical save buffer into a game handle.
    /// Defensive copy at the boundary; callers retain ownership of their bytes.
    /// </summary>
    [JSExport]
    public static int Load(byte[] saveBytes)
    {
        ArgumentNullException.ThrowIfNull(saveBytes);
        var copy = new byte[saveBytes.Length];
        Array.Copy(saveBytes, copy, saveBytes.Length);

        FacadeGame facade;
        try
        {
            facade = FacadeGame.LoadFrom(copy);
        }
        catch (Exception ex)
        {
            throw new InvalidDataException("Unrecognized save file format.", ex);
        }

        var handle = NextHandle();
        Games[handle] = new GameEntry(facade);
        return handle;
    }

    /// <summary>Serialize a save back to a fresh byte array; nothing aliases prior exports.</summary>
    [JSExport]
    public static byte[] SaveBytes(int game) =>
        RequireEntry(game).Facade.ToByteArray(); // commits Facade-side state, applies per-format write fix-ups

    /// <summary>Release a game handle and its entity handles. Optional - dropping all references is also fine in v1.</summary>
    [JSExport]
    public static void Close(int game)
    {
        if (Games.TryRemove(game, out var entry))
        {
            foreach (var (monHandle, mon) in Mons)
            {
                if (ReferenceEquals(mon.Owner, entry))
                {
                    Mons.TryRemove(monHandle, out _);
                }
            }
        }
    }

    /// <summary>Development helper (demo page + fixtures): blank Gen 1 save with a level-5 Pikachu in box 1 + party slot 1.</summary>
    [JSExport]
    public static byte[] GenerateDemoSave(string trainerName)
    {
        var sav = BlankSaveFile.Get(EntityContext.Gen1, trainerName);

        var pk = sav.BlankPKM;
        sav.ApplyTo(pk);
        pk.Species = 25; // Pikachu
        pk.CurrentLevel = 5;
        pk.SetNickname("Pikachu");

        sav.SetBoxSlotAtIndex(pk, 0);
        sav.SetPartySlotAtIndex(pk, 0);
        return sav.Write().ToArray();
    }

    // ---- game reads --------------------------------------------------------

    [JSExport]
    public static string GameTrainerName(int game) => RequireGame(game).OT ?? string.Empty;

    [JSExport]
    public static int GameTrainerId(int game) => (int)RequireGame(game).TID16;

    [JSExport]
    public static int GameTrainerSecretId(int game) => (int)RequireGame(game).SID16;

    [JSExport]
    public static string GameTrainerGender(int game) => FormatGender(RequireGame(game).Gender);

    [JSExport]
    public static int GameBoxCount(int game) => RequireGame(game).BoxCount;

    [JSExport]
    public static string GameGeneration(int game) => RequireGame(game).Context.ToString();

    /// <summary>Money held by the trainer, when the format tracks it.</summary>
    [JSExport]
    public static int GameMoney(int game) => (int)RequireGame(game).Money;

    /// <summary>Snapshot of one storage box as entity handles; empty slots are absent.</summary>
    [JSExport]
    public static int[] GameBoxMonHandles(int game, int boxIndex) =>
        [.. GameBoxSlotHandles(game, boxIndex).Where(h => h != 0)];

    /// <summary>Snapshot of the party as entity handles; empty slots are absent.</summary>
    [JSExport]
    public static int[] GamePartyMonHandles(int game) =>
        [.. GamePartySlotHandles(game).Where(h => h != 0)];

    // ---- Facade-backed additions (pkcamp; see MODIFICATIONS.md) --------------

    /// <summary>Exact version Core recorded, e.g. <c>E</c>/<c>FR</c>; a family (<c>RB</c>) when aggregated.</summary>
    [JSExport]
    public static string GameSaveVersion(int game) => RequireEntry(game).Facade.SaveVersion.Version.ToString();

    /// <summary>Facade's <c>GameVersionDefinition.Aggregated</c>: true when Core cannot pin one exact title.</summary>
    [JSExport]
    public static bool GameVersionIsAggregated(int game) => RequireEntry(game).Facade.SaveVersion.Aggregated;

    /// <summary>Box name; formats that store none fall back to Core's "Box N".</summary>
    [JSExport]
    public static string GameBoxName(int game, int boxIndex)
    {
        var sav = RequireBox(game, boxIndex).Sav;
        return sav is IBoxDetailNameRead named
            ? named.GetBoxName(boxIndex)
            : BoxDetailNameExtensions.GetDefaultBoxName(boxIndex);
    }

    /// <summary>
    /// Positional box snapshot from Facade's <c>PokemonBox.All</c> (which maps
    /// <c>SaveFile.BoxData</c> 1:1, empties included as blank entities):
    /// exactly <c>BoxSlotCount</c> handles, <c>0</c> for an empty slot.
    /// </summary>
    [JSExport]
    public static int[] GameBoxSlotHandles(int game, int boxIndex)
    {
        var entry = RequireBox(game, boxIndex);
        var all = entry.Facade.Trainer.PokemonBox.All;
        var size = entry.Sav.BoxSlotCount;
        var handles = new int[size];
        for (var slot = 0; slot < size; slot++)
        {
            var mon = all[(boxIndex * size) + slot];
            handles[slot] = SpeciesDefinition.IsSome(mon.Species) ? RegisterMon(entry, mon, boxIndex, slot) : 0;
        }
        return handles;
    }

    /// <summary>
    /// Positional party snapshot from Facade's <c>Party.Pokemons</c>: six
    /// handles, <c>0</c> for an empty slot (a party has no interior gaps).
    /// </summary>
    [JSExport]
    public static int[] GamePartySlotHandles(int game)
    {
        var entry = RequireEntry(game);
        var party = entry.Facade.Trainer.Party.Pokemons;
        var handles = new int[6];
        for (var slot = 0; slot < party.Count && slot < handles.Length; slot++)
        {
            var mon = party[slot];
            handles[slot] = SpeciesDefinition.IsSome(mon.Species) ? RegisterMon(entry, mon, BoxParty, slot) : 0;
        }
        return handles;
    }

    /// <summary>
    /// Place an entity at exactly box <paramref name="boxIndex"/>, slot
    /// <paramref name="slot"/>, overwriting what is there. The one piece of new
    /// logic over Facade: its <c>AddOrUpdate</c> addresses by UniqueId or takes
    /// the next open slot, so the entity is written into Facade's own positional
    /// list and committed with Facade's <c>PokemonBox.Commit()</c>. An entity
    /// from another format is converted into the save's first. A
    /// <paramref name="mon"/> handle of <c>0</c> clears the slot using the
    /// save format's blank entity representation.
    /// </summary>
    [JSExport]
    public static void GameSetBoxSlot(int game, int boxIndex, int slot, int mon)
    {
        var entry = RequireBox(game, boxIndex);
        var size = entry.Sav.BoxSlotCount;
        if ((uint)slot >= (uint)size)
        {
            throw new ArgumentOutOfRangeException(nameof(slot), slot, $"box slot outside [0, {size})");
        }
        var box = entry.Facade.Trainer.PokemonBox;
        if (mon == 0)
        {
            box.All[(boxIndex * size) + slot] = new FacadePokemon(entry.Sav.BlankPKM, entry.Facade);
            box.Commit();
            return;
        }

        var source = RequireMon(mon);
        var placed = new FacadePokemon(ConvertInto(entry.Sav, source.Pk), entry.Facade);
        box.All[(boxIndex * size) + slot] = placed;
        box.Commit();
        Mons[mon] = new MonEntry(entry, placed, boxIndex, slot);
    }

    /// <summary>
    /// Parse a standalone <c>.pk*</c> file via Facade's <c>Pokemon.LoadFrom(bytes)</c>
    /// into a detached entity handle (release with <see cref="CloseMon"/>).
    /// </summary>
    [JSExport]
    public static int ParsePkm(byte[] pkmBytes)
    {
        ArgumentNullException.ThrowIfNull(pkmBytes);
        FacadePokemon parsed;
        try
        {
            parsed = FacadePokemon.LoadFrom(pkmBytes.ToArray());
        }
        catch (Exception ex)
        {
            throw new InvalidDataException("Unrecognized Pokémon entity format.", ex);
        }
        var handle = NextHandle();
        Mons[handle] = new MonEntry(null, parsed, BoxDetached, 0);
        return handle;
    }

    /// <summary>Release one entity handle. Idempotent.</summary>
    [JSExport]
    public static void CloseMon(int mon) => Mons.TryRemove(mon, out _);

    /// <summary>Alternate-form index via Facade's <c>PokemonForm</c>; 0 is the base form.</summary>
    [JSExport]
    public static int MonForm(int mon) => RequireMon(mon).Mon.Form.Form.Id;

    /// <summary>Egg state via Facade's <c>Egg</c>.</summary>
    [JSExport]
    public static bool MonIsEgg(int mon) => RequireMon(mon).Mon.Egg.IsEgg;

    /// <summary>Held-item id; 0 when nothing is held.</summary>
    [JSExport]
    public static int MonHeldItem(int mon) => RequireMon(mon).Mon.HeldItem.Id;

    /// <summary>Standalone <c>.pk*</c> file bytes via Facade's <c>Pokemon.ToFile()</c> (decrypted party layout).</summary>
    [JSExport]
    public static byte[] MonToBytes(int mon) => RequireMon(mon).Mon.ToFile().Bytes;

    /// <summary>
    /// Held-item display name via Facade's per-save <c>Game.ItemRepository.GetGameItem</c>,
    /// which resolves ids in the entity's own format's item index space (Gen 3
    /// ids are not national ids). Detached entities get Facade's
    /// <c>Game.EmptyOf(version)</c> owner, so they resolve the same way.
    /// Empty string when nothing is held.
    /// </summary>
    [JSExport]
    public static string MonHeldItemName(int mon)
    {
        var entry = RequireMon(mon);
        var id = entry.Pk.HeldItem;
        return id <= 0 ? string.Empty : entry.Mon.Game.ItemRepository.GetGameItem((ushort)id).Name;
    }

    /// <summary>Ability id via Facade's <c>Pokemon.Ability</c>; -1 where the concept does not exist (Gen 1-2).</summary>
    [JSExport]
    public static int MonAbilityId(int mon)
    {
        var entry = RequireMon(mon);
        return entry.Pk.Context <= EntityContext.Gen2 ? -1 : entry.Mon.Ability.Id;
    }

    /// <summary>Ability display name via Facade's <c>Pokemon.Ability</c>; empty on Gen 1-2.</summary>
    [JSExport]
    public static string MonAbilityName(int mon)
    {
        var entry = RequireMon(mon);
        return entry.Pk.Context <= EntityContext.Gen2 ? string.Empty : entry.Mon.Ability.Name;
    }

    /// <summary>
    /// Level/nature/IV/EV-adjusted battle stats as [HP, Atk, Def, Spe, SpA, SpD]
    /// via Facade's <c>Pokemon.BaseStats</c>. Despite the name, that is not the
    /// species base spread: it reads the entity's party stats (<c>Stat_HPMax</c>,
    /// <c>Stat_ATK</c>, ...) and, when the format stores none (boxed entities),
    /// recomputes them on a clone via <c>ResetPartyStats()</c>. Differs from v1
    /// <see cref="MonStats"/> (<c>PKM.Stats</c>), which carries current HP and
    /// reads zeros for boxed entities.
    /// </summary>
    [JSExport]
    public static int[] MonBattleStats(int mon)
    {
        var stats = RequireMon(mon).Mon.BaseStats;
        return [stats.Health, stats.Attack, stats.Defense, stats.Speed, stats.SpecialAttack, stats.SpecialDefense];
    }

    /// <summary>
    /// Original trainer's ID as the games display it, via Facade's <c>Pokemon.Id</c>
    /// (<c>DisplayTID</c>/<c>DisplaySID</c>), as [tid, sid]. Gen 3-6 this equals the
    /// 16-bit pair; Gen 7+ it is the 6-digit/4-digit split.
    /// </summary>
    [JSExport]
    public static int[] MonOwnerDisplayId(int mon)
    {
        var id = RequireMon(mon).Mon.Id;
        return [(int)id.TID, (int)id.SID];
    }

    // ---- pokemon reads -----------------------------------------------------

    [JSExport]
    public static int MonSpecies(int mon) => RequireMon(mon).Pk.Species;

    [JSExport]
    public static string MonNickname(int mon) => RequireMon(mon).Pk.Nickname;

    [JSExport]
    public static int MonLevel(int mon) => RequireMon(mon).Pk.CurrentLevel;

    [JSExport]
    public static bool MonIsShiny(int mon) => RequireMon(mon).Pk.IsShiny;

    [JSExport]
    public static string MonGender(int mon) => FormatGender(RequireMon(mon).Pk.Gender);

    /// <summary>Nature id, or -1 where the concept does not exist (Gen 1"2).</summary>
    [JSExport]
    public static int MonNatureId(int mon)
    {
        var pk = RequireMon(mon).Pk;
        return pk.Context <= EntityContext.Gen2 ? -1 : (int)pk.Nature;
    }

    [JSExport]
    public static string MonOwnerName(int mon) => RequireMon(mon).Pk.OriginalTrainerName ?? string.Empty;

    [JSExport]
    public static int MonOwnerId(int mon) => (int)RequireMon(mon).Pk.TID16;

    [JSExport]
    public static int MonOwnerSecretId(int mon) => (int)RequireMon(mon).Pk.SID16;

    [JSExport]
    public static string MonOwnerGender(int mon) => FormatGender(RequireMon(mon).Pk.OriginalTrainerGender);

    /// <summary>Individual values as [HP, Atk, Def, Spe, SpA, SpD] - Core's own order.</summary>
    [JSExport]
    public static int[] MonIVs(int mon)
    {
        var ivs = new int[6];
        RequireMon(mon).Pk.GetIVs(ivs);
        return ivs;
    }

    /// <summary>Effort values as [HP, Atk, Def, Spe, SpA, SpD] - Core's own order.</summary>
    [JSExport]
    public static int[] MonEVs(int mon)
    {
        var evs = new int[6];
        RequireMon(mon).Pk.GetEVs(evs);
        return evs;
    }

    /// <summary>Computed battle stats as [HP, Atk, Def, Spe, SpA, SpD].</summary>
    [JSExport]
    public static int[] MonStats(int mon) => (int[])RequireMon(mon).Pk.Stats.Clone();

    /// <summary>Four move slots flattened as [moveId, pp] - 4; empty slots carry id 0.</summary>
    [JSExport]
    public static int[] MonMoveSlots(int mon)
    {
        var pk = RequireMon(mon).Pk;
        return
        [
            pk.Move1, pk.Move1_PP,
            pk.Move2, pk.Move2_PP,
            pk.Move3, pk.Move3_PP,
            pk.Move4, pk.Move4_PP,
        ];
    }

    /// <summary>
    /// Ids of every ribbon this entity currently holds, via Facade's
    /// <c>Pokemon.Ribbons.Held</c>, in the same order as <see cref="MonRibbonNames"/>
    /// (paired by index - JS interop only marshals single-typed arrays, not
    /// records). -1 where Core has no stable numeric id for that ribbon (see
    /// <c>RibbonDefinition.ResolveId</c> in Facade).
    /// </summary>
    [JSExport]
    public static int[] MonRibbonIds(int mon) => RequireMon(mon).Mon.Ribbons.Held.Select(r => r.Id).ToArray();

    /// <summary>Display names of every ribbon this entity currently holds, paired by index with <see cref="MonRibbonIds"/>.</summary>
    [JSExport]
    public static string[] MonRibbonNames(int mon) => RequireMon(mon).Mon.Ribbons.Held.Select(r => r.Name).ToArray();

    /// <summary>
    /// This app's Gen-3-scoped display names (Core's cross-generation
    /// disambiguating qualifiers, e.g. "Champion (Gen3)", stripped to
    /// "Champion" where this app only ever holds one such ribbon), paired
    /// by index with <see cref="MonRibbonIds"/>. See
    /// <c>RibbonDefinition.ShortName</c> in Facade.
    /// </summary>
    [JSExport]
    public static string[] MonRibbonShortNames(int mon) => RequireMon(mon).Mon.Ribbons.Held.Select(r => r.ShortName).ToArray();

    /// <summary>
    /// Icon filenames (no directory) from PKHeX.Core's own ribbon icon set,
    /// paired by index with <see cref="MonRibbonIds"/>. `""` where a ribbon
    /// has no property name (should not occur for held ribbons). See
    /// <c>RibbonDefinition.IconFile</c> in Facade.
    /// </summary>
    [JSExport]
    public static string[] MonRibbonIconFiles(int mon) => RequireMon(mon).Mon.Ribbons.Held.Select(r => r.IconFile).ToArray();

    // ---- pokemon mutators (write-through) ----------------------------------

    [JSExport]
    public static void MonSetNickname(int mon, string nickname)
    {
        ArgumentNullException.ThrowIfNull(nickname);
        var entry = RequireMon(mon);
        RequireEditable(entry, "setNickname");
        var maxNick = Legal.GetMaxLengthNickname(entry.Pk.Context.Generation, (LanguageID)entry.Pk.Language);
        if (nickname.Length > maxNick)
        {
            throw new ArgumentOutOfRangeException(nameof(nickname), nickname,
                ErrorTags.Compose(ErrorTags.Range,
                    $"nickname exceeds this generation's {maxNick} character limit"));
        }
        if (!CanStoreLosslessly(entry.Pk, nickname))
        {
            throw new ArgumentOutOfRangeException(nameof(nickname), nickname,
                ErrorTags.Compose(ErrorTags.Range,
                    "nickname contains characters this generation cannot store"));
        }
        CommonEdits.SetNickname(entry.Pk, nickname);
        Flush(entry);
    }

    [JSExport]
    public static void MonSetLevel(int mon, int level)
    {
        var entry = RequireMon(mon);
        RequireEditable(entry, "setLevel");
        entry.Pk.CurrentLevel = (byte)level;
        Flush(entry);
    }

    [JSExport]
    public static void MonSetMoves(int mon, int[] moveIds)
    {
        ArgumentNullException.ThrowIfNull(moveIds);
        var entry = RequireMon(mon);
        RequireEditable(entry, "setMoves");
        if (moveIds.Length != 4)
        {
            throw new ArgumentException("exactly four move ids are required", nameof(moveIds));
        }
        var maxMove = entry.Pk.MaxMoveID;
        foreach (var id in moveIds)
        {
            if ((uint)id > maxMove) // 0 is the cleared-slot sentinel and stays legal
            {
                throw new ArgumentOutOfRangeException(nameof(moveIds), id,
                    ErrorTags.Compose(ErrorTags.Range,
                        $"move id {id} is unknown to this generation's movepool"));
            }
        }
        entry.Pk.Move1 = (ushort)moveIds[0];
        entry.Pk.Move2 = (ushort)moveIds[1];
        entry.Pk.Move3 = (ushort)moveIds[2];
        entry.Pk.Move4 = (ushort)moveIds[3];
        entry.Pk.HealPP();
        Flush(entry);
    }

    /// <summary>
    /// Mint-aware nature write (Facade Natures.ChangeAll semantics): sets both
    /// the displayed nature and stat alignment, since naïve writes silently
    /// no-op on Gen 8+ formats where stats derive through mints/stat-alignment.
    /// </summary>
    [JSExport]
    public static void MonSetNature(int mon, int natureId)
    {
        var entry = RequireMon(mon);
        if (entry.Pk.Context <= EntityContext.Gen2)
        {
            throw new UnsupportedOperationException("setNature", entry.Pk.Context.ToString());
        }
        RequireEditable(entry, "setNature");
        if (!Enum.IsDefined(typeof(Nature), (Nature)natureId))
        {
            throw new ArgumentOutOfRangeException(nameof(natureId), natureId,
                ErrorTags.Compose(ErrorTags.Range, $"unknown nature id {natureId}"));
        }

        var nature = (Nature)natureId;
        entry.Pk.Nature = nature;
        entry.Pk.StatAlignment = nature;
        Flush(entry);
    }

    [JSExport]
    public static void MonSetShiny(int mon, bool shiny)
    {
        var entry = RequireMon(mon);
        RequireEditable(entry, "setShiny"); // GB formats reject here; upstream unset path never reached
        if (shiny)
        {
            entry.Pk.SetShiny();
        }
        else
        {
            CommonEdits.SetUnshiny(entry.Pk);
        }
        Flush(entry);
    }

    /// <summary>Overwrite all six IV slots (Gen 1 caps at 15 upstream).</summary>
    [JSExport]
    public static void MonSetIVs(int mon, int[] ivs)
    {
        ArgumentNullException.ThrowIfNull(ivs);
        var entry = RequireMon(mon);
        RequireEditable(entry, "setIVs");
        if (ivs.Length != 6)
        {
            throw new ArgumentException("exactly six values are required", nameof(ivs));
        }
        entry.Pk.SetIVs((ReadOnlySpan<int>)ivs);
        Flush(entry);
    }

    /// <summary>Overwrite all six EV slots (caps follow the generation upstream).</summary>
    [JSExport]
    public static void MonSetEVs(int mon, int[] evs)
    {
        ArgumentNullException.ThrowIfNull(evs);
        var entry = RequireMon(mon);
        RequireEditable(entry, "setEVs");
        if (evs.Length != 6)
        {
            throw new ArgumentException("exactly six values are required", nameof(evs));
        }
        entry.Pk.SetEVs((ReadOnlySpan<int>)evs);
        Flush(entry);
    }

    // ---- plumbing ----------------------------------------------------------

    /// <summary>Tier guard: read-only formats reject every mutator before reaching Core.</summary>
    private static void RequireEditable(MonEntry entry, string operation)
    {
        if (entry.Pk.Context.Tier() == SupportTier.ReadOnly)
        {
            throw new UnsupportedTierException(operation, entry.Pk.Context.ToString());
        }
    }

    /// <summary>
    /// Charset guard: a value is storable only when the entity's own format
    /// codec round-trips it losslessly - upstream setters otherwise truncate
    /// or drop unmappable characters silently.
    /// </summary>
    private static bool CanStoreLosslessly(PKM pk, string value)
    {
        Span<byte> buffer = stackalloc byte[(value.Length + 4) * 2];
        buffer.Clear();
        try
        {
            pk.SetString(buffer, value, value.Length, StringConverterOption.None);
            return pk.GetString(buffer) == value;
        }
        catch
        {
            return false;
        }
    }

    private static GameEntry RequireEntry(int game) =>
        Games.TryGetValue(game, out var entry)
            ? entry
            : throw new ArgumentOutOfRangeException(nameof(game), game, "unknown game handle");

    private static SaveFile RequireGame(int game) => RequireEntry(game).Sav;

    private static GameEntry RequireBox(int game, int boxIndex)
    {
        var entry = RequireEntry(game);
        if ((uint)boxIndex >= (uint)entry.Sav.BoxCount)
        {
            throw new ArgumentOutOfRangeException(nameof(boxIndex), boxIndex, $"box index outside [0, {entry.Sav.BoxCount})");
        }
        return entry;
    }

    /// <summary>The entity in <paramref name="sav"/>'s own format; Facade wraps without converting.</summary>
    private static PKM ConvertInto(SaveFile sav, PKM pk)
    {
        if (pk.GetType() == sav.PKMType)
        {
            return pk.Clone();
        }
        var converted = EntityConverter.ConvertToType(pk, sav.PKMType, out var result);
        return converted is not null && result.IsSuccess
            ? converted
            : throw new InvalidDataException($"A {pk.GetType().Name} cannot be converted into this save's {sav.PKMType.Name} format ({result}).");
    }

    private static MonEntry RequireMon(int mon) =>
        Mons.TryGetValue(mon, out var entry)
            ? entry
            : throw new ArgumentOutOfRangeException(nameof(mon), mon, "unknown entity handle");

    private static int RegisterMon(GameEntry owner, FacadePokemon mon, int box, int slot)
    {
        var handle = NextHandle();
        Mons[handle] = new MonEntry(owner, mon, box, slot);
        return handle;
    }

    private static void Flush(MonEntry entry)
    {
        if (entry.Owner is null || entry.IsDetached)
        {
            return; // detached: no slot to write to
        }
        var sav = entry.Owner.Sav;
        if (entry.IsParty)
        {
            sav.SetPartySlotAtIndex(entry.Pk, entry.Slot);
        }
        else
        {
            sav.SetBoxSlotAtIndex(entry.Pk, (entry.Box * sav.BoxSlotCount) + entry.Slot);
        }
        // Written behind Facade's back: rebuild its view so export can't revert it.
        entry.Owner.Invalidate();
    }

    private static int NextHandle() => Interlocked.Increment(ref _nextHandle);

    private static string FormatGender(byte gender) => gender switch { 1 => "female", 2 => "genderless", _ => "male" };
}
