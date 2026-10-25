import { useTranslation, Trans } from 'react-i18next'
export function NewsPage() {
  const { t } = useTranslation(['news', 'common'] as const)

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="brand">
          <a href="./">{t('NewsPage.pkCamp')}</a>
        </h1>
        <p className="tagline">
          <Trans
            ns="news"
            i18nKey="NewsPage.toolsAndUpdatesForRetroPokeMonEnjoyersPart1Managed"
            components={{ part1: <br />, part2: <strong /> }}
          />
        </p>

        <div className="panel">
          <h2 className="banner">{t('NewsPage.projects')}</h2>
          <ul>
            <li>
              <a href="https://www.youtube.com/watch?v=lUWbs-ozJnE">
                {t('NewsPage.mysteryEventOnSwitchFrlg')}
              </a>
              <span>
                {t(
                  'NewsPage.mysteryEventForUnmoddedFireredLeafgreenOnTheSwitchSystems'
                )}
              </span>
            </li>
            <li>
              <a href="https://ribbon-helper.guide/">
                {t('NewsPage.ribbonHelper')}
              </a>
              <span>
                {t('NewsPage.battleAndContestLookupToolForRibbonCollecting')}
              </span>
            </li>
          </ul>
        </div>
      </aside>

      <main>
        <article className="panel has-sticker">
          <span className="sticker" aria-hidden="true">
            {t('NewsPage.new')}
          </span>
          <h2 className="banner">{t('NewsPage.updates')}</h2>
          <div className="body">
            <time dateTime="2026-08-25">2026-08-25</time>
            <h3>{t('NewsPage.whatIsMysteryGift')}</h3>
            <p>{t('NewsPage.soWhatExactlyIsMysteryGiftIsItSafeWhat')}</p>
            <p>
              {t(
                'NewsPage.mysteryGiftIsAFeatureGamefreakProgrammedInTheOriginal'
              )}
            </p>
            <p>
              {t('NewsPage.mysteryGiftContainsTwoMainComponentsAWonderCardAnd')}
            </p>
            <p>
              {t('NewsPage.toUnlockMysteryGiftGoTheAnyPokemartAndInteract')}
            </p>
            <div className="video">
              <iframe
                src="https://www.youtube-nocookie.com/embed/QaGGz4NHxs0"
                title={t(
                  'NewsPage.discoverThisFanMadeMysteryGiftAtPokemonWorldsIn'
                )}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              ></iframe>
            </div>
            <p>
              <a
                className="go"
                href="https://www.youtube.com/watch?v=QaGGz4NHxs0"
              >
                {t('NewsPage.watchOnYoutube')}
              </a>
            </p>
          </div>
        </article>

        <article className="panel has-sticker">
          <span className="sticker" aria-hidden="true">
            {t('NewsPage.new')}
          </span>
          <h2 className="banner">{t('NewsPage.updates')}</h2>
          <div className="body">
            <time dateTime="2026-08-25">2026-08-25</time>
            <h3>{t('NewsPage.mysteryGiftLiveAtPokeMonWorldsXp')}</h3>
            <p>
              {t('NewsPage.comingToSanFranciscoForPokemonWorldsXpComeFind')}
            </p>
            <p>{t('NewsPage.makeSureYouUnlockMysteryGiftFirstGoTheAny')}</p>
            <p>{t('NewsPage.noteThisIsAFanMadeProjectIMTaking')}</p>
            <div className="video">
              <iframe
                src="https://www.youtube-nocookie.com/embed/QaGGz4NHxs0"
                title={t(
                  'NewsPage.discoverThisFanMadeMysteryGiftAtPokemonWorldsIn'
                )}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              ></iframe>
            </div>
            <p>
              <a
                className="go"
                href="https://www.youtube.com/watch?v=QaGGz4NHxs0"
              >
                {t('NewsPage.watchOnYoutube')}
              </a>
            </p>
          </div>
        </article>

        <article className="panel">
          <div className="body">
            <time dateTime="2026-08-19">2026-08-19</time>
            <h3>{t('NewsPage.workingMysteryGiftPrototype')}</h3>
            <p>{t('NewsPage.weHaveAWorkingPrototypeOfMysteryEventForAn')}</p>

            <p>
              <Trans
                ns="news"
                i18nKey="NewsPage.thisWasAcheivedByBuildingOffOfPart1TornadusS"
                components={{
                  part1: (
                    <a href="https://github.com/tornadus/frlg-ldn-trade" />
                  ),
                }}
              />
            </p>

            <p>{t('NewsPage.moreDetailsWillComeUpAsTheTeamWorksOn')}</p>
            <div className="video">
              <iframe
                src="https://www.youtube-nocookie.com/embed/lUWbs-ozJnE"
                title={t(
                  'NewsPage.mysteryEventOnSwitchFireredLeafgreenPrototypeDemo'
                )}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              ></iframe>
            </div>
            <p>
              <a
                className="go"
                href="https://www.youtube.com/watch?v=lUWbs-ozJnE"
              >
                {t('NewsPage.watchOnYoutube')}
              </a>
            </p>
          </div>
        </article>

        <article className="panel">
          <div className="body">
            <time dateTime="2026-08-14">2026-08-14</time>
            <h3>{t('NewsPage.ribbonHelperIsLive')}</h3>
            <p>
              {t('NewsPage.forThoseLookingToRibbonMasterTheirCherishedPokeMon')}
            </p>
            <p>
              <a className="go" href="https://ribbon-helper.guide/">
                {t('NewsPage.openRibbonHelper')}
              </a>
            </p>
          </div>
        </article>
      </main>

      <footer>
        {t('NewsPage.pokeMonIsNintendoCreaturesIncGameFreakIncThis')}
      </footer>
    </div>
  )
}
