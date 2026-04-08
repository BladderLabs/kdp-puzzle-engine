export interface NicheData {
  key: string;
  label: string;
  puzzleType: string;
  words: string[];
  titles: string[];
  keywords: string[];
  backBlurb: string;
  recommendedDifficulty: string;
  recommendedCount: number;
}

export const NICHES: NicheData[] = [
  {
    key: "seniors",
    label: "Seniors & Large Print",
    puzzleType: "Word Search",
    words: ["GARDEN","FAMILY","COOKING","TRAVEL","READING","MEMORY","FRIEND","WISDOM","HEALTH","COFFEE","SUNSET","NATURE","PUZZLE","RELAX","PEACE","BRIDGE","CHESS","KNIT","BINGO","WALK","SMILE","GRACE","LAUGH","DANCE","MUSIC","BOOK","LIGHT","HEART","LOVE","CRAFT","SLEEP","REST","CALM","QUIET","JOY","HOPE","FAITH","CARE","KIND","WARM","GENTLE","TENDER","NOBLE","PROUD","BRAVE","STORY","HONOR","VERSE","THINK","LEARN","SHARE","CHERISH","TEACH","SERVE","GIVE","LISTEN"],
    titles: ["Large Print Word Search for Seniors","Easy Word Search for Seniors Volume {N}","Brain Boosting Puzzles for Seniors","Relaxing Word Search for Seniors","Daily Word Search for Active Minds"],
    keywords: ["large print word search seniors","easy word search adults","brain games seniors large print","word puzzle book seniors","large print puzzle book","senior activity book","brain health puzzles","relaxing puzzle book adults"],
    backBlurb: "Designed specifically for seniors who love a good puzzle. Every word search is printed in extra-large font for comfortable solving, with 100 puzzles on quality white paper. Perfect for daily mental exercise, gift giving, or relaxing afternoons. Complete answer key included.",
    recommendedDifficulty: "Easy",
    recommendedCount: 100,
  },
  {
    key: "kids",
    label: "Kids (Ages 6-12)",
    puzzleType: "Word Search",
    words: ["ANIMAL","SCHOOL","FRIEND","GAME","SPORT","COLOR","MUSIC","DANCE","PIZZA","CAKE","PUPPY","KITTEN","BUNNY","STAR","MOON","SUN","RAINBOW","MAGIC","HAPPY","FUNNY","SILLY","JUMP","RUN","PLAY","LEARN","READ","DRAW","SING","BUILD","LAUGH","CANDY","BALLOON","CASTLE","DRAGON","UNICORN","ROBOT","SUPERHERO","ADVENTURE","TREASURE","JUNGLE","PLANET","TRAIN","BOAT","FIRE","CLOUD","PAINT","DREAM","FISH","BIRD","FLOWER","OCEAN","SNOW"],
    titles: ["Kids Word Search Book Ages 6-12","Fun Word Search for Kids Volume {N}","Super Kids Word Search Activity Book","Amazing Word Search for Children","Kids Brain Games Word Search"],
    keywords: ["word search kids ages 6 12","children word search book","kids activity book word search","fun word search children","school age puzzle book","kids brain games","word puzzle book children","activity book boys girls"],
    backBlurb: "Packed with 100 fun and age-appropriate word search puzzles! Each puzzle is perfectly sized for young eyes, with a themed word bank that makes learning vocabulary exciting. Great for road trips, rainy days, and after-school brain breaks. Answer key included for grown-ups!",
    recommendedDifficulty: "Easy",
    recommendedCount: 100,
  },
  {
    key: "christmas",
    label: "Christmas",
    puzzleType: "Word Search",
    words: ["CHRISTMAS","SANTA","REINDEER","RUDOLPH","SLEIGH","GIFT","PRESENT","STOCKING","CHIMNEY","FIREPLACE","MISTLETOE","HOLLY","WREATH","TINSEL","ORNAMENT","ANGEL","STAR","SNOWFLAKE","SNOWMAN","CAROL","BELLS","CELEBRATE","FAMILY","FEAST","TURKEY","CANDLE","RIBBON","MERRY","JOLLY","ELVES","WORKSHOP","NORTH","POLE","WISH","MAGIC","WONDER","WINTER","COZY","WARM","LOVE","ADVENT","NATIVITY","SHEPHERD","JOSEPH","MARY","WORSHIP","DOVE","FRANKINCENSE","MYRRH","GOLD","PEACE","SILENT"],
    titles: ["Christmas Word Search Puzzle Book","Holiday Word Search for Adults Volume {N}","Merry Christmas Puzzle Book","The Ultimate Christmas Word Search","Christmas Activity Book Adults"],
    keywords: ["christmas word search adults","holiday puzzle book","christmas activity book","christmas word search large print","holiday brain games","christmas gift puzzle book","seasonal word search","christmas stocking stuffer"],
    backBlurb: "Celebrate the magic of Christmas with 100 festive word search puzzles! Every puzzle is filled with holiday cheer — from Santa and reindeer to tinsel and carols. A perfect gift for anyone who loves Christmas. Keep the whole family entertained through the holiday season!",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "nurses",
    label: "Nurses & Medical",
    puzzleType: "Word Search",
    words: ["NURSE","HOSPITAL","DOCTOR","PATIENT","MEDICINE","STETHOSCOPE","SCRUBS","SHIFT","CARE","HEAL","VITAL","PULSE","CHART","SURGERY","NEEDLE","BANDAGE","HEARTBEAT","OXYGEN","MONITOR","DIAGNOSIS","SYMPTOM","TREATMENT","CLINIC","WARD","EMERGENCY","TRIAGE","COMPASSION","DEDICATE","STRENGTH","TEAMWORK","PROCEDURE","PHARMACY","ANESTHESIA","RECOVERY","WELLNESS","HEALTH","PEDIATRIC","ONCOLOGY","TRAUMA","CARDIAC","SYRINGE","VENTILATOR","CATHETER","SUTURE","STERILIZE","HYGIENE","PROTOCOL","BEDSIDE","ADVOCATE","RESIDENT","INTERN","CONSULT"],
    titles: ["Nurse Life Word Search Puzzle Book","Word Search for Nurses Volume {N}","Medical Word Search Nurses Edition","The Nurse's Puzzle Book","Healthcare Heroes Word Search"],
    keywords: ["nurse word search puzzle book","medical word search nurses","nurse gift puzzle book","nursing word search","healthcare word search book","nurse appreciation gift","medical profession puzzle book","nurse life word search"],
    backBlurb: "A word search book made especially for the hardest-working people in healthcare. 100 puzzles packed with medical terminology, nursing specialties, and healthcare vocabulary. A fantastic gift for nurses, nursing students, and medical professionals who deserve a relaxing break!",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "teachers",
    label: "Teachers",
    puzzleType: "Word Search",
    words: ["TEACHER","CLASSROOM","STUDENT","LESSON","HOMEWORK","GRADE","PENCIL","CHALKBOARD","INSPIRE","EDUCATE","CURRICULUM","TEXTBOOK","LIBRARY","SCIENCE","HISTORY","ENGLISH","MATH","ART","MUSIC","RECESS","DIPLOMA","GRADUATION","KNOWLEDGE","WISDOM","PATIENCE","DEDICATION","LEARN","DISCOVER","SUPPORT","MENTOR","ACHIEVEMENT","PROGRESS","SUCCESS","CREATIVE","CURIOUS","BRIGHT","FUTURE","GROW","QUESTION","ANSWER","REPORT","CONFERENCE","PARENT","PRINCIPAL","ASSESSMENT","RUBRIC","WORKSHOP","SYLLABUS","ENGAGE","REFLECT","RESOURCE","STANDARD"],
    titles: ["Teacher Appreciation Word Search Book","Word Search for Teachers Volume {N}","Classroom Word Search Puzzles","The Teacher's Puzzle Book","Back to School Word Search"],
    keywords: ["teacher word search puzzle book","teacher appreciation gift puzzle","educator word search book","classroom word search","teacher gift ideas puzzle","school word search book","teacher life puzzle book","back to school puzzle book"],
    backBlurb: "Dedicated to the teachers who make a difference every single day. 100 classroom-themed word search puzzles celebrating the world of education. A wonderful gift for teachers, end-of-year appreciation, or a relaxing summer break treat. You deserve it!",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "dogs",
    label: "Dog Lovers",
    puzzleType: "Word Search",
    words: ["PUPPY","FETCH","PAWS","WOOF","LEASH","TREAT","COLLAR","RESCUE","ADOPT","LOYAL","PLAYFUL","LABRADOR","POODLE","BULLDOG","BEAGLE","GOLDEN","HUSKY","DALMATIAN","POMERANIAN","CHIHUAHUA","SHEPHERD","TERRIER","SPANIEL","DACHSHUND","KENNEL","GROOMING","TRAINING","OBEDIENCE","AGILITY","SHOW","BREED","BARK","TAIL","SNIFF","DIG","CUDDLE","LOVE","BOND","TRUST","FRIEND","VETERINARY","MICROCHIP","VACCINATE","HEARTWORM","FLEA","TICK","GROOMER","RESCUE","FOSTER","SHELTER","LITTER","PEDIGREE"],
    titles: ["Dog Lover Word Search Puzzle Book","Paw-some Word Search for Dog Lovers Volume {N}","The Dog Lover's Puzzle Book","Woof Word Search for Dog People","Dogs and Puppies Word Search"],
    keywords: ["dog lover word search puzzle book","dog word search gift","puppy word search book","pet lover puzzle book","dog themed word search","dog owner gift ideas","dog puzzle activity book","paw word search book"],
    backBlurb: "For everyone who loves dogs more than people! 100 fun word search puzzles celebrating our four-legged best friends — from breeds and behaviours to training and tricks. A perfect gift for dog owners, dog walkers, vets, and anyone with a furry companion at home.",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "cats",
    label: "Cat Lovers",
    puzzleType: "Word Search",
    words: ["KITTEN","PURR","MEOW","WHISKER","CLAW","POUNCE","TABBY","SIAMESE","PERSIAN","MAINE","BENGAL","RAGDOLL","SPHYNX","ABYSSINIAN","BIRMAN","BURMESE","NAPPING","GROOMING","PLAYFUL","CURIOUS","INDEPENDENT","ALOOF","GRACEFUL","ELEGANT","HUNTER","NOCTURNAL","SCRATCH","KNEAD","STRETCH","YAWN","CATNIP","LITTER","BOWL","COLLAR","WINDOW","SUNBEAM","PERCH","ROAM","STALK","LEAP","VETERINARY","MICROCHIP","DESEX","DENTAL","HAIRBALL","INDOOR","OUTDOOR","TERRITORY","ADOPT","FOSTER","RESCUE","SHELTER"],
    titles: ["Cat Lover Word Search Puzzle Book","Purr-fect Word Search for Cat Lovers Volume {N}","The Cat Lover's Puzzle Book","Meow Word Search for Cat People","Cats and Kittens Word Search"],
    keywords: ["cat lover word search puzzle book","cat word search gift","kitten word search book","cat themed word search","cat owner gift ideas","cat puzzle activity book","cat lover gift puzzle","feline word search book"],
    backBlurb: "For the cat person in your life! 100 entertaining word search puzzles celebrating everything feline — from popular breeds and quirky behaviours to the pure joy of living with cats. Makes a wonderful gift for cat lovers, veterinary staff, and anyone who understands that cats rule the house.",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "sudoku-easy",
    label: "Sudoku for Beginners",
    puzzleType: "Sudoku",
    words: ["LOGIC","GRID","PATTERN","STRATEGY","COLUMN","ROW","BOX","NUMBER","SEQUENCE","SOLVE","UNIQUE","DEDUCE","ELIMINATE","CONFIRM","PLACE","SCAN","NAKED","HIDDEN","SINGLE","PAIR","TRIPLE","QUAD","PENCIL","MARK","CANDIDATE","SUBSET","CHAIN","FORK","WING","FISH","SWORD","JELLYFISH","RECTANGLE","DIAGONAL","SYMMETRY","ROTATE","REFLECT","GIVENS","CLUE","HINT","EASY","SIMPLE","BEGINNER","LEARN","PRACTICE","DAILY","RELAX","CALM","FOCUS","CLEAR","SHARP","BRAIN"],
    titles: ["Easy Sudoku Puzzle Book for Beginners","Sudoku for Beginners Volume {N}","Learn Sudoku Easy Puzzles","Beginner Sudoku 100 Puzzles","Simple Sudoku Activity Book"],
    keywords: ["easy sudoku puzzle book beginners","sudoku for beginners large print","easy sudoku book adults","sudoku puzzles beginners","simple sudoku book","sudoku activity book seniors","learn sudoku puzzles","beginner brain games sudoku"],
    backBlurb: "The perfect sudoku book for beginners! 100 easy sudoku puzzles with generous grids and clear numbers, designed to build your skills gradually. Whether you're completely new to sudoku or just prefer a relaxing easy pace, this book is ideal for daily mental exercise.",
    recommendedDifficulty: "Easy",
    recommendedCount: 100,
  },
  {
    key: "sudoku-hard",
    label: "Sudoku for Experts",
    puzzleType: "Sudoku",
    words: ["LOGIC","DEDUCTION","INFERENCE","ELIMINATION","STRATEGY","CANDIDATE","BIFURCATION","HYPOTHESIS","CONTRADICTION","CHAIN","FORCING","NAKED","HIDDEN","LOCKED","PAIR","TRIPLE","QUAD","SWORDFISH","JELLYFISH","SQUIRMBAG","RECTANGLE","UNIQUE","DIAGONAL","NISHIO","PATTERN","OVERLAY","MULTIPLE","SOLUTION","BACKTRACK","TRIAL","ERROR","EXPERT","MASTER","EXTREME","DIABOLICAL","FIENDISH","BRUTAL","CHALLENGE","PUZZLE","ADVANCED","COMPLEX","DIFFICULT","SOLVE","TECHNIQUE","SKILL","PATIENCE","FOCUS","ANALYZE","REASON","VERIFY","DEDUCE"],
    titles: ["Hard Sudoku Puzzle Book for Experts","Expert Sudoku Challenges Volume {N}","Extreme Sudoku 100 Hard Puzzles","Master Level Sudoku","Ultimate Sudoku Challenge Book"],
    keywords: ["hard sudoku puzzle book expert","expert sudoku puzzles","extreme sudoku book","difficult sudoku challenges","master sudoku puzzles","advanced sudoku book","hard brain teasers sudoku","challenging sudoku activity book"],
    backBlurb: "Ready for a real challenge? 100 hard sudoku puzzles designed to test the sharpest minds. Each puzzle has a unique solution discoverable only through logical deduction — no guessing required. Perfect for experienced puzzlers who want a serious mental workout.",
    recommendedDifficulty: "Hard",
    recommendedCount: 100,
  },
  {
    key: "halloween",
    label: "Halloween",
    puzzleType: "Word Search",
    words: ["HALLOWEEN","PUMPKIN","GHOST","WITCH","VAMPIRE","ZOMBIE","MONSTER","SKELETON","SPIDER","COBWEB","HAUNTED","TRICK","TREAT","COSTUME","MASK","CANDY","CAULDRON","BROOMSTICK","BLACK","CAT","BAT","GRAVEYARD","CEMETERY","MOONLIGHT","SCREECH","HOWL","SCARE","FRIGHT","CREEP","EERIE","SINISTER","DARK","CACKLE","BREW","POTION","CURSE","SPELL","HEX","JACK","LANTERN","MUMMY","GOBLIN","PHANTOM","WEREWOLF","BANSHEE","COFFIN","TOMBSTONE","SCARECROW","OMEN","FOG","CRYPT","SHADOW"],
    titles: ["Halloween Word Search Puzzle Book","Spooky Word Search for Halloween Volume {N}","Haunted Halloween Puzzle Book","Trick or Treat Word Search","Halloween Activity Book Adults"],
    keywords: ["halloween word search puzzle book","spooky word search adults","halloween activity book","halloween word search large print","scary puzzle book halloween","halloween gift puzzle book","seasonal word search halloween","halloween brain games"],
    backBlurb: "Get in the Halloween spirit with 100 spooky word search puzzles! From witches and vampires to trick-or-treating and jack-o-lanterns, every puzzle is filled with Halloween magic. A perfect addition to your Halloween celebrations — for adults who love a good fright!",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "mothers-day",
    label: "Mother's Day",
    puzzleType: "Word Search",
    words: ["MOTHER","MOM","MOMMY","MAMA","LOVE","HUG","KISS","TENDER","CARE","NURTURE","FAMILY","HOME","HEART","FLOWER","ROSE","GARDEN","BREAKFAST","BRUNCH","CHOCOLATE","CAKE","COFFEE","RELAX","PEACE","STRENGTH","PATIENT","WISDOM","GUIDE","TEACH","PROTECT","CHERISH","BOND","PRECIOUS","BLESSING","GRACE","BEAUTY","WARMTH","COMFORT","SUPPORT","INSPIRE","CELEBRATE","SACRIFICE","DEVOTION","PRAYER","SMILE","JOURNAL","MEMORY","COOK","BAKE","CREATE","LAUGH","MIRACLE","ETERNAL"],
    titles: ["Mother's Day Word Search Puzzle Book","A Gift for Mom Word Search Volume {N}","Celebrating Mom Puzzle Book","Mom's Favourite Word Search","Mother's Day Activity Book"],
    keywords: ["mothers day word search puzzle book","gift for mom puzzle book","mother's day activity book","word search gift for mom","mother's day word search","mom puzzle gift ideas","mother's day present puzzle","gift for mum word search"],
    backBlurb: "The perfect Mother's Day gift! 100 beautiful word search puzzles celebrating the most important woman in your life. Filled with words of love, family, and appreciation. Give Mum something she can enjoy again and again — a thoughtful gift that shows how much you care.",
    recommendedDifficulty: "Easy",
    recommendedCount: 100,
  },
  {
    key: "truckers",
    label: "Truckers",
    puzzleType: "Word Search",
    words: ["TRUCKER","HIGHWAY","HAUL","FREIGHT","DIESEL","EIGHTEEN","WHEELER","LOAD","CARGO","DISPATCH","ROUTE","MILE","REST","STOP","WEIGH","STATION","LOGBOOK","BRAKE","CLUTCH","GEAR","ENGINE","EXHAUST","HONK","CONVOY","PASS","INTERSTATE","FREEWAY","BRIDGE","TUNNEL","MOUNTAIN","PLAINS","DESERT","DELIVERY","SCHEDULE","DEADLINE","SAFETY","LICENSE","PERMIT","FLATBED","TANKER","SLEEPER","BUNK","AXLE","DRIVE","SHAFT","DOT","HOURS","SERVICE","SCALE","COBBLESTONE","ASPHALT","TRAILER"],
    titles: ["Trucker Word Search Puzzle Book","Word Search for Truckers Volume {N}","Life on the Road Puzzle Book","The Trucker's Activity Book","Highway Word Search for Truck Drivers"],
    keywords: ["trucker word search puzzle book","truck driver word search gift","trucking word search book","trucker gift ideas puzzle","highway word search book","truck driver activity book","trucker puzzle book","long haul driver word search"],
    backBlurb: "Made for the men and women who keep America moving! 100 word search puzzles packed with trucking terminology, road life, and the open highway. A perfect companion for rest stops and breaks. Great gift for truck drivers, dispatchers, and anyone who loves life on the road.",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "gardening",
    label: "Gardening",
    puzzleType: "Word Search",
    words: ["GARDEN","PLANT","FLOWER","SEED","SOIL","COMPOST","MULCH","WATER","SUNLIGHT","PRUNE","WEED","HARVEST","GROW","BLOOM","PETAL","STEM","ROOT","LEAF","BRANCH","TREE","SHRUB","HERB","VEGETABLE","TOMATO","ROSE","TULIP","DAISY","LAVENDER","SUNFLOWER","DAHLIA","LILY","IRIS","ORCHID","FERN","MOSS","CACTUS","SUCCULENT","FERTILIZE","POLLINATE","BLOSSOM","TRELLIS","GREENHOUSE","CONTAINER","ANNUAL","PERENNIAL","POTTING","PROPAGATE","CULTIVATE","ORGANIC","IRRIGATE","COMPOST","EARTHWORM"],
    titles: ["Gardening Word Search Puzzle Book","The Gardener's Word Search Volume {N}","In Bloom Word Search Puzzles","Garden Lover's Puzzle Book","Plants and Flowers Word Search"],
    keywords: ["gardening word search puzzle book","garden lover puzzle gift","plant word search book","flower word search puzzles","gardening activity book adults","garden themed word search","botanical word search","gardening gift puzzle book"],
    backBlurb: "Perfect for green thumbs! 100 word search puzzles celebrating the joy of gardening — from flowers and vegetables to soil, seasons, and garden tools. Whether you garden indoors or out, this puzzle book is a lovely companion for rainy days when you can't be in the garden.",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "bible",
    label: "Bible & Faith",
    puzzleType: "Word Search",
    words: ["FAITH","PRAYER","WORSHIP","GRACE","BLESSING","SCRIPTURE","GOSPEL","COVENANT","SALVATION","BAPTISM","COMMUNION","TRINITY","HEAVEN","ANGEL","MIRACLE","PARABLE","PROPHET","APOSTLE","DISCIPLE","PSALM","PROVERB","GENESIS","EXODUS","REVELATION","JERUSALEM","NAZARETH","BETHLEHEM","SINAI","JORDAN","GALILEE","MOSES","DAVID","SOLOMON","NOAH","ABRAHAM","SARAH","RUTH","ESTHER","DANIEL","PAUL","WISDOM","COMMANDMENT","MERCY","FORGIVENESS","ETERNAL","SPIRIT","PRAISE","GLORIFY","TESTIFY","REDEEM","SANCTIFY","COMFORT"],
    titles: ["Bible Word Search Puzzle Book","Christian Word Search Volume {N}","Faith and Scripture Word Search","The Bible Puzzle Book for Adults","God's Word Search Puzzle Collection"],
    keywords: ["bible word search puzzle book","christian word search adults","faith puzzle book","scripture word search","religious word search book","bible study puzzle book","christian gift puzzle book","church word search activity"],
    backBlurb: "A word search book for people of faith! 100 puzzles filled with words from Scripture, biblical names, places, and themes of faith and devotion. A wonderful gift for church members, Bible study groups, and anyone who wants to deepen their familiarity with God's Word in a relaxing way.",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "cooking",
    label: "Cooking & Food",
    puzzleType: "Word Search",
    words: ["RECIPE","INGREDIENT","COOK","BAKE","SIMMER","SAUTE","ROAST","GRILL","FRY","BOIL","WHISK","KNEAD","CHOP","SLICE","DICE","MARINADE","SEASONING","HERB","SPICE","GARLIC","ONION","TOMATO","BUTTER","FLOUR","SUGAR","OLIVE","OIL","PASTA","RISOTTO","CASSEROLE","APPETIZER","ENTREE","DESSERT","CHOCOLATE","VANILLA","CINNAMON","BASIL","THYME","BROIL","STEAM","POACH","CURE","SMOKE","PICKLE","FERMENT","CARAMELIZE","DEGLAZE","EMULSIFY","BLANCH","REDUCE","BRAISE","JULIENNE"],
    titles: ["Cooking Word Search Puzzle Book","The Foodie's Word Search Volume {N}","Kitchen Word Search Puzzles","Cook's Word Search Activity Book","Recipes and Flavours Word Search"],
    keywords: ["cooking word search puzzle book","food lover word search gift","kitchen word search book","foodie puzzle book","recipe word search adults","cooking themed word search","culinary word search puzzles","baking word search book"],
    backBlurb: "A word search book for food lovers and kitchen enthusiasts! 100 puzzles packed with culinary vocabulary — from cooking techniques and ingredients to cuisines and kitchen tools. Whether you cook every day or just love food, this book makes a delicious gift!",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "travel",
    label: "Travel & Adventure",
    puzzleType: "Word Search",
    words: ["TRAVEL","ADVENTURE","EXPLORE","JOURNEY","VACATION","PASSPORT","LUGGAGE","FLIGHT","AIRPORT","HOTEL","HOSTEL","BACKPACK","TOUR","GUIDE","MAP","COMPASS","MOUNTAIN","OCEAN","BEACH","FOREST","CANYON","DESERT","ISLAND","CRUISE","TRAIN","ROAD","TRIP","CULTURE","MUSEUM","LANDMARK","CUISINE","LANGUAGE","CURRENCY","SOUVENIR","MEMORY","DISCOVER","WANDER","HORIZON","FREEDOM","EXPERIENCE","CAMPING","HIKING","SNORKELING","DIVING","KAYAKING","RAFTING","CLIMBING","SAFARI","FERRY","CHARTER","HOSTEL","ITINERARY"],
    titles: ["Travel Word Search Puzzle Book","The Explorer's Word Search Volume {N}","Wanderlust Word Search Puzzles","Around the World Word Search","Adventure Awaits Puzzle Book"],
    keywords: ["travel word search puzzle book","explorer word search gift","adventure puzzle book","wanderlust word search","travel themed word search","travel gift puzzle book","geography word search","vacation word search book"],
    backBlurb: "For people who love to travel or dream of it! 100 word search puzzles celebrating adventure, exploration, and the beauty of our world. From famous landmarks and exotic destinations to travel essentials and cultural wonders. A perfect companion for long flights and beach days!",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "maze-kids",
    label: "Kids Mazes",
    puzzleType: "Maze",
    words: ["MAZE","PATH","SOLVE","NAVIGATE","ENTRANCE","EXIT","DIRECTION","TURN","DEAD","END","ROUTE","EXPLORE","FIND","WAY","THROUGH","PUZZLE","BRAIN","CHALLENGE","ADVENTURE","JOURNEY","QUEST","HERO","TREASURE","REWARD","DISCOVER","HIDDEN","SECRET","PASSAGE","CORRIDOR","TUNNEL","BRIDGE","DOOR","KEY","LOCK","CLUE","MAP","COMPASS","NORTH","SOUTH","EAST","WEST","FORK","JUNCTION","CHOICE","DECISION","BACKTRACK","RETRY","PERSIST","SUCCEED","FINISH","WIN","VICTORY"],
    titles: ["Fun Mazes for Kids Activity Book","Amazing Mazes for Children Volume {N}","Kids Maze Puzzle Book Ages 6-12","Super Mazes for Boys and Girls","Kids Brain Games Maze Activity Book"],
    keywords: ["kids maze puzzle book","children maze activity book","maze book ages 6 12","fun mazes for kids","children brain games mazes","maze activity book boys girls","kids puzzle book mazes","school age maze book"],
    backBlurb: "Hundreds of exciting mazes for young adventurers! This activity book includes 100 fun maze puzzles ranging from simple to challenging, perfect for children aged 6-12. Great for developing problem-solving skills, focus, and patience. Every maze is a new adventure!",
    recommendedDifficulty: "Easy",
    recommendedCount: 100,
  },
  {
    key: "cryptogram-adults",
    label: "Cryptograms",
    puzzleType: "Cryptogram",
    words: ["CIPHER","ENCODE","DECODE","SUBSTITUTION","ALPHABET","LETTER","CODE","SYMBOL","KEY","PATTERN","FREQUENCY","ANALYSIS","CRACK","SOLVE","HIDDEN","SECRET","MESSAGE","QUOTE","PHRASE","WISDOM","INSPIRE","MOTIVATE","HUMOR","WIT","CLASSIC","LITERATURE","PHILOSOPHY","FAMOUS","AUTHOR","POET","PLAYWRIGHT","ORATOR","STATESMAN","SCIENTIST","ARTIST","INVENTOR","EXPLORER","MYSTERY","INTRIGUE","LOGIC","REASON","DEDUCE","INFERENCE","CLUE","REVEAL","DECRYPT","PLAINTEXT","CIPHERTEXT","SHIFT","ROTATE","TRANSPOSE","VIGENERE"],
    titles: ["Cryptogram Puzzle Book for Adults","Cryptogram Brain Teasers Volume {N}","Code Cracker Cryptogram Book","The Cryptogram Puzzle Collection","Mind-Bending Cryptograms Adults"],
    keywords: ["cryptogram puzzle book adults","cryptogram brain teasers","code cracker puzzle book","cryptogram activity book","letter substitution puzzle book","cryptogram challenge book","cryptogram gift adults","brain teaser puzzle book cryptogram"],
    backBlurb: "Crack the code! 100 cryptogram puzzles where every famous quote has been encoded with a unique letter substitution cipher. Use logic and pattern recognition to decode each message and reveal the inspiring quote hidden inside. A fantastic workout for language lovers and puzzle enthusiasts!",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "number-search",
    label: "Number Search",
    puzzleType: "Number Search",
    words: ["NUMBER","DIGIT","SEQUENCE","SERIES","PATTERN","SEARCH","FIND","HIDDEN","GRID","ROW","COLUMN","DIAGONAL","FORWARD","BACKWARD","HORIZONTAL","VERTICAL","PRIME","EVEN","ODD","SQUARE","CUBE","FRACTION","DECIMAL","PERCENT","RATIO","FACTOR","MULTIPLE","DIVISOR","INTEGER","NATURAL","WHOLE","COUNTING","ARITHMETIC","CALCULATION","ADDITION","SUBTRACTION","MULTIPLICATION","DIVISION","ALGEBRA","GEOMETRY","STATISTICS","PROBABILITY","LOGIC","SOLVE","PUZZLE","BRAIN","CHALLENGE","NUMERIC","MATHEMATICAL","ANALYTICAL","FOCUS","SHARP"],
    titles: ["Number Search Puzzle Book Adults","Find the Numbers Volume {N}","Number Search Activity Book","Math Number Search Puzzle Collection","Number Brain Games Activity Book"],
    keywords: ["number search puzzle book adults","number search activity book","find the numbers puzzle book","number puzzle book adults","math word search numbers","number brain games adults","digit search puzzle book","number puzzle gift adults"],
    backBlurb: "A refreshing twist on the classic word search! Instead of letters, find hidden number sequences in the grid. 100 number search puzzles with sequences hidden in every direction. A wonderful brain exercise for anyone who loves numbers, math, or just a different kind of challenge!",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "fathers-day",
    label: "Father's Day",
    puzzleType: "Word Search",
    words: ["FATHER","DAD","DADDY","PAPA","HERO","STRONG","WISE","GUIDE","PROTECT","PROVIDE","TEACH","COACH","MENTOR","SUPPORT","CHEER","LAUGH","FISH","GOLF","BBQ","GRILL","SPORTS","FOOTBALL","BASEBALL","BASKETBALL","CRICKET","WORKSHOP","BUILD","FIX","DRIVE","GARAGE","TOOLS","WRENCH","HAMMER","POWER","FAMILY","LOVE","BOND","TRUST","PROUD","BRAVE","BARBECUE","HUNT","HIKE","CAMP","WATCH","READ","RELAX","TINKER","RACE","CHEER","REFEREE","COACH"],
    titles: ["Father's Day Word Search Puzzle Book","A Gift for Dad Word Search Volume {N}","Celebrating Dad Puzzle Book","Dad's Favourite Word Search","Father's Day Activity Book"],
    keywords: ["fathers day word search puzzle book","gift for dad puzzle book","father's day activity book","word search gift for dad","father's day word search","dad puzzle gift ideas","father's day present puzzle","gift for father word search"],
    backBlurb: "The perfect Father's Day gift! 100 word search puzzles packed with everything dad loves — sports, hobbies, tools, and the joy of family. A thoughtful, fun gift that dad will enjoy long after Father's Day. Show him he's appreciated with something he can actually use and enjoy!",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "graduation",
    label: "Graduation",
    puzzleType: "Word Search",
    words: ["GRADUATE","DIPLOMA","DEGREE","ACHIEVEMENT","SUCCESS","FUTURE","CAREER","CELEBRATION","CEREMONY","TASSEL","GOWN","CAP","STAGE","APPLAUSE","SPEECH","HONOR","PRIDE","MILESTONE","JOURNEY","DEDICATION","PERSEVERE","KNOWLEDGE","WISDOM","OPPORTUNITY","AMBITION","DREAM","GOAL","PASSION","FOCUS","DISCIPLINE","MENTOR","UNIVERSITY","COLLEGE","SCHOOL","CAMPUS","CLASS","STUDY","EXAM","RESULT","REWARD","COMMENCEMENT","VALEDICTORIAN","SCHOLARSHIP","FELLOWSHIP","INTERNSHIP","CERTIFICATE","RECOGNITION","TRANSCRIPT","MAJOR","GPA","SUMMA","LAUDE"],
    titles: ["Graduation Word Search Puzzle Book","Congrats Graduate Word Search Volume {N}","Class of 2025 Word Search","Graduate's Puzzle Book","Graduation Day Activity Book"],
    keywords: ["graduation word search puzzle book","graduate word search gift","class of 2025 puzzle book","graduation activity book","student word search gift","commencement word search","graduation gift puzzle book","university college word search"],
    backBlurb: "Celebrate your graduate! 100 inspiring word search puzzles celebrating academic achievement, new beginnings, and the exciting road ahead. A thoughtful and unique graduation gift for high school or college graduates who deserve something special to mark this milestone.",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "valentines",
    label: "Valentine's Day",
    puzzleType: "Word Search",
    words: ["LOVE","HEART","ROMANCE","PASSION","DESIRE","ADORE","CHERISH","DEVOTION","AFFECTION","TENDER","SWEET","DARLING","BELOVED","KISS","HUG","FLOWER","ROSE","CHOCOLATE","CANDY","LETTER","POEM","DATE","DINNER","CANDLE","MUSIC","DANCE","PROMISE","FOREVER","TOGETHER","SOULMATE","DESTINY","BLISS","JOY","WARMTH","CARE","DREAM","WISH","TREASURE","PRECIOUS","ETERNAL","SERENADE","BOUQUET","EMBRACE","MOONLIGHT","STARLIGHT","CONFESSION","COMMITMENT","ANNIVERSARY","PROPOSAL","COURTSHIP","DEVOTION","ADMIRE"],
    titles: ["Valentine's Day Word Search Puzzle Book","Love and Romance Word Search Volume {N}","Be My Valentine Puzzle Book","Sweetheart Word Search Collection","Valentine's Day Activity Book Adults"],
    keywords: ["valentines day word search puzzle book","romance word search gift","love word search adults","valentine's day activity book","couples word search puzzle book","valentine gift puzzle book","love themed word search","heart word search adults"],
    backBlurb: "The most romantic puzzle book! 100 word search puzzles filled with love, romance, and all things Valentine's Day. A sweet and thoughtful gift for your partner, spouse, or anyone who believes in the magic of love. Spend a cozy evening solving puzzles together!",
    recommendedDifficulty: "Easy",
    recommendedCount: 100,
  },
  {
    key: "sports",
    label: "Sports",
    puzzleType: "Word Search",
    words: ["FOOTBALL","SOCCER","BASKETBALL","BASEBALL","TENNIS","GOLF","RUGBY","CRICKET","HOCKEY","SWIMMING","RUNNING","CYCLING","GYMNASTICS","BOXING","WRESTLING","ATHLETICS","CHAMPION","TROPHY","MEDAL","STADIUM","ARENA","COACH","TEAM","PLAYER","SCORE","GOAL","VICTORY","DEFEAT","TRAINING","STRATEGY","ATHLETE","COMPETE","TOURNAMENT","LEAGUE","SEASON","FINAL","OVERTIME","REFEREE","PENALTY","RECORD","MARATHON","TRIATHLON","DECATHLON","WEIGHTLIFTING","ROWING","ARCHERY","SKIING","SURFING","VOLLEYBALL","BADMINTON","FENCING","KAYAKING"],
    titles: ["Sports Word Search Puzzle Book","The Sports Fan's Word Search Volume {N}","Game On Sports Word Search","All Sports Word Search Collection","Sports Brain Games Activity Book"],
    keywords: ["sports word search puzzle book","sports fan word search gift","athletic word search book","football word search adults","sports themed word search","sports activity book gift","game word search puzzles","sports puzzle book adults"],
    backBlurb: "For the sports fan in your life! 100 word search puzzles covering every major sport — from football and basketball to tennis, golf, and the Olympics. Packed with sports vocabulary, team names, positions, and legendary moments. A perfect gift for any sports enthusiast!",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "space",
    label: "Space & Astronomy",
    puzzleType: "Word Search",
    words: ["PLANET","STAR","GALAXY","COMET","ASTEROID","METEOR","MOON","SUN","ORBIT","GRAVITY","TELESCOPE","ASTRONAUT","MISSION","LAUNCH","ROCKET","SATELLITE","STATION","MILKY","WAY","UNIVERSE","COSMOS","NEBULA","SUPERNOVA","BLACK","HOLE","QUASAR","PULSAR","ECLIPSE","SOLSTICE","EQUINOX","JUPITER","SATURN","MARS","VENUS","MERCURY","NEPTUNE","URANUS","PLUTO","EUROPA","TITAN","CONSTELLATION","ZODIAC","ANDROMEDA","CASSINI","VOYAGER","APOLLO","ARTEMIS","HUBBLE","WEBB","INFRARED","ULTRAVIOLET","SINGULARITY"],
    titles: ["Space Word Search Puzzle Book","Astronomy Word Search Volume {N}","Out of This World Word Search","The Space Lover's Puzzle Book","Galaxy Word Search Collection"],
    keywords: ["space word search puzzle book","astronomy word search gift","galaxy puzzle book adults","science word search space","space themed activity book","astronaut word search","astronomy activity book","space puzzle gift adults"],
    backBlurb: "Blast off with 100 out-of-this-world word search puzzles! From planets and stars to black holes and astronauts, every puzzle celebrates the wonder of space and astronomy. Perfect for science fans, star-gazers, and anyone who looks up at the night sky and wonders.",
    recommendedDifficulty: "Medium",
    recommendedCount: 100,
  },
  {
    key: "retirement",
    label: "Retirement",
    puzzleType: "Word Search",
    words: ["RETIRE","FREEDOM","RELAX","TRAVEL","GARDEN","GOLF","FISH","HOBBY","ENJOY","CELEBRATE","MILESTONE","CHAPTER","NEXT","JOURNEY","LEISURE","PEACEFUL","DESERVE","REST","SLEEP","MORNING","COFFEE","READ","PUZZLE","CRAFT","VOLUNTEER","GRANDCHILD","FAMILY","FRIEND","SOCIAL","ACTIVE","HEALTHY","HAPPY","BLESSED","GRATEFUL","ACHIEVE","SUCCESS","CAREER","LEGACY","HONOR","PROUD","BUCKET","LIST","GRANDPARENT","MEMOIR","WISDOM","PENSION","INVEST","MENTOR","COMMUNITY","EXPLORE","DISCOVER","FLOURISH"],
    titles: ["Retirement Word Search Puzzle Book","Happy Retirement Word Search Volume {N}","The Retiree's Puzzle Book","Retired and Loving It Word Search","Celebration of Retirement Puzzle Book"],
    keywords: ["retirement word search puzzle book","retirement gift puzzle book","retiree word search","retirement activity book","retirement gift ideas puzzle","happy retirement word search","retired person puzzle book","retirement word search large print"],
    backBlurb: "Celebrate a well-deserved retirement! 100 word search puzzles celebrating this incredible new chapter — rest, travel, hobbies, and the joy of not setting an alarm. A wonderful retirement gift that captures the excitement and freedom of this milestone. Congratulations!",
    recommendedDifficulty: "Easy",
    recommendedCount: 100,
  },
  {
    key: "minecraft",
    label: "Minecraft & Gaming",
    puzzleType: "Word Search",
    words: ["MINECRAFT","CREEPER","ZOMBIE","SKELETON","ENDERMAN","DIAMOND","REDSTONE","CRAFTING","SURVIVAL","CREATIVE","BIOME","VILLAGE","CASTLE","DUNGEON","SPAWN","RESPAWN","PORTAL","NETHER","ENDWORLD","DRAGON","PICKAXE","SWORD","SHIELD","ARMOR","ENCHANT","POTION","FARM","BUILD","EXPLORE","MINE","CRAFT","SMELT","FORGE","QUEST","ADVENTURE","PIXEL","BLOCK","CHUNK","RENDER","SERVER","OBSIDIAN","NETHERITE","COBBLESTONE","ENCHANTMENT","BEDROCK","COMMAND","COORDINATE","TORCH","FURNACE","CHEST","ANVIL","COMPASS"],
    titles: ["Minecraft Word Search Puzzle Book","Gaming Word Search for Kids Volume {N}","Epic Gaming Word Search Book","Video Game Word Search Collection","The Gamer's Puzzle Book"],
    keywords: ["minecraft word search puzzle book","gaming word search kids","video game word search","minecraft activity book kids","gamer word search gift","gaming puzzle book","minecraft puzzle book children","video game puzzle activity book"],
    backBlurb: "A word search book for gamers! 100 puzzles packed with Minecraft and gaming vocabulary — from biomes and mobs to crafting and building. Perfect for young gamers who want a fun break from the screen, or as a birthday gift for any child who loves video games!",
    recommendedDifficulty: "Easy",
    recommendedCount: 100,
  },
  {
    key: "birthdays",
    label: "Birthday",
    puzzleType: "Word Search",
    words: ["BIRTHDAY","CELEBRATE","PARTY","CAKE","CANDLE","BALLOON","GIFT","PRESENT","FRIEND","FAMILY","LAUGH","DANCE","MUSIC","SURPRISE","CONFETTI","BANNER","WISH","DREAM","JOY","HAPPY","CHEER","TOAST","DRINK","SING","GATHER","MILESTONE","MEMORY","MOMENT","SPECIAL","WONDERFUL","AMAZING","FANTASTIC","INCREDIBLE","TREASURE","CHERISH","LOVE","GROW","SHINE","GLITTER","SPARKLE","DECADE","NOSTALGIA","KEEPSAKE","SCRAPBOOK","PHOTO","ALBUM","REMINISCE","TRIBUTE","CELEBRATE","HONOR","ADORE","ADMIRE"],
    titles: ["Happy Birthday Word Search Puzzle Book","Birthday Celebration Word Search Volume {N}","The Birthday Puzzle Book","Birthday Fun Word Search Collection","Celebrate Your Birthday Puzzle Book"],
    keywords: ["birthday word search puzzle book","happy birthday puzzle gift","birthday activity book adults","birthday word search gift","celebration word search book","birthday party puzzle book","birthday gift ideas word search","birthday puzzle book adults"],
    backBlurb: "The perfect birthday gift! 100 festive word search puzzles all about celebrating in style. From cake and confetti to gifts and laughter, every puzzle captures the joy of a birthday. A fun, thoughtful gift for anyone having a birthday — no matter what age they're turning!",
    recommendedDifficulty: "Easy",
    recommendedCount: 100,
  },
  {
    key: "anxiety-mindfulness",
    label: "Mindfulness & Calm",
    puzzleType: "Word Search",
    words: ["MINDFUL","BREATHE","CALM","PEACE","RELAX","PRESENT","MOMENT","STILLNESS","SILENCE","MEDITATE","AWARENESS","BALANCE","HARMONY","GENTLE","SLOW","PAUSE","RELEASE","ACCEPT","GROUND","CENTER","FOCUS","CLEAR","SERENE","TRANQUIL","PATIENCE","TRUST","FLOW","OPEN","SOFT","LIGHT","GRATEFUL","THANKFUL","NOTICE","OBSERVE","ALLOW","RETURN","SIMPLE","REST","RESTORE","RENEW","YOGA","JOURNAL","NATURE","FOREST","WALK","VISUALIZE","AFFIRM","RECONNECT","UNPLUG","NOURISH","SOOTHE","RECEIVE"],
    titles: ["Mindfulness Word Search Puzzle Book","Calm and Relaxing Word Search Volume {N}","Stress Relief Word Search Puzzles","Anxiety Relief Activity Book","The Peaceful Mind Puzzle Book"],
    keywords: ["mindfulness word search puzzle book","calm word search adults","anxiety relief puzzle book","stress relief word search","relaxing puzzle book adults","mindfulness activity book","calming puzzle book gift","meditation word search book"],
    backBlurb: "A truly calming puzzle experience. 100 gentle word search puzzles filled with words of peace, mindfulness, and wellbeing. Whether you're managing stress, practising mindfulness, or just need a quiet activity, this book provides a soothing escape. Perfect for self-care gift giving.",
    recommendedDifficulty: "Easy",
    recommendedCount: 100,
  },
  {
    key: "thanksgiving",
    label: "Thanksgiving",
    puzzleType: "Word Search",
    words: ["THANKSGIVING","TURKEY","STUFFING","GRAVY","CRANBERRY","PUMPKIN","HARVEST","CORNUCOPIA","PILGRIM","GRATITUDE","THANKFUL","BLESSING","FEAST","GATHER","FAMILY","AUTUMN","FALL","MAPLE","APPLE","CIDER","CORN","SQUASH","CASSEROLE","POTATO","BREAD","BUTTER","CANDLE","PRAYER","TRADITION","FOOTBALL","PARADE","ANCESTOR","GRATEFUL","BOUNTY","ABUNDANCE","ORCHARD","LEAF","ACORN","PECAN","WALNUT","CHESTNUT","CRANBERRY","PLUM","COBBLER","CINNAMON","NUTMEG","CLOVE","ALLSPICE","HEARTH","WARMTH","GATHER","FELLOWSHIP"],
    titles: ["Thanksgiving Word Search Puzzle Book","Harvest Word Search Volume {N}","Give Thanks Puzzle Book","The Thanksgiving Activity Book","Grateful Hearts Word Search"],
    keywords: ["thanksgiving word search puzzle book","harvest word search adults","thanksgiving activity book","thanksgiving gift puzzle book","fall word search seasonal","thanksgiving family puzzle","harvest festival word search","autumn word search book"],
    backBlurb: "Celebrate the season of gratitude with 100 warm and festive Thanksgiving word search puzzles! From turkey and pumpkin pie to harvest and family togetherness, every puzzle captures the spirit of the most thankful time of year. A wonderful gift for the whole family!",
    recommendedDifficulty: "Easy",
    recommendedCount: 100,
  },
  {
    key: "easter-spring",
    label: "Easter & Spring",
    puzzleType: "Word Search",
    words: ["EASTER","BUNNY","EGG","HUNT","BASKET","CHOCOLATE","CANDY","SPRING","FLOWER","PASTEL","CHICK","LAMB","CROSS","RESURRECTION","CHURCH","WORSHIP","HYMN","LILY","TULIP","DAFFODIL","BLOOM","BONNET","PARADE","FAMILY","BRUNCH","HOPE","RENEWAL","REBIRTH","DAWN","SUNRISE","SERVICE","ANGEL","RISEN","ALLELUIA","CELEBRATE","PALM","SUNDAY","LENT","DOVE","RAINBOW","BUTTERFLY","BLOSSOM","ROBIN","NEST","LADYBUG","BEE","PETAL","RAIN","SHOWER","GARDEN","SEEDLING","PASTURE"],
    titles: ["Easter Word Search Puzzle Book","Spring Word Search Volume {N}","He Is Risen Easter Puzzle Book","Easter and Spring Activity Book","Hoppy Easter Word Search Collection"],
    keywords: ["easter word search puzzle book","spring word search adults","easter activity book","easter gift puzzle book","christian easter word search","spring themed word search","easter basket puzzle book","spring word search gift"],
    backBlurb: "Welcome spring with 100 joyful Easter word search puzzles! Celebrate new life, family traditions, and the beauty of the season — from Easter eggs and baskets to spring blooms and church services. A beautiful gift for Easter baskets or spring celebrations!",
    recommendedDifficulty: "Easy",
    recommendedCount: 100,
  },
  {
    key: "maze-adults",
    label: "Mazes for Adults",
    puzzleType: "Maze",
    words: ["LABYRINTH","NAVIGATE","COMPLEX","CHALLENGE","STRATEGY","PATHWAY","CORRIDOR","SOLUTION","DEADEND","BACKTRACK","JUNCTION","BRANCHING","INTERSECTION","OBSTACLE","ROUTE","CIRCUIT","SPIRAL","CONCENTRIC","FRACTAL","GEOMETRIC","SYMMETRY","PATTERN","LOGIC","REASON","SPATIAL","VISUAL","PERCEPTION","ORIENTATION","DIRECTION","COMPASS","CLOCKWISE","COUNTER","DISTANCE","SHORTCUT","OPTIMAL","EFFICIENT","SYSTEMATIC","METHODICAL","PATIENCE","PERSISTENCE","FOCUS","CONCENTRATION","REWARD","VICTORY","COMPLETE","FINISH","SUCCEED","MASTER","EXPERT","SOLVE","DISCOVER","TRIUMPH"],
    titles: ["Difficult Mazes for Adults","Expert Maze Puzzle Book Volume {N}","Advanced Maze Challenge Book","The Ultimate Adult Maze Collection","Mind-Bending Mazes for Grown-Ups"],
    keywords: ["adult maze puzzle book","difficult mazes adults","challenging maze book","expert maze puzzle","adult brain games mazes","complex maze activity book","maze puzzle gift adults","advanced maze challenge book"],
    backBlurb: "A serious challenge for maze enthusiasts! 100 complex maze puzzles ranging from difficult to fiendishly intricate. Perfect for adults who want to sharpen their spatial reasoning, test their problem-solving skills, and enjoy the satisfying feeling of navigating to the finish!",
    recommendedDifficulty: "Hard",
    recommendedCount: 100,
  },
];

