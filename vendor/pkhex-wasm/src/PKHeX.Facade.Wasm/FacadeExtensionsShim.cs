using PKHeX.Core;
using PKHeX.Facade.Pokemons;

namespace PKHeX.Facade.Extensions;

/// <summary>
/// Supplies the one member of upstream's
/// <c>PKHeX.Facade/Extensions/PokemonExtensions.cs</c> that Facade itself
/// consumes internally (<see cref="Legality"/>, used by
/// <c>Repositories/MoveRepository.cs</c>).
///
/// That upstream file is excluded from this build because it also declares
/// <c>ToLegalAsync</c>/<c>ApplyLegalAsync</c>/<c>Showdown</c>, which pull in
/// PKHeX.Core.AutoMod from the PKHeX-Plugins submodule that pkhex-wasm does
/// not check out (see PKHeX.Facade.Wasm.csproj and MODIFICATIONS.md).
///
/// This declaration is copied verbatim from that file and needs nothing beyond
/// PKHeX.Core; the legality-*mutation* helpers are simply not available in the
/// wasm bundle, and nothing in the JS surface exposes them.
/// </summary>
public static class PokemonLegalityExtensions
{
    /// <summary>Legality analysis of one entity. Verbatim from upstream PokemonExtensions.</summary>
    public static LegalityAnalysis Legality(this Pokemon pokemon) => new(pokemon.Pkm);
}
