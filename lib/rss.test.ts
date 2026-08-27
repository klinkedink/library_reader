import { describe, expect, it } from "vitest";
import {
  extractGoodreadsUserId,
  parseGoodreadsRss,
  mergeRssShelves,
} from "./rss";

const SAMPLE_RSS = `<?xml version="1.0"?>
<rss>
  <channel>
    <item>
      <title><![CDATA[Station Eleven]]></title>
      <author_name>Emily St. John Mandel</author_name>
      <isbn>0804172447</isbn>
      <book_id>20170404</book_id>
      <user_rating>5</user_rating>
      <average_rating>4.06</average_rating>
      <user_read_at>Mon, 08 Aug 2022 00:00:00 -0700</user_read_at>
    </item>
    <item>
      <title>Piranesi</title>
      <author_name>Susanna Clarke</author_name>
      <isbn></isbn>
      <user_rating>0</user_rating>
      <average_rating>4.22</average_rating>
    </item>
  </channel>
</rss>`;

describe("Goodreads RSS helpers", () => {
  it("extracts a numeric user id from profile URLs", () => {
    expect(
      extractGoodreadsUserId("https://www.goodreads.com/user/show/12345-maya"),
    ).toBe("12345");
    expect(
      extractGoodreadsUserId("https://www.goodreads.com/review/list/99"),
    ).toBe("99");
    expect(extractGoodreadsUserId("not a url")).toBeNull();
  });

  it("parses titles, authors, and ratings from list_rss XML", () => {
    const books = parseGoodreadsRss(SAMPLE_RSS, "read");
    expect(books).toHaveLength(2);
    expect(books[0]).toMatchObject({
      title: "Station Eleven",
      author: "Emily St. John Mandel",
      myRating: 5,
      exclusiveShelf: "read",
      isbn: "0804172447",
    });
    expect(books[1].title).toBe("Piranesi");
  });

  it("prefers currently-reading / to-read when merging shelves", () => {
    const read = parseGoodreadsRss(SAMPLE_RSS, "read");
    const queued = parseGoodreadsRss(
      SAMPLE_RSS.replace("Station Eleven", "Piranesi"),
      "to-read",
    );
    const merged = mergeRssShelves([
      { shelf: "read", books: read },
      { shelf: "to-read", books: queued },
    ]);
    const piranesi = merged.find((b) => b.title === "Piranesi");
    expect(piranesi?.exclusiveShelf).toBe("to-read");
  });
});
