import { describe, expect, it } from "vitest";
import { parseGoodreadsCsv, CsvParseError } from "./csv";

const HEADER =
  "Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies";

describe("parseGoodreadsCsv", () => {
  it("parses ratings, shelves, ISBN wrappers, and exclusive shelf", () => {
    const csv = `${HEADER}
123,"Never Let Me Go","Kazuo Ishiguro","Ishiguro, Kazuo","","=\"1400078776\"","=\"9781400078776\"",5,3.85,"Vintage","Paperback",288,2006,2005,2021/04/12,2019/01/03,"literary, sci-fi, favorites","literary (#3), sci-fi (#12), favorites (#1)",read,"Haunting.",,,1,1
456,"Klara and the Sun","Kazuo Ishiguro","Ishiguro, Kazuo","","=\"\"","=\"9780593318171\"",0,3.74,"Knopf","Hardcover",303,2021,2021,,2022/06/01,"to-read, sci-fi","to-read (#8), sci-fi (#22)",to-read,,,,0,0
`;
    const books = parseGoodreadsCsv(csv);
    expect(books).toHaveLength(2);
    expect(books[0]).toMatchObject({
      goodreadsId: "123",
      title: "Never Let Me Go",
      author: "Kazuo Ishiguro",
      isbn: "1400078776",
      isbn13: "9781400078776",
      myRating: 5,
      exclusiveShelf: "read",
      dateRead: "2021/04/12",
    });
    expect(books[0].bookshelves).toEqual(["literary", "sci-fi", "favorites"]);
    expect(books[1]).toMatchObject({
      title: "Klara and the Sun",
      isbn: null,
      isbn13: "9780593318171",
      myRating: 0,
      exclusiveShelf: "to-read",
    });
  });

  it("handles quoted commas and blank rows", () => {
    const csv = `${HEADER}
1,"Hello, World","Jane Doe","Doe, Jane","","=\"\"","=\"\"",4,4.1,"Pub","Paperback",100,2020,2020,2020/01/01,2019/01/01,"fiction","fiction (#1)",read,,,,1,0
`;
    const books = parseGoodreadsCsv(csv);
    expect(books[0].title).toBe("Hello, World");
  });

  it("rejects a non-Goodreads CSV", () => {
    expect(() => parseGoodreadsCsv("name,age\nAda,36")).toThrow(CsvParseError);
  });
});
