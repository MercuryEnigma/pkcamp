import { useTranslation, Trans } from 'react-i18next'
import { i18n } from '../../../services/i18n'
import type { ReactNode } from 'react'
import './patchNotes.css'

interface Update {
  date: string
  title: string
  body: ReactNode
  /** YouTube video id, shown embedded with a link. */
  video?: { id: string; title: string }
  link?: { href: string; label: string }
}

const getUpdates = (): readonly Update[] => [
  {
    date: '2026-08-25',
    title: i18n.t('news:PatchNotes.mysteryGiftLiveAtPokeMonWorldsXp'),
    body: (
      <>
        <p>
          {i18n.t(
            'news:PatchNotes.comingToSanFranciscoForPokemonWorldsXpComeFind'
          )}
        </p>
        <p>
          {i18n.t('news:PatchNotes.makeSureYouUnlockMysteryGiftFirstGoToAny')}
        </p>
        <p>{i18n.t('news:PatchNotes.noteThisIsAFanMadeProjectIMTaking')}</p>
      </>
    ),
    video: {
      id: 'QaGGz4NHxs0',
      title: i18n.t(
        'news:PatchNotes.discoverThisFanMadeMysteryGiftAtPokemonWorldsIn'
      ),
    },
  },
  {
    date: '2026-08-19',
    title: i18n.t('news:PatchNotes.workingMysteryGiftPrototype'),
    body: (
      <>
        <p>
          {i18n.t('news:PatchNotes.weHaveAWorkingPrototypeOfMysteryEventForAn')}
        </p>
        <p>
          <Trans
            ns="news"
            i18nKey="PatchNotes.thisWasAchievedByBuildingOffOfPart1TornadusS"
            components={{
              part1: <a href="https://github.com/tornadus/frlg-ldn-trade" />,
            }}
          />
        </p>
        <p>{i18n.t('news:PatchNotes.moreDetailsWillComeUpAsTheTeamWorksOn')}</p>
      </>
    ),
    video: {
      id: 'lUWbs-ozJnE',
      title: i18n.t(
        'news:PatchNotes.mysteryEventOnSwitchFireredLeafgreenPrototypeDemo'
      ),
    },
  },
  {
    date: '2026-08-14',
    title: i18n.t('news:PatchNotes.ribbonHelperIsLive'),
    body: (
      <p>
        {i18n.t(
          'news:PatchNotes.forThoseLookingToRibbonMasterTheirCherishedPokeMon'
        )}
      </p>
    ),
    link: {
      href: 'https://ribbon-helper.guide/',
      label: i18n.t('news:PatchNotes.openRibbonHelper'),
    },
  },
]

/** A read-only list of updates, newest first, in one centered column. */
export function PatchNotes() {
  const { t } = useTranslation(['news', 'common'] as const)

  return (
    <div className="patch-notes">
      <div className="patch-notes-column">
        {getUpdates().map((update) => (
          <article key={update.date} className="site-panel">
            <time dateTime={update.date}>{update.date}</time>
            <h2>{update.title}</h2>
            {update.body}
            {update.video && (
              <iframe
                className="patch-notes-video"
                src={`https://www.youtube-nocookie.com/embed/${update.video.id}`}
                title={update.video.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            )}
            {update.video && (
              <p>
                <a href={`https://www.youtube.com/watch?v=${update.video.id}`}>
                  {t('PatchNotes.watchOnYoutube')}
                </a>
              </p>
            )}
            {update.link && (
              <p>
                <a href={update.link.href}>{update.link.label} →</a>
              </p>
            )}
          </article>
        ))}
        <p className="patch-notes-footer">
          {t('PatchNotes.pokeMonIsNintendoCreaturesIncGameFreakIncThis')}
        </p>
      </div>
    </div>
  )
}
