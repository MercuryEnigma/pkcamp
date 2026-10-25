import arcade from './arcade/en.json'
import camp from './camp/en.json'
import cartridgeSaves from './cartridge-saves/en.json'
import collections from './collections/en.json'
import common from './common/en.json'
import hub from './hub/en.json'
import lab from './lab/en.json'
import mysteryGifts from './mystery-gifts/en.json'
import news from './news/en.json'
import pokemonDetails from './pokemon-details/en.json'
import romBiosDumps from './rom-bios-dumps/en.json'
import services from './services/en.json'
import settings from './settings/en.json'
import start from './start/en.json'
import trade from './trade/en.json'
import transporter from './transporter/en.json'
import arcadeEs from './arcade/es.json'
import campEs from './camp/es.json'
import cartridgeSavesEs from './cartridge-saves/es.json'
import collectionsEs from './collections/es.json'
import commonEs from './common/es.json'
import hubEs from './hub/es.json'
import labEs from './lab/es.json'
import mysteryGiftsEs from './mystery-gifts/es.json'
import newsEs from './news/es.json'
import pokemonDetailsEs from './pokemon-details/es.json'
import romBiosDumpsEs from './rom-bios-dumps/es.json'
import servicesEs from './services/es.json'
import settingsEs from './settings/es.json'
import startEs from './start/es.json'
import tradeEs from './trade/es.json'
import transporterEs from './transporter/es.json'
import pokedex from './pokedex/en.json'
import pokedexEs from './pokedex/es.json'

/** English is the source of truth for namespace and key types. */
export const english = {
  arcade: arcade,
  camp: camp,
  'cartridge-saves': cartridgeSaves,
  collections: collections,
  common: common,
  hub: hub,
  lab: lab,
  'mystery-gifts': mysteryGifts,
  news: news,
  'pokemon-details': pokemonDetails,
  'rom-bios-dumps': romBiosDumps,
  services: services,
  settings: settings,
  start: start,
  trade: trade,
  transporter: transporter,
  pokedex: pokedex,
}

export const resources = {
  en: english,
  es: {
    arcade: arcadeEs,
    camp: campEs,
    'cartridge-saves': cartridgeSavesEs,
    collections: collectionsEs,
    common: commonEs,
    hub: hubEs,
    lab: labEs,
    'mystery-gifts': mysteryGiftsEs,
    news: newsEs,
    'pokemon-details': pokemonDetailsEs,
    'rom-bios-dumps': romBiosDumpsEs,
    services: servicesEs,
    settings: settingsEs,
    start: startEs,
    trade: tradeEs,
    transporter: transporterEs,
    pokedex: pokedexEs,
  },
}