export function getNicheByKey(key: string): NicheData | undefined {
  return NICHES.find(n => n.key === key);
}

export function listNiches() {
  return NICHES.map(n => ({ key: n.key, label: n.label, puzzleType: n.puzzleType }));
}

/**
 * Expands a niche word bank from ~50 seed words to 200+ unique thematic words
 * using a single Claude Haiku call. Results are merged and deduplicated with the
 * existing seed list. Falls back to the seed if AI returns fewer than 80 words.
 *
 * Only relevant for word-based puzzle types (Word Search, Crossword).
 */
export async function expandNicheWordBank(
  niche: string,
  puzzleType: string,
  difficulty: string,
  audience: string,
  existingSeed: string[],
): Promise<string[]> {
  const seedSet = new Set(
    existingSeed.map(w => w.toUpperCase().trim()).filter(w => w.length >= 3 && /^[A-Z]+$/.test(w)),
  );

  const prompt = `You are a professional KDP puzzle book editor. Generate 200 additional thematic words for a word search or crossword puzzle book.

Niche: ${niche}
Puzzle type: ${puzzleType}
Difficulty: ${difficulty}
Target audience: ${audience}

Rules:
- UPPERCASE only, single words with letters only (no spaces, hyphens, or punctuation)
- 3–15 characters each
- Thematically relevant — every word should feel at home in a "${niche}" puzzle book
- Audience-appropriate (avoid obscure jargon for Easy/Senior niches; technical terms welcome for expert niches)
- Mix of short words (3–5 letters) and longer words (8–12 letters)
- Proper nouns allowed only if the niche is about people, places, or proper names (e.g. biblical names for a bible niche)
- DO NOT include any of these already-used seed words: ${[...seedSet].join(", ")}

Return ONLY a JSON array of strings, no markdown, no explanation.
Example: ["WORD1","WORD2","WORD3"]`;

  try {
    const { anthropic } = await import("@workspace/integrations-anthropic-ai");
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "[]";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    const rawWords: unknown = JSON.parse(start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned);

    if (!Array.isArray(rawWords)) return [...seedSet];

    const newWords: string[] = (rawWords as unknown[])
      .filter(w => typeof w === "string")
      .map(w => (w as string).toUpperCase().trim())
      .filter(w => w.length >= 3 && w.length <= 15 && /^[A-Z]+$/.test(w))
      .filter(w => !seedSet.has(w));

    const merged = [...seedSet, ...new Set(newWords)];
    if (merged.length < 80) return [...seedSet];

    return merged;
  } catch {
    return [...seedSet];
  }
}
