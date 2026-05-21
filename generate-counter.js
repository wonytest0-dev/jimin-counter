const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");

const releaseMap =
  require("./releaseMap");

const releaseInfo =
  require("./releaseInfo");

const ARTIST_ID =
  "1oSPZhvZMIrWW5I41kPkkY";

const ARTIST_URL =
  `https://open.spotify.com/artist/${ARTIST_ID}`;

const KWORB_URL =
  `https://kworb.net/spotify/artist/${ARTIST_ID}_songs.html`;

const customSongImages = {

  "Promise":
    "https://res.cloudinary.com/ddh2uwdlk/image/upload/…91139159a27703e662441d9_zkpxcf.jpg",

  "Christmas Love":
    "https://res.cloudinary.com/ddh2uwdlk/image/upload/fl_preserve_transparency/v1779332586/0c49ad930e6ed814d8adf6d8bbdce56e_ydvbsw.jpg",

  "VIBE (feat. Jimin of BTS)":
    "https://res.cloudinary.com/ddh2uwdlk/image/upload/…d0877081d1bcf60b5bd1f99_wkwr1n.jpg",

  "With you":
    "https://res.cloudinary.com/ddh2uwdlk/image/upload/…410415bb6bb95d7772a1fa5_iohiiu.jpg",

  "With you - Instrumental":
    "https://res.cloudinary.com/ddh2uwdlk/image/upload/…410415bb6bb95d7772a1fa5_iohiiu.jpg"
};

function formatNumber(num) {

  if (!num)
    return "0";

  if (
    num >=
    1_000_000_000
  ) {

    return (
      (
        num /
        1_000_000_000
      )
        .toFixed(2)
        .replace(
          /\.00$/,
          ""
        ) + "B"
    );
  }

  if (
    num >=
    1_000_000
  ) {

    return (
      (
        num /
        1_000_000
      )
        .toFixed(1)
        .replace(
          /\.0$/,
          ""
        ) + "M"
    );
  }

  if (
    num >=
    1_000
  ) {

    return (
      (
        num /
        1_000
      )
        .toFixed(1)
        .replace(
          /\.0$/,
          ""
        ) + "K"
    );
  }

  return num
    .toString();
}

function getDailySnapshot() {

  try {

    if (
      fs.existsSync(
        "daily-snapshot.json"
      )
    ) {

      return JSON.parse(
        fs.readFileSync(
          "daily-snapshot.json",
          "utf8"
        )
      );
    }

    return null;

  } catch {

    return null;
  }
}

async function scrapeSpotifyArtist() {

  try {

    const {
      data: html
    } =
      await axios.get(
        ARTIST_URL,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0"
          }
        }
      );

    let followers =
      0;
try {

      const stateMatch =
        html.match(
          /<script id="initial-state"[^>]*>(.*?)<\/script>/
        );

      if (
        stateMatch?.[1]
      ) {

        const json =
          JSON.parse(
            stateMatch[1]
          );

        followers =
          json
          ?.entities
          ?.artists?.[
            ARTIST_ID
          ]
          ?.stats
          ?.followers
          || 0;
      }

    } catch {

      console.log(
        "followers parse failed"
      );
    }

    const monthlyMatch =
      html.match(
        /([0-9.,]+)\s+monthly listeners/i
      );

    const monthlyListeners =
      monthlyMatch
      ? parseInt(
          monthlyMatch[1]
            .replace(
              /,/g,
              ""
            )
        )
      : 0;

    const imageMatch =
      html.match(
        /https:\/\/i\.scdn\.co\/image\/[a-zA-Z0-9]+/
      );

    return {

      name:
        "Jimin",

      followers,

      formattedFollowers:
        formatNumber(
          followers
        ),

      monthlyListeners,

      formattedMonthlyListeners:
        formatNumber(
          monthlyListeners
        ),

      image:
        imageMatch?.[0]
        || null
    };

  } catch (err) {

    console.error(
      "Spotify scrape failed:",
      err.message
    );

    return {

      name:
        "Jimin",

      followers:
        0,

      monthlyListeners:
        0,

      image:
        null
    };
  }
}

