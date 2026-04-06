export function shuf<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export interface WordSearchResult {
  grid: string[][];
  placed: string[];
  pSet: Record<string, boolean>;
}

export function makeWordSearch(words: string[], size: number): WordSearchResult {
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(""));
  const DIRS: [number, number][] = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  const placed: string[] = [];
  const pSet: Record<string, boolean> = {};
  const sorted = [...words].sort((a, b) => b.length - a.length);

  for (const word of sorted) {
    if (word.length > size) continue;
    let done = false;
    for (const [dr, dc] of shuf(DIRS)) {
      if (done) break;
      const positions = shuf(
        Array.from({ length: size * size }, (_, i) => [Math.floor(i / size), i % size] as [number, number])
      );
      for (const [sr, sc] of positions) {
        let ok = true;
        for (let k = 0; k < word.length; k++) {
          const nr = sr + dr * k, nc = sc + dc * k;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) { ok = false; break; }
          if (grid[nr][nc] !== "" && grid[nr][nc] !== word[k]) { ok = false; break; }
        }
        if (ok) {
          for (let k = 0; k < word.length; k++) {
            const nr = sr + dr * k, nc = sc + dc * k;
            grid[nr][nc] = word[k];
            pSet[`${nr},${nc}`] = true;
          }
          placed.push(word);
          done = true;
          break;
        }
      }
    }
  }
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (grid[r][c] === "") grid[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return { grid, placed, pSet };
}

export interface SudokuResult {
  puzzle: number[][];
  solution: number[][];
}

export function makeSudoku(diff: string): SudokuResult {
  const holes = diff === "Easy" ? 32 : diff === "Hard" ? 50 : 44;
  const board: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));

  function ok(b: number[][], r: number, c: number, n: number): boolean {
    for (let i = 0; i < 9; i++) if (b[r][i] === n || b[i][c] === n) return false;
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let i = br; i < br + 3; i++)
      for (let j = bc; j < bc + 3; j++)
        if (b[i][j] === n) return false;
    return true;
  }

  function fill(b: number[][]): boolean {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++) {
        if (b[r][c] === 0) {
          for (const n of shuf([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
            if (ok(b, r, c, n)) {
              b[r][c] = n;
              if (fill(b)) return true;
              b[r][c] = 0;
            }
          }
          return false;
        }
      }
    return true;
  }

  fill(board);
  const solution = board.map(r => [...r]);
  const puzzle = board.map(r => [...r]);

  function cnt(b: number[][], lim: number): number {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++) {
        if (b[r][c] === 0) {
          let ct = 0;
          for (let n = 1; n <= 9; n++) {
            if (ok(b, r, c, n)) {
              b[r][c] = n;
              ct += cnt(b, lim - ct);
              b[r][c] = 0;
              if (ct >= lim) return ct;
            }
          }
          return ct;
        }
      }
    return 1;
  }

  let rem = 0;
  for (const idx of shuf(Array.from({ length: 81 }, (_, i) => i))) {
    if (rem >= holes) break;
    const r = Math.floor(idx / 9), c = idx % 9;
    if (puzzle[r][c] === 0) continue;
    const bk = puzzle[r][c];
    puzzle[r][c] = 0;
    if (cnt(puzzle.map(r => [...r]), 2) === 1) rem++;
    else puzzle[r][c] = bk;
  }
  return { puzzle, solution };
}

export interface MazeResult {
  grid: number[][];
  rows: number;
  cols: number;
}

export function makeMaze(rows: number, cols: number): MazeResult {
  const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

  const DX: Record<number, number> = { 1: 0, 2: 1, 4: 0, 8: -1 };
  const DY: Record<number, number> = { 1: -1, 2: 0, 4: 1, 8: 0 };
  const OPP: Record<number, number> = { 1: 4, 2: 8, 4: 1, 8: 2 };

  function carve(r: number, c: number) {
    visited[r][c] = true;
    for (const d of shuf([1, 2, 4, 8])) {
      const nr = r + DY[d], nc = c + DX[d];
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        grid[r][c] |= d;
        grid[nr][nc] |= OPP[d];
        carve(nr, nc);
      }
    }
  }

  carve(0, 0);
  return { grid, rows, cols };
}

export interface NumberSearchResult {
  grid: string[][];
  placed: string[];
  pSet: Record<string, boolean>;
}

const NUMBER_SEQUENCES = [
  "12345", "67890", "11223", "44556", "77889",
  "13579", "24680", "98765", "54321", "10293",
  "84756", "29384", "56473", "18273", "64738",
  "39182", "74839", "20394", "85749", "31928",
  "47382", "59173", "62847", "83920", "15748",
  "72634", "49821", "36057", "81234", "56789",
];

/** Convert a word to a 5-digit sequence via letter-position encoding (A=1,B=2,...,Z=0 mod 10). */
function wordToSequence(word: string): string {
  const digits = word.toUpperCase().split("").map(c => ((c.charCodeAt(0) - 64) % 10).toString()).join("");
  return (digits + digits).slice(0, 5); // repeat to ensure ≥5 chars then trim
}

export function makeNumberSearch(size: number, wordBank?: string[]): NumberSearchResult {
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(""));
  const DIRS: [number, number][] = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  const placed: string[] = [];
  const pSet: Record<string, boolean> = {};
  // Use category-derived sequences when a word bank is provided
  const seqPool = wordBank && wordBank.length >= 5
    ? shuf([...wordBank]).slice(0, 30).map(wordToSequence)
    : NUMBER_SEQUENCES;
  const sequences = shuf([...seqPool]).slice(0, 20);

  for (const seq of sequences.sort((a, b) => b.length - a.length)) {
    if (seq.length > size) continue;
    let done = false;
    for (const [dr, dc] of shuf(DIRS)) {
      if (done) break;
      const positions = shuf(
        Array.from({ length: size * size }, (_, i) => [Math.floor(i / size), i % size] as [number, number])
      );
      for (const [sr, sc] of positions) {
        let ok = true;
        for (let k = 0; k < seq.length; k++) {
          const nr = sr + dr * k, nc = sc + dc * k;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) { ok = false; break; }
          if (grid[nr][nc] !== "" && grid[nr][nc] !== seq[k]) { ok = false; break; }
        }
        if (ok) {
          for (let k = 0; k < seq.length; k++) {
            const nr = sr + dr * k, nc = sc + dc * k;
            grid[nr][nc] = seq[k];
            pSet[`${nr},${nc}`] = true;
          }
          placed.push(seq);
          done = true;
          break;
        }
      }
    }
  }
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (grid[r][c] === "") grid[r][c] = String(Math.floor(Math.random() * 10));
  return { grid, placed, pSet };
}

export interface CryptogramResult {
  cipher: string;
  plain: string;
  key: Record<string, string>;
  author: string;
}

export interface QuoteEntry {
  text: string;
  author: string;
}

