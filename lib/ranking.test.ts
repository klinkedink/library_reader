import { describe, expect, it } from "vitest";
import { parseGoodreadsCsv } from "./csv";
import { rankShelf } from "./ranking";
import type { DetectedBook } from "./types";

const HEADER =
  "Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies";

function detected(
  id: string,
  title: string,
  author: string,
  confidence = 0.9,
): DetectedBook {
  return { id, title, author, confidence };
}

const DEMO = `${HEADER}
1,"Never Let Me Go","Kazuo Ishiguro","Ishiguro, Kazuo","","=\"1400078776\"","=\"9781400078776\"",5,3.85,"Vintage","Paperback",288,2006,2005,2021/04/12,2019/01/03,"literary, sci-fi","literary (#1), sci-fi (#1)",read,,,,1,1
2,"The Remains of the Day","Kazuo Ishiguro","Ishiguro, Kazuo","","=\"\"","=\"9780679731726\"",5,4.14,"Vintage","Paperback",258,1990,1989,2020/02/02,2018/01/01,"literary","literary (#2)",read,,,,1,1
3,"Klara and the Sun","Kazuo Ishiguro","Ishiguro, Kazuo","","=\"\"","=\"9780593318171\"",0,3.74,"Knopf","Hardcover",303,2021,2021,,2022/06/01,"to-read, sci-fi","to-read (#1), sci-fi (#2)",to-read,,,,0,0
4,"Station Eleven","Emily St. John Mandel","Mandel, Emily St. John","","=\"\"","=\"9780804172448\"",5,4.06,"Vintage","Paperback",333,2014,2014,2022/08/08,2020/01/01,"literary, sci-fi","literary (#3), sci-fi (#3)",read,,,,1,1
5,"The Left Hand of Darkness","Ursula K. Le Guin","Le Guin, Ursula K.","","=\"\"","=\"9780441478125\"",5,4.09,"Ace","Paperback",304,1969,1969,2017/07/07,2016/01/01,"sci-fi","sci-fi (#4)",read,,,,1,1
6,"The Martian","Andy Weir","Weir, Andy","","=\"\"","=\"9780553418026\"",4,4.41,"Broadway","Paperback",387,2014,2011,2018/03/03,2017/01/01,"sci-fi","sci-fi (#5)",read,,,,1,1
7,"Project Hail Mary","Andy Weir","Weir, Andy","","=\"\"","=\"9780593135204\"",0,4.5,"Ballantine","Hardcover",496,2021,2021,,2023/01/15,"to-read, sci-fi","to-read (#2), sci-fi (#6)",to-read,,,,0,0
8,"A Little Life","Hanya Yanagihara","Yanagihara, Hanya","","=\"\"","=\"9780804172707\"",2,4.32,"Anchor","Paperback",720,2015,2015,2019/09/09,2018/01/01,"literary","literary (#4)",read,,,,1,1
9,"Piranesi","Susanna Clarke","Clarke, Susanna","","=\"\"","=\"9781635575637\"",0,4.22,"Bloomsbury","Hardcover",245,2020,2020,,2024/02/02,"to-read, fantasy","to-read (#3), fantasy (#1)",to-read,,,,0,0
`;