async function generateCounter() {

  try {

    const artist =
      await scrapeSpotifyArtist();

    const snapshot =
      getDailySnapshot();

    const {
      data: html
    } = await axios.get(
      KWORB_URL
    );

    const $ =
      cheerio.load(html);

    let updated =
      "";

    $("body")
      .find("*")
      .each((i, el) => {

        const text =
          $(el).text();

        if (
          text.includes(
            "Last updated:"
          )
        ) {

          const match =
            text.match(
              /Last updated:\s*(\d{4}\/\d{2}\/\d{2})/
            );

          if (match) {

            updated =
              match[1];
          }
        }
      });

    const songs =
      [];

    let totalStreams =
      0;

    let totalDaily =
      0;

    let songCount =
      0;

    for (
      const row of
      $("table tbody tr")
        .toArray()
    ) {

      const cols =
        $(row)
          .find("td");

      if (
        cols.length <
        3
      ) continue;

      const title =
        $(row)
          .find("a")
          .first()
          .text()
          .trim();

      if (
        !title
      ) continue;

      const streams =
        parseInt(
          cols
            .eq(
              cols.length - 2
            )
            .text()
            .replace(
              /,/g,
              ""
            )
        ) || 0;

      const daily =
        parseInt(
          cols
            .eq(
              cols.length - 1
            )
            .text()
            .replace(
              /,/g,
              ""
            )
        ) || 0;
totalStreams +=
        streams;

      totalDaily +=
        daily;

      songCount++;

      let image =
        artist.image;

      if (
        customSongImages[
          title
        ]
      ) {

        image =
          customSongImages[
            title
          ];

      } else {

        for (
          const [
            releaseName,
            trackList
          ]
          of Object.entries(
            releaseMap
          )
        ) {

          if (
            trackList.includes(
              title
            )
          ) {

            image =
              releaseInfo[
                releaseName
              ]?.image
              || artist.image;

            break;
          }
        }
      }

      const snapshotSong =
        snapshot
        ?.songs
        ?.find(
          song =>
            song.title ===
            title
        );

      const yesterdayDaily =
        snapshotSong
        ?.daily || 0;

      const difference =
        daily -
        yesterdayDaily;

      songs.push({

        title,

        streams,

        daily,

        yesterdayDaily,

        difference,

        formattedDifference:
          difference > 0
            ? `+${formatNumber(
                difference
              )}`
            : formatNumber(
                difference
              ),

        image,

        formattedStreams:
          formatNumber(
            streams
          ),

        formattedDaily:
          formatNumber(
            daily
          )
      });
    }

    const releases =
      [];

    for (
      const [
        releaseName,
        trackList
      ]
      of Object.entries(
        releaseMap
      )
    ) {

      const releaseSongs =
        songs.filter(
          song =>
            trackList.includes(
              song.title
            )
        );

      const streams =
        releaseSongs.reduce(
          (
            sum,
            song
          ) =>
            sum +
            song.streams,
          0
        );

      const daily =
        releaseSongs.reduce(
          (
            sum,
            song
          ) =>
            sum +
            song.daily,
          0
        );

      const info =
        releaseInfo[
          releaseName
        ];

      let image =
        artist.image;

      if (
        info?.image
      ) {

        image =
          info.image;
      }

      const previousRelease =
        snapshot
        ?.releases
        ?.find(
          release =>
            release.title ===
            releaseName
        );

      const yesterdayDaily =
        previousRelease
        ?.daily || 0;

      const difference =
        daily -
        yesterdayDaily;

      releases.push({

        title:
          releaseName,

        type:
          info?.type ||
          "album",

        image,

        streams,

        formattedStreams:
          formatNumber(
            streams
          ),

        daily,

        yesterdayDaily,

        difference,

        formattedDifference:
          difference > 0
            ? `+${formatNumber(
                difference
              )}`
            : formatNumber(
                difference
              ),

        formattedDaily:
          formatNumber(
            daily
          ),

        songCount:
          releaseSongs.length,

        songs:
          releaseSongs.sort(
            (
              a,
              b
            ) =>
              b.streams -
              a.streams
          )
      });
    }

    const final = {

      updated,

      artist,

      summary: {

        totalStreams,

        formattedStreams:
          formatNumber(
            totalStreams
          ),

        totalDaily,

        formattedDaily:
          formatNumber(
            totalDaily
          ),

        yesterdayTotalDaily:
          snapshot
          ?.summary
          ?.totalDaily || 0,

        difference:
          totalDaily -
          (
            snapshot
            ?.summary
            ?.totalDaily ||
            0
          ),

        formattedDifference:
          formatNumber(
            totalDaily -
            (
              snapshot
              ?.summary
              ?.totalDaily ||
              0
            )
          ),

        songCount
      },

      releases
    };

    if (
      !fs.existsSync(
        "daily-snapshot.json"
      ) ||
      (
        snapshot &&
        snapshot.updated !==
        updated
      )
    ) {

      fs.writeFileSync(
        "daily-snapshot.json",
        JSON.stringify(
          {
            updated,
            summary: {
              totalDaily
            },
            songs,
            releases
          },
          null,
          2
        )
      );

      console.log(
        "📸 snapshot updated"
      );
    }

    fs.writeFileSync(
      "counter.json",
      JSON.stringify(
        final,
        null,
        2
      )
    );

    console.log(
      "🔥 counter.json generated"
    );

  } catch (err) {

    console.error(
      "Generate failed:",
      err
    );
  }
}

generateCounter();