export const QUOTE_BANK: QuoteEntry[] = [
  { text: "THE ONLY WAY TO DO GREAT WORK IS TO LOVE WHAT YOU DO", author: "Steve Jobs" },
  { text: "IN THE MIDDLE OF EVERY DIFFICULTY LIES OPPORTUNITY", author: "Albert Einstein" },
  { text: "IT DOES NOT MATTER HOW SLOWLY YOU GO AS LONG AS YOU DO NOT STOP", author: "Confucius" },
  { text: "LIFE IS WHAT HAPPENS WHEN YOU ARE BUSY MAKING OTHER PLANS", author: "John Lennon" },
  { text: "THE FUTURE BELONGS TO THOSE WHO BELIEVE IN THE BEAUTY OF THEIR DREAMS", author: "Eleanor Roosevelt" },
  { text: "SPREAD LOVE EVERYWHERE YOU GO AND LET NO ONE EVER COME TO YOU WITHOUT LEAVING HAPPIER", author: "Mother Teresa" },
  { text: "WHEN YOU REACH THE END OF YOUR ROPE TIE A KNOT IN IT AND HANG ON", author: "Franklin D. Roosevelt" },
  { text: "ALWAYS REMEMBER THAT YOU ARE ABSOLUTELY UNIQUE JUST LIKE EVERYONE ELSE", author: "Margaret Mead" },
  { text: "DO NOT GO WHERE THE PATH MAY LEAD GO INSTEAD WHERE THERE IS NO PATH AND LEAVE A TRAIL", author: "Ralph Waldo Emerson" },
  { text: "YOU WILL FACE MANY DEFEATS IN LIFE BUT NEVER LET YOURSELF BE DEFEATED", author: "Maya Angelou" },
  { text: "THE GREATEST GLORY IN LIVING LIES NOT IN NEVER FALLING BUT IN RISING EVERY TIME WE FALL", author: "Nelson Mandela" },
  { text: "IN THE END IT IS NOT THE YEARS IN YOUR LIFE THAT COUNT IT IS THE LIFE IN YOUR YEARS", author: "Abraham Lincoln" },
  { text: "NEVER LET THE FEAR OF STRIKING OUT KEEP YOU FROM PLAYING THE GAME", author: "Babe Ruth" },
  { text: "LIFE IS EITHER A DARING ADVENTURE OR NOTHING AT ALL", author: "Helen Keller" },
  { text: "MANY OF LIFE S FAILURES ARE PEOPLE WHO DID NOT REALIZE HOW CLOSE THEY WERE TO SUCCESS WHEN THEY GAVE UP", author: "Thomas A. Edison" },
  { text: "YOU HAVE BRAINS IN YOUR HEAD AND FEET IN YOUR SHOES YOU CAN STEER YOURSELF ANY DIRECTION YOU CHOOSE", author: "Dr. Seuss" },
  { text: "IF LIFE WERE PREDICTABLE IT WOULD CEASE TO BE LIFE AND BE WITHOUT FLAVOR", author: "Eleanor Roosevelt" },
  { text: "IF YOU LOOK AT WHAT YOU HAVE IN LIFE YOU WILL ALWAYS HAVE MORE", author: "Oprah Winfrey" },
  { text: "IF YOU SET YOUR GOALS RIDICULOUSLY HIGH AND IT IS A FAILURE YOU WILL FAIL ABOVE EVERYONE ELSE S SUCCESS", author: "James Cameron" },
  { text: "LIFE IS NOT MEASURED BY THE NUMBER OF BREATHS WE TAKE BUT BY THE MOMENTS THAT TAKE OUR BREATH AWAY", author: "Maya Angelou" },
  { text: "IF YOU WANT TO LIVE A HAPPY LIFE TIE IT TO A GOAL NOT TO PEOPLE OR OBJECTS", author: "Albert Einstein" },
  { text: "NEVER LET THE FEAR OF WHAT COULD HAPPEN MAKE NOTHING HAPPEN", author: "Doe Zantamata" },
  { text: "TWENTY YEARS FROM NOW YOU WILL BE MORE DISAPPOINTED BY THE THINGS YOU DID NOT DO THAN BY THE ONES YOU DID", author: "Mark Twain" },
  { text: "WHEN I WAS FIVE YEARS OLD MY MOTHER ALWAYS TOLD ME THAT HAPPINESS WAS THE KEY TO LIFE", author: "John Lennon" },
  { text: "THE REAL TEST IS NOT WHETHER YOU AVOID THIS FAILURE BECAUSE YOU WON T IT IS WHETHER YOU LET IT HARDEN OR SHAME YOU", author: "Barack Obama" },
  { text: "BELIEVE YOU CAN AND YOU ARE HALFWAY THERE", author: "Theodore Roosevelt" },
  { text: "SUCCESS IS NOT FINAL FAILURE IS NOT FATAL IT IS THE COURAGE TO CONTINUE THAT COUNTS", author: "Winston Churchill" },
  { text: "THE ONLY LIMIT TO OUR REALIZATION OF TOMORROW IS OUR DOUBTS OF TODAY", author: "Franklin D. Roosevelt" },
  { text: "THE PURPOSE OF OUR LIVES IS TO BE HAPPY", author: "Dalai Lama" },
  { text: "GET BUSY LIVING OR GET BUSY DYING", author: "Stephen King" },
  { text: "YOU ONLY LIVE ONCE BUT IF YOU DO IT RIGHT ONCE IS ENOUGH", author: "Mae West" },
  { text: "MANY PEOPLE DIE AT TWENTY FIVE AND ARE NOT BURIED UNTIL THEY ARE SEVENTY FIVE", author: "Benjamin Franklin" },
  { text: "THE WHOLE SECRET OF A SUCCESSFUL LIFE IS TO FIND OUT WHAT IS ONE S DESTINY TO DO AND THEN DO IT", author: "Henry Ford" },
  { text: "IF YOU ARE NOT WILLING TO RISK THE USUAL YOU WILL HAVE TO SETTLE FOR THE ORDINARY", author: "Jim Rohn" },
  { text: "THE WAY TO GET STARTED IS TO QUIT TALKING AND BEGIN DOING", author: "Walt Disney" },
  { text: "THERE IS ONLY ONE WAY TO AVOID CRITICISM DO NOTHING SAY NOTHING AND BE NOTHING", author: "Aristotle" },
  { text: "EVERYTHING YOU HAVE EVER WANTED IS ON THE OTHER SIDE OF FEAR", author: "George Addair" },
  { text: "CREATIVITY IS INTELLIGENCE HAVING FUN", author: "Albert Einstein" },
  { text: "DO ONE THING EVERY DAY THAT SCARES YOU", author: "Eleanor Roosevelt" },
  { text: "WELL DONE IS BETTER THAN WELL SAID", author: "Benjamin Franklin" },
  { text: "THE BEST TIME TO PLANT A TREE WAS TWENTY YEARS AGO THE SECOND BEST TIME IS NOW", author: "Chinese Proverb" },
  { text: "AN UNEXAMINED LIFE IS NOT WORTH LIVING", author: "Socrates" },
  { text: "EIGHTY PERCENT OF SUCCESS IS SHOWING UP", author: "Woody Allen" },
  { text: "YOUR TIME IS LIMITED SO DO NOT WASTE IT LIVING SOMEONE ELSE S LIFE", author: "Steve Jobs" },
  { text: "EVERY CHILD IS AN ARTIST THE PROBLEM IS HOW TO REMAIN AN ARTIST ONCE WE GROW UP", author: "Pablo Picasso" },
  { text: "I AM NOT A PRODUCT OF MY CIRCUMSTANCES I AM A PRODUCT OF MY DECISIONS", author: "Stephen Covey" },
  { text: "WHEN ONE DOOR OF HAPPINESS CLOSES ANOTHER OPENS BUT OFTEN WE LOOK SO LONG AT THE CLOSED DOOR", author: "Helen Keller" },
  { text: "IF YOU CHANGE THE WAY YOU LOOK AT THINGS THE THINGS YOU LOOK AT CHANGE", author: "Wayne Dyer" },
  { text: "IF YOUR DREAMS DO NOT SCARE YOU THEY ARE NOT BIG ENOUGH", author: "Ellen Johnson Sirleaf" },
  { text: "THE QUESTION IS NOT WHO IS GOING TO LET ME IT IS WHO IS GOING TO STOP ME", author: "Ayn Rand" },
  { text: "NOTHING IS IMPOSSIBLE THE WORD ITSELF SAYS I AM POSSIBLE", author: "Audrey Hepburn" },
  { text: "KEEP YOUR FACE ALWAYS TOWARD THE SUNSHINE AND SHADOWS WILL FALL BEHIND YOU", author: "Walt Whitman" },
  { text: "WE KNOW WHAT WE ARE BUT KNOW NOT WHAT WE MAY BE", author: "William Shakespeare" },
  { text: "NOT ALL THOSE WHO WANDER ARE LOST", author: "J.R.R. Tolkien" },
  { text: "IT ALWAYS SEEMS IMPOSSIBLE UNTIL IT IS DONE", author: "Nelson Mandela" },
  { text: "IN THREE WORDS I CAN SUM UP EVERYTHING I VE LEARNED ABOUT LIFE IT GOES ON", author: "Robert Frost" },
  { text: "I OWE MY SUCCESS TO HAVING LISTENED RESPECTFULLY TO THE VERY BEST ADVICE AND THEN GOING AWAY AND DOING THE EXACT OPPOSITE", author: "G. K. Chesterton" },
  { text: "A PERSON WHO NEVER MADE A MISTAKE NEVER TRIED ANYTHING NEW", author: "Albert Einstein" },
  { text: "GREAT MINDS DISCUSS IDEAS AVERAGE MINDS DISCUSS EVENTS SMALL MINDS DISCUSS PEOPLE", author: "Eleanor Roosevelt" },
  { text: "IF YOU TELL THE TRUTH YOU DO NOT HAVE TO REMEMBER ANYTHING", author: "Mark Twain" },
  { text: "LOVE THE LIFE YOU LIVE LIVE THE LIFE YOU LOVE", author: "Bob Marley" },
  { text: "STRIVE NOT TO BE A SUCCESS BUT RATHER TO BE OF VALUE", author: "Albert Einstein" },
  { text: "TWO ROADS DIVERGED IN A WOOD AND I TOOK THE ONE LESS TRAVELED BY", author: "Robert Frost" },
  { text: "I ATTRIBUTE MY SUCCESS TO THIS I NEVER GAVE OR TOOK ANY EXCUSE", author: "Florence Nightingale" },
  { text: "YOU MISS ONE HUNDRED PERCENT OF THE SHOTS YOU DO NOT TAKE", author: "Wayne Gretzky" },
  { text: "THE MOST COMMON WAY PEOPLE GIVE UP THEIR POWER IS BY THINKING THEY DO NOT HAVE ANY", author: "Alice Walker" },
  { text: "WINNING IS NOT EVERYTHING BUT WANTING TO WIN IS", author: "Vince Lombardi" },
  { text: "I HAVE LEARNED OVER THE YEARS THAT WHEN ONE S MIND IS MADE UP THIS DIMINISHES FEAR", author: "Rosa Parks" },
  { text: "DO NOT JUDGE EACH DAY BY THE HARVEST YOU REAP BUT BY THE SEEDS THAT YOU PLANT", author: "Robert Louis Stevenson" },
  { text: "REMEMBERING THAT YOU ARE GOING TO DIE IS THE BEST WAY TO AVOID THE TRAP OF THINKING YOU HAVE SOMETHING TO LOSE", author: "Steve Jobs" },
  { text: "LOVE ALL TRUST A FEW DO WRONG TO NONE", author: "William Shakespeare" },
  { text: "GO CONFIDENTLY IN THE DIRECTION OF YOUR DREAMS AND LIVE THE LIFE YOU HAVE IMAGINED", author: "Henry David Thoreau" },
  { text: "WHEN I STAND BEFORE GOD AT THE END OF MY LIFE I WOULD HOPE THAT I WOULD NOT HAVE A SINGLE BIT OF TALENT LEFT", author: "Erma Bombeck" },
  { text: "FEW THINGS CAN HELP AN INDIVIDUAL MORE THAN TO PLACE RESPONSIBILITY ON HIM AND TO LET HIM KNOW THAT YOU TRUST HIM", author: "Booker T. Washington" },
  { text: "CERTAIN THINGS CATCH YOUR EYE BUT PURSUE ONLY THOSE THAT CAPTURE THE HEART", author: "Ancient Indian Proverb" },
  { text: "BELIEVE THAT LIFE IS WORTH LIVING AND YOUR BELIEF WILL HELP CREATE THE FACT", author: "William James" },
  { text: "ALWAYS BEAR IN MIND THAT YOUR OWN RESOLUTION TO SUCCEED IS MORE IMPORTANT THAN ANY OTHER", author: "Abraham Lincoln" },
  { text: "NOTHING IN THE WORLD CAN TAKE THE PLACE OF PERSEVERANCE", author: "Calvin Coolidge" },
  { text: "THE SECRET OF GETTING AHEAD IS GETTING STARTED", author: "Mark Twain" },
  { text: "MAGIC IS BELIEVING IN YOURSELF IF YOU CAN DO THAT YOU CAN MAKE ANYTHING HAPPEN", author: "Johann Wolfgang von Goethe" },
  { text: "ALL OUR DREAMS CAN COME TRUE IF WE HAVE THE COURAGE TO PURSUE THEM", author: "Walt Disney" },
  { text: "WHATEVER THE MIND OF MAN CAN CONCEIVE AND BELIEVE IT CAN ACHIEVE", author: "Napoleon Hill" },
  { text: "FIRST FORGET INSPIRATION HABIT IS MORE DEPENDABLE HABIT WILL SUSTAIN YOU WHETHER YOU ARE INSPIRED OR NOT", author: "Octavia Butler" },
  { text: "WE BECOME WHAT WE THINK ABOUT MOST OF THE TIME AND THAT IS THE STRANGEST SECRET", author: "Earl Nightingale" },
  { text: "CHANGE YOUR THOUGHTS AND YOU CHANGE YOUR WORLD", author: "Norman Vincent Peale" },
  { text: "EITHER YOU RUN THE DAY OR THE DAY RUNS YOU", author: "Jim Rohn" },
  { text: "WHETHER YOU THINK YOU CAN OR YOU THINK YOU CANNOT YOU ARE RIGHT", author: "Henry Ford" },
  { text: "THE HARDER I WORK THE MORE LUCK I SEEM TO HAVE", author: "Thomas Jefferson" },
  { text: "SUCCESS USUALLY COMES TO THOSE WHO ARE TOO BUSY TO BE LOOKING FOR IT", author: "Henry David Thoreau" },
  { text: "OPPORTUNITIES DO NOT HAPPEN YOU CREATE THEM", author: "Chris Grosser" },
  { text: "FALL SEVEN TIMES AND STAND UP EIGHT", author: "Japanese Proverb" },
  { text: "ONCE YOU CHOOSE HOPE ANYTHING IS POSSIBLE", author: "Christopher Reeve" },
  { text: "ONCE WE ACCEPT OUR LIMITS WE GO BEYOND THEM", author: "Albert Einstein" },
  { text: "IF YOU CANNOT DO GREAT THINGS DO SMALL THINGS IN A GREAT WAY", author: "Napoleon Hill" },
  { text: "YOU ARE NEVER TOO OLD TO SET ANOTHER GOAL OR TO DREAM A NEW DREAM", author: "C.S. Lewis" },
  { text: "PRESS FORWARD DO NOT STOP DO NOT LINGER IN YOUR JOURNEY BUT STRIVE FOR THE MARK SET BEFORE YOU", author: "George Whitefield" },
  { text: "WE MUST ACCEPT FINITE DISAPPOINTMENT BUT NEVER LOSE INFINITE HOPE", author: "Martin Luther King Jr." },
  { text: "IT IS NEVER TOO LATE TO BE WHAT YOU MIGHT HAVE BEEN", author: "George Eliot" },
  { text: "ONLY I CAN CHANGE MY LIFE NO ONE CAN DO IT FOR ME", author: "Carol Burnett" },
  { text: "I CAN AND I WILL WATCH ME", author: "Carrie Green" },
  { text: "I DID NOT FAIL THE TEST I JUST FOUND ONE HUNDRED WAYS TO DO IT WRONG", author: "Benjamin Franklin" },
  { text: "LUCK IS A DIVIDEND OF SWEAT THE MORE YOU SWEAT THE LUCKIER YOU GET", author: "Ray Kroc" },
  { text: "YOU DO NOT HAVE TO BE GREAT TO START BUT YOU HAVE TO START TO BE GREAT", author: "Zig Ziglar" },
  { text: "WHAT YOU GET BY ACHIEVING YOUR GOALS IS NOT AS IMPORTANT AS WHAT YOU BECOME", author: "Henry David Thoreau" },
  { text: "NOBODY EVER WROTE DOWN A PLAN TO BE BROKE FAT LAZY OR STUPID THOSE THINGS ARE WHAT HAPPEN WHEN YOU DO NOT HAVE A PLAN", author: "Larry Winget" },
  { text: "SOMEONE IS SITTING IN THE SHADE TODAY BECAUSE SOMEONE PLANTED A TREE A LONG TIME AGO", author: "Warren Buffett" },
  { text: "THE BEGINNING IS THE MOST IMPORTANT PART OF THE WORK", author: "Plato" },
  { text: "IN ORDER TO SUCCEED WE MUST FIRST BELIEVE THAT WE CAN", author: "Nikos Kazantzakis" },
  { text: "LIMITATIONS LIVE ONLY IN OUR MINDS BUT IF WE USE OUR IMAGINATIONS OUR POSSIBILITIES BECOME LIMITLESS", author: "Jamie Paolinetti" },
  { text: "ENERGY AND PERSISTENCE CONQUER ALL THINGS", author: "Benjamin Franklin" },
  { text: "PROBLEMS ARE NOT STOP SIGNS THEY ARE GUIDELINES", author: "Robert H. Schuller" },
  { text: "THE MOST DIFFICULT THING IS THE DECISION TO ACT THE REST IS MERELY TENACITY", author: "Amelia Earhart" },
  { text: "HOW WONDERFUL IT IS THAT NOBODY NEED WAIT A SINGLE MOMENT BEFORE STARTING TO IMPROVE THE WORLD", author: "Anne Frank" },
  { text: "AN INVESTMENT IN KNOWLEDGE PAYS THE BEST INTEREST", author: "Benjamin Franklin" },
  { text: "FIRST THEY IGNORE YOU THEN THEY LAUGH AT YOU THEN THEY FIGHT YOU THEN YOU WIN", author: "Mahatma Gandhi" },
  { text: "THE BATTLES THAT COUNT ARE NOT THE ONES FOR GOLD MEDALS THE STRUGGLES WITHIN YOURSELF ARE FASCINATING", author: "Jesse Owens" },
  { text: "EDUCATION COSTS MONEY BUT THEN SO DOES IGNORANCE", author: "Sir Claus Moser" },
  { text: "HEALTH IS THE GREATEST GIFT CONTENTMENT THE GREATEST WEALTH FAITHFULNESS THE BEST RELATIONSHIP", author: "Buddha" },
  { text: "HARDSHIPS OFTEN PREPARE ORDINARY PEOPLE FOR AN EXTRAORDINARY DESTINY", author: "C.S. Lewis" },
  { text: "YOU ARE BRAVER THAN YOU BELIEVE STRONGER THAN YOU SEEM AND SMARTER THAN YOU THINK", author: "A.A. Milne" },
  { text: "LIFE IS SHORT AND IT IS UP TO YOU TO MAKE IT SWEET", author: "Sarah Louise Delany" },
  { text: "JUST ONE SMALL POSITIVE THOUGHT IN THE MORNING CAN CHANGE YOUR WHOLE DAY", author: "Dalai Lama" },
  { text: "KEEP YOUR EYES ON THE STARS AND YOUR FEET ON THE GROUND", author: "Theodore Roosevelt" },
  { text: "WE GENERATE FEARS WHILE WE SIT WE OVERCOME THEM BY ACTION", author: "Dr. Henry Link" },
  { text: "WHETHER YOU ARE NEW TO THE WORKFORCE OR A SEASONED PROFESSIONAL STANDING OUT TAKES EFFORT AND INTENTION", author: "Germany Kent" },
  { text: "TO SEE WHAT IS RIGHT AND NOT DO IT IS A LACK OF COURAGE", author: "Confucius" },
  { text: "IT TAKES COURAGE TO GROW UP AND BECOME WHO YOU REALLY ARE", author: "E.E. Cummings" },
  { text: "YOUR SELF WORTH IS DETERMINED BY YOU YOU DO NOT HAVE TO DEPEND ON SOMEONE TELLING YOU WHO YOU ARE", author: "Beyonce" },
  { text: "NOTHING IS PARTICULARLY HARD IF YOU DIVIDE IT INTO SMALL JOBS", author: "Henry Ford" },
  { text: "HAPPINESS IS NOT BY CHANCE BUT BY CHOICE", author: "Jim Rohn" },
  { text: "THE WISEST MIND HAS SOMETHING YET TO LEARN", author: "George Santayana" },
  { text: "ALL THE WORLD IS A STAGE AND ALL THE MEN AND WOMEN MERELY PLAYERS", author: "William Shakespeare" },
  { text: "A ROOM WITHOUT BOOKS IS LIKE A BODY WITHOUT A SOUL", author: "Marcus Tullius Cicero" },
  { text: "I AM SO CLEVER THAT SOMETIMES I DO NOT UNDERSTAND A SINGLE WORD OF WHAT I AM SAYING", author: "Oscar Wilde" },
  { text: "THE MORE THAT YOU READ THE MORE THINGS YOU WILL KNOW", author: "Dr. Seuss" },
  { text: "TODAY A READER TOMORROW A LEADER", author: "Margaret Fuller" },
  { text: "KNOWLEDGE IS LIKE A GARDEN IF IT IS NOT CULTIVATED IT CANNOT BE HARVESTED", author: "African Proverb" },
  { text: "THE BEAUTIFUL THING ABOUT LEARNING IS THAT NOBODY CAN TAKE IT AWAY FROM YOU", author: "B.B. King" },
  { text: "LIVE AS IF YOU WERE TO DIE TOMORROW LEARN AS IF YOU WERE TO LIVE FOREVER", author: "Mahatma Gandhi" },
  { text: "WONDER IS THE BEGINNING OF WISDOM", author: "Socrates" },
  { text: "THE ROOTS OF EDUCATION ARE BITTER BUT THE FRUIT IS SWEET", author: "Aristotle" },
  { text: "INTELLIGENCE PLUS CHARACTER THAT IS THE GOAL OF TRUE EDUCATION", author: "Martin Luther King Jr." },
  { text: "I FIND THAT THE HARDER I WORK THE MORE LUCK I SEEM TO HAVE", author: "Thomas Jefferson" },
  { text: "KNOWLEDGE IS POWER INFORMATION IS LIBERATING EDUCATION IS THE PREMISE OF PROGRESS", author: "Kofi Annan" },
  { text: "DOUBT IS THE BEGINNING NOT THE END OF WISDOM", author: "George Iles" },
  { text: "LEARNING NEVER EXHAUSTS THE MIND", author: "Leonardo da Vinci" },
  { text: "WHOEVER CEASES TO BE A STUDENT HAS NEVER BEEN A STUDENT", author: "George Iles" },
  { text: "TELL ME AND I FORGET TEACH ME AND I REMEMBER INVOLVE ME AND I LEARN", author: "Benjamin Franklin" },
  { text: "READING GIVES US SOMEPLACE TO GO WHEN WE HAVE TO STAY WHERE WE ARE", author: "Mason Cooley" },
  { text: "WE ARE WHAT WE REPEATEDLY DO EXCELLENCE THEN IS NOT AN ACT BUT A HABIT", author: "Will Durant" },
  { text: "IT IS THE MARK OF AN EDUCATED MIND TO BE ABLE TO ENTERTAIN A THOUGHT WITHOUT ACCEPTING IT", author: "Aristotle" },
  { text: "SCIENCE IS ORGANIZED KNOWLEDGE WISDOM IS ORGANIZED LIFE", author: "Immanuel Kant" },
];

