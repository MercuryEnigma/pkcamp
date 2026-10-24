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

const UPDATES: readonly Update[] = [
  {
    date: '2026-08-25',
    title: 'Mystery Gift live at Pokémon Worlds / XP!',
    body: (
      <>
        <p>
          Coming to San Francisco for Pokemon Worlds / XP? Come find the
          first-of-its-kind mystery gift distribution for Switch
          FireRed/LeafGreen! Receive a rare egg that unlocks a LEGENDARY
          experience!
        </p>
        <p>
          Make sure you unlock Mystery Gift first. Go to any PokeMart and
          interact with the questionnaire on the counter and put in: LINK
          TOGETHER WITH ALL
        </p>
        <p>
          NOTE: This is a fan-made project. I'm taking huge care to test and
          make sure it is as proper and bug-free as possible. But as with all
          non-official methods, there is always a small chance for unintended
          behavior, so use at your own risk.
        </p>
      </>
    ),
    video: {
      id: 'QaGGz4NHxs0',
      title: 'Discover this fan-made Mystery Gift at Pokemon Worlds in SF',
    },
  },
  {
    date: '2026-08-19',
    title: 'Working Mystery Gift prototype',
    body: (
      <>
        <p>
          We have a working prototype of Mystery Event for an unmodded Switch or
          Switch 2 FireRed / LeafGreen game. Come to Pokémon Worlds / XP in San
          Francisco to get an exclusive look!
        </p>
        <p>
          This was achieved by building off of{' '}
          <a href="https://github.com/tornadus/frlg-ldn-trade">
            tornadus's FRLG LDN trade project
          </a>
          . By extending this project to support hosting trades and wireless
          adapter interactions, we can now send custom mystery gift events to
          stock, unmodded Switch 1 and Switch 2 FireRed / LeafGreen games with a
          simple Linux and Wi-Fi USB adapter!
        </p>
        <p>
          More details will come up as the team works on streamlining it so it
          is easy for anyone to try!
        </p>
      </>
    ),
    video: {
      id: 'lUWbs-ozJnE',
      title: 'Mystery Event on Switch FireRed / LeafGreen — prototype demo',
    },
  },
  {
    date: '2026-08-14',
    title: 'Ribbon Helper is live',
    body: (
      <p>
        For those looking to ribbon master their cherished Pokémon before
        Pokemon Bank closes down, I created a tool to help look up battle and
        contest info to make it as accessible as possible. There is also a full
        set of guides for all ribbons, resources for figuring out which games
        Pokemon can go to, and a tool to create a single HOME screenshot.
      </p>
    ),
    link: { href: 'https://ribbon-helper.guide/', label: 'Open Ribbon Helper' },
  },
]

/** A read-only list of updates, newest first, in one centered column. */
export function PatchNotes() {
  return (
    <div className="patch-notes">
      <div className="patch-notes-column">
        {UPDATES.map((update) => (
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
                  Watch on YouTube →
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
          Pokémon is © Nintendo / Creatures Inc. / GAME FREAK inc. This is an
          unofficial fan site with no affiliation.
        </p>
      </div>
    </div>
  )
}
