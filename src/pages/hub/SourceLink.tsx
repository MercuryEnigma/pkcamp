/** Public source access, available independently of Dropbox configuration. */
export function SourceLink() {
  return (
    <a
      className="camp-dropbox-badge camp-source-link"
      href="https://github.com/MercuryEnigma/pkcamp"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="pkCamp source code on GitHub (opens in a new tab)"
      title="Source code on GitHub"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.105.773-.244.773-.543v-2.093c-3.144.675-3.806-1.332-3.806-1.332-.514-1.305-1.253-1.653-1.253-1.653-1.025-.701.078-.687.078-.687 1.133.08 1.73 1.163 1.73 1.163 1.007 1.725 2.643 1.226 3.287.938.102-.729.394-1.226.716-1.508-2.51-.286-5.15-1.255-5.15-5.59 0-1.235.442-2.244 1.165-3.036-.117-.286-.505-1.437.111-2.994 0 0 .95-.304 3.094 1.16a10.79 10.79 0 0 1 5.626 0c2.144-1.464 3.092-1.16 3.092-1.16.618 1.557.23 2.708.113 2.994.725.792 1.163 1.801 1.163 3.036 0 4.347-2.644 5.301-5.163 5.581.405.35.767 1.04.767 2.096v3.085c0 .302.204.654.78.543A11.25 11.25 0 0 0 12 .75Z" />
      </svg>
    </a>
  )
}