export function makeCryptogramFromQuote(quote: QuoteEntry): CryptogramResult {
  const plain = quote.text.toUpperCase().replace(/[^A-Z ]/g, "").trim();
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const shuffled = shuf([...letters]);
  const key: Record<string, string> = {};
  letters.forEach((l, i) => { key[l] = shuffled[i]; });
  for (let i = 0; i < letters.length; i++) {
    if (key[letters[i]] === letters[i]) {
      const j = (i + 1) % letters.length;
      [key[letters[i]], key[letters[j]]] = [key[letters[j]], key[letters[i]]];
    }
  }
  const cipher = plain
    .split("")
    .map(ch => (ch >= "A" && ch <= "Z") ? key[ch] : ch)
    .join("");
  return { cipher, plain, key, author: quote.author };
}

export function makeCryptogram(): CryptogramResult {
  const quote = QUOTE_BANK[Math.floor(Math.random() * QUOTE_BANK.length)];
  return makeCryptogramFromQuote(quote);
}

// ─────────────────────────────────────────────────────────────────────────────
// Crossword generator
// ─────────────────────────────────────────────────────────────────────────────

export interface CrosswordClue {
  num: number;
  clue: string;
  answer: string;
  row: number;
  col: number;
  len: number;
}

export interface CrosswordResult {
  grid: string[][];
  across: CrosswordClue[];
  down: CrosswordClue[];
  size: number;
  nums: Record<string, number>;
}

