export function PatchNotes() {
    const html = `<div class="layout">

  <aside class="sidebar">
    <h1 class="brand"><a href="./">PK&nbsp;Camp</a></h1>
    <p class="tagline">Tools and updates for Retro Pokémon enjoyers.<br>Managed by <strong>MercuryEnigma</strong></p>

    <div class="panel">
      <h2 class="banner">Projects</h2>
      <ul>
        <li>
          <a href="https://www.youtube.com/watch?v=lUWbs-ozJnE">Mystery Event on Switch FrLg</a>
          <span>Mystery Event for unmodded FireRed &amp; LeafGreen on the Switch systems.</span>
        </li>
        <li>
          <a href="https://ribbon-helper.guide/">Ribbon Helper</a>
          <span>Battle and contest lookup tool for ribbon collecting.</span>
        </li>
      </ul>
    </div>
  </aside>

  <main>
    <article class="panel has-sticker">
      <span class="sticker" aria-hidden="true">NEW!</span>
      <h2 class="banner">Updates</h2>
      <div class="body">
        <time datetime="2026-08-25">2026-08-25</time>
        <h3>What is Mystery Gift?</h3>
        <p>
          So what exactly is Mystery Gift? Is it safe? What can it do?
        </p>
        <p>
          Mystery Gift is a feature GameFreak programmed in the original FireRed / LeafGreen
          that allowed for event distribution. It was primarily used for sending the 
          AuroraTicket and MysticTicket items via the wireless adapter. But it is much
          flexible and able to run almost any code sent. They have specific methods for
          receiving items, pokemon, and eggs. There is also support for things like sprites
          and music. 
        </p>
        <p>
          Mystery Gift contains two main components: a Wonder Card and the script to run
          when you talk to the deliveryman on the 2nd floor of the Pokémon Center. The 
          Wonder Card contains text to provide instructions for the player. The script is
          code stored in a special place on the file to run when needed and keep it isolated.
          If you delete the Wonder Card in the Mystery Gift menu, it also deletes the script
          so it is easy to remove any Mystery Gift data.
        </p>
        <p>
          To unlock Mystery Gift: Go the any PokeMart and interact with
          the questionnaire on the counter and put in: LINK	TOGETHER	WITH	ALL
        </p>
        <div class="video">
          <iframe
            src="https://www.youtube-nocookie.com/embed/QaGGz4NHxs0"
            title="Discover this fan-made Mystery Gift at Pokemon Worlds in SF"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen></iframe>
        </div>
        <p><a class="go" href="https://www.youtube.com/watch?v=QaGGz4NHxs0">Watch on YouTube &rarr;</a></p>
      </div>
    </article>

    <article class="panel has-sticker">
      <span class="sticker" aria-hidden="true">NEW!</span>
      <h2 class="banner">Updates</h2>
      <div class="body">
        <time datetime="2026-08-25">2026-08-25</time>
        <h3>Mystery Gift live at Pokémon Worlds / XP!</h3>
        <p>
          Coming to San Francisco for Pokemon Worlds / XP? Come find the
          first-of-its-kind mystery gift distribution for Switch FireRed/LeafGreen!
          Receive a rare egg that unlocks a LEGENDARY experience!
        </p>
        <p>
          Make sure you unlock Mystery Gift first. Go the any PokeMart and interact with
          the questionnaire on the counter and put in: LINK	TOGETHER	WITH	ALL
        </p>
        <p>
          NOTE: This is a fan-made project. I'm taking huge care to test and make sure
          it is as proper and bug-free as possible. But as with all non-official methods,
          there is always a small chance for unintended behavior, so use at your own risk.
        </p>
        <div class="video">
          <iframe
            src="https://www.youtube-nocookie.com/embed/QaGGz4NHxs0"
            title="Discover this fan-made Mystery Gift at Pokemon Worlds in SF"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen></iframe>
        </div>
        <p><a class="go" href="https://www.youtube.com/watch?v=QaGGz4NHxs0">Watch on YouTube &rarr;</a></p>
      </div>
    </article>

    <article class="panel">
      <div class="body">
        <time datetime="2026-08-19">2026-08-19</time>
        <h3>Working Mystery Gift prototype</h3>
        <p>
          We have a working prototype of Mystery Event for an unmodded Switch or
          Switch&nbsp;2 FireRed&nbsp;/&nbsp;LeafGreen game. Come to Pokémon Worlds&nbsp;/&nbsp;XP
          in San Francisco to get an exclusive look!
        </p>

        <p>
          This was acheived by building off of 
          <a href="https://github.com/tornadus/frlg-ldn-trade">tornadus's FRLG LDN trade project</a>.
          By extending this project to support hosting trades and wireless adapter interactions,
          we can now send custom mystery gift events to stock, unmodded Switch 1 and Switch 2
          FireRed / LeafGreen games with a simple linux and Wifi-USB adapter! 
        </p>

        <p>
          More details will come up as the team works on streamlining it so it is easy for anyone to try!
        </p>
        <div class="video">
          <iframe
            src="https://www.youtube-nocookie.com/embed/lUWbs-ozJnE"
            title="Mystery Event on Switch FireRed / LeafGreen — prototype demo"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen></iframe>
        </div>
        <p><a class="go" href="https://www.youtube.com/watch?v=lUWbs-ozJnE">Watch on YouTube &rarr;</a></p>
      </div>
    </article>

    <article class="panel">
      <div class="body">
        <time datetime="2026-08-14">2026-08-14</time>
        <h3>Ribbon Helper is live</h3>
        <p>
          For those looking to ribbon master their cherished Pokémon before
          Pokemon Bank closes down, I created a tool to help look up battle and
          contest info to make it as accessible as possible. There is also a full
          set of guides for all ribbons, resources for figuring out which games
          Pokemon can go to, and a tool to create a single HOME screenshot.
        </p>
        <p><a class="go" href="https://ribbon-helper.guide/">Open Ribbon Helper &rarr;</a></p>
      </div>
    </article>
  </main>

  <footer>
    Pokémon is © Nintendo / Creatures Inc. / GAME FREAK inc.
    This is an unofficial fan site with no affiliation.
  </footer>
  </div>
`;

    return (
        <div dangerouslySetInnerHTML={{ _html: hmtl }} />
    );
}
