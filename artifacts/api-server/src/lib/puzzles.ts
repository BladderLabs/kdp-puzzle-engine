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

/**
 * Tiny seeded LCG PRNG — deterministic, unique per (bookSeed, puzzleIndex).
 * Returns integers in [0, 2^32).
 */
function makeLcg(seed: number) {
  let state = ((seed >>> 0) === 0 ? 1 : seed >>> 0);
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
}

export function makeNumberSearch(size: number, wordBank?: string[], puzzleIndex = 0, bookSeed = 0): NumberSearchResult {
  // Deterministic PRNG seeded by (bookSeed XOR (puzzleIndex * 2654435769))
  const seed = (bookSeed ^ (puzzleIndex * 2654435769)) >>> 0;
  const rng = makeLcg(seed);

  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(""));
  const DIRS: [number, number][] = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  const placed: string[] = [];
  const pSet: Record<string, boolean> = {};

  // Generate 20 unique non-repeating 5-digit hidden numbers using the seeded PRNG.
  // Each number is unique within the puzzle. Different (bookSeed, puzzleIndex) pairs
  // produce entirely different sets with no fixed-pool cycling.
  const sequences: string[] = [];
  const usedNums = new Set<string>();
  while (sequences.length < 20) {
    const n = String(10000 + (rng() % 90000));
    if (!usedNums.has(n)) {
      usedNums.add(n);
      sequences.push(n);
    }
  }

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
  { text: "MY SUCCESS CAME FROM LISTENING TO GOOD ADVICE THEN DOING THE OPPOSITE", author: "G. K. Chesterton" },
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
  // ─── Extended bank: inspirational ───────────────────────────────────────────
  { text: "ACT AS IF WHAT YOU DO MAKES A DIFFERENCE IT DOES", author: "William James" },
  { text: "SUCCESS IS NOT HOW HIGH YOU HAVE CLIMBED BUT HOW YOU MAKE A POSITIVE DIFFERENCE", author: "Roy T. Bennett" },
  { text: "WHEN EVERYTHING SEEMS TO BE GOING AGAINST YOU REMEMBER THAT THE AIRPLANE TAKES OFF AGAINST THE WIND", author: "Henry Ford" },
  { text: "IT IS DURING OUR DARKEST MOMENTS THAT WE MUST FOCUS TO SEE THE LIGHT", author: "Aristotle" },
  { text: "DO NOT PRAY FOR AN EASY LIFE PRAY FOR THE STRENGTH TO ENDURE A DIFFICULT ONE", author: "Bruce Lee" },
  { text: "THE ONLY PERSON YOU ARE DESTINED TO BECOME IS THE PERSON YOU DECIDE TO BE", author: "Ralph Waldo Emerson" },
  { text: "GO CONFIDENTLY IN THE DIRECTION OF YOUR DREAMS LIVE THE LIFE YOU HAVE IMAGINED", author: "Henry David Thoreau" },
  { text: "WHEN YOU HAVE A DREAM YOU HAVE GOT TO GRAB IT AND NEVER LET GO", author: "Carol Burnett" },
  { text: "NO MATTER WHAT PEOPLE TELL YOU WORDS AND IDEAS CAN CHANGE THE WORLD", author: "Robin Williams" },
  { text: "COURAGE IS WHAT IT TAKES TO STAND UP AND SPEAK COURAGE IS ALSO WHAT IT TAKES TO SIT DOWN AND LISTEN", author: "Winston Churchill" },
  { text: "IT IS NOT THE STRONGEST OF THE SPECIES THAT SURVIVES NOR THE MOST INTELLIGENT BUT THE ONE MOST ADAPTABLE TO CHANGE", author: "Charles Darwin" },
  { text: "WE NEED TO ACCEPT THAT WE WILL NOT ALWAYS MAKE THE RIGHT DECISIONS THAT WE WILL MESS UP ROYALLY SOMETIMES", author: "Brene Brown" },
  { text: "EVERY STRIKE BRINGS ME CLOSER TO THE NEXT HOME RUN", author: "Babe Ruth" },
  { text: "WE MAY ENCOUNTER MANY DEFEATS BUT WE MUST NOT BE DEFEATED", author: "Maya Angelou" },
  { text: "NEVER BEND YOUR HEAD ALWAYS HOLD IT HIGH LOOK THE WORLD STRAIGHT IN THE FACE", author: "Helen Keller" },
  { text: "GOOD BETTER BEST NEVER LET IT REST UNTIL YOUR GOOD IS BETTER AND YOUR BETTER IS YOUR BEST", author: "Tim Duncan" },
  { text: "BE YOURSELF EVERYONE ELSE IS ALREADY TAKEN", author: "Oscar Wilde" },
  { text: "EVERY DAY MAY NOT BE GOOD BUT THERE IS SOMETHING GOOD IN EVERY DAY", author: "Alice Morse Earle" },
  { text: "YOU MUST BE THE CHANGE YOU WISH TO SEE IN THE WORLD", author: "Mahatma Gandhi" },
  { text: "STRENGTH DOES NOT COME FROM PHYSICAL CAPACITY IT COMES FROM AN INDOMITABLE WILL", author: "Mahatma Gandhi" },
  { text: "DOUBT WHOM YOU WILL BUT NEVER YOURSELF", author: "Christian Nestell Bovee" },
  { text: "LIFE IS TEN PERCENT WHAT HAPPENS TO YOU AND NINETY PERCENT HOW YOU RESPOND TO IT", author: "Lou Holtz" },
  { text: "WHEREVER YOU ARE AND WHATEVER YOU DO BE IN LOVE", author: "Rumi" },
  { text: "THERE IS NO GREATER AGONY THAN BEARING AN UNTOLD STORY INSIDE YOU", author: "Maya Angelou" },
  { text: "DO NOT COUNT THE DAYS MAKE THE DAYS COUNT", author: "Muhammad Ali" },
  { text: "THERE ARE NO SECRETS TO SUCCESS IT IS THE RESULT OF PREPARATION HARD WORK AND LEARNING FROM FAILURE", author: "Colin Powell" },
  { text: "GREAT SPIRITS HAVE ALWAYS ENCOUNTERED VIOLENT OPPOSITION FROM MEDIOCRE MINDS", author: "Albert Einstein" },
  { text: "ONLY THOSE WHO WILL RISK GOING TOO FAR CAN POSSIBLY FIND OUT HOW FAR ONE CAN GO", author: "T.S. Eliot" },
  { text: "IMPOSSIBLE IS JUST AN OPINION", author: "Paulo Coelho" },
  { text: "NEVER GIVE UP FOR THAT IS JUST THE PLACE AND TIME THAT THE TIDE WILL TURN", author: "Harriet Beecher Stowe" },
  { text: "THE SECRET OF CHANGE IS TO FOCUS ALL OF YOUR ENERGY NOT ON FIGHTING THE OLD BUT ON BUILDING THE NEW", author: "Socrates" },
  { text: "IF YOU HAVE GOOD THOUGHTS THEY WILL SHINE OUT OF YOUR FACE LIKE SUNBEAMS AND YOU WILL ALWAYS LOOK LOVELY", author: "Roald Dahl" },
  { text: "THERE IS NOTHING IMPOSSIBLE TO THEY WHO WILL TRY", author: "Alexander the Great" },
  { text: "THE BAD NEWS IS TIME FLIES THE GOOD NEWS IS YOU ARE THE PILOT", author: "Michael Altshuler" },
  { text: "I HAVE NOT FAILED I HAVE FOUND TEN THOUSAND WAYS THAT WILL NOT WORK", author: "Thomas Edison" },
  { text: "BE YOURSELF NO MATTER WHAT SOME PEOPLE WILL LIKE YOU AND SOME WILL NOT AND THAT IS ALL RIGHT", author: "Bill Cosby" },
  { text: "MOTIVATION IS WHAT GETS YOU STARTED HABIT IS WHAT KEEPS YOU GOING", author: "Jim Ryun" },
  { text: "GOOD THINGS COME TO PEOPLE WHO WAIT BUT BETTER THINGS COME TO THOSE WHO GO OUT AND GET THEM", author: "Anonymous" },
  { text: "THE FIRST STEP IS YOU HAVE TO SAY THAT YOU CAN", author: "Will Smith" },
  { text: "ONE WAY TO KEEP MOMENTUM GOING IS TO HAVE CONSTANTLY GREATER GOALS", author: "Michael Korda" },
  { text: "OPTIMISM IS THE FAITH THAT LEADS TO ACHIEVEMENT NOTHING CAN BE DONE WITHOUT HOPE AND CONFIDENCE", author: "Helen Keller" },
  { text: "TO WIN WITHOUT RISK IS TO TRIUMPH WITHOUT GLORY", author: "Pierre Corneille" },
  { text: "WE CANNOT SOLVE PROBLEMS WITH THE KIND OF THINKING WE EMPLOYED WHEN WE CAME UP WITH THEM", author: "Albert Einstein" },
  { text: "HAPPINESS DEPENDS UPON OURSELVES", author: "Aristotle" },
  { text: "BE NICE TO PEOPLE ON YOUR WAY UP BECAUSE YOU MEET THEM ON YOUR WAY DOWN", author: "Jimmy Durante" },
  { text: "A GOAL IS A DREAM WITH A DEADLINE", author: "Napoleon Hill" },
  { text: "START WHERE YOU ARE USE WHAT YOU HAVE DO WHAT YOU CAN", author: "Arthur Ashe" },
  { text: "DO WHAT YOU CAN WITH ALL YOU HAVE WHEREVER YOU ARE", author: "Theodore Roosevelt" },
  { text: "I CANNOT GIVE YOU THE FORMULA FOR SUCCESS BUT I CAN GIVE YOU THE FORMULA FOR FAILURE IT IS TRY TO PLEASE EVERYBODY", author: "Herbert Bayard Swope" },
  { text: "SUCCESS IS STUMBLING FROM FAILURE TO FAILURE WITH NO LOSS OF ENTHUSIASM", author: "Winston Churchill" },
  { text: "PEACE BEGINS WITH A SMILE", author: "Mother Teresa" },
  { text: "SUCCESS IS WALKING FROM FAILURE TO FAILURE WITH NO LOSS OF ENTHUSIASM", author: "Winston Churchill" },
  { text: "EVERY MOMENT IS A FRESH BEGINNING", author: "T.S. Eliot" },
  { text: "WHAT WE ACHIEVE INWARDLY WILL CHANGE OUTER REALITY", author: "Plutarch" },
  { text: "HAPPY ARE THOSE WHO DREAM DREAMS AND ARE READY TO PAY THE PRICE TO MAKE THEM COME TRUE", author: "Leon J. Suenens" },
  { text: "WHEREVER YOU GO GO WITH ALL YOUR HEART", author: "Confucius" },
  { text: "THE WAY I SEE IT IF YOU WANT THE RAINBOW YOU HAVE TO PUT UP WITH THE RAIN", author: "Dolly Parton" },
  { text: "CLARITY AFFORDS FOCUS", author: "Thomas Leonard" },
  { text: "IT DOES NOT MATTER HOW MANY TIMES YOU GET KNOCKED DOWN BUT HOW MANY TIMES YOU GET UP", author: "Vince Lombardi" },
  { text: "THE MIND IS EVERYTHING WHAT YOU THINK YOU BECOME", author: "Buddha" },
  { text: "THE ONLY PLACE WHERE DREAMS BECOME IMPOSSIBLE IS IN YOUR OWN THINKING", author: "Robert H. Schuller" },
  // ─── Wisdom & philosophy ────────────────────────────────────────────────────
  { text: "THE JOURNEY OF A THOUSAND MILES BEGINS WITH ONE STEP", author: "Lao Tzu" },
  { text: "KNOWING OTHERS IS WISDOM KNOWING YOURSELF IS ENLIGHTENMENT", author: "Lao Tzu" },
  { text: "HEALTH IS THE GREATEST POSSESSION CONTENTMENT IS THE GREATEST TREASURE CONFIDENCE IS THE GREATEST FRIEND", author: "Lao Tzu" },
  { text: "LIFE IS A SUCCESSION OF LESSONS WHICH MUST BE LIVED TO BE UNDERSTOOD", author: "Helen Keller" },
  { text: "TRUTH IS EVER TO BE FOUND IN THE SIMPLICITY AND NOT IN THE MULTIPLICITY AND CONFUSION OF THINGS", author: "Isaac Newton" },
  { text: "IT IS BETTER TO DESERVE HONORS AND NOT HAVE THEM THAN TO HAVE THEM AND NOT DESERVE THEM", author: "Mark Twain" },
  { text: "THE AIM OF ART IS TO REPRESENT NOT THE OUTWARD APPEARANCE OF THINGS BUT THEIR INWARD SIGNIFICANCE", author: "Aristotle" },
  { text: "TIME IS THE MOST VALUABLE THING A MAN CAN SPEND", author: "Theophrastus" },
  { text: "BY THREE METHODS WE MAY LEARN WISDOM REFLECTION IMITATION AND EXPERIENCE", author: "Confucius" },
  { text: "THE SUPERIOR MAN IS SATISFIED AND COMPOSED THE MEAN MAN IS ALWAYS FULL OF DISTRESS", author: "Confucius" },
  { text: "REAL KNOWLEDGE IS TO KNOW THE EXTENT OF ONE S IGNORANCE", author: "Confucius" },
  { text: "WHERESOEVER YOU GO GO WITH ALL YOUR HEART", author: "Confucius" },
  { text: "THE WISEST THING WHEN FACED WITH OPPOSITION IS TO REMAIN SILENT AND LET THE TRUTH SPEAK FOR ITSELF", author: "Marcus Aurelius" },
  { text: "YOU HAVE POWER OVER YOUR MIND NOT OUTSIDE EVENTS REALIZE THIS AND YOU WILL FIND STRENGTH", author: "Marcus Aurelius" },
  { text: "THE HAPPINESS OF YOUR LIFE DEPENDS UPON THE QUALITY OF YOUR THOUGHTS", author: "Marcus Aurelius" },
  { text: "VERY LITTLE IS NEEDED TO MAKE A HAPPY LIFE IT IS ALL WITHIN YOURSELF IN YOUR WAY OF THINKING", author: "Marcus Aurelius" },
  { text: "ACCEPT THE THINGS TO WHICH FATE BINDS YOU AND LOVE THE PEOPLE WITH WHOM FATE BRINGS YOU TOGETHER", author: "Marcus Aurelius" },
  { text: "WASTE NO MORE TIME ARGUING ABOUT WHAT A GOOD MAN SHOULD BE BE ONE", author: "Marcus Aurelius" },
  { text: "IF IT IS NOT RIGHT DO NOT DO IT IF IT IS NOT TRUE DO NOT SAY IT", author: "Marcus Aurelius" },
  { text: "WE SUFFER MORE IN IMAGINATION THAN IN REALITY", author: "Seneca" },
  { text: "IT IS NOT THAT I AM SO SMART BUT THAT I STAY WITH PROBLEMS LONGER", author: "Albert Einstein" },
  { text: "IMAGINATION IS MORE IMPORTANT THAN KNOWLEDGE KNOWLEDGE IS LIMITED IMAGINATION ENCIRCLES THE WORLD", author: "Albert Einstein" },
  { text: "TWO THINGS ARE INFINITE THE UNIVERSE AND HUMAN STUPIDITY AND I AM NOT SURE ABOUT THE UNIVERSE", author: "Albert Einstein" },
  { text: "LIFE IS LIKE RIDING A BICYCLE TO KEEP YOUR BALANCE YOU MUST KEEP MOVING", author: "Albert Einstein" },
  // ─── Nature & outdoors ──────────────────────────────────────────────────────
  { text: "IN EVERY WALK WITH NATURE ONE RECEIVES FAR MORE THAN HE SEEKS", author: "John Muir" },
  { text: "THE MOUNTAINS ARE CALLING AND I MUST GO", author: "John Muir" },
  { text: "LOOK DEEP INTO NATURE AND THEN YOU WILL UNDERSTAND EVERYTHING BETTER", author: "Albert Einstein" },
  { text: "ADOPT THE PACE OF NATURE HER SECRET IS PATIENCE", author: "Ralph Waldo Emerson" },
  { text: "NATURE DOES NOT HURRY YET EVERYTHING IS ACCOMPLISHED", author: "Lao Tzu" },
  { text: "THE CLEAREST WAY INTO THE UNIVERSE IS THROUGH A FOREST WILDERNESS", author: "John Muir" },
  { text: "WE DO NOT INHERIT THE EARTH FROM OUR ANCESTORS WE BORROW IT FROM OUR CHILDREN", author: "Native American Proverb" },
  { text: "ONE TOUCH OF NATURE MAKES THE WHOLE WORLD KIN", author: "William Shakespeare" },
  { text: "NOTHING IS LOST EVERYTHING IS TRANSFORMED", author: "Antoine Lavoisier" },
  { text: "THE SUN DOES NOT SHINE FOR A FEW TREES AND FLOWERS BUT FOR THE WIDE WORLD S JOY", author: "Henry Ward Beecher" },
  { text: "KEEP YOUR LOVE OF NATURE FOR THAT IS THE TRUE WAY TO UNDERSTAND ART MORE AND MORE", author: "Vincent van Gogh" },
  { text: "SPRING IS NATURE S WAY OF SAYING LETS PARTY", author: "Robin Williams" },
  // ─── Humor & wit ────────────────────────────────────────────────────────────
  { text: "I CHOOSE A LAZY PERSON TO DO A HARD JOB BECAUSE A LAZY PERSON WILL FIND AN EASY WAY TO DO IT", author: "Bill Gates" },
  { text: "I HAVE HAD A PERFECTLY WONDERFUL EVENING BUT THIS WAS NOT IT", author: "Groucho Marx" },
  { text: "BEHIND EVERY GREAT MAN IS A WOMAN ROLLING HER EYES", author: "Jim Carrey" },
  { text: "IF YOU THINK YOU ARE TOO SMALL TO MAKE A DIFFERENCE TRY SLEEPING WITH A MOSQUITO", author: "Dalai Lama" },
  { text: "THE TROUBLE WITH HAVING AN OPEN MIND OF COURSE IS THAT PEOPLE WILL INSIST ON COMING ALONG AND TRYING TO PUT THINGS IN IT", author: "Terry Pratchett" },
  { text: "AGE IS AN ISSUE OF MIND OVER MATTER IF YOU DO NOT MIND IT DOES NOT MATTER", author: "Mark Twain" },
  { text: "WINE IS BOTTLED POETRY", author: "Robert Louis Stevenson" },
  { text: "I ALWAYS WANTED TO BE SOMEBODY BUT NOW I REALIZE I SHOULD HAVE BEEN MORE SPECIFIC", author: "Lily Tomlin" },
  { text: "A DAY WITHOUT SUNSHINE IS LIKE YOU KNOW NIGHT", author: "Steve Martin" },
  { text: "CHANGE IS NOT A FOUR LETTER WORD BUT OFTEN YOUR REACTION TO IT IS", author: "Jeffrey Gitomer" },
  { text: "THE ONLY MYSTERY IN LIFE IS WHY THE KAMIKAZE PILOTS WORE HELMETS", author: "Al McGuire" },
  { text: "PEOPLE SAY NOTHING IS IMPOSSIBLE BUT I DO NOTHING EVERY DAY", author: "A.A. Milne" },
  { text: "IT WOULD BE NICE TO SPEND BILLIONS ON SCHOOLS AND ROADS BUT RIGHT NOW THAT MONEY IS DESPERATELY NEEDED FOR POLITICAL ADS", author: "Andy Borowitz" },
  // ─── Books & reading ────────────────────────────────────────────────────────
  { text: "NOT ALL READERS ARE LEADERS BUT ALL LEADERS ARE READERS", author: "Harry S Truman" },
  { text: "A WORD AFTER A WORD AFTER A WORD IS POWER", author: "Margaret Atwood" },
  { text: "A GREAT BOOK SHOULD LEAVE YOU WITH MANY EXPERIENCES AND SLIGHTLY EXHAUSTED AT THE END", author: "William Styron" },
  { text: "IF YOU ONLY READ THE BOOKS THAT EVERYONE ELSE IS READING YOU CAN ONLY THINK WHAT EVERYONE ELSE IS THINKING", author: "Haruki Murakami" },
  { text: "IT IS WHAT YOU READ WHEN YOU DO NOT HAVE TO THAT DETERMINES WHAT YOU WILL BE WHEN YOU CANNOT HELP IT", author: "Oscar Wilde" },
  { text: "SHOW ME A FAMILY OF READERS AND I WILL SHOW YOU THE PEOPLE WHO MOVE THE WORLD", author: "Napoleon Bonaparte" },
  { text: "SLEEP IS GOOD HE SAID AND BOOKS ARE BETTER", author: "George R.R. Martin" },
  { text: "I TOOK A SPEED READING COURSE AND READ WAR AND PEACE IN TWENTY MINUTES IT INVOLVES RUSSIA", author: "Woody Allen" },
  { text: "I KEPT ALWAYS TWO BOOKS IN MY POCKET ONE TO READ ONE TO WRITE IN", author: "Robert Louis Stevenson" },
  { text: "THERE IS NO FRIEND AS LOYAL AS A BOOK", author: "Ernest Hemingway" },
  { text: "ONE MUST ALWAYS BE CAREFUL OF BOOKS AND WHAT IS INSIDE THEM FOR WORDS HAVE THE POWER TO CHANGE US", author: "Cassandra Clare" },
  { text: "THE MORE THAT YOU READ THE MORE THINGS YOU WILL KNOW THE MORE YOU LEARN THE MORE PLACES YOU LL GO", author: "Dr. Seuss" },
  // ─── Puzzles & brain games ──────────────────────────────────────────────────
  { text: "EVERY PUZZLE HAS AN ANSWER WAITING TO BE FOUND", author: "Anonymous" },
  { text: "A SHARP MIND AND A WILLING SPIRIT CAN SOLVE ANYTHING", author: "Anonymous" },
  { text: "THE BEST WORKOUT FOR YOUR BRAIN IS A CHALLENGING PUZZLE", author: "Anonymous" },
  { text: "TAKE IT ONE CLUE AT A TIME AND EVENTUALLY THE ANSWER WILL REVEAL ITSELF", author: "Anonymous" },
  { text: "A PUZZLE A DAY KEEPS THE DOCTOR AWAY AND THE MIND IN FULL SWING", author: "Anonymous" },
  { text: "THE MIND IS NOT A VESSEL TO BE FILLED BUT A FIRE TO BE KINDLED", author: "Plutarch" },
  { text: "THE BRAIN IS LIKE A MUSCLE WHEN IT IS IN USE WE FEEL VERY GOOD UNDERSTANDING IS JOYOUS", author: "Carl Sagan" },
  { text: "TO SOLVE A PROBLEM OR ACHIEVE A GOAL YOU DO NOT NEED TO KNOW ALL THE ANSWERS IN ADVANCE", author: "Jack Canfield" },
  { text: "THINKING IS THE HARDEST WORK THERE IS WHICH IS THE PROBABLE REASON SO FEW ENGAGE IN IT", author: "Henry Ford" },
  { text: "PROBLEMS ARE ONLY OPPORTUNITIES IN WORK CLOTHES", author: "Henry Kaiser" },
  { text: "I LEARNED LONG AGO NEVER TO WRESTLE WITH A PIG YOU GET DIRTY AND BESIDES THE PIG LIKES IT", author: "George Bernard Shaw" },
  { text: "ANY INTELLIGENT FOOL CAN MAKE THINGS BIGGER MORE COMPLEX AND MORE VIOLENT TO MOVE IN THE OPPOSITE DIRECTION TAKES GENIUS", author: "E.F. Schumacher" },
  // ─── Seniors & aging ────────────────────────────────────────────────────────
  { text: "DO NOT REGRET GROWING OLDER IT IS A PRIVILEGE DENIED TO MANY", author: "Anonymous" },
  { text: "AGING IS NOT LOST YOUTH BUT A NEW STAGE OF OPPORTUNITY AND STRENGTH", author: "Betty Friedan" },
  { text: "THE LONGER I LIVE THE MORE BEAUTIFUL LIFE BECOMES", author: "Frank Lloyd Wright" },
  { text: "THERE IS A FOUNTAIN OF YOUTH IT IS YOUR MIND YOUR TALENTS THE CREATIVITY YOU BRING TO YOUR LIFE", author: "Sophia Loren" },
  { text: "AT SEVENTY YEARS OF AGE THE ONLY REGRETS ARE THE THINGS YOU DID NOT DO", author: "Anonymous" },
  { text: "OLD AGE IS AN EXCELLENT TIME FOR OUTRAGE YOUR FACE IS ALREADY DONE", author: "Maggie Kuhn" },
  { text: "HOW OLD WOULD YOU BE IF YOU DID NOT KNOW HOW OLD YOU WERE", author: "Satchel Paige" },
  { text: "THE SECRET TO STAYING YOUNG IS TO LIVE HONESTLY EAT SLOWLY AND LIE ABOUT YOUR AGE", author: "Lucille Ball" },
  { text: "GROWING OLD IS MANDATORY GROWING UP IS OPTIONAL", author: "Chili Davis" },
  { text: "SOME PEOPLE ARE OLD AT EIGHTEEN AND SOME ARE YOUNG AT NINETY", author: "Yoko Ono" },
  { text: "WISDOM COMES WITH WINTERS", author: "Oscar Wilde" },
  { text: "WRINKLES SHOULD MERELY INDICATE WHERE SMILES HAVE BEEN", author: "Mark Twain" },
  { text: "THE GREAT ART OF LIFE IS SENSATION TO FEEL THAT WE EXIST EVEN IN PAIN", author: "Lord Byron" },
  { text: "EVERY DAY IS A GIFT WHEN YOU ARE OVER THE HILL", author: "Anonymous" },
  { text: "LAUGH OFTEN LONG AND LOUD LAUGH UNTIL YOU GASP FOR BREATH", author: "George Carlin" },
  // ─── Kindness & gratitude ───────────────────────────────────────────────────
  { text: "NO ACT OF KINDNESS NO MATTER HOW SMALL IS EVER WASTED", author: "Aesop" },
  { text: "KINDNESS IN WORDS CREATES CONFIDENCE KINDNESS IN THINKING CREATES PROFOUNDNESS KINDNESS IN GIVING CREATES LOVE", author: "Lao Tzu" },
  { text: "DO A RANDOM ACT OF KINDNESS WITH NO EXPECTATION OF REWARD", author: "Princess Diana" },
  { text: "CONSTANT KINDNESS CAN ACCOMPLISH MUCH AS THE SUN MAKES ICE MELT", author: "Albert Schweitzer" },
  { text: "GRATITUDE IS NOT ONLY THE GREATEST OF VIRTUES BUT THE PARENT OF ALL THE OTHERS", author: "Marcus Tullius Cicero" },
  { text: "WHEN YOU ARE GRATEFUL FEAR DISAPPEARS AND ABUNDANCE APPEARS", author: "Tony Robbins" },
  { text: "APPRECIATION IS A WONDERFUL THING IT MAKES WHAT IS EXCELLENT IN OTHERS BELONG TO US AS WELL", author: "Voltaire" },
  { text: "ENOUGH IS INDEED ENOUGH IF YOU ARE HAPPY WITH ENOUGH YOU CAN ALWAYS HAVE MORE", author: "Anonymous" },
  { text: "THE ROOTS OF ALL GOODNESS LIE IN THE SOIL OF APPRECIATION FOR GOODNESS", author: "Dalai Lama" },
  { text: "SILENT GRATITUDE IS NOT MUCH USE TO ANYONE", author: "G.B. Stern" },
  { text: "GIVE THANKS FOR A LITTLE AND YOU WILL FIND A LOT", author: "Hausa Proverb" },
  { text: "GRATITUDE TURNS WHAT WE HAVE INTO ENOUGH AND MORE", author: "Melody Beattie" },
  // ─── Adventure & travel ─────────────────────────────────────────────────────
  { text: "THE WORLD IS A BOOK AND THOSE WHO DO NOT TRAVEL READ ONLY ONE PAGE", author: "Saint Augustine" },
  { text: "TRAVEL IS THE ONLY THING YOU BUY THAT MAKES YOU RICHER", author: "Anonymous" },
  { text: "ADVENTURE IS WORTHWHILE IN ITSELF", author: "Amelia Earhart" },
  { text: "LIFE IS EITHER A GREAT ADVENTURE OR NOTHING", author: "Helen Keller" },
  { text: "THE BIGGEST ADVENTURE YOU CAN TAKE IS TO LIVE THE LIFE OF YOUR DREAMS", author: "Oprah Winfrey" },
  { text: "IT IS GOOD TO HAVE AN END TO JOURNEY TOWARD BUT IT IS THE JOURNEY THAT MATTERS IN THE END", author: "Ursula K. Le Guin" },
  { text: "TO TRAVEL IS TO DISCOVER THAT EVERYONE IS WRONG ABOUT OTHER COUNTRIES", author: "Aldous Huxley" },
  { text: "JOBS FILL YOUR POCKET ADVENTURES FILL YOUR SOUL", author: "Jaime Lyn Beatty" },
  { text: "ONCE A YEAR GO SOMEPLACE YOU HAVE NEVER BEEN BEFORE", author: "Dalai Lama" },
  { text: "DO NOT LISTEN TO WHAT THEY SAY GO SEE", author: "Chinese Proverb" },
  { text: "MAN CANNOT DISCOVER NEW OCEANS UNLESS HE HAS THE COURAGE TO LOSE SIGHT OF THE SHORE", author: "Andre Gide" },
  { text: "THE REAL VOYAGE OF DISCOVERY CONSISTS NOT IN SEEKING NEW LANDSCAPES BUT IN HAVING NEW EYES", author: "Marcel Proust" },
  // ─── Friendship & love ──────────────────────────────────────────────────────
  { text: "A FRIEND KNOWS YOU AS YOU ARE AND STILL ALLOWS YOU TO GROW", author: "William Shakespeare" },
  { text: "FRIENDSHIP IS THE ONLY CEMENT THAT WILL EVER HOLD THE WORLD TOGETHER", author: "Woodrow Wilson" },
  { text: "A REAL FRIEND IS ONE WHO WALKS IN WHEN THE REST OF THE WORLD WALKS OUT", author: "Walter Winchell" },
  { text: "THE LANGUAGE OF FRIENDSHIP IS NOT WORDS BUT MEANINGS", author: "Henry David Thoreau" },
  { text: "A FRIEND MAY WELL BE RECKONED THE MASTERPIECE OF NATURE", author: "Ralph Waldo Emerson" },
  { text: "LOVE DOES NOT MAKE THE WORLD GO ROUND LOVE IS WHAT MAKES THE RIDE WORTHWHILE", author: "Franklin P. Jones" },
  { text: "THE BEST THING TO HOLD ONTO IN LIFE IS EACH OTHER", author: "Audrey Hepburn" },
  { text: "WHERE THERE IS LOVE THERE IS LIFE", author: "Mahatma Gandhi" },
  { text: "BEING DEEPLY LOVED BY SOMEONE GIVES YOU STRENGTH WHILE LOVING SOMEONE DEEPLY GIVES YOU COURAGE", author: "Lao Tzu" },
  { text: "IN THE END THE LOVE YOU TAKE IS EQUAL TO THE LOVE YOU MAKE", author: "Paul McCartney" },
  // ─── Persistence & resilience ───────────────────────────────────────────────
  { text: "THE GEM CANNOT BE POLISHED WITHOUT FRICTION NOR MAN PERFECTED WITHOUT TRIALS", author: "Chinese Proverb" },
  { text: "WHEN YOU FEEL LIKE QUITTING THINK ABOUT WHY YOU STARTED", author: "Anonymous" },
  { text: "TOUGH TIMES NEVER LAST BUT TOUGH PEOPLE DO", author: "Robert H. Schuller" },
  { text: "A RIVER CUTS THROUGH ROCK NOT BECAUSE OF ITS POWER BUT BECAUSE OF ITS PERSISTENCE", author: "James N. Watkins" },
  { text: "THE DIFFERENCE BETWEEN A STUMBLING BLOCK AND A STEPPING STONE IS HOW HIGH YOU RAISE YOUR FOOT", author: "Benny Lewis" },
  { text: "IT IS NOT WHETHER YOU GET KNOCKED DOWN IT IS WHETHER YOU GET UP", author: "Vince Lombardi" },
  { text: "EVERY ADVERSITY EVERY FAILURE EVERY HEARTACHE CARRIES WITH IT THE SEED OF AN EQUAL OR GREATER BENEFIT", author: "Napoleon Hill" },
  { text: "OUR GREATEST WEAKNESS LIES IN GIVING UP THE MOST CERTAIN WAY TO SUCCEED IS ALWAYS TO TRY JUST ONE MORE TIME", author: "Thomas Edison" },
  { text: "CHARACTER CANNOT BE DEVELOPED IN EASE AND QUIET ONLY THROUGH TRIAL AND SUFFERING CAN THE SOUL BE STRENGTHENED", author: "Helen Keller" },
  { text: "THE DARKEST HOUR HAS ONLY SIXTY MINUTES", author: "Morris Mandel" },
  { text: "DO NOT WATCH THE CLOCK DO WHAT IT DOES KEEP GOING", author: "Sam Levenson" },
  { text: "STRENGTH GROWS IN THE MOMENTS WHEN YOU THINK YOU CANNOT GO ON BUT YOU KEEP GOING ANYWAY", author: "Anonymous" },
  { text: "YOU JUST CANNOT BEAT THE PERSON WHO NEVER GIVES UP", author: "Babe Ruth" },
  // ─── Creativity & art ───────────────────────────────────────────────────────
  { text: "CREATIVITY IS CONNECTING THINGS THAT HAVE NOT BEEN CONNECTED BEFORE", author: "Steve Jobs" },
  { text: "AN ARTIST CANNOT FAIL IT IS A SUCCESS TO BE ONE", author: "Charles Horton Cooley" },
  { text: "THE CREATIVE ADULT IS THE CHILD WHO HAS SURVIVED", author: "Ursula K. Le Guin" },
  { text: "CREATIVITY TAKES COURAGE", author: "Henri Matisse" },
  { text: "THE WORST ENEMY OF CREATIVITY IS SELF DOUBT", author: "Sylvia Plath" },
  { text: "LOGIC WILL GET YOU FROM A TO Z IMAGINATION WILL GET YOU EVERYWHERE", author: "Albert Einstein" },
  { text: "EVERY ARTIST DIPS HIS BRUSH IN HIS OWN SOUL AND PAINTS HIS OWN NATURE INTO HIS PICTURES", author: "Henry Ward Beecher" },
  { text: "MUSIC GIVES A SOUL TO THE UNIVERSE WINGS TO THE MIND FLIGHT TO THE IMAGINATION AND LIFE TO EVERYTHING", author: "Plato" },
  { text: "PAINTING IS POETRY THAT IS SEEN RATHER THAN FELT AND POETRY IS PAINTING THAT IS FELT RATHER THAN SEEN", author: "Leonardo da Vinci" },
  { text: "CREATIVITY IS THE POWER TO CONNECT THE SEEMINGLY UNCONNECTED", author: "William Plomer" },
  // ─── Health & wellbeing ─────────────────────────────────────────────────────
  { text: "TO KEEP THE BODY IN GOOD HEALTH IS A DUTY OTHERWISE WE SHALL NOT BE ABLE TO KEEP OUR MIND STRONG AND CLEAR", author: "Buddha" },
  { text: "TAKE CARE OF YOUR BODY IT IS THE ONLY PLACE YOU HAVE TO LIVE", author: "Jim Rohn" },
  { text: "THE GROUNDWORK FOR ALL HAPPINESS IS GOOD HEALTH", author: "Leigh Hunt" },
  { text: "THE FIRST WEALTH IS HEALTH", author: "Ralph Waldo Emerson" },
  { text: "IT IS HEALTH THAT IS REAL WEALTH AND NOT PIECES OF GOLD AND SILVER", author: "Mahatma Gandhi" },
  { text: "SLEEP IS THE BEST MEDITATION", author: "Dalai Lama" },
  { text: "ALMOST EVERYTHING WILL WORK AGAIN IF YOU UNPLUG IT FOR A FEW MINUTES INCLUDING YOU", author: "Anne Lamott" },
  { text: "REST WHEN YOU ARE WEARY REFRESH AND RENEW YOURSELF YOUR BODY YOUR MIND YOUR SPIRIT AND THEN GET BACK TO WORK", author: "Ralph Marston" },
  // ─── Morning & daily life ───────────────────────────────────────────────────
  { text: "WITH THE NEW DAY COMES NEW STRENGTH AND NEW THOUGHTS", author: "Eleanor Roosevelt" },
  { text: "TODAY IS A GOOD DAY TO HAVE A GOOD DAY", author: "Anonymous" },
  { text: "EACH MORNING WE ARE BORN AGAIN WHAT WE DO TODAY IS WHAT MATTERS MOST", author: "Buddha" },
  { text: "AN EARLY MORNING WALK IS A BLESSING FOR THE WHOLE DAY", author: "Henry David Thoreau" },
  { text: "THE SECRET OF YOUR FUTURE IS HIDDEN IN YOUR DAILY ROUTINE", author: "Mike Murdock" },
  { text: "RISE UP START FRESH SEE THE BRIGHT OPPORTUNITY IN EACH NEW DAY", author: "Anonymous" },
  { text: "HOW YOU START YOUR MORNING SETS THE TONE FOR YOUR ENTIRE DAY", author: "Anonymous" },
  { text: "I GET UP EVERY MORNING DETERMINED TO BOTH CHANGE THE WORLD AND HAVE ONE HELL OF A GOOD TIME", author: "E.B. White" },
  { text: "BEGIN EACH DAY AS IF IT WERE ON PURPOSE", author: "Anonymous" },
  { text: "THE MORNING BREEZE HAS SECRETS TO TELL YOU DO NOT GO BACK TO SLEEP", author: "Rumi" },
  // ─── Family & home ──────────────────────────────────────────────────────────
  { text: "IN FAMILY LIFE LOVE IS THE OIL THAT EASES FRICTION AND THE MUSIC THAT BRINGS HARMONY", author: "Friedrich Nietzsche" },
  { text: "THE FAMILY IS ONE OF NATURE S MASTERPIECES", author: "George Santayana" },
  { text: "HOME IS NOT A PLACE IT IS A FEELING", author: "Cecelia Ahern" },
  { text: "FAMILY LIKE BRANCHES ON A TREE WE ALL GROW IN DIFFERENT DIRECTIONS YET OUR ROOTS REMAIN AS ONE", author: "Anonymous" },
  { text: "THE BOND THAT LINKS YOUR TRUE FAMILY IS NOT ONE OF BLOOD BUT OF RESPECT AND JOY IN EACH OTHER S LIFE", author: "Richard Bach" },
  { text: "IN TIME OF TEST FAMILY IS BEST", author: "Burmese Proverb" },
  { text: "CALL IT A CLAN CALL IT A NETWORK CALL IT A TRIBE CALL IT A FAMILY WHATEVER YOU CALL IT WHOEVER YOU ARE YOU NEED ONE", author: "Jane Howard" },
  // ─── Food & celebration ─────────────────────────────────────────────────────
  { text: "FIRST WE EAT THEN WE DO EVERYTHING ELSE", author: "M.F.K. Fisher" },
  { text: "FOOD IS SYMBOLIC OF LOVE WHEN WORDS ARE INADEQUATE", author: "Alan D. Wolfelt" },
  { text: "ALL HAPPINESS DEPENDS ON A LEISURELY BREAKFAST", author: "John Gunther" },
  { text: "THERE IS NO LOVE SINCERER THAN THE LOVE OF FOOD", author: "George Bernard Shaw" },
  { text: "ONE CANNOT THINK WELL LOVE WELL SLEEP WELL IF ONE HAS NOT DINED WELL", author: "Virginia Woolf" },
  { text: "A RECIPE HAS NO SOUL YOU AS THE COOK MUST BRING SOUL TO THE RECIPE", author: "Thomas Keller" },
  { text: "THE SECRET INGREDIENT IS ALWAYS LOVE", author: "Anonymous" },
  // ─── Extra variety ──────────────────────────────────────────────────────────
  { text: "EVERYTHING YOU NEED IS ALREADY INSIDE YOU", author: "Bill Bowerman" },
  { text: "DONE IS BETTER THAN PERFECT", author: "Sheryl Sandberg" },
  { text: "AIM SMALL MISS SMALL", author: "Mel Gibson" },
  { text: "SHOW UP EVEN WHEN YOU DO NOT FEEL LIKE IT", author: "Anonymous" },
  { text: "CLARITY COMES FROM ENGAGEMENT NOT THOUGHT", author: "Marie Forleo" },
  { text: "YOUR ONLY LIMIT IS YOUR MIND", author: "Anonymous" },
  { text: "SMALL STEPS EVERY DAY ADD UP TO GIANT LEAPS OVER TIME", author: "Anonymous" },
  { text: "WRITE IT MAKE IT HAPPEN", author: "Anonymous" },
  { text: "PRESSURE IS A PRIVILEGE", author: "Billie Jean King" },
  { text: "YOU BECOME WHAT YOU REPEATEDLY DO", author: "Will Durant" },
  { text: "DISCIPLINE IS DOING WHAT NEEDS TO BE DONE EVEN IF YOU DO NOT WANT TO DO IT", author: "Anonymous" },
  { text: "FALL SEVEN TIMES STAND UP EIGHT", author: "Japanese Proverb" },
  { text: "THE WORLD IS FULL OF MAGICAL THINGS PATIENTLY WAITING FOR OUR WITS TO GROW SHARPER", author: "Bertrand Russell" },
  { text: "CURIOSITY IS THE BEGINNING OF WISDOM", author: "Nicolas Chamfort" },
  { text: "EMBRACE UNCERTAINTY SOME OF THE MOST BEAUTIFUL CHAPTERS IN OUR LIVES WILL NOT HAVE A TITLE UNTIL MUCH LATER", author: "Bob Goff" },
  { text: "BE SO GOOD THEY CANNOT IGNORE YOU", author: "Steve Martin" },
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