const CROSSWORD_CLUES: Record<string, string> = {
  PUZZLE: "A game to solve", BRAIN: "Thinking organ", SOLVE: "Find the answer",
  GAME: "Fun activity", FIND: "Locate something", LETTER: "Alphabet character",
  GRID: "Rows and columns layout", CLUE: "A helpful hint", ANSWER: "The solution",
  LOGIC: "Reasoned thinking", LEARN: "Gain knowledge", SKILL: "Practiced ability",
  HUNT: "Search for something", QUEST: "A seeking journey", DECODE: "Crack a cipher",
  REVEAL: "Show what was hidden", UNLOCK: "Open a lock", STUDY: "Focus on learning",
  FOCUS: "Concentrate attention", RELAX: "Rest and unwind", THINK: "Use your mind",
  SMART: "Quick-witted", MIND: "The thinking self", QUICK: "Fast and ready",
  SHARP: "Keen and alert", CLEVER: "Intelligent person", BRIGHT: "Smart and shining",
  MASTER: "Expert at something", PATTERN: "Repeating design", RIDDLE: "A puzzling question",
  CIPHER: "A coded message", WISDOM: "Deep understanding", REASON: "Think through a problem",
  TRACE: "Follow a path", IMPROVE: "Get better at something", EFFORT: "Hard work applied",
  FIGURE: "Work something out", DETAIL: "Small but important part",
  PROBE: "Investigate thoroughly", NOTICE: "Become aware of",
  ELEPHANT: "Largest land animal", GIRAFFE: "Tallest animal on earth",
  DOLPHIN: "Smart sea mammal", CHEETAH: "Fastest land animal",
  GORILLA: "Large great ape", PANTHER: "Black big cat", LEOPARD: "Spotted big cat",
  JAGUAR: "Americas big cat", BUFFALO: "Large bovine", PEACOCK: "Bird with a stunning tail",
  OSTRICH: "Largest flightless bird", FALCON: "Fast hunting bird",
  OCTOPUS: "Eight-armed sea creature", LOBSTER: "Clawed seafood",
  WALRUS: "Tusked Arctic animal", OTTER: "Playful river animal",
  BEAVER: "Dam-building rodent", BADGER: "Burrowing nocturnal animal",
  RABBIT: "Hopping soft-eared pet", FERRET: "Slim weasel-like pet",
  LEMUR: "Ring-tailed primate", SLOTH: "Slow-moving tree dweller",
  LYNX: "Wild spotted cat", COUGAR: "Mountain lion",
  PUMA: "South American big cat", COYOTE: "Prairie wolf",
  HYENA: "Laughing scavenger", ZEBRA: "Striped African horse",
  BISON: "American buffalo", MOOSE: "Largest deer species",
  FLAMINGO: "Pink wading bird", PENGUIN: "Antarctic flightless bird",
  KANGAROO: "Pouched Australian animal", HEDGEHOG: "Spiny small mammal",
  WOLVERINE: "Fierce mustelid", REINDEER: "Holiday sleigh puller",
  STALLION: "Adult male horse", PELICAN: "Large-billed sea bird",
  TOUCAN: "Tropical fruit bird", CONDOR: "Giant soaring bird",
  SEAHORSE: "Tiny upright fish", MANATEE: "Sea cow",
  NARWHAL: "Unicorn of the sea", CHIPMUNK: "Stripe-faced ground squirrel",
  SQUIRREL: "Nut-hoarding tree rodent", HAMSTER: "Small cage pet",
  CAPYBARA: "World largest rodent", GAZELLE: "Swift African antelope",
  IMPALA: "Leaping antelope", CARIBOU: "Arctic deer",
  MOUNTAIN: "High rocky peak", FOREST: "Dense woodland",
  MEADOW: "Open grassy field", CANYON: "Deep rocky gorge",
  GLACIER: "Slow-moving ice mass", VOLCANO: "Erupting fire mountain",
  TUNDRA: "Frozen treeless plain", SAVANNA: "African grassland",
  PLATEAU: "Flat-topped highland", RAVINE: "Deep narrow valley",
  LAGOON: "Coastal shallow water", BOULDER: "Large rounded rock",
  GRANITE: "Tough igneous rock", QUARTZ: "Common silica mineral",
  CRYSTAL: "Clear mineral formation", FOSSIL: "Ancient preserved remains",
  TORNADO: "Violent spinning storm", RAINBOW: "Arched colored spectrum",
  AURORA: "Northern lights display", SUNSET: "Evening twilight glow",
  SUNRISE: "Morning dawn", WILLOW: "Weeping tree species",
  CEDAR: "Fragrant evergreen tree", RIVER: "Flowing freshwater",
  STREAM: "Small water flow", OCEAN: "Vast salt water body",
  VALLEY: "Low land between hills", DESERT: "Arid sandy landscape",
  WATERFALL: "Cascading water drop", CAVERN: "Underground hollow",
  GEYSER: "Spouting hot spring", BLIZZARD: "Severe snowstorm",
  HURRICANE: "Tropical storm system", DROUGHT: "Long dry period",
  LIGHTNING: "Electric sky flash", REDWOOD: "Tallest tree species",
  LAVENDER: "Purple fragrant herb", PRAIRIE: "Flat open grassland",
  JUNGLE: "Dense tropical forest", SPRING: "Natural water source",
  CREEK: "Small waterway",
  CHRISTMAS: "December celebration", HALLOWEEN: "Spooky October holiday",
  CELEBRATE: "Mark a special occasion", FESTIVAL: "Community celebration",
  PARADE: "Moving street procession", ORNAMENT: "Tree decoration",
  WREATH: "Circular festive ring", CANDLE: "Wax flame light",
  PUMPKIN: "Orange Halloween gourd", HOLIDAY: "Special day off",
  CARNIVAL: "Colorful traveling fair", FAMILY: "Related group of people",
  GARLAND: "Festive hanging decoration", STOCKING: "Christmas sock",
  TINSEL: "Shiny holiday string", SNOWFLAKE: "Unique ice crystal",
  MENORAH: "Hanukkah candleholder", LANTERN: "Portable light holder",
  GRATITUDE: "Feeling of thankfulness", WARMTH: "Cozy comfortable feeling",
  BAGUETTE: "Long French bread", BURRITO: "Wrapped Mexican dish",
  SUSHI: "Japanese rice roll", RAMEN: "Japanese noodle soup",
  PIZZA: "Italian flatbread dish", BREAD: "Baked flour staple",
  MANGO: "Tropical sweet fruit", PAPAYA: "Orange tropical fruit",
  AVOCADO: "Creamy green fruit", TIRAMISU: "Italian coffee dessert",
  WAFFLE: "Grid-patterned cake", CREPE: "Thin French pancake",
  CHEDDAR: "Sharp yellow cheese", BRIE: "Soft French cheese",
  GOUDA: "Dutch round cheese", MOZZARELLA: "Classic pizza cheese",
  PARMESAN: "Hard Italian cheese", LASAGNA: "Layered pasta bake",
  RISOTTO: "Creamy Italian rice", PAELLA: "Spanish rice dish",
  CROISSANT: "Buttery curved pastry", ENCHILADA: "Rolled tortilla dish",
  EMPANADA: "Stuffed pastry turnover", TAMALE: "Corn dough wrap",
  HUMMUS: "Chickpea dip spread", FALAFEL: "Fried chickpea ball",
  SHAWARMA: "Rotisserie meat wrap", KEBAB: "Skewered grilled meat",
  BAKLAVA: "Honey nut pastry", TEMPURA: "Japanese fried dish",
  TERIYAKI: "Sweet soy glaze", DUMPLING: "Filled dough pouch",
  ECLAIR: "Cream-filled pastry", MACARON: "Colorful French cookie",
  MOUSSE: "Light airy dessert",
  BASKETBALL: "Hoop shooting team sport", VOLLEYBALL: "Net-and-ball team sport",
  MARATHON: "26 mile endurance race", ARCHERY: "Bow and arrow sport",
  FENCING: "Sword dueling sport", BOXING: "Padded fist fighting",
  SURFING: "Wave riding sport", TENNIS: "Racket net sport",
  HOCKEY: "Stick and puck sport", CRICKET: "Bat and wicket sport",
  SAILING: "Wind-powered boat sport", SWIMMING: "Aquatic racing sport",
  GYMNASTICS: "Acrobatic floor sport", BADMINTON: "Shuttlecock net sport",
  LACROSSE: "Stick and net sport", TRIATHLON: "Three-sport race",
  CYCLING: "Bicycle racing sport", JAVELIN: "Throwing spear event",
  DIVING: "Aerial water entry sport", KAYAKING: "Paddle water sport",
  ROWING: "Oar-powered boat sport", CURLING: "Ice and stone sport",
  JUDO: "Japanese throwing sport", KARATE: "Japanese striking art",
  TAEKWONDO: "Korean kicking art", CLIMBING: "Ascent rock sport",
  WEIGHTLIFTING: "Heavy barbell sport",
  PASSPORT: "Official travel document", ADVENTURE: "Exciting risky journey",
  JOURNEY: "Long travel trip", SAFARI: "African wildlife tour",
  AIRPORT: "Air travel hub", HOSTEL: "Budget traveler lodging",
  RESORT: "Luxury vacation stay", VILLA: "Vacation rental home",
  CULTURE: "People shared customs", LANDMARK: "Famous recognizable site",
  MONUMENT: "Memorial structure", TEMPLE: "Religious worship place",
  CASTLE: "Fortified medieval building", SOUVENIR: "Travel keepsake item",
  ITINERARY: "Trip schedule plan", EXPEDITION: "Organized exploration",
  VOYAGE: "Long sea journey", EXCURSION: "Short side trip",
  DEPARTURE: "Leaving point", ARRIVAL: "Reaching destination",
  CUSTOMS: "Border inspection process", CATHEDRAL: "Large Christian church",
  PALACE: "Royal residence", FORTRESS: "Military stronghold",
  BAZAAR: "Middle Eastern market", HERITAGE: "Cultural legacy",
  TRADITION: "Passed-down practice",
  EXPERIMENT: "Controlled scientific test", ANALYSIS: "Detailed examination",
  RESEARCH: "Systematic investigation", CHEMISTRY: "Study of matter",
  BIOLOGY: "Study of life", PHYSICS: "Study of forces",
  GEOLOGY: "Study of the earth", ASTRONOMY: "Study of stars",
  GRAVITY: "Force pulling things down", ENERGY: "Capacity to do work",
  MOLECULE: "Smallest chemical unit", ENZYME: "Biological catalyst",
  HYPOTHESIS: "Scientific educated guess", MICROSCOPE: "Tiny object viewer",
  TELESCOPE: "Distant object viewer", ELECTRON: "Negative atomic particle",
  CATALYST: "Speeds up a reaction", EVOLUTION: "Species change over time",
  VACCINE: "Disease prevention shot", BACTERIA: "Single-celled organisms",
  QUANTUM: "Smallest energy packet", MOMENTUM: "Mass times velocity",
  VELOCITY: "Speed with direction", FRICTION: "Resistance to motion",
  INERTIA: "Resistance to change",
  REVOLUTION: "Overthrow of government", EMPIRE: "Large ruled territory",
  DYNASTY: "Ruling family line", REPUBLIC: "Elected government system",
  PYRAMID: "Ancient Egyptian tomb", TREATY: "Signed peace agreement",
  CIVILIZATION: "Organized ancient society", PHARAOH: "Ancient Egyptian ruler",
  EMPEROR: "Supreme ruler of empire", ARTIFACT: "Historical object",
  MANUSCRIPT: "Ancient handwritten text", ARCHAEOLOGY: "Study of ancient remains",
  EQUATOR: "Earth middle latitude line", LATITUDE: "North-south position",
  LONGITUDE: "East-west position line", HEMISPHERE: "Half of a globe",
  CONTINENT: "Large land mass", PENINSULA: "Land surrounded by water",
  FJORD: "Narrow coastal inlet", ISTHMUS: "Narrow land bridge",
  AMAZON: "South American mighty river", HIMALAYAS: "World highest mountains",
  SAHARA: "World largest hot desert", PACIFIC: "Earth largest ocean",
  ATLANTIC: "Ocean between Americas and Europe",
  SYMPHONY: "Orchestral composition", CONCERTO: "Soloist with orchestra",
  HARMONY: "Combined musical tones", MELODY: "Main musical tune",
  RHYTHM: "Beat and timing pattern", ORCHESTRA: "Full instrumental group",
  SOPRANO: "Highest female vocal range", TENOR: "High male vocal range",
  BLUES: "Soulful American music style", JAZZ: "Improvised American music",
  CLARINET: "Woodwind reed instrument", TROMBONE: "Slide brass instrument",
  CRESCENDO: "Gradually getting louder",
  DIRECTOR: "Film scene controller", THRILLER: "Suspenseful film genre",
  MYSTERY: "Unknown puzzle film genre", DIALOGUE: "Character spoken words",
  MONTAGE: "Sequence of edited clips", NARRATIVE: "Story being told",
  CLIMAX: "Story highest tension point", SEQUEL: "Follow-up to a film",
  NEBULA: "Cosmic gas and dust cloud", GALAXY: "Billions of stars system",
  SUPERNOVA: "Exploding dying star", SATELLITE: "Object orbiting a planet",
  ASTRONAUT: "Space traveler", COMET: "Icy body with a tail",
  CONSTELLATION: "Named star pattern in sky", ASTEROID: "Rocky space body",
  SPACECRAFT: "Vehicle for space travel", ROVER: "Planet surface explorer",
};

