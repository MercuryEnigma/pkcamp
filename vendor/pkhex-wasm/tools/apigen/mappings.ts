/**
 * The explicit per-member binding map (owner decision on #14): every
 * `[JSExport]` member of the wasm facade claims exactly one TS surface
 * target here. `gen:check` fails when a runtime export is missing from this
 * table (unsurfaced capability) or when an entry references something that
 * no longer exists on either side.
 *
 * Target paths are `<Interface>.<member>` pairs from the model surface;
 * `(internal)` marks exports that are deliberate plumbing with no place in
 * the public JS API (lifecycle/dev helpers).
 */

export interface BindingMapping {
  /** Method name on the PkHexExports facade. */
  export: string;
  /** Dotted TS surface path claimed by this export, or `(internal)`. */
  target: string;
  note?: string;
}

export const BINDING_MAPPINGS: BindingMapping[] = [
  { export: "Load", target: "PKHex.load", note: "defensive copy-in happens wasm-side" },
  { export: "SaveBytes", target: "PKHex.saveBytes" },
  { export: "Initialize", target: "(internal)", note: "registers managed crypto at bootstrap, before any parse" },
  { export: "GetApiVersion", target: "(internal)", note: "runtime version stamp" },
  { export: "Close", target: "Game.dispose", note: "idempotent release of the save and its entity handles" },
  { export: "GenerateDemoSave", target: "(internal)", note: "dev/demo helper" },

  { export: "GameTrainerName", target: "TrainerInfo.name" },
  { export: "GameTrainerId", target: "TrainerInfo.id.tid" },
  { export: "GameTrainerSecretId", target: "TrainerInfo.id.sid" },
  { export: "GameTrainerGender", target: "TrainerInfo.gender" },
  { export: "GameMoney", target: "TrainerInfo.money" },
  { export: "GameBoxCount", target: "Game.boxCount" },
  { export: "GameGeneration", target: "Game.generation" },
  { export: "GameBoxMonHandles", target: "Game.box", note: "materializes entity handles per non-empty slot" },
  { export: "GamePartyMonHandles", target: "Game.party", note: "materializes entity handles per non-empty slot" },

  { export: "MonSpecies", target: "Pokemon.species" },
  { export: "MonNickname", target: "Pokemon.nickname" },
  { export: "MonLevel", target: "Pokemon.level" },
  { export: "MonIsShiny", target: "Pokemon.isShiny" },
  { export: "MonGender", target: "Pokemon.gender" },
  { export: "MonNatureId", target: "Pokemon.nature", note: "-1 sentinel maps to null pre-Gen3" },
  { export: "MonOwnerName", target: "Pokemon.owner.name" },
  { export: "MonOwnerId", target: "Pokemon.owner.id.tid" },
  { export: "MonOwnerSecretId", target: "Pokemon.owner.id.sid" },
  { export: "MonOwnerGender", target: "Pokemon.owner.gender" },
  { export: "MonIVs", target: "Pokemon.ivs", note: "wire order translated to StatBlock display order" },
  { export: "MonEVs", target: "Pokemon.evs", note: "wire order translated to StatBlock display order" },
  { export: "MonStats", target: "Pokemon.stats" },
  { export: "MonMoveSlots", target: "Pokemon.moves", note: "flat [id, pp] x4 reshaped into MoveSlot[]" },

  { export: "MonSetNickname", target: "Pokemon.setNickname", note: "rejects beyond the generation's length cap" },
  { export: "MonSetLevel", target: "Pokemon.setLevel", note: "client clamps 1..100 before the call" },
  { export: "MonSetMoves", target: "Pokemon.setMoves", note: "ids validated against the generation's movepool" },
  { export: "MonSetNature", target: "Pokemon.setNature", note: "mint-aware: nature + stat alignment written together" },
  { export: "MonSetShiny", target: "Pokemon.setShiny" },
  { export: "MonSetIVs", target: "Pokemon.setIVs", note: "partial merge resolved client-side" },
  { export: "MonSetEVs", target: "Pokemon.setEVs", note: "partial merge resolved client-side" },

  // v2 generic-accessor scaffold (upstream ticket #36): exported by upstream HEAD
  // but not part of the locked v1 model. Claimed so the gate stays exhaustive.
  { export: "InitV2", target: "(internal)", note: "upstream v2 scaffold" },
  { export: "LoadV2", target: "(internal)", note: "upstream v2 scaffold" },
  { export: "SaveBytesV2", target: "(internal)", note: "upstream v2 scaffold" },
  { export: "CloseV2", target: "(internal)", note: "upstream v2 scaffold" },
  { export: "GetBoxMonHandlesV2", target: "(internal)", note: "upstream v2 scaffold" },
  { export: "GetPartyMonHandlesV2", target: "(internal)", note: "upstream v2 scaffold" },
  { export: "GetMember", target: "(internal)", note: "upstream v2 scaffold" },
  { export: "SetMember", target: "(internal)", note: "upstream v2 scaffold" },

  // Facade-backed additions (pkcamp; MODIFICATIONS.md)
  { export: "GameSaveVersion", target: "Game.saveVersion" },
  { export: "GameVersionIsAggregated", target: "Game.isVersionAggregated" },
  { export: "GameBoxName", target: "Game.boxName" },
  { export: "GameBoxSlotHandles", target: "Game.boxSlots", note: "0 sentinel reshaped to null" },
  { export: "GamePartySlotHandles", target: "Game.partySlots", note: "0 sentinel reshaped to null" },
  { export: "GameSetBoxSlot", target: "Game.setBoxSlot", note: "explicit-index placement over Facade PokemonBox" },
  { export: "ParsePkm", target: "PKHex.parsePkm" },
  { export: "CloseMon", target: "Pokemon.release" },
  { export: "MonForm", target: "Pokemon.form" },
  { export: "MonIsEgg", target: "Pokemon.isEgg" },
  { export: "MonHeldItem", target: "Pokemon.heldItem" },
  { export: "MonToBytes", target: "Pokemon.toBytes" },
  { export: "MonHeldItemName", target: "Pokemon.heldItemName" },
  { export: "MonAbilityId", target: "Pokemon.ability", note: "-1 sentinel maps to null pre-Gen3" },
  { export: "MonAbilityName", target: "Pokemon.ability", note: "joined with MonAbilityId into one LookupRef" },
  { export: "MonBattleStats", target: "Pokemon.battleStats", note: "wire order translated to StatBlock display order" },
  { export: "MonOwnerDisplayId", target: "Pokemon.ownerDisplayId", note: "[tid, sid] reshaped into an object" },
  { export: "MonRibbonIds", target: "Pokemon.ribbons", note: "paired by index with MonRibbonNames/MonRibbonShortNames/MonRibbonIconFiles into RibbonRef[]" },
  { export: "MonRibbonNames", target: "Pokemon.ribbons", note: "paired by index with MonRibbonIds into RibbonRef[]" },
  { export: "MonRibbonShortNames", target: "Pokemon.ribbons", note: "paired by index with MonRibbonIds into RibbonRef[]" },
  { export: "MonRibbonIconFiles", target: "Pokemon.ribbons", note: "paired by index with MonRibbonIds into RibbonRef[]" },
];