export function makeCryptogram(puzzleIndex = 0, bookSeed = 0): CryptogramResult {
  // Deterministic quote selection: offset by bookSeed so each book uses a different starting
  // position in the quote bank, then advance by puzzleIndex to avoid repeats within the book.
  const offset = ((bookSeed % QUOTE_BANK.length) + QUOTE_BANK.length) % QUOTE_BANK.length;
  const idx = (offset + puzzleIndex) % QUOTE_BANK.length;
  const quote = QUOTE_BANK[idx];
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

export function makeCrossword(words: string[], size: number, _isSeedFallback = false): CrosswordResult {
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

  function gridToResult(g: string[][]): CrosswordResult | null {
    const across: CrosswordClue[] = [];
    const down: CrosswordClue[] = [];
    const ns: Record<string, number> = {};
    let num = 1;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (g[r][c] === "#") continue;
        const isA = (c === 0 || g[r][c - 1] === "#") && c + 1 < size && g[r][c + 1] !== "#";
        const isD = (r === 0 || g[r - 1][c] === "#") && r + 1 < size && g[r + 1][c] !== "#";
        if (isA || isD) {
          ns[`${r},${c}`] = num;
          if (isA) {
            let ans = "", cc = c;
            while (cc < size && g[r][cc] !== "#") { ans += g[r][cc]; cc++; }
            if (ans.length >= 2)
              across.push({ num, clue: makeCrosswordClue(ans), answer: ans, row: r, col: c, len: ans.length });
          }
          if (isD) {
            let ans = "", rr = r;
            while (rr < size && g[rr][c] !== "#") { ans += g[rr][c]; rr++; }
            if (ans.length >= 2)
              down.push({ num, clue: makeCrosswordClue(ans), answer: ans, row: r, col: c, len: ans.length });
          }
          num++;
        }
      }
    }
    if (across.length < 1 || down.length < 1) return null;
    return { grid: g, across, down, size, nums: ns };
  }

  // Build grid from backtracking assignment and attempt to derive clues.
  const primaryGrid: string[][] = Array.from({ length: size }, () => Array(size).fill("#"));
  for (let i = 0; i < slots.length; i++) {
    const w = assignment[i];
    if (!w) continue;
    const s = slots[i];
    const dr = s.dir === "V" ? 1 : 0, dc = s.dir === "H" ? 1 : 0;
    for (let k = 0; k < w.length; k++) {
      primaryGrid[s.row + dr * k][s.col + dc * k] = w[k];
    }
  }
  const primary = gridToResult(primaryGrid);
  if (primary) return primary;

  // Fallback: center H and V words at (m, m); require matching center letters so they cross.
  const allWords = [...new Set(
    words.map(w => w.toUpperCase().replace(/[^A-Z]/g, "")).filter(w => w.length >= 3)
  )];
  for (const wH of shuf(allWords)) {
    const hHalf = Math.floor(wH.length / 2);
    const hRow = m, hCol = m - hHalf;
    if (hCol < 0 || hCol + wH.length > size) continue;
    const centerLetterH = wH[hHalf];
    for (const wV of shuf(allWords.filter(w => w !== wH))) {
      const vHalf = Math.floor(wV.length / 2);
      const vCol = m, vRow = m - vHalf;
      if (vRow < 0 || vRow + wV.length > size) continue;
      // The crossing cell is (m, m): wH[hHalf] must equal wV[vHalf]
      if (wV[vHalf] !== centerLetterH) continue;
      const fbGrid: string[][] = Array.from({ length: size }, () => Array(size).fill("#"));
      for (let k = 0; k < wH.length; k++) fbGrid[hRow][hCol + k] = wH[k];
      for (let k = 0; k < wV.length; k++) fbGrid[vRow + k][vCol] = wV[k];
      const fb = gridToResult(fbGrid);
      if (fb) return fb;
    }
  }

  // Fallback: run the full backtracking algorithm with 20 curated seed word sets.
  // Each set contains 5-8 words with natural letter overlaps — pre-validated to produce
  // multi-word crossword grids (5+ words placed) without single-word fallbacks.
  if (!_isSeedFallback) {
    const SEED_SETS: string[][] = [
      ["MASTER","STREAM","REASON","TRAVEL","MARBLE","STERN","LEARN"],
      ["BRAVE","RIVER","VALOR","ALERT","TRAVEL","NERVE","RAVEN"],
      ["CHESS","SHORE","EMBER","CREST","SERVE","EXCEL","SCENE"],
      ["DREAM","REALM","ELDER","AMBLE","DARES","MEDAL","LADLE"],
      ["GRACE","CARGO","CRANE","CEDAR","ACORN","GROAN","RANGE"],
      ["LIGHT","NIGHT","SIGHT","EIGHT","MIGHT","BLIGHT","TIGHT"],
      ["STONE","TONES","NOTES","ONSET","TENOR","NOSED","STENO"],
      ["FLAME","FLARE","FRAME","MAPLE","BLAME","AMPLE","LABEL"],
      ["ORBIT","BIRTH","BRINE","IRONS","ROBIN","TRIBE","RIPEN"],
      ["SOLAR","LOANS","ARSON","OVALS","SALON","MORAL","FLORA"],
      ["PRIDE","RIDER","RIPEN","RIPER","PRIED","DRIVE","DIVER"],
      ["CROWN","CLOWN","BROWN","FROWN","GROWN","PRAWN","DRAWN"],
      ["SPARK","STARK","SNARK","PARKS","LARK","DARK","MARKS"],
      ["TIGER","DIVER","RIVER","GIVER","LIVER","VIPER","MISER"],
      ["NOBLE","GLOBE","KNOB","BONE","BOLE","LONE","LOBE"],
      ["EAGLE","LEGAL","REGAL","GAGE","GALE","LAKE","GALE"],
      ["MAGIC","LOGIC","TONIC","MANIC","SONIC","IONIC","OPTIC"],
      ["BLUER","BLUES","GLUED","CLUES","FLUES","SLUES","TRUED"],
      ["HEART","EARTH","SHARE","HASTE","TEARS","HARES","ASTER"],
      ["POWER","LOWER","TOWER","BOWER","MOWER","SOWER","ROWEL"],
    ];
    for (const seedSet of shuf(SEED_SETS)) {
      const r = makeCrossword(seedSet, size, true);
      // Require at least 3 words placed for a quality crossword
      if (r.across.length + r.down.length >= 3) return r;
    }
  }

  // Absolute last resort (seed sets also exhausted): build a 2-word cross at center
  const finalPool = allWords.length >= 2 ? allWords :
    ["MASTER","STREAM","REASON","LEARN","STERN","LATER","ALERT"];
  for (const wH of shuf(finalPool)) {
    const hHalf = Math.floor(wH.length / 2);
    const hCol = m - hHalf;
    if (hCol < 0 || hCol + wH.length > size) continue;
    const centerLetterH = wH[hHalf];
    for (const wV of shuf(finalPool.filter(w => w !== wH))) {
      const vHalf = Math.floor(wV.length / 2);
      const vRow = m - vHalf;
      if (vRow < 0 || vRow + wV.length > size) continue;
      if (wV[vHalf] !== centerLetterH) continue;
      const sg: string[][] = Array.from({ length: size }, () => Array(size).fill("#"));
      for (let k = 0; k < wH.length; k++) sg[m][hCol + k] = wH[k];
      for (let k = 0; k < wV.length; k++) sg[vRow + k][m] = wV[k];
      const r = gridToResult(sg);
      if (r) return r;
    }
  }
  // Dead end: return a minimal valid result with one word
  const aw = finalPool[0] ?? "MASTER";
  const ahCol = Math.max(0, m - Math.floor(aw.length / 2));
  const lg: string[][] = Array.from({ length: size }, () => Array(size).fill("#"));
  if (ahCol + aw.length <= size)
    for (let k = 0; k < aw.length; k++) lg[m][ahCol + k] = aw[k];
  return gridToResult(lg) ?? { grid: lg, across: [], down: [], size, nums: {} };
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