function makeCrosswordClue(word: string): string {
  return CROSSWORD_CLUES[word] || `${word.length}-letter word`;
}

export function makeCrossword(words: string[], size: number): CrosswordResult {
  interface Slot { row: number; col: number; len: number; dir: "H" | "V" }
  type SlotGroup = [Slot] | [Slot, Slot];
  interface Intersection { a: number; posA: number; b: number; posB: number }

  const m = Math.floor(size / 2);
  const groups: SlotGroup[] = [];

  function addH(r: number, cStart: number, len: number) {
    if (cStart < 0 || cStart + len > size) return;
    const a: Slot = { row: r, col: cStart, len, dir: "H" };
    const mr = size - 1 - r;
    const mc = size - 1 - (cStart + len - 1);
    if (mr === r && mc === cStart) {
      groups.push([a]);
    } else {
      if (mc < 0 || mc + len > size || mr < 0 || mr >= size) return;
      groups.push([a, { row: mr, col: mc, len, dir: "H" }]);
    }
  }

  function addV(c: number, rStart: number, len: number) {
    if (rStart < 0 || rStart + len > size) return;
    const a: Slot = { row: rStart, col: c, len, dir: "V" };
    const mc = size - 1 - c;
    const mr = size - 1 - (rStart + len - 1);
    if (mc === c && mr === rStart) {
      groups.push([a]);
    } else {
      if (mr < 0 || mr + len > size || mc < 0 || mc >= size) return;
      groups.push([a, { row: mr, col: mc, len, dir: "V" }]);
    }
  }

  // Plus-cross topology: center H/V cross at center cell; arm pairs extend from
  // center lines only (arms never cross each other, only the center word).
  if (size >= 13) {
    addH(m, 2, size - 4);    // center-H singleton
    addV(m, 2, size - 4);    // center-V singleton
    addV(m - 3, m - 2, 5);  // arm-V pair (crosses center-H)
    addH(m - 3, m - 2, 5);  // arm-H pair (crosses center-V)
  } else {
    addH(m, 2, size - 4);   // center-H singleton
    addV(m, 2, size - 4);   // center-V singleton
    addV(m - 2, m - 2, 5);  // arm-V pair
    addH(m - 2, m - 2, 5);  // arm-H pair
  }

  // Flatten groups → indexed slots, track group membership
  const slots: Slot[] = [];
  const groupOf: number[] = [];  // slot index → group index
  const groupSlots: number[][] = []; // group index → [slot indices]
  for (let g = 0; g < groups.length; g++) {
    groupSlots.push([]);
    for (const s of groups[g]) {
      groupSlots[g].push(slots.length);
      groupOf.push(g);
      slots.push(s);
    }
  }

  const intersections: Intersection[] = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const si = slots[i], sj = slots[j];
      if (si.dir === sj.dir) continue;
      const h = si.dir === "H" ? si : sj;
      const v = si.dir === "H" ? sj : si;
      const hi = si.dir === "H" ? i : j;
      const vi = si.dir === "H" ? j : i;
      const posH = v.col - h.col;
      const posV = h.row - v.row;
      if (posH >= 0 && posH < h.len && posV >= 0 && posV < v.len) {
        intersections.push({ a: hi, posA: posH, b: vi, posB: posV });
      }
    }
  }

  const slotLens = new Set(slots.map(s => s.len));
  const pool = [...new Set(
    words.map(w => w.toUpperCase().replace(/[^A-Z]/g, ""))
         .filter(w => w.length >= 3 && slotLens.has(w.length))
  )];

  const assignment: (string | null)[] = Array(slots.length).fill(null);

  function letterOk(slotIdx: number, w: string): boolean {
    for (const ix of intersections) {
      let posInW = -1, otherIdx = -1, posInOther = -1;
      if (ix.a === slotIdx) { posInW = ix.posA; otherIdx = ix.b; posInOther = ix.posB; }
      else if (ix.b === slotIdx) { posInW = ix.posB; otherIdx = ix.a; posInOther = ix.posA; }
      else continue;
      const other = assignment[otherIdx];
      if (other !== null && other[posInOther] !== w[posInW]) return false;
    }
    return true;
  }

  function btGroups(gi: number, usedWords: Set<string>): boolean {
    if (gi === groups.length) return true;
    const gs = groupSlots[gi];
    const len = slots[gs[0]].len;
    // If no words of this length exist anywhere in the pool, skip unconditionally.
    const hasLen = pool.some(w => w.length === len);
    if (!hasLen) return btGroups(gi + 1, usedWords);

    if (gs.length === 1) {
      const idxA = gs[0];
      const cands = shuf(pool.filter(w => w.length === len && !usedWords.has(w)));
      for (const w of cands) {
        if (!letterOk(idxA, w)) continue;
        assignment[idxA] = w;
        usedWords.add(w);
        if (btGroups(gi + 1, usedWords)) return true;
        assignment[idxA] = null;
        usedWords.delete(w);
      }
    } else {
      const idxA = gs[0], idxB = gs[1];
      const candsA = shuf(pool.filter(w => w.length === len && !usedWords.has(w)));
      for (const wA of candsA) {
        if (!letterOk(idxA, wA)) continue;
        assignment[idxA] = wA;
        usedWords.add(wA);
        const candsB = shuf(pool.filter(w => w.length === len && !usedWords.has(w)));
        for (const wB of candsB) {
          if (!letterOk(idxB, wB)) continue;
          assignment[idxB] = wB;
          usedWords.add(wB);
          if (btGroups(gi + 1, usedWords)) return true;
          assignment[idxB] = null;
          usedWords.delete(wB);
        }
        assignment[idxA] = null;
        usedWords.delete(wA);
      }
    }

    // Group cannot be filled; skip (both slots stay '#', symmetry preserved).
    return btGroups(gi + 1, usedWords);
  }

  btGroups(0, new Set<string>());

  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill("#"));

  for (let i = 0; i < slots.length; i++) {
    const w = assignment[i];
    if (!w) continue;
    const s = slots[i];
    const dr = s.dir === "V" ? 1 : 0, dc = s.dir === "H" ? 1 : 0;
    for (let k = 0; k < w.length; k++) {
      grid[s.row + dr * k][s.col + dc * k] = w[k];
    }
  }

  const acrossList: CrosswordClue[] = [];
  const downList: CrosswordClue[] = [];
  const nums: Record<string, number> = {};
  let cellNum = 1;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === "#") continue;
      const isAcrossStart = (c === 0 || grid[r][c - 1] === "#") && c + 1 < size && grid[r][c + 1] !== "#";
      const isDownStart = (r === 0 || grid[r - 1][c] === "#") && r + 1 < size && grid[r + 1][c] !== "#";
      if (isAcrossStart || isDownStart) {
        nums[`${r},${c}`] = cellNum;
        if (isAcrossStart) {
          let answer = "", cc = c;
          while (cc < size && grid[r][cc] !== "#") { answer += grid[r][cc]; cc++; }
          if (answer.length >= 2)
            acrossList.push({ num: cellNum, clue: makeCrosswordClue(answer), answer, row: r, col: c, len: answer.length });
        }
        if (isDownStart) {
          let answer = "", rr = r;
          while (rr < size && grid[rr][c] !== "#") { answer += grid[rr][c]; rr++; }
          if (answer.length >= 2)
            downList.push({ num: cellNum, clue: makeCrosswordClue(answer), answer, row: r, col: c, len: answer.length });
        }
        cellNum++;
      }
    }
  }

  const MIN_CLUES = 2;
  if (acrossList.length < MIN_CLUES || downList.length < MIN_CLUES) {
    const empty: string[][] = Array.from({ length: size }, () => Array(size).fill("#"));
    return { grid: empty, across: [], down: [], size, nums: {} };
  }

  return { grid: grid as string[][], across: acrossList, down: downList, size, nums };
}