describe("rankShelf", () => {
  const library = parseGoodreadsCsv(DEMO);

  it("excludes already-read books from recommendations", () => {
    const result = rankShelf(
      [
        detected("1", "Never Let Me Go", "Kazuo Ishiguro"),
        detected("2", "The Buried Giant", "Kazuo Ishiguro"),
      ],
      library,
    );

    expect(result.alreadyRead.map((r) => r.book.title)).toContain("Never Let Me Go");
    expect(result.picks.map((r) => r.book.title)).not.toContain("Never Let Me Go");
    expect(result.picks.map((r) => r.book.title)).toContain("The Buried Giant");
  });

  it("ranks unread books by the same beloved author", () => {
    const result = rankShelf(
      [detected("2", "The Buried Giant", "Kazuo Ishiguro")],
      library,
    );
    expect(result.picks).toHaveLength(1);
    expect(result.picks[0].reasons.join(" ")).toMatch(/Ishiguro/);
    expect(result.picks[0].reasons.join(" ")).toMatch(/5★/);
  });

  it("treats to-read shelf books as queued picks, not already-read", () => {
    const result = rankShelf(
      [detected("3", "Klara and the Sun", "Kazuo Ishiguro")],
      library,
    );
    expect(result.alreadyRead).toHaveLength(0);
    expect(result.picks[0].kind).toBe("queued");
    expect(result.picks[0].reasons.join(" ")).toMatch(/to-read/i);
  });

  it("does not recommend an author the user rated poorly", () => {
    const result = rankShelf(
      [detected("10", "To Paradise", "Hanya Yanagihara")],
      library,
    );
    expect(result.picks.map((r) => r.book.title)).not.toContain("To Paradise");
    expect(result.rest[0].reasons.join(" ")).toMatch(/skip/i);
  });

  it("matches inverted author names and ISBN-identified reads", () => {
    const result = rankShelf(
      [
        {
          id: "isbn",
          title: "Messy Spine OCR",
          author: "",
          confidence: 0.4,
          isbn: "9781400078776",
        },
      ],
      library,
    );
    expect(result.alreadyRead).toHaveLength(1);
    expect(result.alreadyRead[0].matchedLibrary?.title).toBe("Never Let Me Go");
  });

  it("keeps picks to at most seven books", () => {
    const shelf = [
      detected("a", "Klara and the Sun", "Kazuo Ishiguro"),
      detected("b", "The Buried Giant", "Kazuo Ishiguro"),
      detected("c", "Project Hail Mary", "Andy Weir"),
      detected("d", "Piranesi", "Susanna Clarke"),
      detected("e", "Sea of Tranquility", "Emily St. John Mandel"),
      detected("f", "The Dispossessed", "Ursula K. Le Guin"),
      detected("g", "A Wizard of Earthsea", "Ursula K. Le Guin"),
      detected("h", "An Artist of the Floating World", "Kazuo Ishiguro"),
      detected("i", "The Martian", "Andy Weir"),
    ];
    const result = rankShelf(shelf, library);
    expect(result.picks.length).toBeGreaterThanOrEqual(3);
    expect(result.picks.length).toBeLessThanOrEqual(7);
    expect(result.picks.map((p) => p.book.title)).not.toContain("The Martian");
  });

  it("still recommends from a small Goodreads sample using author, to-read, and subjects", () => {
    const tiny = library.filter((book) =>
      ["Never Let Me Go", "The Remains of the Day", "The Left Hand of Darkness", "Klara and the Sun"].includes(
        book.title,
      ),
    );
    expect(tiny).toHaveLength(4);
    const result = rankShelf(
      [
        detected("buried", "The Buried Giant", "Kazuo Ishiguro"),
        detected("ancillary", "Ancillary Justice", "Ann Leckie"),
        detected("klara", "Klara and the Sun", "Kazuo Ishiguro"),
      ],
      tiny,
      { ancillary: ["Science fiction", "Space opera"] },
    );
    expect(result.tasteBookCount).toBe(4);
    expect(result.picks.map((p) => p.book.title)).toEqual(
      expect.arrayContaining(["The Buried Giant", "Klara and the Sun", "Ancillary Justice"]),
    );
    expect(result.picks.map((p) => p.book.title)).not.toContain("Never Let Me Go");
  });

  it("ranks most popular independently of taste and skips empty genres", () => {
    const result = rankShelf(
      [
        detected("twilight", "Twilight", "Stephenie Meyer"),
        detected("narnia", "The Lion, the Witch and the Wardrobe", "C.S. Lewis"),
        detected("rich", "Think and Grow Rich", "Napoleon Hill"),
        detected("martian", "The Martian", "Andy Weir"),
      ],
      library,
      {
        twilight: ["Young Adult Fiction", "Fantasy fiction", "Vampires"],
        narnia: ["Fantasy", "Juvenile Fiction", "Children"],
        rich: ["Self-Help", "Success", "Business"],
        martian: ["Science fiction"],
      },
      {
        twilight: { averageRating: 4.6, ratingsCount: 90_000 },
        narnia: { averageRating: 4.4, ratingsCount: 40_000 },
        rich: { averageRating: 4.2, ratingsCount: 12_000 },
        martian: { averageRating: 4.4, ratingsCount: 80_000 },
      },
    );

    expect(result.popular[0].book.title).toBe("Twilight");
    expect(result.popular.map((p) => p.book.title)).toContain("The Martian");
    expect(result.genres.map((g) => g.id)).toEqual(
      expect.arrayContaining(["fiction", "fantasy", "scifi", "selfhelp", "ya", "nonfiction"]),
    );
    expect(result.genres.map((g) => g.id)).not.toContain("romance");
    const ya = result.genres.find((g) => g.id === "ya");
    expect(ya?.books.length).toBeGreaterThanOrEqual(1);
    expect(ya?.books.length).toBeLessThanOrEqual(3);
    expect(result.genres.find((g) => g.id === "selfhelp")?.books[0].book.title).toBe(
      "Think and Grow Rich",
    );
    expect(result.picks.map((p) => p.book.title)).not.toContain("The Martian");
  });
});