export const WORD_BANKS: Record<string, string[]> = {
  General: [
    "PUZZLE","SEARCH","WORDS","BRAIN","THINK","SOLVE","GAME","PLAY","FIND","HIDDEN",
    "LETTER","GRID","CLUE","ANSWER","MATCH","LEVEL","SCORE","BONUS","TIMER","CHALLENGE",
    "FOCUS","RELAX","SHARP","MIND","LOGIC","QUEST","LEARN","SKILL","REASON","PATTERN",
    "RIDDLE","CIPHER","DECODE","WISDOM","CLEVER","BRIGHT","SMART","THINK","MASTER","POWER",
    "SWIFT","NIMBLE","QUICK","READY","SOLVE","ENJOY","LEISURE","PASTIME","FUN","HOBBY",
    "MENTAL","AGILE","ALERT","SAVVY","AWARE","KEEN","PROBE","TRACE","HUNT","DISCOVER",
    "REVEAL","UNLOCK","DECODE","GRASP","RECALL","RETAIN","REVIEW","STUDY","PRACTICE","IMPROVE",
    "EFFORT","DEDUCE","REASON","FIGURE","DETAIL","NOTICE","OBSERVE","EXPLORE","EXAMINE","REFLECT",
  ],
  Animals: [
    "ELEPHANT","GIRAFFE","PENGUIN","DOLPHIN","CHEETAH","GORILLA","PANTHER","LEOPARD","JAGUAR","BUFFALO",
    "ANTELOPE","FLAMINGO","PLATYPUS","KANGAROO","MONGOOSE","CROCODILE","CHAMELEON","PORCUPINE","ARMADILLO","WOLVERINE",
    "HEDGEHOG","REINDEER","STALLION","PEACOCK","PELICAN","MACAW","TOUCAN","OSTRICH","FALCON","CONDOR",
    "SEAHORSE","OCTOPUS","LOBSTER","MANATEE","WALRUS","NARWHAL","OTTER","BEAVER","BADGER","WEASEL",
    "CHIPMUNK","SQUIRREL","HAMSTER","RABBIT","FERRET","LEMUR","SLOTH","TAPIR","CAPYBARA","OCELOT",
    "CARACAL","SERVAL","LYNX","COUGAR","PUMA","COYOTE","DINGO","HYENA","JACKAL","MEERKAT",
    "GAZELLE","IMPALA","ZEBRA","BISON","MOOSE","CARIBOU","PRONGHORN","IBEX","MARMOT","VOLE",
  ],
  Nature: [
    "MOUNTAIN","FOREST","WATERFALL","MEADOW","CANYON","GLACIER","VOLCANO","TUNDRA","SAVANNA","WETLAND",
    "PENINSULA","ARCHIPELAGO","PLATEAU","RAVINE","LAGOON","ESTUARY","DELTA","FJORD","GEYSER","CAVERN",
    "BOULDER","GRANITE","LIMESTONE","SANDSTONE","OBSIDIAN","QUARTZ","CRYSTAL","MINERAL","FOSSIL","GEODE",
    "RAINFALL","SNOWFALL","BLIZZARD","TORNADO","HURRICANE","CYCLONE","MONSOON","DROUGHT","THUNDER","LIGHTNING",
    "SUNRISE","SUNSET","RAINBOW","AURORA","TWILIGHT","SOLSTICE","EQUINOX","HORIZON","ZENITH","MERIDIAN",
    "WILLOW","CEDAR","REDWOOD","CYPRESS","MAGNOLIA","JASMINE","LAVENDER","CLOVER","FERN","MOSS",
    "RIVER","STREAM","BROOK","CREEK","SPRING","OCEAN","VALLEY","PRAIRIE","JUNGLE","DESERT",
  ],
  Holiday: [
    "CHRISTMAS","THANKSGIVING","HANUKKAH","KWANZAA","HALLOWEEN","VALENTINE","EASTER","PASSOVER","DIWALI","RAMADAN",
    "CELEBRATE","TRADITION","FESTIVAL","GATHERING","REUNION","PARADE","FIREWORKS","DECORATION","ORNAMENT","GARLAND",
    "WREATH","STOCKING","MISTLETOE","TINSEL","SNOWFLAKE","CANDLE","MENORAH","LANTERN","PUMPKIN","SCARECROW",
    "COSTUME","MASQUERADE","CARNIVAL","FIESTA","HOLIDAY","VACATION","RETREAT","PILGRIMAGE","CEREMONY","TRIBUTE",
    "FEASTING","BANQUET","STUFFING","PUMPKIN","GRAVY","CRANBERRY","MINCEMEAT","FIGGY","PUDDING","WASSAIL",
    "PRESENTS","GIFTING","WRAPPING","RIBBON","TINSEL","REINDEER","SLEIGH","CAROLING","CONCERT","BLESSING",
    "GRATITUDE","KINDNESS","GIVING","CHARITY","FELLOWSHIP","UNITY","FAMILY","MEMORIES","WARMTH","CHEERS",
  ],
  Food: [
    "SPAGHETTI","LASAGNA","RISOTTO","PAELLA","RATATOUILLE","CROISSANT","BAGUETTE","SOURDOUGH","FOCACCIA","CIABATTA",
    "BURRITO","ENCHILADA","TAQUITO","QUESADILLA","EMPANADA","TAMALE","CEVICHE","GAZPACHO","MINESTRONE","BISQUE",
    "SUSHI","TEMPURA","TERIYAKI","EDAMAME","MISO","RAMEN","UDON","SASHIMI","DUMPLING","WONTONS",
    "HUMMUS","FALAFEL","SHAWARMA","TABOULEH","PITA","KEBAB","BAKLAVA","HALVAH","FATTOUSH","TZATZIKI",
    "CHEDDAR","BRIE","CAMEMBERT","GOUDA","MOZZARELLA","PARMESAN","PROVOLONE","RICOTTA","MASCARPONE","GRUYERE",
    "AVOCADO","MANGO","PAPAYA","POMELO","GUAVA","PASSION","LYCHEE","JACKFRUIT","DRAGONFRUIT","STARFRUIT",
    "TIRAMISU","MACARON","ECLAIR","PROFITEROLE","CREPE","WAFFLE","SOUFFLE","MOUSSE","GANACHE","PRALINE",
  ],
  Sports: [
    "BASKETBALL","VOLLEYBALL","BADMINTON","LACROSSE","HANDBALL","BASEBALL","FOOTBALL","SWIMMING","GYMNASTICS","WRESTLING",
    "MARATHON","TRIATHLON","DECATHLON","PENTATHLON","HEPTATHLON","BIATHLON","BOBSLED","LUGE","SKELETON","CURLING",
    "ARCHERY","FENCING","JUDO","KARATE","TAEKWONDO","BOXING","WRESTLING","WEIGHTLIFTING","ROWING","KAYAKING",
    "CYCLING","SPRINTING","HURDLES","JAVELIN","DISCUS","HAMMER","SHOTPUT","POLEVAULT","LONGJUMP","HIGHJUMP",
    "SURFING","SKATEBOARDING","SNOWBOARD","ALPINE","SLALOM","MOGULS","FREESTYLE","BOBSLEIGH","ICESKATING","HOCKEY",
    "CRICKET","SQUASH","RACQUETBALL","PICKLEBALL","TENNIS","CROQUET","POLO","DRESSAGE","SHOWJUMPING","EVENTING",
    "SAILING","WINDSURFING","KITEBOARD","WATERPOLO","DIVING","SNORKELING","SYNCHRONIZED","CANOEING","RAFTING","CLIMBING",
  ],
  Travel: [
    "PASSPORT","ITINERARY","DESTINATION","ADVENTURE","EXPEDITION","JOURNEY","VOYAGE","PILGRIMAGE","EXCURSION","SAFARI",
    "BACKPACKING","SIGHTSEEING","WANDERING","EXPLORING","DISCOVERING","TOURING","CRUISING","TREKKING","SOJOURNING","ROAMING",
    "AIRPORT","TERMINAL","DEPARTURE","ARRIVAL","BOARDING","CUSTOMS","IMMIGRATION","QUARANTINE","LAYOVER","TRANSIT",
    "HOSTEL","BOUTIQUE","RESORT","CHALET","VILLA","PENSION","RYOKAN","HACIENDA","RIAD","GLAMPING",
    "SOUVENIR","MEMENTO","KEEPSAKE","POSTCARD","SNAPSHOT","JOURNAL","GUIDEBOOK","BROCHURE","PAMPHLET","ATLAS",
    "CULTURE","CUISINE","LANGUAGE","CUSTOMS","HERITAGE","TRADITION","FOLKLORE","HISTORY","ARCHITECTURE","ARTISTRY",
    "LANDMARK","MONUMENT","CATHEDRAL","TEMPLE","PALACE","CASTLE","FORTRESS","BAZAAR","MARKET","PIAZZA",
  ],
  Science: [
    "HYPOTHESIS","EXPERIMENT","OBSERVATION","DISCOVERY","INNOVATION","ANALYSIS","RESEARCH","LABORATORY","MICROSCOPE","TELESCOPE",
    "CHEMISTRY","BIOLOGY","PHYSICS","GEOLOGY","ASTRONOMY","ECOLOGY","GENETICS","BOTANY","ZOOLOGY","ANATOMY",
    "ELECTRON","PROTON","NEUTRON","PHOTON","QUARK","LEPTON","BOSON","FERMION","NEUTRINO","POSITRON",
    "MOLECULE","COMPOUND","ELEMENT","ISOTOPE","CATALYST","REACTION","SOLUTION","MIXTURE","POLYMER","ENZYME",
    "EVOLUTION","ADAPTATION","MUTATION","SELECTION","SPECIATION","TAXONOMY","BIODIVERSITY","ECOSYSTEM","BIOME","HABITAT",
    "GRAVITY","MOMENTUM","VELOCITY","ACCELERATION","FRICTION","INERTIA","ENERGY","MATTER","ENTROPY","QUANTUM",
    "VACCINE","ANTIBODY","ANTIGEN","PATHOGEN","BACTERIA","VIRUS","FUNGUS","PARASITE","PROBIOTIC","MICROBIOME",
  ],
  History: [
    "CIVILIZATION","REVOLUTION","EMPIRE","DYNASTY","REPUBLIC","MONARCHY","DEMOCRACY","FEUDALISM","COLONIALISM","RENAISSANCE",
    "PHARAOH","EMPEROR","PHARAOH","SULTAN","MAHARAJA","TSAR","KAISER","REGENT","CHANCELLOR","MAGISTRATE",
    "PYRAMID","COLOSSEUM","PARTHENON","PANTHEON","ACROPOLIS","STONEHENGE","SPHINX","ZIGGURAT","PANTHEON","AGORA",
    "CRUSADES","REFORMATION","ENLIGHTENMENT","INQUISITION","INDUSTRIAL","PROGRESSIVE","SUFFRAGE","ABOLITION","EMANCIPATION","RECONSTRUCTION",
    "TREATY","ARMISTICE","SURRENDER","CONQUEST","LIBERATION","OCCUPATION","RESISTANCE","UPRISING","REBELLION","MUTINY",
    "ARTIFACT","RELIC","MONUMENT","ARCHIVE","CHRONICLE","MANUSCRIPT","PAPYRUS","HIEROGLYPH","CUNEIFORM","INSCRIPTION",
    "ARCHAEOLOGY","EXCAVATION","STRATIGRAPHY","CARTOGRAPHY","HISTORIOGRAPHY","ANTHROPOLOGY","NUMISMATIC","HERALDRY","GENEALOGY","PALEOGRAPHY",
  ],
  Geography: [
    "EQUATOR","LATITUDE","LONGITUDE","HEMISPHERE","MERIDIAN","TROPICS","ARCTIC","ANTARCTIC","CONTINENT","OCEAN",
    "PENINSULA","ARCHIPELAGO","ISTHMUS","STRAIT","FJORD","ESTUARY","WATERSHED","CANYON","PLATEAU","ESCARPMENT",
    "AMAZON","NILE","YANGTZE","MISSISSIPPI","CONGO","DANUBE","GANGES","MEKONG","EUPHRATES","TIGRIS",
    "HIMALAYAS","ANDES","ROCKIES","ALPS","PYRENEES","URALS","CAUCASUS","APPALACHIAN","ATLAS","DRAKENSBERG",
    "SAHARA","GOBI","MOJAVE","ATACAMA","NAMIB","SONORAN","PATAGONIA","TUNDRA","SAVANNA","STEPPE",
    "AMAZON","BORNEO","SUMATRA","MADAGASCAR","GREENLAND","BAFFIN","VICTORIA","HONSHU","BRITAIN","IRELAND",
    "PACIFIC","ATLANTIC","INDIAN","ARCTIC","SOUTHERN","CARIBBEAN","MEDITERRANEAN","CASPIAN","BERING","CORAL",
  ],
  Music: [
    "SYMPHONY","CONCERTO","SONATA","OVERTURE","NOCTURNE","RHAPSODY","PRELUDE","FUGUE","SERENADE","CANTATA",
    "ORCHESTRA","ENSEMBLE","QUARTET","QUINTET","OCTET","PHILHARMONIC","CHAMBER","BAROQUE","CLASSICAL","ROMANTIC",
    "CLARINET","OBOE","BASSOON","TROMBONE","EUPHONIUM","XYLOPHONE","MARIMBA","VIBRAPHONE","THEREMIN","HARPSICHORD",
    "HARMONY","MELODY","RHYTHM","TEMPO","DYNAMICS","TIMBRE","REGISTER","CADENCE","RESONANCE","VIBRATO",
    "SOPRANO","MEZZO","CONTRALTO","TENOR","BARITONE","BASS","FALSETTO","CASTRATO","CHOIR","CHORUS",
    "IMPROVISE","COMPOSE","CONDUCT","PERFORM","REHEARSE","TRANSPOSE","MODULATE","SYNCOPATE","CRESCENDO","DIMINUENDO",
    "BLUES","JAZZ","REGGAE","SALSA","FLAMENCO","TANGO","BOLERO","SAMBA","CUMBIA","MERENGUE",
  ],
  Movies: [
    "SCREENPLAY","DIRECTOR","PRODUCER","CINEMATOGRAPHY","CHOREOGRAPHY","ANIMATION","DOCUMENTARY","THRILLER","ADVENTURE","MYSTERY",
    "PROTAGONIST","ANTAGONIST","CHARACTER","NARRATIVE","DIALOGUE","MONOLOGUE","SOLILOQUY","SUBPLOT","FLASHBACK","FORESHADOW",
    "LIGHTING","CONTRAST","SATURATION","COMPOSITION","FRAMING","CLOSEUP","PANORAMA","MONTAGE","DISSOLVE","CUTAWAY",
    "SOUNDTRACK","SCORE","FOLEY","DUBBING","SUBTITLES","OVERDUB","VOICEOVER","NARRATION","DIEGETIC","ORCHESTRATION",
    "STORYBOARD","SCREENPLAY","TREATMENT","SYNOPSIS","LOGLINE","PREMISE","CONFLICT","RESOLUTION","CLIMAX","DENOUEMENT",
    "PREMIERE","FESTIVAL","SCREENING","SEQUEL","PREQUEL","FRANCHISE","BLOCKBUSTER","INDEPENDENT","ARTHOUSE","FOREIGN",
    "ACADEMY","CANNES","SUNDANCE","TRIBECA","VENICE","TORONTO","BERLIN","BAFTA","GOLDEN","SATELLITE",
  ],
  Space: [
    "NEBULA","GALAXY","CONSTELLATION","SUPERNOVA","PULSAR","QUASAR","MAGNETAR","ASTEROID","METEORITE","COMET",
    "TELESCOPE","OBSERVATORY","SATELLITE","SPACECRAFT","CAPSULE","ORBITER","LANDER","ROVER","PROBE","SHUTTLE",
    "ASTRONAUT","COSMONAUT","TAIKONAUT","SPACEWALK","EXTRAVEHICULAR","MICROGRAVITY","WEIGHTLESS","RADIATION","ATMOSPHERE","EXOSPHERE",
    "HYDROGEN","HELIUM","OXYGEN","NITROGEN","CARBON","SILICON","IRON","NICKEL","SULFUR","PHOSPHORUS",
    "SOLSTICE","EQUINOX","APHELION","PERIHELION","APOGEE","PERIGEE","ECLIPTIC","PRECESSION","NUTATION","LIBRATION",
    "EUROPA","TITAN","GANYMEDE","CALLISTO","IO","TRITON","CHARON","OBERON","TITANIA","MIRANDA",
    "MILKYWAY","ANDROMEDA","TRIANGULUM","WHIRLPOOL","SOMBRERO","PINWHEEL","CARTWHEEL","CENTAURUS","FORNAX","SCULPTOR",
  ],
};

export const WORD_CATEGORY_KEYS = Object.keys(WORD_BANKS);

export const DEFWORDS = WORD_BANKS.General;
