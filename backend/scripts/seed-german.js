/**
 * scripts/seed-german.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds the HabitGerman table with rich, level-appropriate German content for
 * EVERY CEFR level (A1.1 → C2.2) so the app can be tested end-to-end.
 *
 * For a given account it:
 *   1. Deletes every existing German record for that user,
 *   2. Creates chapters per level,
 *   3. Fills vocab, grammar, verbs, dialogues, memos, expressions, idioms,
 *      mistakes, books, resources and notes (chapters are tagged where useful),
 *   4. Adds the full A1.1 alphabet.
 *
 * Usage: node scripts/seed-german.js <email>
 */

const bcrypt = require('bcryptjs');
const { QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../db/dynamodb');
const { getUserByEmail, createUser } = require('../db/users');
const german = require('../db/german');

const TABLE = 'HabitGerman';

// ── Content ──────────────────────────────────────────────────────────────────
// Each level: chapters[], vocab[{w,t,ex,cat,ch}], grammar[{rule,expl,exs[],cat}],
// verbs[{i,meaning,ich,du,er,wir,ihr,sie,cat}], dialogues[{title,parts,lines}],
// memos[{title,content,german,english}], expressions[{p,t,cat}],
// idioms[{p,t,meaning,usage}], mistakes[{inc,cor,why}],
// books[{name,author,notes}], resources[{url,kind,title,author,handle}],
// notes[{cat,daysAgo,content,ch}]  (ch = chapter index, null = unassigned)
//
// vocab/notes use their `ch` field; grammar, verbs, dialogues, memos,
// expressions, idioms and mistakes are tagged to chapters round-robin so every
// chapter page in the PDF report carries all of its sections.

const SEED = {
  'A1.1': {
    chapters: [
      'Lektion 1 · Begrüßungen & Vorstellung',
      'Lektion 2 · Familie & Personen',
      'Lektion 3 · Essen & Trinken',
      'Lektion 4 · Alltag & Freizeit',
    ],
    vocab: [
      { w: 'Hallo', t: 'hello', ex: 'Hallo, wie geht es dir?', cat: 'Greetings', ch: 0 },
      { w: 'Guten Morgen', t: 'good morning', ex: 'Guten Morgen, Frau Müller!', cat: 'Greetings', ch: 0 },
      { w: 'Tschüss', t: 'bye', ex: 'Tschüss, bis morgen!', cat: 'Greetings', ch: 0 },
      { w: 'ich heiße', t: 'my name is', ex: 'Ich heiße Anna.', cat: 'Greetings', ch: 0 },
      { w: 'die Familie', t: 'the family', ex: 'Meine Familie ist groß.', cat: 'Family', ch: 1 },
      { w: 'der Vater', t: 'the father', ex: 'Mein Vater arbeitet in Berlin.', cat: 'Family', ch: 1 },
      { w: 'die Mutter', t: 'the mother', ex: 'Meine Mutter kocht gut.', cat: 'Family', ch: 1 },
      { w: 'der Bruder', t: 'the brother', ex: 'Ich habe einen Bruder.', cat: 'Family', ch: 1 },
      { w: 'das Essen', t: 'the food', ex: 'Das Essen schmeckt sehr gut.', cat: 'Food', ch: 2 },
      { w: 'das Wasser', t: 'the water', ex: 'Ich trinke ein Glas Wasser.', cat: 'Food', ch: 2 },
      { w: 'der Apfel', t: 'the apple', ex: 'Ein Apfel am Tag.', cat: 'Food', ch: 2 },
      { w: 'das Brot', t: 'the bread', ex: 'Ich kaufe frisches Brot.', cat: 'Food', ch: 2 },
      { w: 'die Schule', t: 'the school', ex: 'Die Schule beginnt um acht Uhr.', cat: 'Daily Life', ch: 3 },
      { w: 'das Buch', t: 'the book', ex: 'Ich lese ein Buch.', cat: 'Daily Life', ch: 3 },
    ],
    grammar: [
      { rule: 'Das Verb "sein"', expl: 'The verb "sein" (to be) is irregular: ich bin, du bist, er/sie/es ist, wir sind, ihr seid, sie sind.', exs: ['Ich bin Lehrer.', 'Wir sind aus Tunesien.'], cat: 'Verbs' },
      { rule: 'Das Verb "haben"', expl: 'The verb "haben" (to have): ich habe, du hast, er/sie/es hat, wir haben, ihr habt, sie haben.', exs: ['Ich habe eine Schwester.', 'Er hat keine Zeit.'], cat: 'Verbs' },
      { rule: 'Der, die, das', expl: 'Every German noun has a gender. der = masculine, die = feminine, das = neuter. Learn the article together with the noun.', exs: ['der Mann, die Frau, das Kind'], cat: 'Articles' },
      { rule: 'W-Fragen', expl: 'Question words: Wer (who), Was (what), Wo (where), Woher (from where), Wann (when).', exs: ['Woher kommst du?', 'Was machst du?'], cat: 'Questions' },
      { rule: 'Verbkonjugation (regelmäßig)', expl: 'Regular verbs take the endings: ich -e, du -st, er/sie/es -t, wir -en, ihr -t, sie -en.', exs: ['ich lerne, du lernst, er lernt, wir lernen'], cat: 'Verbs' },
    ],
    verbs: [
      { i: 'sein', meaning: 'to be', ich: 'bin', du: 'bist', er: 'ist', wir: 'sind', ihr: 'seid', sie: 'sind', cat: 'Irregular' },
      { i: 'haben', meaning: 'to have', ich: 'habe', du: 'hast', er: 'hat', wir: 'haben', ihr: 'habt', sie: 'haben', cat: 'Irregular' },
      { i: 'heißen', meaning: 'to be called', ich: 'heiße', du: 'heißt', er: 'heißt', wir: 'heißen', ihr: 'heißt', sie: 'heißen', cat: 'Regular' },
      { i: 'kommen', meaning: 'to come', ich: 'komme', du: 'kommst', er: 'kommt', wir: 'kommen', ihr: 'kommt', sie: 'kommen', cat: 'Regular' },
      { i: 'wohnen', meaning: 'to live / reside', ich: 'wohne', du: 'wohnst', er: 'wohnt', wir: 'wohnen', ihr: 'wohnt', sie: 'wohnen', cat: 'Regular' },
    ],
    dialogues: [
      { title: 'Begrüßung im Deutschkurs', parts: [{ name: 'Anna', gender: 'female' }, { name: 'Thomas', gender: 'male' }], lines: [
        [0, 'Hallo! Ich heiße Anna. Wie heißt du?'],
        [1, 'Hallo Anna! Ich heiße Thomas. Woher kommst du?'],
        [0, 'Ich komme aus Tunesien. Und du?'],
        [1, 'Ich komme aus Spanien. Ich wohne jetzt in München.'],
        [0, 'Das ist schön. Wir sind im gleichen Kurs!'],
      ] },
      { title: 'Im Café bestellen', parts: [{ name: 'Gast', gender: 'female' }, { name: 'Kellner', gender: 'male' }], lines: [
        [1, 'Guten Tag! Was möchten Sie?'],
        [0, 'Guten Tag! Ich möchte einen Kaffee und ein Stück Kuchen, bitte.'],
        [1, 'Möchten Sie den Kuchen mit Sahne?'],
        [0, 'Nein, danke. Nur den Kuchen.'],
        [1, 'Bitte schön. Das macht zusammen sechs Euro.'],
        [0, 'Vielen Dank!'],
      ] },
    ],
    memos: [
      { title: 'Meine Familie vorstellen', content: 'A simple paragraph to introduce my family using sein, haben and possessive pronouns.', german: 'Ich heiße Rami und komme aus Tunis. Ich habe einen Vater, eine Mutter, einen Bruder und eine Schwester. Mein Vater heißt Sami und arbeitet als Ingenieur. Meine Mutter ist Lehrerin. Mein Bruder ist zwanzig Jahre alt und mein Studium. Unsere Familie ist sehr glücklich.', english: 'My name is Rami and I come from Tunis. I have a father, a mother, a brother and a sister. My father is called Sami and works as an engineer. My mother is a teacher. My brother is twenty years old and my study. Our family is very happy.' },
      { title: 'Einkaufen gehen', content: 'A short memo about going shopping, using food vocabulary and how much things cost.', german: 'Heute gehe ich einkaufen. Ich brauche Brot, Äpfel und Wasser. Das Brot kostet zwei Euro und fünfzig. Die Äpfel kosten drei Euro pro Kilo. Das Wasser kostet einen Euro. Ich bezahle an der Kasse.', english: 'Today I go shopping. I need bread, apples and water. The bread costs two euros fifty. The apples cost three euros per kilo. The water costs one euro. I pay at the checkout.' },
    ],
    expressions: [
      { p: 'Guten Morgen!', t: 'Good morning!', cat: 'Greetings' },
      { p: 'Wie geht es dir?', t: 'How are you?', cat: 'Greetings' },
      { p: 'Mir geht es gut, danke.', t: 'I am fine, thank you.', cat: 'Greetings' },
      { p: 'Danke schön!', t: 'Thank you very much!', cat: 'Politeness' },
      { p: 'Bitte schön.', t: 'You are welcome / Here you go.', cat: 'Politeness' },
      { p: 'Entschuldigung!', t: 'Excuse me / Sorry!', cat: 'Politeness' },
    ],
    idioms: [
      { p: 'Das ist mir Wurst.', t: 'I do not care.', meaning: 'Literally "that is sausage to me"; used when something is not important to you.', usage: 'Soll ich die blaue oder die rote Tasche kaufen? Das ist mir Wurst.' },
      { p: 'Tomaten auf den Augen haben', t: 'to be blind to something obvious', meaning: 'Not to notice something that is right in front of you.', usage: 'Ich habe den Fehler nicht gesehen – ich hatte Tomaten auf den Augen.' },
    ],
    mistakes: [
      { inc: 'Ich bin gut.', cor: 'Mir geht es gut.', why: '"Ich bin gut" means "I am good (a good person)". To say you feel well, use "Mir geht es gut".' },
      { inc: 'Hast du hunger?', cor: 'Hast du Hunger?', why: 'Nouns are always capitalised in German, so the noun "der Hunger" must be written with a capital H.' },
    ],
    books: [
      { name: 'Menschen A1.1', author: 'Hueber Verlag', notes: 'Great starter course book with lots of everyday dialogues and listening exercises.' },
      { name: 'Netzwerk A1', author: 'Langenscheidt', notes: 'Good for building vocabulary with picture-based tasks.' },
    ],
    resources: [
      { url: 'https://www.youtube.com/@EasyGerman', kind: 'channel', title: 'Easy German', author: 'Easy Languages', handle: '@EasyGerman' },
      { url: 'https://www.youtube.com/@LearnGermanWithAnja', kind: 'channel', title: 'Learn German with Anja', author: 'Anja', handle: '@LearnGermanWithAnja' },
      { url: 'https://www.youtube.com/@GermanWithLaura', kind: 'channel', title: 'German with Laura', author: 'Laura', handle: '@GermanWithLaura' },
    ],
    notes: [
      { cat: 'daily', daysAgo: 0, content: 'Heute habe ich Deutsch gelernt. Ich habe die Begrüßungen geübt: Hallo, Guten Morgen, Tschüss. Ich kenne jetzt die Verben sein und haben.', ch: 0 },
      { cat: 'writing', daysAgo: 1, content: 'Ich habe einen kurzen Text über meine Familie geschrieben. Ich habe die Wörter Vater, Mutter, Bruder und Schwester benutzt.', ch: 1 },
      { cat: 'reading', daysAgo: 3, content: 'Ich habe eine einfache Leseübung über das Einkaufen gelesen. Neue Wörter: das Brot, der Apfel, das Wasser.', ch: null },
    ],
  },

  'A1.2': {
    chapters: [
      'Lektion 5 · Unterwegs & Reisen',
      'Lektion 6 · Wohnen & Zuhause',
      'Lektion 7 · Arbeit & Beruf',
      'Lektion 8 · Gesundheit & Körper',
    ],
    vocab: [
      { w: 'der Zug', t: 'the train', ex: 'Der Zug fährt um neun Uhr ab.', cat: 'Travel', ch: 0 },
      { w: 'der Flughafen', t: 'the airport', ex: 'Der Flughafen ist weit weg.', cat: 'Travel', ch: 0 },
      { w: 'das Hotel', t: 'the hotel', ex: 'Wir übernachten im Hotel.', cat: 'Travel', ch: 0 },
      { w: 'die Straße', t: 'the street', ex: 'Die Straße ist sehr lang.', cat: 'Travel', ch: 0 },
      { w: 'die Wohnung', t: 'the apartment', ex: 'Unsere Wohnung hat drei Zimmer.', cat: 'Home', ch: 1 },
      { w: 'das Zimmer', t: 'the room', ex: 'Mein Zimmer ist klein und hell.', cat: 'Home', ch: 1 },
      { w: 'die Küche', t: 'the kitchen', ex: 'Die Küche ist modern.', cat: 'Home', ch: 1 },
      { w: 'der Beruf', t: 'the profession', ex: 'Was ist Ihr Beruf?', cat: 'Work', ch: 2 },
      { w: 'die Arbeit', t: 'the work', ex: 'Die Arbeit beginnt um acht.', cat: 'Work', ch: 2 },
      { w: 'das Büro', t: 'the office', ex: 'Ich arbeite im Büro.', cat: 'Work', ch: 2 },
      { w: 'der Arzt', t: 'the doctor', ex: 'Ich muss zum Arzt gehen.', cat: 'Health', ch: 3 },
      { w: 'der Kopf', t: 'the head', ex: 'Mein Kopf tut weh.', cat: 'Health', ch: 3 },
      { w: 'die Medizin', t: 'the medicine', ex: 'Ich nehme die Medizin jeden Tag.', cat: 'Health', ch: 3 },
      { w: 'müde', t: 'tired', ex: 'Ich bin heute sehr müde.', cat: 'Feelings', ch: 3 },
    ],
    grammar: [
      { rule: 'Präteritum: war / hatte', expl: 'The simple past of sein is "war" (ich war) and of haben is "hatte" (ich hatte). Used mainly for narration.', exs: ['Gestern war ich im Kino.', 'Ich hatte viel Arbeit.'], cat: 'Past Tense' },
      { rule: 'Modalverb können', expl: 'können = to be able to. ich kann, du kannst, er kann, wir können, ihr könnt, sie können. The main verb goes to the end.', exs: ['Ich kann Deutsch sprechen.', 'Können Sie mir helfen?'], cat: 'Modal Verbs' },
      { rule: 'Wortstellung: Verb an zweiter Stelle', expl: 'In main clauses the finite verb always stands in second position.', exs: ['Ich lerne heute Deutsch.', 'Heute lerne ich Deutsch.'], cat: 'Sentence Structure' },
      { rule: 'Wo oder wohin?', expl: 'Wo = where (place, dative). Wohin = where to (direction, accusative).', exs: ['Wo wohnst du?', 'Wohin gehst du?'], cat: 'Questions' },
      { rule: 'Possessivartikel: mein / dein', expl: 'my / your. mein Vater, deine Mutter, mein Buch. Ending changes with gender and case.', exs: ['Das ist mein Bruder.', 'Ist das deine Tasche?'], cat: 'Grammar Basics' },
    ],
    verbs: [
      { i: 'fahren', meaning: 'to drive / travel', ich: 'fahre', du: 'fährst', er: 'fährt', wir: 'fahren', ihr: 'fahrt', sie: 'fahren', cat: 'Irregular' },
      { i: 'gehen', meaning: 'to go', ich: 'gehe', du: 'gehst', er: 'geht', wir: 'gehen', ihr: 'geht', sie: 'gehen', cat: 'Irregular' },
      { i: 'arbeiten', meaning: 'to work', ich: 'arbeite', du: 'arbeitest', er: 'arbeitet', wir: 'arbeiten', ihr: 'arbeitet', sie: 'arbeiten', cat: 'Regular' },
      { i: 'schlafen', meaning: 'to sleep', ich: 'schlafe', du: 'schläfst', er: 'schläft', wir: 'schlafen', ihr: 'schlaft', sie: 'schlafen', cat: 'Irregular' },
      { i: 'müssen', meaning: 'to have to', ich: 'muss', du: 'musst', er: 'muss', wir: 'müssen', ihr: 'müsst', sie: 'müssen', cat: 'Modal Verbs' },
    ],
    dialogues: [
      { title: 'Am Bahnhof', parts: [{ name: 'Fahrgast', gender: 'male' }, { name: 'Angestellter', gender: 'female' }], lines: [
        [0, 'Guten Tag! Ich möchte eine Fahrkarte nach Berlin, bitte.'],
        [1, 'Guten Tag! Einfach oder hin und zurück?'],
        [0, 'Hin und zurück, bitte. Wie viel kostet das?'],
        [1, 'Das kostet 58 Euro. Der Zug fährt um 10:15 Uhr von Gleis 3 ab.'],
        [0, 'Danke schön! Wann kommt der Zug in Berlin an?'],
        [1, 'Um 13:40 Uhr. Gute Reise!'],
      ] },
      { title: 'Beim Arzt einen Termin machen', parts: [{ name: 'Patient', gender: 'female' }, { name: 'Sprechstundenhilfe', gender: 'female' }], lines: [
        [0, 'Guten Morgen! Ich möchte einen Termin beim Arzt machen.'],
        [1, 'Guten Morgen! Wann möchten Sie kommen?'],
        [0, 'Morgen um zehn Uhr wäre gut.'],
        [1, 'Um zehn Uhr ist alles besetzt. Um halb elf geht es.'],
        [0, 'Das ist okay. Ich habe nämlich Kopfschmerzen.'],
        [1, 'Alles klar. Bis morgen um halb elf!'],
      ] },
    ],
    memos: [
      { title: 'Mein Zuhause beschreiben', content: 'Describe my home using location words and the rooms of the house.', german: 'Meine Wohnung liegt im Zentrum von München. Sie hat eine Küche, ein Wohnzimmer, zwei Schlafzimmer und ein Bad. Das Wohnzimmer ist groß und hell. In der Küche gibt es einen modernen Herd. Das Schlafzimmer ist ruhig, weil es zum Hof liegt.', english: 'My apartment is in the centre of Munich. It has a kitchen, a living room, two bedrooms and a bathroom. The living room is big and bright. In the kitchen there is a modern stove. The bedroom is quiet because it faces the courtyard.' },
      { title: 'Im Büro anrufen', content: 'A memo about calling the office to speak with a colleague.', german: 'Ich habe im Büro angerufen. Die Sekretärin hat gesagt, dass Frau Schmidt in einer Besprechung ist. Ich soll um drei Uhr noch einmal anrufen. Morgen habe ich einen Termin mit dem Chef um neun Uhr.', english: 'I called the office. The secretary said that Ms Schmidt is in a meeting. I should call again at three o clock. Tomorrow I have an appointment with the boss at nine.' },
    ],
    expressions: [
      { p: 'Ich möchte bitte …', t: 'I would like …, please.', cat: 'Shopping' },
      { p: 'Wo ist der Bahnhof?', t: 'Where is the train station?', cat: 'Travel' },
      { p: 'Wie viel kostet das?', t: 'How much does that cost?', cat: 'Shopping' },
      { p: 'Ich habe Schmerzen.', t: 'I am in pain.', cat: 'Health' },
      { p: 'Können Sie mir helfen?', t: 'Can you help me?', cat: 'Politeness' },
      { p: 'Auf Wiedersehen!', t: 'Goodbye!', cat: 'Greetings' },
    ],
    idioms: [
      { p: 'Die Daumen drücken', t: 'to keep your fingers crossed', meaning: 'To hope that something succeeds for someone.', usage: 'Morgen habe ich die Prüfung – drück mir die Daumen!' },
      { p: 'Ich verstehe nur Bahnhof', t: 'it is all Greek to me', meaning: 'I do not understand anything at all.', usage: 'Die Erklärung war zu kompliziert, ich habe nur Bahnhof verstanden.' },
    ],
    mistakes: [
      { inc: 'Ich habe eine Kopfweh.', cor: 'Ich habe Kopfschmerzen.', why: '"Kopfweh" is not used as a countable noun. Say "Ich habe Kopfschmerzen" (plural) or "Ich habe Kopfschmerzen".' },
      { inc: 'Wo ich kann parken?', cor: 'Wo kann ich parken?', why: 'In questions with a modal verb, the verb is conjugated and stands in second position: Wo kann ich parken?' },
    ],
    books: [
      { name: 'Menschen A1.2', author: 'Hueber Verlag', notes: 'Continues the Menschen series with more dialogues about everyday life.' },
      { name: 'Schritte Plus Neu A1.2', author: 'Hueber Verlag', notes: 'Very good for beginners, includes grammar with everyday context.' },
    ],
    resources: [
      { url: 'https://www.youtube.com/@EasyGerman', kind: 'video', title: 'Easy German – Street Interviews', author: 'Easy Languages', handle: '@EasyGerman' },
      { url: 'https://www.youtube.com/@LearnGermanWithAnja', kind: 'video', title: 'German A1 – The most important verbs', author: 'Anja', handle: '@LearnGermanWithAnja' },
      { url: 'https://www.youtube.com/@GermanWithLaura', kind: 'video', title: 'German Grammar – der die das explained', author: 'Laura', handle: '@GermanWithLaura' },
    ],
    notes: [
      { cat: 'daily', daysAgo: 4, content: 'Heute habe ich über Reisen gelernt: der Zug, der Flughafen, das Hotel. Ich kann jetzt eine Fahrkarte kaufen.', ch: 0 },
      { cat: 'speaking', daysAgo: 6, content: 'Ich habe das Dialog beim Arzt geübt. Ich kann jetzt einen Termin machen und über Schmerzen sprechen.', ch: 3 },
      { cat: 'listening', daysAgo: 8, content: 'Ich habe einen Hörtext über das Wohnen gehört. Neue Wörter: die Wohnung, das Zimmer, die Küche.', ch: 1 },
    ],
  },

  'A2.1': {
    chapters: [
      'Lektion 9 · Einkaufen & Geld',
      'Lektion 10 · In der Stadt',
      'Lektion 11 · Vergangenheit & Erlebnisse',
      'Lektion 12 · Pläne & Zukunft',
    ],
    vocab: [
      { w: 'der Markt', t: 'the market', ex: 'Am Samstag gehe ich auf den Markt.', cat: 'Shopping', ch: 0 },
      { w: 'das Geschäft', t: 'the shop', ex: 'Das Geschäft öffnet um neun Uhr.', cat: 'Shopping', ch: 0 },
      { w: 'das Geld', t: 'the money', ex: 'Ich habe nicht viel Geld.', cat: 'Money', ch: 0 },
      { w: 'die Kasse', t: 'the cash register / checkout', ex: 'Bitte zahlen Sie an der Kasse.', cat: 'Money', ch: 0 },
      { w: 'das Rathaus', t: 'the town hall', ex: 'Das Rathaus liegt am Marktplatz.', cat: 'City', ch: 1 },
      { w: 'das Museum', t: 'the museum', ex: 'Das Museum ist montags geschlossen.', cat: 'City', ch: 1 },
      { w: 'der Park', t: 'the park', ex: 'Wir gehen im Park spazieren.', cat: 'City', ch: 1 },
      { w: 'die Kirche', t: 'the church', ex: 'Die Kirche ist sehr alt.', cat: 'City', ch: 1 },
      { w: 'das Wochenende', t: 'the weekend', ex: 'Am Wochenende habe ich frei.', cat: 'Time', ch: 2 },
      { w: 'das Geschenk', t: 'the present', ex: 'Ich kaufe ein Geschenk für meine Mutter.', cat: 'Occasions', ch: 2 },
      { w: 'die Vergangenheit', t: 'the past', ex: 'In der Vergangenheit war alles anders.', cat: 'Time', ch: 2 },
      { w: 'die Zukunft', t: 'the future', ex: 'In der Zukunft möchte ich mehr reisen.', cat: 'Time', ch: 3 },
      { w: 'der Plan', t: 'the plan', ex: 'Wir haben einen Plan für den Sommer.', cat: 'Plans', ch: 3 },
      { w: 'teuer', t: 'expensive', ex: 'Das Hotel ist zu teuer.', cat: 'Adjectives', ch: 0 },
    ],
    grammar: [
      { rule: 'Perfekt mit haben und sein', expl: 'The perfect tense: haben/sein (conjugated) + past participle at the end. Use sein with verbs of motion and change of state.', exs: ['Ich habe gelernt.', 'Ich bin nach Hause gegangen.'], cat: 'Past Tense' },
      { rule: 'Trennbare Verben', expl: 'Separable verbs: the prefix is separated in the main clause and the past participle is formed with "ge".', exs: ['Ich kaufe heute ein. (einkaufen)', 'Ich bin gestern angekommen. (ankommen)'], cat: 'Verbs' },
      { rule: 'Akkusativ', expl: 'The accusative case marks the direct object. der Mann → den Mann, die Frau → die Frau, das Kind → das Kind.', exs: ['Ich sehe den Mann.', 'Ich habe das Buch.'], cat: 'Cases' },
      { rule: 'Präpositionen: in, an, auf', expl: 'With these two-way prepositions: dative for position (wo?), accusative for direction (wohin?).', exs: ['Ich bin in der Stadt.', 'Ich gehe in die Stadt.'], cat: 'Prepositions' },
      { rule: 'Komparativ und Superlativ', expl: 'Comparisons: schnell → schneller → am schnellsten. gut → besser → am besten.', exs: ['Das Auto ist schneller.', 'Sie ist am besten.'], cat: 'Grammar Basics' },
    ],
    verbs: [
      { i: 'kaufen', meaning: 'to buy', ich: 'kaufe', du: 'kaufst', er: 'kauft', wir: 'kaufen', ihr: 'kauft', sie: 'kaufen', cat: 'Regular' },
      { i: 'einkaufen', meaning: 'to shop', ich: 'kaufe ein', du: 'kaufst ein', er: 'kauft ein', wir: 'kaufen ein', ihr: 'kauft ein', sie: 'kaufen ein', cat: 'Separable' },
      { i: 'ankommen', meaning: 'to arrive', ich: 'komme an', du: 'kommst an', er: 'kommt an', wir: 'kommen an', ihr: 'kommt an', sie: 'kommen an', cat: 'Separable' },
      { i: 'reisen', meaning: 'to travel', ich: 'reise', du: 'reist', er: 'reist', wir: 'reisen', ihr: 'reist', sie: 'reisen', cat: 'Regular' },
      { i: 'geben', meaning: 'to give', ich: 'gebe', du: 'gibst', er: 'gibt', wir: 'geben', ihr: 'gebt', sie: 'geben', cat: 'Irregular' },
    ],
    dialogues: [
      { title: 'Im Supermarkt bezahlen', parts: [{ name: 'Kundin', gender: 'female' }, { name: 'Kassierer', gender: 'male' }], lines: [
        [1, 'Guten Tag! Haben Sie alles gefunden?'],
        [0, 'Ja, danke. Ich möchte bitte zahlen.'],
        [1, 'Das sind zusammen 23,40 Euro. Zahlen Sie bar oder mit Karte?'],
        [0, 'Mit Karte, bitte.'],
        [1, 'Bitte geben Sie die Karte ins Gerät. Und hier ist der Bon. Auf Wiedersehen!'],
      ] },
      { title: 'Nach dem Weg fragen', parts: [{ name: 'Tourist', gender: 'male' }, { name: 'Einwohner', gender: 'female' }], lines: [
        [0, 'Entschuldigung, wie komme ich zum Museum?'],
        [1, 'Gehen Sie geradeaus bis zur Ampel, dann rechts. Das Museum ist auf der linken Seite.'],
        [0, 'Ist es weit von hier?'],
        [1, 'Nein, nur etwa zehn Minuten zu Fuß.'],
        [0, 'Vielen Dank für Ihre Hilfe!'],
        [1, 'Gern geschehen!'],
      ] },
    ],
    memos: [
      { title: 'Was habe ich am Wochenende gemacht?', content: 'Using the perfect tense to talk about last weekend.', german: 'Am Wochenende bin ich mit meinen Freunden in die Stadt gegangen. Wir haben einen Film im Kino gesehen und danach haben wir in einem Café Kuchen gegessen. Ich habe außerdem ein Geschenk für meinen Bruder gekauft. Es war ein schönes Wochenende.', english: 'At the weekend I went into town with my friends. We watched a film in the cinema and afterwards we ate cake in a café. I also bought a present for my brother. It was a nice weekend.' },
      { title: 'Meine Reisepläne', content: 'Future plans with the verb werden and time expressions.', german: 'Nächsten Sommer werde ich nach Deutschland reisen. Ich werde zwei Wochen in Berlin verbringen und dann nach München fahren. Ich möchte die Museen besuchen und deutsches Essen probieren. Nächste Woche werde ich das Hotel buchen.', english: 'Next summer I will travel to Germany. I will spend two weeks in Berlin and then go to Munich. I want to visit the museums and try German food. Next week I will book the hotel.' },
    ],
    expressions: [
      { p: 'Ich hätte gern …, bitte.', t: 'I would like …, please.', cat: 'Shopping' },
      { p: 'Kann ich mit Karte zahlen?', t: 'Can I pay by card?', cat: 'Money' },
      { p: 'Wo kann ich … finden?', t: 'Where can I find …?', cat: 'City' },
      { p: 'Ich war letztes Jahr in …', t: 'Last year I was in …', cat: 'Travel' },
      { p: 'Nächste Woche werde ich …', t: 'Next week I will …', cat: 'Plans' },
      { p: 'Ich freue mich auf …', t: 'I am looking forward to …', cat: 'Feelings' },
    ],
    idioms: [
      { p: 'Über den Berg sein', t: 'to be past the worst', meaning: 'To have got through the hardest part of a problem or illness.', usage: 'Nach der ersten Woche im neuen Job war ich über den Berg.' },
      { p: 'Ins Wasser fallen', t: 'to fall through (of plans)', meaning: 'For plans to not happen.', usage: 'Wegen des Regens ist unser Ausflug ins Wasser gefallen.' },
    ],
    mistakes: [
      { inc: 'Ich habe gestern gehen.', cor: 'Ich bin gestern gegangen.', why: 'With verbs of movement (gehen) use "sein" as the auxiliary and the past participle "gegangen".' },
      { inc: 'Die teuer Auto', cor: 'Das teure Auto', why: 'Auto is neuter (das Auto), so the adjective takes the ending -e: das teure Auto.' },
    ],
    books: [
      { name: 'Menschen A2.1', author: 'Hueber Verlag', notes: 'Focus on everyday situations and the past tense.' },
      { name: 'Netzwerk A2.1', author: 'Langenscheidt', notes: 'Includes useful audio and video material for A2.' },
    ],
    resources: [
      { url: 'https://www.youtube.com/@EasyGerman', kind: 'video', title: 'Easy German – Talking about the past', author: 'Easy Languages', handle: '@EasyGerman' },
      { url: 'https://www.youtube.com/@LearnGermanWithAnja', kind: 'video', title: 'German Perfekt tense explained', author: 'Anja', handle: '@LearnGermanWithAnja' },
      { url: 'https://www.youtube.com/@GermanWithLaura', kind: 'video', title: 'German cases in 20 minutes', author: 'Laura', handle: '@GermanWithLaura' },
    ],
    notes: [
      { cat: 'daily', daysAgo: 9, content: 'Ich habe das Perfekt geübt. Jetzt kann ich über meine Vergangenheit sprechen: Ich bin gegangen, ich habe gesehen.', ch: 2 },
      { cat: 'writing', daysAgo: 11, content: 'Ich habe einen Text über meine Reisepläne geschrieben. Ich habe die Zukunft mit "werden" benutzt.', ch: 3 },
      { cat: 'speaking', daysAgo: 13, content: 'Ich habe im Supermarkt auf Deutsch bezahlt. Ich kann jetzt sagen: Kann ich mit Karte zahlen?', ch: 0 },
    ],
  },

  'A2.2': {
    chapters: [
      'Lektion 13 · Hobbys & Freizeit',
      'Lektion 14 · Natur & Wetter',
      'Lektion 15 · Kommunikation',
      'Lektion 16 · Beruf & Bewerbung',
    ],
    vocab: [
      { w: 'das Hobby', t: 'the hobby', ex: 'Mein Hobby ist Fotografieren.', cat: 'Leisure', ch: 0 },
      { w: 'das Fahrrad', t: 'the bicycle', ex: 'Ich fahre jeden Tag mit dem Fahrrad.', cat: 'Leisure', ch: 0 },
      { w: 'der Sport', t: 'the sport', ex: 'Sport ist gesund.', cat: 'Leisure', ch: 0 },
      { w: 'die Musik', t: 'the music', ex: 'Ich höre gern Musik.', cat: 'Leisure', ch: 0 },
      { w: 'das Wetter', t: 'the weather', ex: 'Das Wetter ist heute schön.', cat: 'Weather', ch: 1 },
      { w: 'die Sonne', t: 'the sun', ex: 'Die Sonne scheint.', cat: 'Weather', ch: 1 },
      { w: 'der Regen', t: 'the rain', ex: 'Der Regen hört nie auf.', cat: 'Weather', ch: 1 },
      { w: 'der Wald', t: 'the forest', ex: 'Wir wandern durch den Wald.', cat: 'Nature', ch: 1 },
      { w: 'das Telefon', t: 'the telephone', ex: 'Das Telefon klingelt.', cat: 'Communication', ch: 2 },
      { w: 'die E-Mail', t: 'the e-mail', ex: 'Ich sende eine E-Mail an meinen Chef.', cat: 'Communication', ch: 2 },
      { w: 'der Brief', t: 'the letter', ex: 'Der Brief ist gestern angekommen.', cat: 'Communication', ch: 2 },
      { w: 'der Lebenslauf', t: 'the CV', ex: 'Mein Lebenslauf ist aktuell.', cat: 'Work', ch: 3 },
      { w: 'das Vorstellungsgespräch', t: 'the job interview', ex: 'Morgen habe ich ein Vorstellungsgespräch.', cat: 'Work', ch: 3 },
      { w: 'die Bewerbung', t: 'the application', ex: 'Ich schreibe eine Bewerbung.', cat: 'Work', ch: 3 },
    ],
    grammar: [
      { rule: 'Dativ', expl: 'The dative case marks the indirect object. der → dem, die → der, das → dem, plural → den ... -n.', exs: ['Ich helfe dem Mann.', 'Das Buch gehört der Frau.'], cat: 'Cases' },
      { rule: 'Reflexive Verben', expl: 'Reflexive verbs need a reflexive pronoun: ich freue mich, du freust dich, er freut sich.', exs: ['Ich interessiere mich für Kunst.', 'Er setzt sich an den Tisch.'], cat: 'Verbs' },
      { rule: 'Modalverben: sollen und wollen', expl: 'sollen = should / supposed to; wollen = to want.', exs: ['Du sollst mehr schlafen.', 'Ich will Deutsch lernen.'], cat: 'Modal Verbs' },
      { rule: 'Nebensätze mit dass', expl: 'Subordinate clauses with "dass" put the conjugated verb at the end.', exs: ['Ich weiß, dass du Recht hast.'], cat: 'Sentence Structure' },
      { rule: 'Präpositionen mit Dativ: mit, bei, von, zu', expl: 'These prepositions always take the dative case.', exs: ['Ich gehe mit dem Hund spazieren.', 'Wir fahren zu den Eltern.'], cat: 'Prepositions' },
    ],
    verbs: [
      { i: 'spielen', meaning: 'to play', ich: 'spiele', du: 'spielst', er: 'spielt', wir: 'spielen', ihr: 'spielt', sie: 'spielen', cat: 'Regular' },
      { i: 'schwimmen', meaning: 'to swim', ich: 'schwimme', du: 'schwimmst', er: 'schwimmt', wir: 'schwimmen', ihr: 'schwimmt', sie: 'schwimmen', cat: 'Irregular' },
      { i: 'treffen', meaning: 'to meet', ich: 'treffe', du: 'triffst', er: 'trifft', wir: 'treffen', ihr: 'trefft', sie: 'treffen', cat: 'Irregular' },
      { i: 'beginnen', meaning: 'to begin', ich: 'beginne', du: 'beginrst', er: 'beginnt', wir: 'beginnen', ihr: 'beginnt', sie: 'beginnen', cat: 'Irregular' },
      { i: 'bleiben', meaning: 'to stay', ich: 'bleibe', du: 'bleibst', er: 'bleibt', wir: 'bleiben', ihr: 'bleibt', sie: 'bleiben', cat: 'Irregular' },
    ],
    dialogues: [
      { title: 'Ein Telefongespräch', parts: [{ name: 'Peter', gender: 'male' }, { name: 'Frau Schmidt', gender: 'female' }], lines: [
        [1, 'Praxis Dr. Weber, guten Tag. Frau Schmidt am Apparat.'],
        [0, 'Guten Tag, hier ist Peter Braun. Ich möchte einen Termin verschieben.'],
        [1, 'Wann möchten Sie denn kommen?'],
        [0, 'Wäre es am Freitag um 14 Uhr möglich?'],
        [1, 'Ja, das passt. Ich trage Sie ein.'],
        [0, 'Vielen Dank, auf Wiederhören!'],
      ] },
      { title: 'Im Vorstellungsgespräch', parts: [{ name: 'Interviewer', gender: 'male' }, { name: 'Bewerber', gender: 'male' }], lines: [
        [0, 'Guten Tag, Herr Ben Salah. Erzählen Sie etwas über sich.'],
        [1, 'Ich bin vor zwei Jahren nach Deutschland gekommen und habe den Deutschkurs B1 abgeschlossen.'],
        [0, 'Warum möchten Sie bei uns arbeiten?'],
        [1, 'Ihr Unternehmen ist bekannt für gute Arbeitsbedingungen und ich möchte meine Erfahrung einbringen.'],
        [0, 'Wann können Sie anfangen?'],
        [1, 'Ich kann im nächsten Monat anfangen.'],
      ] },
    ],
    memos: [
      { title: 'Mein Hobby: Fotografie', content: 'Write about a hobby with "wenn" clauses and time expressions.', german: 'In meiner Freizeit fotografiere ich gern die Natur. Wenn das Wetter schön ist, gehe ich in den Wald oder an den See. Ich nehme immer meine Kamera mit. Fotografieren hilft mir, den Alltag zu vergessen. Mein Traum ist eine Fotoausstellung.', english: 'In my free time I like to photograph nature. When the weather is nice, I go into the forest or to the lake. I always take my camera with me. Photography helps me forget everyday life. My dream is a photo exhibition.' },
      { title: 'Bewerbung schreiben', content: 'Notes on writing a job application in German.', german: 'Ich habe eine Bewerbung als Verkäufer geschrieben. Der Lebenslauf ist auf Deutsch. Ich habe einen Termin für ein Vorstellungsgespräch am Montag bekommen. Ich soll mein Zeugnis mitbringen und pünktlich sein.', english: 'I wrote an application as a salesperson. The CV is in German. I got an appointment for an interview on Monday. I should bring my certificate and be on time.' },
    ],
    expressions: [
      { p: 'Wie ist das Wetter heute?', t: 'What is the weather like today?', cat: 'Weather' },
      { p: 'Es regnet / Die Sonne scheint.', t: 'It is raining / The sun is shining.', cat: 'Weather' },
      { p: 'Ich interessiere mich für …', t: 'I am interested in …', cat: 'Leisure' },
      { p: 'Können wir einen Termin ausmachen?', t: 'Can we arrange an appointment?', cat: 'Work' },
      { p: 'Ich melde mich bei Ihnen.', t: 'I will get back to you.', cat: 'Work' },
      { p: 'Es tut mir leid.', t: 'I am sorry.', cat: 'Politeness' },
    ],
    idioms: [
      { p: 'Alle Hände voll zu tun haben', t: 'to have your hands full', meaning: 'To be very busy.', usage: 'Mit drei Kindern habe ich alle Hände voll zu tun.' },
      { p: 'Das ist ein Kinderspiel', t: 'that is a piece of cake', meaning: 'Something is very easy.', usage: 'Die Aufgabe war ein Kinderspiel für mich.' },
    ],
    mistakes: [
      { inc: 'Ich interessiere mich für der Musik.', cor: 'Ich interessiere mich für die Musik.', why: '"Für" takes the accusative, so "die Musik" (not "der Musik").' },
      { inc: 'Ich will ins Kino gehen, weil es gibt einen guten Film.', cor: 'Ich will ins Kino gehen, weil es einen guten Film gibt.', why: 'In a "weil" clause the verb goes to the end: weil es einen guten Film gibt.' },
    ],
    books: [
      { name: 'Menschen A2.2', author: 'Hueber Verlag', notes: 'Completes the A2 level with more complex dialogues.' },
      { name: 'Spektrum Deutsch A2', author: 'Schubert Verlag', notes: 'Good grammar reference with many exercises.' },
    ],
    resources: [
      { url: 'https://www.youtube.com/@EasyGerman', kind: 'video', title: 'Easy German – Dative case in everyday German', author: 'Easy Languages', handle: '@EasyGerman' },
      { url: 'https://www.youtube.com/@LearnGermanWithAnja', kind: 'video', title: 'German reflexive verbs', author: 'Anja', handle: '@LearnGermanWithAnja' },
      { url: 'https://www.youtube.com/@GermanWithLaura', kind: 'video', title: 'The German dative explained', author: 'Laura', handle: '@GermanWithLaura' },
    ],
    notes: [
      { cat: 'daily', daysAgo: 14, content: 'Heute habe ich den Dativ gelernt. Ich kann jetzt sagen: Ich helfe dem Mann, das Buch gehört der Frau.', ch: 1 },
      { cat: 'writing', daysAgo: 16, content: 'Ich habe eine Bewerbung geschrieben und meinen Lebenslauf aktualisiert.', ch: 3 },
      { cat: 'listening', daysAgo: 18, content: 'Ich habe das Telefongespräch zweimal gehört und dann selbst geübt.', ch: 2 },
    ],
  },

  'B1.1': {
    chapters: [
      'Lektion 17 · Reisen & Tourismus',
      'Lektion 18 · Medien & Internet',
      'Lektion 19 · Gefühle & Beziehungen',
      'Lektion 20 · Beruf & Alltag',
    ],
    vocab: [
      { w: 'die Reise', t: 'the journey', ex: 'Die Reise nach Berlin war toll.', cat: 'Travel', ch: 0 },
      { w: 'der Koffer', t: 'the suitcase', ex: 'Mein Koffer ist zu schwer.', cat: 'Travel', ch: 0 },
      { w: 'das Visum', t: 'the visa', ex: 'Ich brauche ein Visum für die USA.', cat: 'Travel', ch: 0 },
      { w: 'der Reiseführer', t: 'the travel guide', ex: 'Der Reiseführer hat gute Tipps.', cat: 'Travel', ch: 0 },
      { w: 'die Nachricht', t: 'the news / message', ex: 'Ich habe eine Nachricht von dir bekommen.', cat: 'Media', ch: 1 },
      { w: 'die Zeitung', t: 'the newspaper', ex: 'Ich lese jeden Morgen die Zeitung.', cat: 'Media', ch: 1 },
      { w: 'das Internet', t: 'the internet', ex: 'Das Internet ist heute sehr langsam.', cat: 'Media', ch: 1 },
      { w: 'die Soziale Medien', t: 'the social media', ex: 'Er verbringt zu viel Zeit in sozialen Medien.', cat: 'Media', ch: 1 },
      { w: 'die Liebe', t: 'the love', ex: 'Die Liebe macht das Leben schön.', cat: 'Feelings', ch: 2 },
      { w: 'die Freundschaft', t: 'the friendship', ex: 'Eine gute Freundschaft ist wichtig.', cat: 'Feelings', ch: 2 },
      { w: 'das Gefühl', t: 'the feeling', ex: 'Ich habe ein gutes Gefühl bei der Sache.', cat: 'Feelings', ch: 2 },
      { w: 'der Stress', t: 'the stress', ex: 'Der Stress bei der Arbeit ist groß.', cat: 'Work', ch: 3 },
      { w: 'der Termin', t: 'the appointment', ex: 'Ich habe um drei Uhr einen Termin.', cat: 'Work', ch: 3 },
      { w: 'die Erfahrung', t: 'the experience', ex: 'Ich habe Erfahrung im Verkauf.', cat: 'Work', ch: 3 },
    ],
    grammar: [
      { rule: 'Präteritum: starke Verben', expl: 'Strong verbs change their stem in the simple past: gehen → ging, sehen → sah, kommen → kam.', exs: ['Ich ging gestern ins Kino.', 'Sie sah den Film.'], cat: 'Past Tense' },
      { rule: 'Konjunktiv II mit würde', expl: 'The conditional form "würde + Infinitiv" is used for hypothetical situations.', exs: ['Ich würde gern mehr reisen.', 'Wenn ich Zeit hätte, würde ich kommen.'], cat: 'Konjunktiv' },
      { rule: 'Passiv (Präsens)', expl: 'The passive voice: werden + past participle. Focuses on the action, not the agent.', exs: ['Das Haus wird gebaut.', 'Deutsch wird weltweit gelernt.'], cat: 'Passive' },
      { rule: 'Relativsätze', expl: 'Relative clauses describe a noun: der/die/das + relative verb at the end.', exs: ['Das ist der Mann, der mich angerufen hat.'], cat: 'Sentence Structure' },
      { rule: 'nicht nur … sondern auch', expl: 'Two-part conjunction meaning "not only … but also".', exs: ['Er spricht nicht nur Deutsch, sondern auch Französisch.'], cat: 'Conjunctions' },
    ],
    verbs: [
      { i: 'fliegen', meaning: 'to fly', ich: 'fliege', du: 'fliegst', er: 'fliegt', wir: 'fliegen', ihr: 'fliegt', sie: 'fliegen', cat: 'Irregular' },
      { i: 'verstehen', meaning: 'to understand', ich: 'verstehe', du: 'verstehst', er: 'versteht', wir: 'verstehen', ihr: 'versteht', sie: 'verstehen', cat: 'Irregular' },
      { i: 'schreiben', meaning: 'to write', ich: 'schreibe', du: 'schreibst', er: 'schreibt', wir: 'schreiben', ihr: 'schreibt', sie: 'schreiben', cat: 'Irregular' },
      { i: 'empfehlen', meaning: 'to recommend', ich: 'empfehle', du: 'empfiehlst', er: 'empfiehlt', wir: 'empfehlen', ihr: 'empfiehlt', sie: 'empfehlen', cat: 'Irregular' },
      { i: 'vergessen', meaning: 'to forget', ich: 'vergesse', du: 'vergisst', er: 'vergisst', wir: 'vergessen', ihr: 'vergisst', sie: 'vergessen', cat: 'Irregular' },
    ],
    dialogues: [
      { title: 'Am Flughafen einchecken', parts: [{ name: 'Passagier', gender: 'male' }, { name: 'Mitarbeiterin', gender: 'female' }], lines: [
        [1, 'Guten Morgen! Darf ich Ihren Pass und die Buchungsbestätigung sehen?'],
        [0, 'Hier bitte. Ich fliege nach Rom.'],
        [1, 'Möchten Sie einen Fensterplatz?'],
        [0, 'Ja, bitte. Und können Sie mein Gepäck aufgeben?'],
        [1, 'Natürlich. Ihr Flug geht um 9:30 von Terminal B.'],
        [0, 'Vielen Dank, auf Wiedersehen!'],
      ] },
      { title: 'Ein Problem im Restaurant lösen', parts: [{ name: 'Gast', gender: 'female' }, { name: 'Oberkellner', gender: 'male' }], lines: [
        [0, 'Entschuldigung, aber mein Essen ist kalt.'],
        [1, 'Das tut mir leid. Ich bringe Ihnen sofort ein neues Gericht.'],
        [0, 'Danke. Und ich hatte eigentlich ein Glas Rotwein bestellt.'],
        [1, 'Sie haben Recht, das war mein Fehler. Es kommt sofort.'],
        [0, 'Gut, danke für Ihr Verständnis.'],
      ] },
    ],
    memos: [
      { title: 'Meine letzte Reise', content: 'Narrate a journey using the simple past and connecting words.', german: 'Im Juni bin ich nach Hamburg geflogen. Ich habe das berühmte Rathaus besucht und bin mit dem Boot durch den Hafen gefahren. Das Wetter war fantastisch. Am Abend habe ich mit Freunden Fisch gegessen. Es war eine unvergessliche Reise, und ich würde gern bald wiederkommen.', english: 'In June I flew to Hamburg. I visited the famous town hall and took a boat through the harbour. The weather was fantastic. In the evening I ate fish with friends. It was an unforgettable journey, and I would like to come back soon.' },
      { title: 'Beruflicher Alltag', content: 'A description of a typical work day with appointments and stress management.', german: 'Mein Arbeitstag beginnt um acht Uhr. Zuerst beantworte ich die E-Mails und danach habe ich meistens zwei bis drei Termine. Am Nachmittag arbeite ich an Projekten. Die Arbeit kann stressig sein, aber ich mag die Verantwortung. Am Abend entspanne ich mich beim Sport.', english: 'My work day starts at eight o clock. First I answer the e-mails and afterwards I usually have two to three appointments. In the afternoon I work on projects. The work can be stressful, but I like the responsibility. In the evening I relax by doing sport.' },
    ],
    expressions: [
      { p: 'Gute Reise!', t: 'Have a good trip!', cat: 'Travel' },
      { p: 'Ich habe eine Nachricht erhalten.', t: 'I received a message.', cat: 'Media' },
      { p: 'Ich bin der Meinung, dass …', t: 'I am of the opinion that …', cat: 'Discussion' },
      { p: 'Was meinst du dazu?', t: 'What do you think about it?', cat: 'Discussion' },
      { p: 'Ich würde gern …', t: 'I would like to …', cat: 'Politeness' },
      { p: 'Das kommt darauf an.', t: 'That depends.', cat: 'Discussion' },
    ],
    idioms: [
      { p: 'Den Nagel auf den Kopf treffen', t: 'to hit the nail on the head', meaning: 'To say or do exactly the right thing.', usage: 'Mit deiner Analyse hast du den Nagel auf den Kopf getroffen.' },
      { p: 'Schwein haben', t: 'to be very lucky', meaning: 'To have good luck unexpectedly.', usage: 'Ich habe bei der Prüfung Schwein gehabt, die Fragen waren einfach.' },
    ],
    mistakes: [
      { inc: 'Wenn ich Zeit habe, ich würde kommen.', cor: 'Wenn ich Zeit hätte, würde ich kommen.', why: 'In hypothetical if-clauses use Konjunktiv II (hätte) and the main clause starts with the verb (würde ich).' },
      { inc: 'Das Buch, das ich es gelesen habe, ist gut.', cor: 'Das Buch, das ich gelesen habe, ist gut.', why: 'The relative pronoun "das" is already the object, so "es" must not be repeated.' },
    ],
    books: [
      { name: 'Menschen B1', author: 'Hueber Verlag', notes: 'A solid B1 course book covering everyday and work topics.' },
      { name: 'Aspekte Neu B1+', author: 'Langenscheidt', notes: 'Good bridge between B1 and B2 with authentic texts.' },
    ],
    resources: [
      { url: 'https://www.youtube.com/@EasyGerman', kind: 'video', title: 'Easy German – Real street conversations at B1', author: 'Easy Languages', handle: '@EasyGerman' },
      { url: 'https://www.youtube.com/@LearnGermanWithAnja', kind: 'video', title: 'German Konjunktiv II simply explained', author: 'Anja', handle: '@LearnGermanWithAnja' },
      { url: 'https://www.youtube.com/@GermanWithLaura', kind: 'video', title: 'Passive voice in German', author: 'Laura', handle: '@GermanWithLaura' },
    ],
    notes: [
      { cat: 'daily', daysAgo: 19, content: 'Ich habe den Konjunktiv II geübt: Ich würde gern mehr reisen. Wenn ich Zeit hätte, würde ich kommen.', ch: 0 },
      { cat: 'reading', daysAgo: 21, content: 'Ich habe einen Zeitungsartikel über Tourismus gelesen und die wichtigsten Argumente notiert.', ch: 0 },
      { cat: 'writing', daysAgo: 23, content: 'Ich habe einen Text über meinen beruflichen Alltag geschrieben.', ch: 3 },
    ],
  },

  'B1.2': {
    chapters: [
      'Lektion 21 · Gesundheit & Fitness',
      'Lektion 22 · Umwelt & Natur',
      'Lektion 23 · Politik & Gesellschaft',
      'Lektion 24 · Beruf & Karriere',
    ],
    vocab: [
      { w: 'die Ernährung', t: 'the nutrition / diet', ex: 'Eine gesunde Ernährung ist wichtig.', cat: 'Health', ch: 0 },
      { w: 'die Bewegung', t: 'the exercise / movement', ex: 'Regelmäßige Bewegung hält fit.', cat: 'Health', ch: 0 },
      { w: 'der Blutdruck', t: 'the blood pressure', ex: 'Mein Blutdruck ist normal.', cat: 'Health', ch: 0 },
      { w: 'die Fitness', t: 'the fitness', ex: 'Fitness ist Teil meines Lebens.', cat: 'Health', ch: 0 },
      { w: 'der Müll', t: 'the rubbish', ex: 'Wir trennen unseren Müll.', cat: 'Environment', ch: 1 },
      { w: 'die Umwelt', t: 'the environment', ex: 'Wir müssen die Umwelt schützen.', cat: 'Environment', ch: 1 },
      { w: 'die Energie', t: 'the energy', ex: 'Solare Energie ist sauber.', cat: 'Environment', ch: 1 },
      { w: 'die Nachhaltigkeit', t: 'the sustainability', ex: 'Nachhaltigkeit wird immer wichtiger.', cat: 'Environment', ch: 1 },
      { w: 'die Politik', t: 'the politics', ex: 'Politik betrifft uns alle.', cat: 'Society', ch: 2 },
      { w: 'die Gesellschaft', t: 'the society', ex: 'Die Gesellschaft verändert sich.', cat: 'Society', ch: 2 },
      { w: 'das Gesetz', t: 'the law', ex: 'Das neue Gesetz gilt ab Januar.', cat: 'Society', ch: 2 },
      { w: 'die Karriere', t: 'the career', ex: 'Sie macht eine gute Karriere.', cat: 'Career', ch: 3 },
      { w: 'das Gehalt', t: 'the salary', ex: 'Das Gehalt wird monatlich bezahlt.', cat: 'Career', ch: 3 },
      { w: 'die Weiterbildung', t: 'the further training', ex: 'Weiterbildung öffnet neue Türen.', cat: 'Career', ch: 3 },
    ],
    grammar: [
      { rule: 'Plusquamperfekt', expl: 'The past perfect: hatte/war + past participle. Describes what happened before another past event.', exs: ['Nachdem ich gegessen hatte, ging ich schlafen.'], cat: 'Past Tense' },
      { rule: 'Genitiv', expl: 'The genitive shows possession: des, der, des. die Tasche des Mannes.', exs: ['Das Auto meines Bruders ist neu.'], cat: 'Cases' },
      { rule: 'Nomen-Verb-Verbindungen', expl: 'Verbal noun phrases: eine Entscheidung treffen (statt entscheiden).', exs: ['Er traf eine wichtige Entscheidung.'], cat: 'Phrases' },
      { rule: 'Indirekte Rede', expl: 'Reported speech with "dass" or subjunctive I: Er sagt, er komme morgen.', exs: ['Sie sagte, dass sie krank sei.'], cat: 'Reported Speech' },
      { rule: 'Temporale Nebensätze', expl: 'Time clauses: bevor (before), nachdem (after), während (while).', exs: ['Bevor ich koche, räume ich auf.'], cat: 'Sentence Structure' },
    ],
    verbs: [
      { i: 'produzieren', meaning: 'to produce', ich: 'produziere', du: 'produzierst', er: 'produziert', wir: 'produzieren', ihr: 'produziert', sie: 'produzieren', cat: 'Regular' },
      { i: 'vermeiden', meaning: 'to avoid', ich: 'vermeide', du: 'vermeidest', er: 'vermeidet', wir: 'vermeiden', ihr: 'vermeidet', sie: 'vermeiden', cat: 'Irregular' },
      { i: 'entscheiden', meaning: 'to decide', ich: 'entscheide', du: 'entscheidest', er: 'entscheidet', wir: 'entscheiden', ihr: 'entscheidet', sie: 'entscheiden', cat: 'Irregular' },
      { i: 'erhöhen', meaning: 'to increase', ich: 'erhöhe', du: 'erhöhst', er: 'erhöht', wir: 'erhöhen', ihr: 'erhöht', sie: 'erhöhen', cat: 'Regular' },
      { i: 'senken', meaning: 'to reduce / lower', ich: 'senke', du: 'senkst', er: 'senkt', wir: 'senken', ihr: 'senkt', sie: 'senken', cat: 'Regular' },
    ],
    dialogues: [
      { title: 'Beim Ernährungsberater', parts: [{ name: 'Berater', gender: 'male' }, { name: 'Kunde', gender: 'female' }], lines: [
        [0, 'Guten Tag! Was kann ich für Sie tun?'],
        [1, 'Ich möchte mich gesünder ernähren. Was empfehlen Sie mir?'],
        [0, 'Trinken Sie viel Wasser und essen Sie mehr Gemüse. Vermeiden Sie Zucker.'],
        [1, 'Und wie oft sollte ich Sport treiben?'],
        [0, 'Mindestens dreimal pro Woche. Bewegung ist das A und O.'],
        [1, 'Vielen Dank, ich werde es versuchen!'],
      ] },
      { title: 'Über Umweltschutz diskutieren', parts: [{ name: 'Lea', gender: 'female' }, { name: 'Marc', gender: 'male' }], lines: [
        [0, 'Ich finde, wir sollten mehr auf die Umwelt achten.'],
        [1, 'Da bin ich ganz deiner Meinung. Aber was können wir konkret tun?'],
        [0, 'Zum Beispiel weniger Plastik benutzen und öfter mit dem Fahrrad fahren.'],
        [1, 'Guter Punkt. Außerdem sollte man nachhaltige Produkte kaufen.'],
        [0, 'Genau, jede Entscheidung zählt.'],
      ] },
    ],
    memos: [
      { title: 'Gesund leben', content: 'Reflect on healthy habits using frequency adverbs and modal verbs.', german: 'Um gesund zu bleiben, treibe ich dreimal pro Woche Sport und schlafe acht Stunden. Ich habe auch meinen Zuckerkonsum reduziert und trinke mehr Wasser. Bewegung hilft mir gegen Stress. Es ist nicht immer leicht, aber die Ergebnisse motivieren mich.', english: 'To stay healthy, I do sport three times a week and sleep eight hours. I have also reduced my sugar consumption and drink more water. Exercise helps me against stress. It is not always easy, but the results motivate me.' },
      { title: 'Mein Karriereziel', content: 'Write about career ambitions and further training.', german: 'Mein Karriereziel ist eine Stelle als Projektleiterin. Dafür mache ich eine Weiterbildung im Projektmanagement und verbessere mein Englisch. Ich möchte mehr Verantwortung übernehmen und ein eigenes Team führen. In fünf Jahren sehe ich mich in dieser Position.', english: 'My career goal is a position as project manager. For that I am doing further training in project management and improving my English. I want to take on more responsibility and lead my own team. In five years I see myself in this position.' },
    ],
    expressions: [
      { p: 'Ich bin der Meinung, dass …', t: 'I am of the opinion that …', cat: 'Discussion' },
      { p: 'Da bin ich ganz deiner Meinung.', t: 'I totally agree with you.', cat: 'Discussion' },
      { p: 'Wir müssen die Umwelt schützen.', t: 'We must protect the environment.', cat: 'Environment' },
      { p: 'Das ist eine wichtige Entscheidung.', t: 'That is an important decision.', cat: 'Discussion' },
      { p: 'Meiner Meinung nach …', t: 'In my opinion …', cat: 'Discussion' },
      { p: 'Das wäre eine gute Idee.', t: 'That would be a good idea.', cat: 'Discussion' },
    ],
    idioms: [
      { p: 'Das A und O', t: 'the be-all and end-all', meaning: 'The most essential thing.', usage: 'Bei der Arbeit ist Pünktlichkeit das A und O.' },
      { p: 'Unter einer Decke stecken', t: 'to be in league with someone', meaning: 'To secretly work together with someone.', usage: 'Die beiden stecken unter einer Decke.' },
    ],
    mistakes: [
      { inc: 'Das Auto von meinem Bruder', cor: 'Das Auto meines Bruders', why: 'In formal German possession is expressed with the genitive: das Auto meines Bruders.' },
      { inc: 'Nachdem ich gegessen habe, bin ich schlafen gegangen.', cor: 'Nachdem ich gegessen hatte, ging ich schlafen.', why: 'After "nachdem" use the Plusquamperfekt when the other event is in the past.' },
    ],
    books: [
      { name: 'Aspekte Neu B1+', author: 'Langenscheidt', notes: 'Prepares well for B2 with real-world topics.' },
      { name: 'Sicher! B1+', author: 'Hueber Verlag', notes: 'A modern course book with clear grammar sections.' },
    ],
    resources: [
      { url: 'https://www.youtube.com/@EasyGerman', kind: 'video', title: 'Easy German – Sustainability discussion', author: 'Easy Languages', handle: '@EasyGerman' },
      { url: 'https://www.youtube.com/@LearnGermanWithAnja', kind: 'video', title: 'German Plusquamperfekt', author: 'Anja', handle: '@LearnGermanWithAnja' },
      { url: 'https://www.youtube.com/@GermanWithLaura', kind: 'video', title: 'The German genitive case', author: 'Laura', handle: '@GermanWithLaura' },
    ],
    notes: [
      { cat: 'daily', daysAgo: 24, content: 'Ich habe das Plusquamperfekt gelernt und Temporalnebensätze geübt: bevor, nachdem, während.', ch: 0 },
      { cat: 'speaking', daysAgo: 26, content: 'Ich habe über Umweltschutz diskutiert und meine Meinung auf Deutsch geäußert.', ch: 1 },
      { cat: 'writing', daysAgo: 28, content: 'Ich habe einen Text über meine Karriereziele geschrieben.', ch: 3 },
    ],
  },

  'B2.1': {
    chapters: [
      'Lektion 25 · Studium & Wissenschaft',
      'Lektion 26 · Technologie & Digitalisierung',
      'Lektion 27 · Finanzen & Wirtschaft',
      'Lektion 28 · Gesellschaft im Wandel',
    ],
    vocab: [
      { w: 'das Studium', t: 'the studies / degree', ex: 'Das Studium dauert vier Jahre.', cat: 'Education', ch: 0 },
      { w: 'die Universität', t: 'the university', ex: 'Die Universität ist sehr alt.', cat: 'Education', ch: 0 },
      { w: 'die Forschung', t: 'the research', ex: 'Die Forschung ist Grundlage des Fortschritts.', cat: 'Education', ch: 0 },
      { w: 'die Digitalisierung', t: 'the digitalisation', ex: 'Die Digitalisierung verändert die Arbeitswelt.', cat: 'Technology', ch: 1 },
      { w: 'das Gerät', t: 'the device', ex: 'Jedes Gerät braucht Strom.', cat: 'Technology', ch: 1 },
      { w: 'die Daten', t: 'the data', ex: 'Die Daten werden sicher gespeichert.', cat: 'Technology', ch: 1 },
      { w: 'die Wirtschaft', t: 'the economy', ex: 'Die Wirtschaft wächst langsam.', cat: 'Finance', ch: 2 },
      { w: 'die Investition', t: 'the investment', ex: 'Die Investition lohnt sich langfristig.', cat: 'Finance', ch: 2 },
      { w: 'die Steuer', t: 'the tax', ex: 'Die Steuer wird automatisch abgezogen.', cat: 'Finance', ch: 2 },
      { w: 'der Wandel', t: 'the change', ex: 'Der gesellschaftliche Wandel ist spürbar.', cat: 'Society', ch: 3 },
      { w: 'die Migration', t: 'the migration', ex: 'Migration ist ein globales Thema.', cat: 'Society', ch: 3 },
      { w: 'die Integration', t: 'the integration', ex: 'Integration braucht Zeit und Geduld.', cat: 'Society', ch: 3 },
      { w: 'nachhaltig', t: 'sustainable', ex: 'Nachhaltiges Wirtschaften ist wichtig.', cat: 'Adjectives', ch: 2 },
      { w: 'global', t: 'global', ex: 'Wir leben in einer globalen Welt.', cat: 'Adjectives', ch: 3 },
    ],
    grammar: [
      { rule: 'Konjunktiv II der Vergangenheit', expl: 'Hypothetical past: hätte/wäre + past participle.', exs: ['Ich hätte das gemacht.', 'Wir wären früher gekommen.'], cat: 'Konjunktiv' },
      { rule: 'Passiv mit Modalverben', expl: 'Modal + passive: Der Antrag muss eingereicht werden.', exs: ['Die Aufgabe muss heute gelöst werden.'], cat: 'Passive' },
      { rule: 'Partizipialattribute', expl: 'Adjectival participles expand noun phrases: der zu lösende Antrag.', exs: ['Die steigenden Preise belasten die Verbraucher.'], cat: 'Syntax' },
      { rule: 'Nomen mit Präpositionen', expl: 'Nouns fixed to prepositions: die Angst vor, die Lust auf.', exs: ['Die Angst vor Fehlern ist verbreitet.'], cat: 'Phrases' },
      { rule: 'es-Formen', expl: 'The impersonal "es": es gibt, es handelt sich um, es kommt darauf an.', exs: ['Es handelt sich um ein wichtiges Thema.'], cat: 'Syntax' },
    ],
    verbs: [
      { i: 'erwerben', meaning: 'to acquire', ich: 'erwerbe', du: 'erwirbst', er: 'erwirbt', wir: 'erwerben', ihr: 'erwerbt', sie: 'erwerben', cat: 'Irregular' },
      { i: 'analysieren', meaning: 'to analyse', ich: 'analysiere', du: 'analysierst', er: 'analysiert', wir: 'analysieren', ihr: 'analysiert', sie: 'analysieren', cat: 'Regular' },
      { i: 'bewerten', meaning: 'to evaluate', ich: 'bewerte', du: 'bewertest', er: 'bewertet', wir: 'bewerten', ihr: 'bewertet', sie: 'bewerten', cat: 'Regular' },
      { i: 'beeinflussen', meaning: 'to influence', ich: 'beeinflusse', du: 'beeinflusst', er: 'beeinflusst', wir: 'beeinflussen', ihr: 'beeinflusst', sie: 'beeinflussen', cat: 'Regular' },
      { i: 'regulieren', meaning: 'to regulate', ich: 'reguliere', du: 'regulierst', er: 'reguliert', wir: 'regulieren', ihr: 'reguliert', sie: 'regulieren', cat: 'Regular' },
    ],
    dialogues: [
      { title: 'Eine Vorlesung besprechen', parts: [{ name: 'Nadia', gender: 'female' }, { name: 'David', gender: 'male' }], lines: [
        [0, 'Wie fandest du die Vorlesung über Digitalisierung?'],
        [1, 'Sehr interessant, aber auch komplex. Die Datenschutzfragen waren besonders spannend.'],
        [0, 'Ja, ich hätte nie gedacht, dass Daten so viel wert sind.'],
        [1, 'Ich glaube, wir müssen in Zukunft mehr über die Ethik der Technologie diskutieren.'],
        [0, 'Einverstanden. Vielleicht machen wir dazu ein gemeinsames Referat?'],
        [1, 'Gute Idee! Ich sammle die Quellen, du strukturierst die Argumente.'],
      ] },
      { title: 'Über eine Investition sprechen', parts: [{ name: 'Berater', gender: 'male' }, { name: 'Kundin', gender: 'female' }], lines: [
        [0, 'Ich würde gern langfristig investieren. Was empfehlen Sie?'],
        [1, 'Zuerst sollten wir Ihre Risikobereitschaft klären. Wichtig ist auch die Steuerplanung.'],
        [0, 'Ich möchte nachhaltige Fonds bevorzugen.'],
        [1, 'Eine gute Wahl. Diese Fonds investieren in umweltfreundliche Unternehmen.'],
        [0, 'Und welche Rendite kann ich erwarten?'],
        [1, 'Das hängt vom Markt ab. Im Durchschnitt vier bis sechs Prozent pro Jahr.'],
      ] },
    ],
    memos: [
      { title: 'Digitalisierung in meinem Beruf', content: 'Analyse the impact of digitalisation with passive and conjunction structures.', german: 'Die Digitalisierung hat meinen Beruf grundlegend verändert. Viele Aufgaben werden heute automatisiert, und Dokumente werden digital unterschrieben. Gleichzeitig müssen neue Kompetenzen erworben werden. Wer die Veränderungen versteht, kann sie nutzen. Die Zukunft gehört den Menschen, die digital denken.', english: 'Digitalisation has fundamentally changed my profession. Many tasks are automated today, and documents are signed digitally. At the same time, new skills must be acquired. Those who understand the changes can use them. The future belongs to people who think digitally.' },
      { title: 'Gesellschaftlicher Wandel', content: 'Reflect on social change with examples and opinion.', german: 'Unsere Gesellschaft wird immer vielfältiger. Migration und Globalisierung bringen neue Perspektiven, aber auch Herausforderungen. Integration gelingt am besten durch Begegnung und gemeinsame Projekte. Meiner Meinung nach sollten wir den Wandel als Chance sehen und nicht als Bedrohung.', english: 'Our society is becoming more diverse. Migration and globalisation bring new perspectives, but also challenges. Integration works best through encounters and joint projects. In my opinion, we should see change as an opportunity and not as a threat.' },
    ],
    expressions: [
      { p: 'Meiner Meinung nach sollte man …', t: 'In my opinion one should …', cat: 'Discussion' },
      { p: 'Das lässt sich nicht vermeiden.', t: 'That cannot be avoided.', cat: 'Discussion' },
      { p: 'Ich muss zugeben, dass …', t: 'I have to admit that …', cat: 'Discussion' },
      { p: 'Es handelt sich um eine komplexe Frage.', t: 'It is a complex question.', cat: 'Academic' },
      { p: 'Die Daten zeigen deutlich, dass …', t: 'The data clearly show that …', cat: 'Academic' },
      { p: 'Langfristig gesehen …', t: 'In the long term …', cat: 'Academic' },
    ],
    idioms: [
      { p: 'Zwei Fliegen mit einer Klappe schlagen', t: 'to kill two birds with one stone', meaning: 'To achieve two goals with one action.', usage: 'Mit dem Fahrrad zur Arbeit fahren und Sport – zwei Fliegen mit einer Klappe.' },
      { p: 'Ins Schwarze treffen', t: 'to hit the bullseye', meaning: 'To be exactly right.', usage: 'Mit deiner Prognose hast du ins Schwarze getroffen.' },
    ],
    mistakes: [
      { inc: 'Der Antrag muss eingereicht werden können.', cor: 'Der Antrag muss eingereicht werden.', why: 'The double modal (muss ... können) is grammatically awkward; express ability or necessity once.' },
      { inc: 'Ich bin Angst vor Prüfungen.', cor: 'Ich habe Angst vor Prüfungen.', why: 'In German "Angst haben" uses "haben", not "sein".' },
    ],
    books: [
      { name: 'Sicher! B2', author: 'Hueber Verlag', notes: 'Comprehensive B2 course book with academic and professional modules.' },
      { name: 'Aspekte Neu B2', author: 'Langenscheidt', notes: 'Excellent for B2 exam preparation.' },
    ],
    resources: [
      { url: 'https://www.youtube.com/@EasyGerman', kind: 'video', title: 'Easy German – Debating in German', author: 'Easy Languages', handle: '@EasyGerman' },
      { url: 'https://www.youtube.com/@LearnGermanWithAnja', kind: 'video', title: 'German Konjunktiv II past', author: 'Anja', handle: '@LearnGermanWithAnja' },
      { url: 'https://www.youtube.com/@GermanWithLaura', kind: 'video', title: 'German passive with modal verbs', author: 'Laura', handle: '@GermanWithLaura' },
    ],
    notes: [
      { cat: 'daily', daysAgo: 29, content: 'Ich habe Konjunktiv II der Vergangenheit geübt: Ich hätte das gemacht, wir wären gekommen.', ch: 0 },
      { cat: 'reading', daysAgo: 31, content: 'Artikel über Digitalisierung gelesen. Wichtige Vokabeln: die Daten, das Gerät, die Digitalisierung.', ch: 1 },
      { cat: 'writing', daysAgo: 33, content: 'Ich habe einen analytischen Text über den gesellschaftlichen Wandel geschrieben.', ch: 3 },
    ],
  },

  'B2.2': {
    chapters: [
      'Lektion 29 · Berufssprache & Präsentationen',
      'Lektion 30 · Medizin & Forschung',
      'Lektion 31 · Recht & Justiz',
      'Lektion 32 · Medien & Rhetorik',
    ],
    vocab: [
      { w: 'die Präsentation', t: 'the presentation', ex: 'Die Präsentation war überzeugend.', cat: 'Business', ch: 0 },
      { w: 'die Zusammenfassung', t: 'the summary', ex: 'Ich schreibe eine Zusammenfassung des Berichts.', cat: 'Business', ch: 0 },
      { w: 'der Bericht', t: 'the report', ex: 'Der Bericht muss bis Freitag fertig sein.', cat: 'Business', ch: 0 },
      { w: 'die Studie', t: 'the study', ex: 'Die Studie bestätigt die Ergebnisse.', cat: 'Research', ch: 1 },
      { w: 'der Patient', t: 'the patient', ex: 'Der Patient erholt sich gut.', cat: 'Medicine', ch: 1 },
      { w: 'die Diagnose', t: 'the diagnosis', ex: 'Die Diagnose kam überraschend.', cat: 'Medicine', ch: 1 },
      { w: 'das Recht', t: 'the right / law', ex: 'Jeder hat das Recht auf Bildung.', cat: 'Law', ch: 2 },
      { w: 'der Anwalt', t: 'the lawyer', ex: 'Der Anwalt berät mich kostenlos.', cat: 'Law', ch: 2 },
      { w: 'das Gericht', t: 'the court', ex: 'Das Gericht fällt das Urteil.', cat: 'Law', ch: 2 },
      { w: 'die Rede', t: 'the speech', ex: 'Die Rede des Politikers war stark.', cat: 'Media', ch: 3 },
      { w: 'das Argument', t: 'the argument', ex: 'Sein Argument war überzeugend.', cat: 'Media', ch: 3 },
      { w: 'die Rhetorik', t: 'the rhetoric', ex: 'Rhetorik ist die Kunst der Überzeugung.', cat: 'Media', ch: 3 },
      { w: 'überzeugend', t: 'convincing', ex: 'Sie hat eine überzeugende Präsentation gehalten.', cat: 'Adjectives', ch: 0 },
      { w: 'präzise', t: 'precise', ex: 'Gute Berichte sind präzise formuliert.', cat: 'Adjectives', ch: 0 },
    ],
    grammar: [
      { rule: 'Nominalisierungen', expl: 'Turning verbs into nouns: prüfen → die Prüfung, entscheiden → die Entscheidung.', exs: ['Die Prüfung der Unterlagen dauerte lange.'], cat: 'Style' },
      { rule: 'Verbale Klammer', expl: 'The sentence bracket: the conjugated verb in position 2 and the rest at the end.', exs: ['Er hat die Studie gestern veröffentlicht. (Perfekt)'], cat: 'Syntax' },
      { rule: 'Futur II', expl: 'Future perfect: wird + past participle + haben/sein.', exs: ['Bis nächste Woche werde ich den Bericht geschrieben haben.'], cat: 'Future' },
      { rule: 'Redemittel für Diskussionen', expl: 'Useful phrases: Zusammenfassend lässt sich sagen, demgegenüber, einerseits … andererseits.', exs: ['Zusammenfassend lässt sich sagen, dass das Projekt gelingt.'], cat: 'Discussion' },
      { rule: 'Appositionen', expl: 'Appositions add information: Herr Schmidt, unser Chef, ist krank.', exs: ['Anna, meine beste Freundin, zieht nach Wien.'], cat: 'Syntax' },
    ],
    verbs: [
      { i: 'überzeugen', meaning: 'to convince', ich: 'überzeuge', du: 'überzeugst', er: 'überzeugt', wir: 'überzeugen', ihr: 'überzeugt', sie: 'überzeugen', cat: 'Regular' },
      { i: 'zusammenfassen', meaning: 'to summarise', ich: 'fasse zusammen', du: 'fasst zusammen', er: 'fasst zusammen', wir: 'fassen zusammen', ihr: 'fasst zusammen', sie: 'fassen zusammen', cat: 'Separable' },
      { i: 'präsentieren', meaning: 'to present', ich: 'präsentiere', du: 'präsentierst', er: 'präsentiert', wir: 'präsentieren', ihr: 'präsentiert', sie: 'präsentieren', cat: 'Regular' },
      { i: 'verhandeln', meaning: 'to negotiate', ich: 'verhandle', du: 'verhandelst', er: 'verhandelt', wir: 'verhandeln', ihr: 'verhandelt', sie: 'verhandeln', cat: 'Regular' },
      { i: 'einreichen', meaning: 'to submit', ich: 'reiche ein', du: 'reichst ein', er: 'reicht ein', wir: 'reichen ein', ihr: 'reicht ein', sie: 'reichen ein', cat: 'Separable' },
    ],
    dialogues: [
      { title: 'Vor der Präsentation', parts: [{ name: 'Kollegin', gender: 'female' }, { name: 'Kollege', gender: 'male' }], lines: [
        [0, 'Kannst du meine Präsentation kurz anschauen? Ich habe Bedenken.'],
        [1, 'Gern. Der Aufbau ist gut, aber die Einleitung könnte präziser sein.'],
        [0, 'Danke. Und sind die Zahlen klar genug?'],
        [1, 'Ja, aber füge eine Zusammenfassung am Ende hinzu. Das wirkt professioneller.'],
        [0, 'Perfekt, ich überarbeite es noch heute.'],
      ] },
      { title: 'Ein Rechtsproblem besprechen', parts: [{ name: 'Mandant', gender: 'male' }, { name: 'Anwältin', gender: 'female' }], lines: [
        [1, 'Also, Ihr Fall ist nicht kompliziert, aber die Beweislage ist dünn.'],
        [0, 'Was raten Sie mir?'],
        [1, 'Ich würde vor Gericht auf eine außergerichtliche Einigung hinarbeiten.'],
        [0, 'Und wie hoch sind die Kosten?'],
        [1, 'Das hängt von der Dauer ab. Ich reiche Ihnen einen Kostenplan ein.'],
      ] },
    ],
    memos: [
      { title: 'Eine Präsentation vorbereiten', content: 'Plan a presentation using structure words and professional phrases.', german: 'Für die Präsentation wähle ich ein klares Thema und eine klare Gliederung. Zuerst nenne ich die wichtigsten Ergebnisse, dann gehe ich auf die Methoden ein. Am Ende fasse ich zusammen und nehme Fragen entgegen. Wichtig sind präzise Formulierungen und aussagekräftige Grafiken. Überzeugend ist, wer sachlich bleibt.', english: 'For the presentation I choose a clear topic and a clear structure. First I mention the most important results, then I go into the methods. At the end I summarise and take questions. Precise wording and meaningful graphics are important. Convincing is whoever stays objective.' },
      { title: 'Die Kunst der Rhetorik', content: 'Notes on rhetoric and how to build strong arguments.', german: 'Rhetorik ist die Kunst, Menschen zu überzeugen. Ein gutes Argument hat eine klare These, starke Belege und eine nachvollziehbare Schlussfolgerung. Man sollte ruhig sprechen, Pausen setzen und den Blickkontakt halten. Auch Körpersprache und Stimmlage spielen eine große Rolle.', english: 'Rhetoric is the art of convincing people. A good argument has a clear thesis, strong evidence and a comprehensible conclusion. You should speak calmly, set pauses and keep eye contact. Body language and voice also play a big role.' },
    ],
    expressions: [
      { p: 'Zusammenfassend lässt sich sagen, dass …', t: 'In summary, one can say that …', cat: 'Discussion' },
      { p: 'Demgegenüber steht …', t: 'On the other hand there is …', cat: 'Discussion' },
      { p: 'Einerseits … andererseits …', t: 'On the one hand … on the other hand …', cat: 'Discussion' },
      { p: 'Ich möchte auf einen Punkt eingehen.', t: 'I would like to address a point.', cat: 'Discussion' },
      { p: 'Das spricht für / gegen die These.', t: 'That speaks for / against the thesis.', cat: 'Academic' },
      { p: 'Können Sie das genauer erläutern?', t: 'Can you explain that more precisely?', cat: 'Discussion' },
    ],
    idioms: [
      { p: 'Den Stein ins Rollen bringen', t: 'to set the ball rolling', meaning: 'To start something that will develop further.', usage: 'Mit deinem Vorschlag hast du den Stein ins Rollen gebracht.' },
      { p: 'Auf dem Schlauch stehen', t: 'to draw a blank', meaning: 'To not understand something right away.', usage: 'Ich stehe gerade auf dem Schlauch, kannst du es wiederholen?' },
    ],
    mistakes: [
      { inc: 'Ich werde den Bericht bis Freitag geschrieben haben müssen.', cor: 'Ich muss den Bericht bis Freitag geschrieben haben.', why: 'Avoid stacking future and modal forms; one modal with the perfect infinitive is enough.' },
      { inc: 'Der Patient ist gut erholt.', cor: 'Der Patient hat sich gut erholt.', why: '"sich erholen" is reflexive and uses "haben": Der Patient hat sich gut erholt.' },
    ],
    books: [
      { name: 'Sicher! B2.2', author: 'Hueber Verlag', notes: 'Covers professional German and media topics.' },
      { name: 'Aspekte Neu B2.2', author: 'Langenscheidt', notes: 'Includes academic texts and exam training.' },
    ],
    resources: [
      { url: 'https://www.youtube.com/@EasyGerman', kind: 'video', title: 'Easy German – Job interview questions', author: 'Easy Languages', handle: '@EasyGerman' },
      { url: 'https://www.youtube.com/@LearnGermanWithAnja', kind: 'video', title: 'German sentence bracket explained', author: 'Anja', handle: '@LearnGermanWithAnja' },
      { url: 'https://www.youtube.com/@GermanWithLaura', kind: 'video', title: 'German future perfect', author: 'Laura', handle: '@GermanWithLaura' },
    ],
    notes: [
      { cat: 'daily', daysAgo: 34, content: 'Ich habe Redemittel für Diskussionen gelernt: Zusammenfassend lässt sich sagen, demgegenüber, einerseits andererseits.', ch: 0 },
      { cat: 'writing', daysAgo: 36, content: 'Ich habe einen Bericht über die Rhetorik geschrieben und die verbale Klammer geübt.', ch: 3 },
      { cat: 'listening', daysAgo: 38, content: 'Ich habe einen Hörtext über den Berufsalltag gehört und neue Wörter notiert.', ch: 0 },
    ],
  },

  'B2.3': {
    chapters: [
      'Lektion 33 · Kultur & Kunst',
      'Lektion 34 · Wissenschaft & Ethik',
      'Lektion 35 · Globale Wirtschaft',
      'Lektion 36 · Sprachen & Kommunikation',
    ],
    vocab: [
      { w: 'die Kultur', t: 'the culture', ex: 'Die Kultur eines Landes ist vielfältig.', cat: 'Culture', ch: 0 },
      { w: 'die Kunst', t: 'the art', ex: 'Die Kunst spricht eine eigene Sprache.', cat: 'Culture', ch: 0 },
      { w: 'das Museum', t: 'the museum', ex: 'Das Museum zeigt moderne Kunst.', cat: 'Culture', ch: 0 },
      { w: 'die Ethik', t: 'the ethics', ex: 'Die Ethik stellt moralische Fragen.', cat: 'Science', ch: 1 },
      { w: 'der Fortschritt', t: 'the progress', ex: 'Der Fortschritt bringt neue Fragen.', cat: 'Science', ch: 1 },
      { w: 'die Verantwortung', t: 'the responsibility', ex: 'Wissenschaft trägt Verantwortung.', cat: 'Science', ch: 1 },
      { w: 'der Handel', t: 'the trade', ex: 'Der internationale Handel wächst.', cat: 'Economy', ch: 2 },
      { w: 'der Export', t: 'the export', ex: 'Der Export steigt jedes Jahr.', cat: 'Economy', ch: 2 },
      { w: 'die Globalisierung', t: 'the globalisation', ex: 'Die Globalisierung verbindet Märkte.', cat: 'Economy', ch: 2 },
      { w: 'die Übersetzung', t: 'the translation', ex: 'Die Übersetzung war sehr gut.', cat: 'Language', ch: 3 },
      { w: 'der Dialekt', t: 'the dialect', ex: 'Der Dialekt klingt charmant.', cat: 'Language', ch: 3 },
      { w: 'die Kommunikation', t: 'the communication', ex: 'Gute Kommunikation ist entscheidend.', cat: 'Language', ch: 3 },
      { w: 'kulturell', t: 'cultural', ex: 'Der kulturelle Austausch fördert das Verständnis.', cat: 'Adjectives', ch: 0 },
      { w: 'wissenschaftlich', t: 'scientific', ex: 'Die wissenschaftliche Methode ist streng.', cat: 'Adjectives', ch: 1 },
    ],
    grammar: [
      { rule: 'Passiv Perfekt', expl: 'Perfect passive: ist + past participle + worden.', exs: ['Die Studie ist veröffentlicht worden.'], cat: 'Passive' },
      { rule: 'Subjektiver Gebrauch der Modalverben', expl: 'Modal verbs can express assumptions: er will das getan haben (he claims).', exs: ['Sie soll sehr reich sein.'], cat: 'Modal Verbs' },
      { rule: 'Konnektoren: während, demnach, insofern', expl: 'Formal connectors used in academic language.', exs: ['Insofern ist die Lösung plausibel.'], cat: 'Conjunctions' },
      { rule: 'Erweiterte Partizipien', expl: 'Extended participles build complex noun phrases: die in der Studie untersuchten Patienten.', exs: ['Der in der Forschung erzielte Fortschritt ist groß.'], cat: 'Syntax' },
      { rule: 'Wissenschaftssprache', expl: 'Academic style: impersonal, precise, with nominalisations.', exs: ['Die Durchführung der Studie war aufwendig.'], cat: 'Academic' },
    ],
    verbs: [
      { i: 'exportieren', meaning: 'to export', ich: 'exportiere', du: 'exportierst', er: 'exportiert', wir: 'exportieren', ihr: 'exportiert', sie: 'exportieren', cat: 'Regular' },
      { i: 'importieren', meaning: 'to import', ich: 'importiere', du: 'importierst', er: 'importiert', wir: 'importieren', ihr: 'importiert', sie: 'importieren', cat: 'Regular' },
      { i: 'übersetzen', meaning: 'to translate', ich: 'übersetze', du: 'übersetzt', er: 'übersetzt', wir: 'übersetzen', ihr: 'übersetzt', sie: 'übersetzen', cat: 'Regular' },
      { i: 'dokumentieren', meaning: 'to document', ich: 'dokumentiere', du: 'dokumentierst', er: 'dokumentiert', wir: 'dokumentieren', ihr: 'dokumentiert', sie: 'dokumentieren', cat: 'Regular' },
      { i: 'veröffentlichen', meaning: 'to publish', ich: 'veröffentliche', du: 'veröffentlichst', er: 'veröffentlicht', wir: 'veröffentlichen', ihr: 'veröffentlicht', sie: 'veröffentlichen', cat: 'Regular' },
    ],
    dialogues: [
      { title: 'Über moderne Kunst sprechen', parts: [{ name: 'Sara', gender: 'female' }, { name: 'Jonas', gender: 'male' }], lines: [
        [0, 'Wie gefällt dir die Ausstellung?'],
        [1, 'Ehrlich gesagt verstehe ich moderne Kunst oft nicht ganz.'],
        [0, 'Man muss sie nicht verstehen, man soll sie erleben.'],
        [1, 'Interessanter Gedanke. Worauf kommt es deiner Meinung nach an?'],
        [0, 'Auf die Wirkung und auf die Botschaft, die der Künstler vermitteln will.'],
      ] },
      { title: 'Ein Verkaufsgespräch auf dem Weltmarkt', parts: [{ name: 'Exportleiterin', gender: 'female' }, { name: 'Partner', gender: 'male' }], lines: [
        [0, 'Vielen Dank für Ihr Interesse an unseren Produkten.'],
        [1, 'Ihr Angebot ist gut, aber der Preis ist zu hoch.'],
        [0, 'Dafür bieten wir besseren Service und längere Garantie.'],
        [1, 'Das stimmt. Können Sie bei großen Mengen Rabatt geben?'],
        [0, 'Ab tausend Stück fünf Prozent. Wir können auch die Logistik übernehmen.'],
      ] },
    ],
    memos: [
      { title: 'Kunst und Kultur erleben', content: 'Write about a museum visit and personal reactions.', german: 'Am Samstag war ich in der Ausstellung zeitgenössischer Kunst. Die Werke haben mich zum Nachdenken gebracht. Besonders beeindruckt hat mich eine Installation über die Globalisierung. Kunst ist für mich ein Spiegel der Gesellschaft. Ich habe beschlossen, häufiger Ausstellungen zu besuchen und meine Eindrücke zu notieren.', english: 'On Saturday I was at the exhibition of contemporary art. The works made me think. A installation about globalisation impressed me especially. Art is for me a mirror of society. I have decided to visit exhibitions more often and to note my impressions.' },
      { title: 'Ethik und Wissenschaft', content: 'Discuss the responsibility of science using academic German.', german: 'Der wissenschaftliche Fortschritt ist beeindruckend, aber er ist nicht neutral. Die Forschung trägt Verantwortung für die Folgen ihrer Ergebnisse. Deshalb müssen ethische Fragen in jedem Projekt von Anfang an gestellt werden. Eine kritische Wissenschaft hält am Menschen als Maßstab fest.', english: 'Scientific progress is impressive, but it is not neutral. Research is responsible for the consequences of its results. Therefore ethical questions must be asked from the beginning in every project. A critical science keeps the human being as the measure.' },
    ],
    expressions: [
      { p: 'Es ist erwiesen, dass …', t: 'It is proven that …', cat: 'Academic' },
      { p: 'Unter diesen Umständen …', t: 'Under these circumstances …', cat: 'Discussion' },
      { p: 'Das wirft die Frage auf, ob …', t: 'That raises the question of whether …', cat: 'Academic' },
      { p: 'Es kommt darauf an, wie man es betrachtet.', t: 'It depends on how you look at it.', cat: 'Discussion' },
      { p: 'Die Wissenschaft geht davon aus, dass …', t: 'Science assumes that …', cat: 'Academic' },
      { p: 'Diesen Standpunkt teile ich nicht.', t: 'I do not share this point of view.', cat: 'Discussion' },
    ],
    idioms: [
      { p: 'Die Fäden in der Hand haben', t: 'to hold all the strings', meaning: 'To be in control of a situation.', usage: 'Als Projektleiterin hat sie die Fäden in der Hand.' },
      { p: 'Auf großem Fuß leben', t: 'to live large', meaning: 'To live expensively, beyond your means.', usage: 'Er lebt auf großem Fuß und gibt mehr aus, als er verdient.' },
    ],
    mistakes: [
      { inc: 'Die Studie ist veröffentlicht geworden.', cor: 'Die Studie ist veröffentlicht worden.', why: 'The perfect passive uses "worden" (without ge-), not "geworden".' },
      { inc: 'Ich habe das Buch von ihm übersetzen gelassen lassen.', cor: 'Ich habe das Buch von ihm übersetzen lassen.', why: 'With "lassen" the infinitive goes at the end; do not repeat the verb.' },
    ],
    books: [
      { name: 'Aspekte Neu B2.3', author: 'Langenscheidt', notes: 'Final B2 volume with cultural and academic themes.' },
      { name: 'Großes Übungsbuch Deutsch – B2', author: 'Hueber Verlag', notes: 'Intensive grammar and vocabulary practice.' },
    ],
    resources: [
      { url: 'https://www.youtube.com/@EasyGerman', kind: 'video', title: 'Easy German – Culture and art in Berlin', author: 'Easy Languages', handle: '@EasyGerman' },
      { url: 'https://www.youtube.com/@LearnGermanWithAnja', kind: 'video', title: 'German passive perfect', author: 'Anja', handle: '@LearnGermanWithAnja' },
      { url: 'https://www.youtube.com/@GermanWithLaura', kind: 'video', title: 'German modal verbs subjective', author: 'Laura', handle: '@GermanWithLaura' },
    ],
    notes: [
      { cat: 'daily', daysAgo: 39, content: 'Ich habe das Passiv Perfekt geübt: Die Studie ist veröffentlicht worden.', ch: 1 },
      { cat: 'reading', daysAgo: 41, content: 'Ich habe einen Essay über Globalisierung gelesen und die Argumente analysiert.', ch: 2 },
      { cat: 'writing', daysAgo: 43, content: 'Mein Museumserlebnis aufgeschrieben – neue Wörter: die Installation, der Eindruck.', ch: 0 },
    ],
  },

  'C1.1': {
    chapters: [
      'Lektion 37 · Wissenschaft & Technik',
      'Lektion 38 · Diskussion & Meinung',
      'Lektion 39 · Kritik & Analyse',
      'Lektion 40 · Reportagen & Presse',
    ],
    vocab: [
      { w: 'die These', t: 'the thesis', ex: 'Die These ist gut begründet.', cat: 'Academic', ch: 0 },
      { w: 'der Standpunkt', t: 'the point of view', ex: 'Ich respektiere deinen Standpunkt.', cat: 'Discussion', ch: 1 },
      { w: 'die Analyse', t: 'the analysis', ex: 'Die Analyse der Daten ist abgeschlossen.', cat: 'Academic', ch: 0 },
      { w: 'die Kritik', t: 'the criticism', ex: 'Die Kritik ist konstruktiv.', cat: 'Discussion', ch: 2 },
      { w: 'die Reportage', t: 'the reportage', ex: 'Die Reportage zeigt das echte Leben.', cat: 'Media', ch: 3 },
      { w: 'die Presse', t: 'the press', ex: 'Die Presse berichtet ausführlich.', cat: 'Media', ch: 3 },
      { w: 'die Recherche', t: 'the research (journalistic)', ex: 'Die Recherche dauerte drei Wochen.', cat: 'Media', ch: 3 },
      { w: 'die Quelle', t: 'the source', ex: 'Die Quelle ist zuverlässig.', cat: 'Academic', ch: 0 },
      { w: 'die Argumentation', t: 'the line of argument', ex: 'Die Argumentation ist schlüssig.', cat: 'Discussion', ch: 1 },
      { w: 'die Perspektive', t: 'the perspective', ex: 'Aus meiner Perspektive ist es klar.', cat: 'Discussion', ch: 1 },
      { w: 'nuanciert', t: 'nuanced', ex: 'Ihre Meinung ist sehr nuanciert.', cat: 'Adjectives', ch: 2 },
      { w: 'sachlich', t: 'objective / matter-of-fact', ex: 'Bleiben Sie sachlich in der Debatte.', cat: 'Adjectives', ch: 2 },
      { w: 'der Fortschritt', t: 'the progress', ex: 'Der technische Fortschritt ist rasant.', cat: 'Science', ch: 0 },
      { w: 'die Technik', t: 'the technology / engineering', ex: 'Die Technik entwickelt sich schnell.', cat: 'Science', ch: 0 },
    ],
    grammar: [
      { rule: 'Konzessive Sätze', expl: 'Concessive clauses: obwohl, trotzdem, trotz + Gen. Express contrast.', exs: ['Obwohl es regnete, gingen wir spazieren.'], cat: 'Syntax' },
      { rule: 'Komplexe Satzgefüge', expl: 'C1 sentence construction with multiple subordinate clauses and connectors.', exs: ['Da die Ergebnisse eindeutig sind, kann man sagen, dass der Plan funktioniert.'], cat: 'Syntax' },
      { rule: 'Redewiedergabe (Konjunktiv I)', expl: 'Reported speech with subjunctive I: Er sagt, er habe Zeit.', exs: ['Sie behauptet, sie wisse nichts davon.'], cat: 'Reported Speech' },
      { rule: 'Fachsprache', expl: 'Technical terminology and abbreviations used in academic German.', exs: ['Die Quantifizierung der Ergebnisse ist schwierig.'], cat: 'Academic' },
      { rule: 'Vergleiche mit als und wie', expl: 'als for comparisons of inequality, wie for equality.', exs: ['Er ist schneller als ich.', 'Er ist genauso schnell wie ich.'], cat: 'Grammar Basics' },
    ],
    verbs: [
      { i: 'argumentieren', meaning: 'to argue', ich: 'argumentiere', du: 'argumentierst', er: 'argumentiert', wir: 'argumentieren', ihr: 'argumentiert', sie: 'argumentieren', cat: 'Regular' },
      { i: 'kritisieren', meaning: 'to criticise', ich: 'kritisiere', du: 'kritisierst', er: 'kritisiert', wir: 'kritisieren', ihr: 'kritisiert', sie: 'kritisieren', cat: 'Regular' },
      { i: 'recherchieren', meaning: 'to research', ich: 'recherchiere', du: 'recherchierst', er: 'recherchiert', wir: 'recherchieren', ihr: 'recherchiert', sie: 'recherchieren', cat: 'Regular' },
      { i: 'analysieren', meaning: 'to analyse', ich: 'analysiere', du: 'analysierst', er: 'analysiert', wir: 'analysieren', ihr: 'analysiert', sie: 'analysieren', cat: 'Regular' },
      { i: 'veröffentlichen', meaning: 'to publish', ich: 'veröffentliche', du: 'veröffentlichst', er: 'veröffentlicht', wir: 'veröffentlichen', ihr: 'veröffentlicht', sie: 'veröffentlichen', cat: 'Regular' },
    ],
    dialogues: [
      { title: 'Eine wissenschaftliche Debatte', parts: [{ name: 'Prof. Dr. Klein', gender: 'male' }, { name: 'Dr. Meyer', gender: 'female' }], lines: [
        [0, 'Die Ergebnisse Ihrer Studie sind interessant, aber die Stichprobe ist zu klein.'],
        [1, 'Das ist ein berechtigter Einwand. Wir planen eine größere Folgestudie.'],
        [0, 'Würden Sie dennoch Ihre These halten?'],
        [1, 'Vorläufig ja, aber ohne weitere Daten bleibt die Aussage begrenzt.'],
        [0, 'Einverstanden. Ich freue mich auf Ihre nächsten Ergebnisse.'],
      ] },
      { title: 'Kritische Analyse einer Reportage', parts: [{ name: 'Redakteurin', gender: 'female' }, { name: 'Journalist', gender: 'male' }], lines: [
        [0, 'Deine Reportage ist gut, aber die Quellen sind nicht ausreichend belegt.'],
        [1, 'Die Hauptquellen habe ich dokumentiert, zwei Interviews sind anonym.'],
        [0, 'Anonyme Quellen schwächen die Glaubwürdigkeit.'],
        [1, 'Ich kann sie schützen, indem ich die Details verändere.'],
        [0, 'Das wäre eine gute Lösung. Überarbeite bitte den Abschnitt.'],
      ] },
    ],
    memos: [
      { title: 'Eine These verteidigen', content: 'Practice defending a thesis with concession clauses and counterarguments.', german: 'Meine These lautet: Digitalisierung verbessert die Arbeitsqualität. Obwohl einige Studien negative Effekte zeigen, überwiegen die Vorteile. Demgegenüber muss man zugeben, dass die digitale Überwachung Risiken birgt. Dennoch überwiegt die Effizienz, wenn man die richtigen Regeln einführt. Kritiker sollten daher nicht verallgemeinern.', english: 'My thesis is: digitalisation improves the quality of work. Although some studies show negative effects, the advantages outweigh them. On the other hand, one must admit that digital surveillance carries risks. Nevertheless efficiency prevails if the right rules are introduced. Critics should therefore not generalise.' },
      { title: 'Presse und Wahrheit', content: 'Reflect on journalistic ethics and the role of the press.', german: 'Die Presse hat die Aufgabe, unabhängig zu informieren. In Zeiten von Fake News ist die Recherche wichtiger denn je. Journalisten müssen Quellen prüfen und unterschiedliche Perspektiven zeigen. Die Glaubwürdigkeit eines Mediums entsteht durch Transparenz und Korrekturen. Ein freier Journalismus ist eine Stütze der Demokratie.', english: 'The press has the task of informing independently. In times of fake news, research is more important than ever. Journalists must check sources and show different perspectives. The credibility of a medium arises through transparency and corrections. A free journalism is a pillar of democracy.' },
    ],
    expressions: [
      { p: 'Meiner Auffassung nach …', t: 'In my view …', cat: 'Discussion' },
      { p: 'Das ist ein berechtigter Einwand.', t: 'That is a legitimate objection.', cat: 'Discussion' },
      { p: 'Ich möchte das relativieren.', t: 'I would like to qualify that.', cat: 'Discussion' },
      { p: 'Es lässt sich nicht leugnen, dass …', t: 'It cannot be denied that …', cat: 'Discussion' },
      { p: 'Dem ist entgegenzuhalten, dass …', t: 'Against that one must say that …', cat: 'Discussion' },
      { p: 'Die Argumente sprechen eine klare Sprache.', t: 'The arguments speak for themselves.', cat: 'Discussion' },
    ],
    idioms: [
      { p: 'Den Wald vor lauter Bäumen nicht sehen', t: 'to miss the forest for the trees', meaning: 'To focus on details and miss the big picture.', usage: 'Ich habe so lange an der Grafik gearbeitet, dass ich den Wald vor lauter Bäumen nicht gesehen habe.' },
      { p: 'Etwas auf die lange Bank schieben', t: 'to put something off', meaning: 'To postpone something for a long time.', usage: 'Schieben Sie die Entscheidung nicht auf die lange Bank.' },
    ],
    mistakes: [
      { inc: 'Obwohl es regnete, aber wir gingen spazieren.', cor: 'Obwohl es regnete, gingen wir spazieren.', why: 'Do not use "aber" in the main clause after "obwohl"; the main clause already expresses the contrast.' },
      { inc: 'Sie behauptet, dass sie nichts weißt.', cor: 'Sie behauptet, sie wisse nichts.', why: 'In reported speech use Konjunktiv I: "sie wisse" instead of "weißt".' },
    ],
    books: [
      { name: 'Aspekte Neu C1', author: 'Langenscheidt', notes: 'Academic and cultural topics for C1.' },
      { name: 'Akademie Deutsch C1+', author: 'Hueber Verlag', notes: 'Ideal for university preparation in German.' },
    ],
    resources: [
      { url: 'https://www.youtube.com/@EasyGerman', kind: 'video', title: 'Easy German – Debating and arguing politely', author: 'Easy Languages', handle: '@EasyGerman' },
      { url: 'https://www.youtube.com/@LearnGermanWithAnja', kind: 'video', title: 'German Konjunktiv I for reported speech', author: 'Anja', handle: '@LearnGermanWithAnja' },
      { url: 'https://www.youtube.com/@GermanWithLaura', kind: 'video', title: 'German concessive clauses', author: 'Laura', handle: '@GermanWithLaura' },
    ],
    notes: [
      { cat: 'daily', daysAgo: 44, content: 'Ich habe konzessive Sätze geübt: obwohl, trotzdem, trotz + Genitiv.', ch: 1 },
      { cat: 'reading', daysAgo: 46, content: 'Zwei Reportagen gelesen und die Perspektiven der Autoren verglichen.', ch: 3 },
      { cat: 'writing', daysAgo: 48, content: 'Meine These zur Digitalisierung verteidigt und Gegenargumente integriert.', ch: 0 },
    ],
  },

  'C1.2': {
    chapters: [
      'Lektion 41 · Fachsprache & Wissenschaft',
      'Lektion 42 · Verhandlungen & Verträge',
      'Lektion 43 · Innovation & Zukunft',
      'Lektion 44 · Rhetorik & Präsentation',
    ],
    vocab: [
      { w: 'der Vertrag', t: 'the contract', ex: 'Der Vertrag wurde unterzeichnet.', cat: 'Business', ch: 1 },
      { w: 'die Verhandlung', t: 'the negotiation', ex: 'Die Verhandlung dauerte den ganzen Tag.', cat: 'Business', ch: 1 },
      { w: 'die Bedingung', t: 'the condition', ex: 'Wir akzeptieren die Bedingungen nicht.', cat: 'Business', ch: 1 },
      { w: 'die Innovation', t: 'the innovation', ex: 'Innovation treibt den Fortschritt an.', cat: 'Future', ch: 2 },
      { w: 'die Prognose', t: 'the forecast', ex: 'Die Prognose für den Markt ist positiv.', cat: 'Future', ch: 2 },
      { w: 'die Zukunft', t: 'the future', ex: 'Die Zukunft ist voller Möglichkeiten.', cat: 'Future', ch: 2 },
      { w: 'die Rhetorik', t: 'the rhetoric', ex: 'Gute Rhetorik überzeugt ohne Manipulation.', cat: 'Rhetoric', ch: 3 },
      { w: 'die Argumentation', t: 'the line of argument', ex: 'Die Argumentation war lückenlos.', cat: 'Rhetoric', ch: 3 },
      { w: 'die Überzeugung', t: 'the conviction', ex: 'Überzeugung entsteht durch Sachlichkeit.', cat: 'Rhetoric', ch: 3 },
      { w: 'die Terminologie', t: 'the terminology', ex: 'Die Terminologie muss präzise sein.', cat: 'Academic', ch: 0 },
      { w: 'die Hypothese', t: 'the hypothesis', ex: 'Die Hypothese muss überprüft werden.', cat: 'Academic', ch: 0 },
      { w: 'strategisch', t: 'strategic', ex: 'Das ist eine strategische Entscheidung.', cat: 'Adjectives', ch: 2 },
      { w: 'innovativ', t: 'innovative', ex: 'Das Unternehmen ist sehr innovativ.', cat: 'Adjectives', ch: 2 },
      { w: 'stichhaltig', t: 'valid / sound (of arguments)', ex: 'Das Argument ist nicht stichhaltig.', cat: 'Adjectives', ch: 0 },
    ],
    grammar: [
      { rule: 'Funktionsverbgefüge', expl: 'Nominal verb phrases: in Frage stellen, zur Verfügung stehen, in Kraft treten.', exs: ['Die Lösung steht zur Verfügung.', 'Der Vertrag tritt im Januar in Kraft.'], cat: 'Style' },
      { rule: 'Präpositionalattribute', expl: 'Nominalised attributes with prepositions: die Frage nach dem Sinn, der Schutz vor Kälte.', exs: ['Die Frage nach dem Sinn der Forschung bleibt offen.'], cat: 'Syntax' },
      { rule: 'Stilistische Mittel', expl: 'Rhetorical devices: Metapher, Ironie, rhetorische Frage, Hyperbel.', exs: ['Ist das nicht offensichtlich? (rhetorische Frage)'], cat: 'Rhetoric' },
      { rule: 'Erörterung', expl: 'Structured essay: These, Argumente, Gegenargumente, Synthese.', exs: ['Einerseits spricht die Effizienz dafür, andererseits die Ethik dagegen.'], cat: 'Essay' },
      { rule: 'Hypothesen formulieren', expl: 'Expressing assumptions: es ist anzunehmen, dass; vermutlich; dürfte.', exs: ['Die Nachfrage dürfte weiter steigen.'], cat: 'Academic' },
    ],
    verbs: [
      { i: 'verhandeln', meaning: 'to negotiate', ich: 'verhandle', du: 'verhandelst', er: 'verhandelt', wir: 'verhandeln', ihr: 'verhandelt', sie: 'verhandeln', cat: 'Regular' },
      { i: 'formulieren', meaning: 'to formulate', ich: 'formuliere', du: 'formulierst', er: 'formuliert', wir: 'formulieren', ihr: 'formuliert', sie: 'formulieren', cat: 'Regular' },
      { i: 'überzeugen', meaning: 'to convince', ich: 'überzeuge', du: 'überzeugst', er: 'überzeugt', wir: 'überzeugen', ihr: 'überzeugt', sie: 'überzeugen', cat: 'Regular' },
      { i: 'präsentieren', meaning: 'to present', ich: 'präsentiere', du: 'präsentierst', er: 'präsentiert', wir: 'präsentieren', ihr: 'präsentiert', sie: 'präsentieren', cat: 'Regular' },
      { i: 'implementieren', meaning: 'to implement', ich: 'implementiere', du: 'implementierst', er: 'implementiert', wir: 'implementieren', ihr: 'implementiert', sie: 'implementieren', cat: 'Regular' },
    ],
    dialogues: [
      { title: 'Eine Vertragsverhandlung', parts: [{ name: 'Anbieter', gender: 'male' }, { name: 'Kunde', gender: 'female' }], lines: [
        [0, 'Wir akzeptieren den Preis, aber die Lieferzeit ist zu lang.'],
        [1, 'Wir können die Lieferung beschleunigen, wenn Sie drei Prozent mehr zahlen.'],
        [0, 'Das kommt nicht infrage. Bieten Sie uns eine Alternative an.'],
        [1, 'Dann verlängern wir die Garantie auf fünf Jahre. Das gleicht die Wartezeit aus.'],
        [0, 'Abgemacht. Unter dieser Bedingung unterzeichnen wir den Vertrag.'],
      ] },
      { title: 'Ein Interview für die Präsentation', parts: [{ name: 'Moderatorin', gender: 'female' }, { name: 'Gast', gender: 'male' }], lines: [
        [0, 'Was ist die größte Herausforderung für die Zukunft der Branche?'],
        [1, 'Die größte Herausforderung ist der Fachkräftemangel in Kombination mit der Digitalisierung.'],
        [0, 'Wie wollen Sie diese Herausforderung lösen?'],
        [1, 'Durch Aus- und Weiterbildung sowie durch intelligente Automatisierung.'],
        [0, 'Eine klare Strategie. Vielen Dank für das Gespräch.'],
      ] },
    ],
    memos: [
      { title: 'Eine Verhandlung vorbereiten', content: 'Plan a negotiation with objectives, concessions and fallback positions.', german: 'Für die Verhandlung definiere ich klare Ziele: ein Preisnachlass von zehn Prozent und kürzere Lieferzeiten. Meine rote Linie sind zwölf Monate Zahlungsziel. Als Zugeständnis kann ich eine höhere Stückzahl garantieren. Falls sich die Partei nicht bewegt, habe ich eine Alternative bei einem anderen Anbieter. Die Strategie ist, sachlich und flexibel zu bleiben.', english: 'For the negotiation I define clear goals: a price reduction of ten percent and shorter delivery times. My red line is twelve months payment period. As a concession I can guarantee a higher quantity. If the party does not move, I have an alternative with another provider. The strategy is to remain objective and flexible.' },
      { title: 'Die Kunst der Überzeugung', content: 'Notes on persuasion combining logic and emotion.', german: 'Überzeugen gelingt, wenn Logik und Emotion sich verbinden. Fakten liefern die Basis, Geschichten die Verbindung. Ein guter Redner passt sich dem Publikum an, spricht klar und benutzt Bilder. Am wichtigsten ist Glaubwürdigkeit: Man soll nur versprechen, was man halten kann. Damit wird Rhetorik zur Überzeugung statt zur Manipulation.', english: 'Convincing succeeds when logic and emotion combine. Facts provide the basis, stories the connection. A good speaker adapts to the audience, speaks clearly and uses images. Most important is credibility: one should only promise what one can keep. Thus rhetoric becomes persuasion instead of manipulation.' },
    ],
    expressions: [
      { p: 'Das kommt nicht infrage.', t: 'That is out of the question.', cat: 'Negotiation' },
      { p: 'Unter diesen Bedingungen akzeptieren wir das.', t: 'Under these conditions we accept that.', cat: 'Negotiation' },
      { p: 'Wir sollten eine Win-Win-Lösung finden.', t: 'We should find a win-win solution.', cat: 'Negotiation' },
      { p: 'Ich sehe das als Chance, nicht als Risiko.', t: 'I see that as an opportunity, not a risk.', cat: 'Discussion' },
      { p: 'Lassen Sie mich einen konkreten Vorschlag machen.', t: 'Let me make a concrete proposal.', cat: 'Discussion' },
      { p: 'Auf dieser Grundlage können wir uns einigen.', t: 'On this basis we can reach an agreement.', cat: 'Negotiation' },
    ],
    idioms: [
      { p: 'Etwas im Griff haben', t: 'to have something under control', meaning: 'To manage a situation confidently.', usage: 'Nach zwei Monaten habe ich den neuen Job voll im Griff.' },
      { p: 'Auf Wolke sieben schweben', t: 'to be on cloud nine', meaning: 'To be extremely happy.', usage: 'Nach der bestandenen Prüfung schwebte sie auf Wolke sieben.' },
    ],
    mistakes: [
      { inc: 'Wir können uns einigen, wenn Sie geben uns einen Rabatt.', cor: 'Wir können uns einigen, wenn Sie uns einen Rabatt geben.', why: 'In a "wenn" clause the conjugated verb goes to the end: wenn Sie uns einen Rabatt geben.' },
      { inc: 'Das Argument ist nicht stichhalt.', cor: 'Das Argument ist nicht stichhaltig.', why: 'The adjective is "stichhaltig" (valid/sound), not "stichhalt".' },
    ],
    books: [
      { name: 'Erkundungen C1', author: 'Schubert Verlag', notes: 'Academic reading and writing training for C1.' },
      { name: 'Ziel C1', author: 'Hueber Verlag', notes: 'Full C1 preparation with business German focus.' },
    ],
    resources: [
      { url: 'https://www.youtube.com/@EasyGerman', kind: 'video', title: 'Easy German – Negotiating in German', author: 'Easy Languages', handle: '@EasyGerman' },
      { url: 'https://www.youtube.com/@LearnGermanWithAnja', kind: 'video', title: 'German for presentations', author: 'Anja', handle: '@LearnGermanWithAnja' },
      { url: 'https://www.youtube.com/@GermanWithLaura', kind: 'video', title: 'Rhetoric and style in German', author: 'Laura', handle: '@GermanWithLaura' },
    ],
    notes: [
      { cat: 'daily', daysAgo: 49, content: 'Funktionsverbgefüge gelernt: in Frage stellen, zur Verfügung stehen, in Kraft treten.', ch: 1 },
      { cat: 'speaking', daysAgo: 51, content: 'Eine Verhandlungssituation auf Deutsch geübt und Win-Win-Lösungen formuliert.', ch: 1 },
      { cat: 'writing', daysAgo: 53, content: 'Einen Aufsatz über Innovation geschrieben – These, Argumente, Synthese.', ch: 2 },
    ],
  },

  'C2.1': {
    chapters: [
      'Lektion 45 · Akademisches Schreiben',
      'Lektion 46 · Literatur & Interpretation',
      'Lektion 47 · Philosophie & Ethik',
      'Lektion 48 · Wissenschaft & Forschung',
    ],
    vocab: [
      { w: 'die Dissertation', t: 'the dissertation', ex: 'Die Dissertation wurde mit Auszeichnung bewertet.', cat: 'Academic', ch: 0 },
      { w: 'das Manuskript', t: 'the manuscript', ex: 'Das Manuskript ist fast fertig.', cat: 'Academic', ch: 0 },
      { w: 'die Literatur', t: 'the literature', ex: 'Die deutsche Literatur ist reichhaltig.', cat: 'Literature', ch: 1 },
      { w: 'die Interpretation', t: 'the interpretation', ex: 'Die Interpretation des Gedichts war tiefgründig.', cat: 'Literature', ch: 1 },
      { w: 'der Diskurs', t: 'the discourse', ex: 'Der öffentliche Diskurs ist polarisiert.', cat: 'Academic', ch: 3 },
      { w: 'die Philosophie', t: 'the philosophy', ex: 'Die Philosophie fragt nach dem Sinn.', cat: 'Philosophy', ch: 2 },
      { w: 'die Ethik', t: 'the ethics', ex: 'Die Ethik begleitet den Fortschritt.', cat: 'Philosophy', ch: 2 },
      { w: 'die Erkenntnis', t: 'the insight / cognition', ex: 'Die Erkenntnis verändert unser Weltbild.', cat: 'Science', ch: 3 },
      { w: 'die Hypothese', t: 'the hypothesis', ex: 'Die Hypothese wurde widerlegt.', cat: 'Science', ch: 3 },
      { w: 'die Methodik', t: 'the methodology', ex: 'Die Methodik der Studie ist transparent.', cat: 'Science', ch: 3 },
      { w: 'abstrakt', t: 'abstract', ex: 'Das Konzept ist sehr abstrakt.', cat: 'Adjectives', ch: 2 },
      { w: 'präzis', t: 'precise', ex: 'Die Formulierung ist präzis.', cat: 'Adjectives', ch: 0 },
      { w: 'subtil', t: 'subtle', ex: 'Der Unterschied ist subtil.', cat: 'Adjectives', ch: 1 },
      { w: 'relevant', t: 'relevant', ex: 'Die Frage ist hoch relevant.', cat: 'Adjectives', ch: 3 },
    ],
    grammar: [
      { rule: 'Komplexe Nominalphrasen', expl: 'Academic noun phrases with multiple attributes: die im Rahmen der Studie durchgeführte Analyse.', exs: ['Die in den letzten Jahren beobachtete Entwicklung ist bemerkenswert.'], cat: 'Academic' },
      { rule: 'Nominalisierung von Verben', expl: 'Verbs become nominal phrases: die Erkenntnis, dass …; die Tatsache, dass …', exs: ['Die Tatsache, dass die Zahlen steigen, ist alarmierend.'], cat: 'Academic' },
      { rule: 'Passivumschreibungen', expl: 'Alternatives to passive: sich lassen, sein + zu + Infinitiv.', exs: ['Das Problem lässt sich lösen.', 'Die Lösung ist nicht zu vermeiden.'], cat: 'Passive' },
      { rule: 'Hypotaktische Sätze', expl: 'Complex multi-clause sentences typical of literary and academic writing.', exs: ['Wenn man bedenkt, dass die Zeit knapp ist, erscheint die Entscheidung richtig.'], cat: 'Syntax' },
      { rule: 'Wissenschaftliche Textsorte', expl: 'Structure of academic texts: Einleitung, Forschungsstand, Methode, Ergebnisse, Diskussion.', exs: ['Die Diskussion der Ergebnisse zeigt deutliche Grenzen.'], cat: 'Academic' },
    ],
    verbs: [
      { i: 'verfassen', meaning: 'to compose / write', ich: 'verfasse', du: 'verfasst', er: 'verfasst', wir: 'verfassen', ihr: 'verfasst', sie: 'verfassen', cat: 'Regular' },
      { i: 'interpretieren', meaning: 'to interpret', ich: 'interpretiere', du: 'interpretierst', er: 'interpretiert', wir: 'interpretieren', ihr: 'interpretiert', sie: 'interpretieren', cat: 'Regular' },
      { i: 'reflektieren', meaning: 'to reflect', ich: 'reflektiere', du: 'reflektierst', er: 'reflektiert', wir: 'reflektieren', ihr: 'reflektiert', sie: 'reflektieren', cat: 'Regular' },
      { i: 'postulieren', meaning: 'to postulate', ich: 'postuliere', du: 'postulierst', er: 'postuliert', wir: 'postulieren', ihr: 'postuliert', sie: 'postulieren', cat: 'Regular' },
      { i: 'verwerfen', meaning: 'to reject / discard', ich: 'verwerfe', du: 'verwirfst', er: 'verwirft', wir: 'verwerfen', ihr: 'verwerft', sie: 'verwerfen', cat: 'Irregular' },
    ],
    dialogues: [
      { title: 'Eine Textinterpretation diskutieren', parts: [{ name: 'Dozentin', gender: 'female' }, { name: 'Student', gender: 'male' }], lines: [
        [0, 'Ihre Interpretation des Gedichts ist originell, aber worauf stützen Sie sich?'],
        [1, 'Ich stütze mich auf die Bildsprache und die historische Einordnung.'],
        [0, 'Sehen Sie eine Verbindung zur Biografie des Autors?'],
        [1, 'Ja, aber ich habe sie bewusst zurückhaltend behandelt, um den Text selbst sprechen zu lassen.'],
        [0, 'Das ist eine überzeugende Herangehensweise.'],
      ] },
      { title: 'Ethik in der Forschung', parts: [{ name: 'Forscher', gender: 'male' }, { name: 'Ethikerin', gender: 'female' }], lines: [
        [0, 'Unsere Studie könnte die Diagnostik revolutionieren.'],
        [1, 'Welche Auswirkungen hat das auf den Datenschutz der Probanden?'],
        [0, 'Wir arbeiten vollständig anonymisiert.'],
        [1, 'Anonymisierung ist gut, aber die Weitergabe an Dritte muss vertraglich geregelt sein.'],
        [0, 'Selbstverständlich. Ethik ist Teil unserer Verantwortung.'],
      ] },
    ],
    memos: [
      { title: 'Eine akademische Arbeit strukturieren', content: 'Notes on structuring a dissertation with a formal register.', german: 'Die Dissertation gliedert sich in Einleitung, Forschungsstand, Methodik, Ergebnisse und Diskussion. Die Einleitung formuliert die Forschungsfrage und die Relevanz. Der Forschungsstand zeigt die Lücke, die meine Arbeit schließt. In der Diskussion reflektiere ich die Grenzen der Studie und den Ausblick. Jedes Kapitel schließt mit einer Zwischenbilanz.', english: 'The dissertation is structured into introduction, state of research, methodology, results and discussion. The introduction formulates the research question and the relevance. The state of research shows the gap that my work closes. In the discussion I reflect on the limits of the study and the outlook. Each chapter closes with an interim conclusion.' },
      { title: 'Literatur als Spiegel der Gesellschaft', content: 'A reflection on the interpretation of literature and its social function.', german: 'Literatur ist mehr als Unterhaltung: Sie ist ein Spiegel der Gesellschaft und ein Raum der Freiheit. Die Interpretation eines Textes verlangt Sensibilität für Sprache und Kontext. Wer zwischen den Zeilen liest, entdeckt Widersprüche, die die Diskussion bereichern. Literatur lehrt uns, die Welt mit den Augen anderer zu sehen.', english: 'Literature is more than entertainment: it is a mirror of society and a space of freedom. The interpretation of a text requires sensitivity to language and context. Whoever reads between the lines discovers contradictions that enrich the discussion. Literature teaches us to see the world with the eyes of others.' },
    ],
    expressions: [
      { p: 'In diesem Zusammenhang sei darauf hingewiesen, dass …', t: 'In this context it should be noted that …', cat: 'Academic' },
      { p: 'Die Frage erfordert eine differenzierte Betrachtung.', t: 'The question requires a differentiated consideration.', cat: 'Academic' },
      { p: 'Es bleibt festzuhalten, dass …', t: 'It remains to be noted that …', cat: 'Academic' },
      { p: 'Aus literaturwissenschaftlicher Sicht …', t: 'From a literary studies point of view …', cat: 'Academic' },
      { p: 'Die These lässt sich nicht ohne Weiteres halten.', t: 'The thesis cannot be maintained without further ado.', cat: 'Academic' },
      { p: 'Das wirft ein neues Licht auf die Frage.', t: 'That throws new light on the question.', cat: 'Academic' },
    ],
    idioms: [
      { p: 'Die Qual der Wahl haben', t: 'to have a hard choice to make', meaning: 'To be spoiled for choice.', usage: 'Bei so vielen guten Universitäten habe ich die Qual der Wahl.' },
      { p: 'Etwas mit Haut und Haaren', t: 'completely / wholly', meaning: 'With body and soul, completely.', usage: 'Sie ist mit Haut und Haaren der Wissenschaft verbunden.' },
    ],
    mistakes: [
      { inc: 'Der Mensch ist, was er isst.', cor: 'Der Mensch ist, was er isst.', why: 'This famous quote is correct as written; many misplace the comma when quoting it in academic texts.' },
      { inc: 'Die Methode ist nicht zu vermeiden anwenden.', cor: 'Die Methode ist nicht ohne Weiteres anzuwenden.', why: 'With "sein + zu + Infinitiv" the "zu" attaches to the infinitive: anzuwenden.' },
    ],
    books: [
      { name: 'Mit Erfolg zum Goethe-Zertifikat C2', author: 'Klett Verlag', notes: 'Complete C2 exam preparation.' },
      { name: 'Erkundungen C2', author: 'Schubert Verlag', notes: 'Advanced academic and literary texts.' },
    ],
    resources: [
      { url: 'https://www.youtube.com/@EasyGerman', kind: 'video', title: 'Easy German – Academic German vocabulary', author: 'Easy Languages', handle: '@EasyGerman' },
      { url: 'https://www.youtube.com/@GermanWithLaura', kind: 'video', title: 'German at C2 level', author: 'Laura', handle: '@GermanWithLaura' },
      { url: 'https://www.youtube.com/@LearnGermanWithAnja', kind: 'video', title: 'Academic German writing', author: 'Anja', handle: '@LearnGermanWithAnja' },
    ],
    notes: [
      { cat: 'daily', daysAgo: 54, content: 'Passivumschreibungen geübt: Das Problem lässt sich lösen, die Lösung ist nicht zu vermeiden.', ch: 3 },
      { cat: 'writing', daysAgo: 56, content: 'Die Einleitung meiner akademischen Arbeit formuliert: Forschungsfrage, Relevanz, Gliederung.', ch: 0 },
      { cat: 'reading', daysAgo: 58, content: 'Ein Gedicht von Goethe interpretiert und die Bildsprache analysiert.', ch: 1 },
    ],
  },

  'C2.2': {
    chapters: [
      'Lektion 49 · Rhetorik & Stil',
      'Lektion 50 · Publizistik & Medienkritik',
      'Lektion 51 · Rechtssprache & Verträge',
      'Lektion 52 · Expertenwissen & Wissenschaft',
    ],
    vocab: [
      { w: 'die Rhetorik', t: 'the rhetoric', ex: 'Rhetorik ist die Königsdisziplin der Sprache.', cat: 'Rhetoric', ch: 0 },
      { w: 'der Stil', t: 'the style', ex: 'Der Stil des Autors ist prägnant.', cat: 'Rhetoric', ch: 0 },
      { w: 'die Publizistik', t: 'the media studies / journalism', ex: 'Die Publizistik untersucht die Medienöffentlichkeit.', cat: 'Media', ch: 1 },
      { w: 'die Medienkritik', t: 'the media criticism', ex: 'Medienkritik schärft den Blick.', cat: 'Media', ch: 1 },
      { w: 'die Rechtssprache', t: 'the legal language', ex: 'Die Rechtssprache ist präzise, aber schwer verständlich.', cat: 'Law', ch: 2 },
      { w: 'der Vertrag', t: 'the contract', ex: 'Der Vertrag regelt alle Einzelheiten.', cat: 'Law', ch: 2 },
      { w: 'die Expertise', t: 'the expertise', ex: 'Die Expertise der Gutachterin war gefragt.', cat: 'Science', ch: 3 },
      { w: 'der Sachverstand', t: 'the expert knowledge', ex: 'Der Sachverstand ist hier unverzichtbar.', cat: 'Science', ch: 3 },
      { w: 'die Argumentation', t: 'the argumentation', ex: 'Die Argumentation überzeugt durch Klarheit.', cat: 'Rhetoric', ch: 0 },
      { w: 'die Differenzierung', t: 'the differentiation', ex: 'Die Differenzierung der Begriffe ist entscheidend.', cat: 'Academic', ch: 3 },
      { w: 'eloquent', t: 'eloquent', ex: 'Sie ist eine eloquente Rednerin.', cat: 'Adjectives', ch: 0 },
      { w: 'differenziert', t: 'differentiated', ex: 'Eine differenzierte Betrachtung ist nötig.', cat: 'Adjectives', ch: 3 },
      { w: 'verbindlich', t: 'binding', ex: 'Die Zusage ist verbindlich.', cat: 'Adjectives', ch: 2 },
      { w: 'objektiv', t: 'objective', ex: 'Eine objektive Berichterstattung ist das Ziel.', cat: 'Adjectives', ch: 1 },
    ],
    grammar: [
      { rule: 'Stilfiguren', expl: 'Rhetorical figures: Anapher, Metapher, Litotes, Hyperbel.', exs: ['Litotes: Das ist keine schlechte Idee.'], cat: 'Rhetoric' },
      { rule: 'Textkohäsion', expl: 'Cohesion devices: Verweise, Konnektoren, Wiederaufnahmen.', exs: ['Diese These, die im ersten Kapitel entwickelt wird, bleibt prägend.'], cat: 'Syntax' },
      { rule: 'Modalpartikeln', expl: 'Particles like ja, doch, denn, wohl, eigentlich express speaker attitude.', exs: ['Das ist ja eine Überraschung!', 'Was meinst du denn?'], cat: 'Grammar Basics' },
      { rule: 'Erörterung auf höchstem Niveau', expl: 'Full academic essay: Einleitung, Hauptteil mit Pro und Kontra, Synthese.', exs: ['Pro und Kontra werden abgewogen, bevor die Synthese formuliert wird.'], cat: 'Essay' },
      { rule: 'Passiv in der Wissenschaftssprache', expl: 'Impersonal passive structures dominate academic German.', exs: ['Es wurde gezeigt, dass die Hypothese haltbar ist.'], cat: 'Passive' },
    ],
    verbs: [
      { i: 'argumentieren', meaning: 'to argue', ich: 'argumentiere', du: 'argumentierst', er: 'argumentiert', wir: 'argumentieren', ihr: 'argumentiert', sie: 'argumentieren', cat: 'Regular' },
      { i: 'differenzieren', meaning: 'to differentiate', ich: 'differenziere', du: 'differenzierst', er: 'differenziert', wir: 'differenzieren', ihr: 'differenziert', sie: 'differenzieren', cat: 'Regular' },
      { i: 'subsumieren', meaning: 'to subsume', ich: 'subsumiere', du: 'subsumierst', er: 'subsumiert', wir: 'subsumieren', ihr: 'subsumiert', sie: 'subsumieren', cat: 'Regular' },
      { i: 'extrapolieren', meaning: 'to extrapolate', ich: 'extrapoliere', du: 'extrapolierst', er: 'extrapoliert', wir: 'extrapolieren', ihr: 'extrapoliert', sie: 'extrapolieren', cat: 'Regular' },
      { i: 'kontextualisieren', meaning: 'to contextualise', ich: 'kontextualisiere', du: 'kontextualisierst', er: 'kontextualisiert', wir: 'kontextualisieren', ihr: 'kontextualisiert', sie: 'kontextualisieren', cat: 'Regular' },
    ],
    dialogues: [
      { title: 'Ein journalistisches Interview', parts: [{ name: 'Redakteur', gender: 'male' }, { name: 'Wissenschaftlerin', gender: 'female' }], lines: [
        [0, 'Frau Professorin, wie erklären Sie den rasanten Fortschritt der KI?'],
        [1, 'Der Fortschritt ergibt sich aus besseren Daten und leistungsfähigeren Modellen.'],
        [0, 'Sehen Sie Gefahren für die Gesellschaft?'],
        [1, 'Die Gefahren liegen weniger in der Technik selbst als in ihrer Regulierung.'],
        [0, 'Was empfehlen Sie politisch Verantwortlichen?'],
        [1, 'Eine vorausschauende Gesetzgebung, die Innovation und Grundrechte verbindet.'],
      ] },
      { title: 'Einen Vertrag fachgerecht prüfen', parts: [{ name: 'Juristin', gender: 'female' }, { name: 'Klient', gender: 'male' }], lines: [
        [1, 'Ich habe den Vertrag geprüft. Der Absatz über die Haftung ist problematisch.'],
        [0, 'Inwiefern?'],
        [1, 'Die Haftung wird fast vollständig ausgeschlossen. Das ist rechtlich angreifbar.'],
        [0, 'Soll ich neu verhandeln?'],
        [1, 'Ja, ich empfehle, eine angemessene Haftungsregelung einzufordern.'],
      ] },
    ],
    memos: [
      { title: 'Stil und Präzision', content: 'Reflect on the craft of writing with precision and style.', german: 'Präzision beginnt bei der Wortwahl. Jedes Wort trägt Bedeutung, jede Formulierung eine Absicht. Ein guter Text verzichtet auf Füllwörter und setzt bewusst Zeichensetzung ein. Stil ist keine Dekoration, sondern Ausdruck von Klarheit. Wer präzise denkt, schreibt präzise.', english: 'Precision begins with word choice. Every word carries meaning, every formulation an intention. A good text avoids filler words and uses punctuation deliberately. Style is not decoration but an expression of clarity. Whoever thinks precisely writes precisely.' },
      { title: 'Die Rolle der Medien', content: 'Media criticism and the responsibility of journalism in a democracy.', german: 'Medien schaffen Öffentlichkeit und bilden Meinungen. Deshalb ist Medienkritik ein Teil demokratischer Verantwortung. Eine seriöse Berichterstattung trennt Fakten von Meinungen und benennt ihre Quellen. In Zeiten der Desinformation gewinnt der sorgfältige Journalismus an Bedeutung. Vertrauen entsteht durch Transparenz und Selbstkritik.', english: 'Media create publicity and shape opinions. Therefore media criticism is part of democratic responsibility. Serious reporting separates facts from opinions and names its sources. In times of disinformation, careful journalism gains importance. Trust arises through transparency and self-criticism.' },
    ],
    expressions: [
      { p: 'Es wäre zu differenzieren zwischen …', t: 'One would have to differentiate between …', cat: 'Academic' },
      { p: 'Diese These lässt sich nur bedingt aufrechterhalten.', t: 'This thesis can only be maintained to a limited extent.', cat: 'Academic' },
      { p: 'Die Beweislage ist eindeutig.', t: 'The evidence is clear.', cat: 'Legal' },
      { p: 'Wir sehen uns zu einer Klarstellung veranlasst.', t: 'We feel compelled to clarify.', cat: 'Formal' },
      { p: 'Dieser Argumentation ist beizupflichten.', t: 'This line of argument is to be agreed with.', cat: 'Academic' },
      { p: 'Die Sachlage erfordert eine umfassende Prüfung.', t: 'The situation requires a comprehensive review.', cat: 'Formal' },
    ],
    idioms: [
      { p: 'Die Rechnung ohne den Wirt machen', t: 'to forget someone involved', meaning: 'To plan without considering an important person.', usage: 'Sie haben die Rechnung ohne den Wirt gemacht – der Chef hat das letzte Wort.' },
      { p: 'Den Sprung wagen', t: 'to take the plunge', meaning: 'To dare a bold step.', usage: 'Mit der Promotion hat sie den Sprung in die Wissenschaft gewagt.' },
    ],
    mistakes: [
      { inc: 'Die Medien beeinflusst die Meinung.', cor: 'Die Medien beeinflussen die Meinung.', why: 'Medien is plural, so the verb takes the plural ending: beeinflussen.' },
      { inc: 'Sie ist eine eloquente Rednerin, welche das Publikum fesselt.', cor: 'Sie ist eine eloquente Rednerin, die das Publikum fesselt.', why: '"welche" as a relative pronoun is outdated in standard German; use "die".' },
    ],
    books: [
      { name: 'Großes Übungsbuch Deutsch C2', author: 'Hueber Verlag', notes: 'The most demanding grammar and style exercises.' },
      { name: 'Deutsch fürs Jurastudium', author: 'UTB', notes: 'Legal German for advanced learners.' },
    ],
    resources: [
      { url: 'https://www.youtube.com/@GermanWithLaura', kind: 'video', title: 'German rhetorical devices', author: 'Laura', handle: '@GermanWithLaura' },
      { url: 'https://www.youtube.com/@LearnGermanWithAnja', kind: 'video', title: 'C2 level German in daily life', author: 'Anja', handle: '@LearnGermanWithAnja' },
      { url: 'https://www.youtube.com/@EasyGerman', kind: 'video', title: 'Easy German – media critique', author: 'Easy Languages', handle: '@EasyGerman' },
    ],
    notes: [
      { cat: 'daily', daysAgo: 59, content: 'Modalpartikeln geübt: ja, doch, denn, wohl, eigentlich – sie machen Deutsch natürlich.', ch: 0 },
      { cat: 'reading', daysAgo: 61, content: 'Eine Medienkolumne kritisch gelesen und die Argumentationsstrategie analysiert.', ch: 1 },
      { cat: 'writing', daysAgo: 63, content: 'Einen Kommentar über Vertrauen in Medien verfasst, mit Litotes und Anapher.', ch: 0 },
    ],
  },
};

const ALPHABET = [
  ['A', 'Apfel', 'Apple', 'ah-pfull'], ['B', 'Brot', 'Bread', 'broht'], ['C', 'Computer', 'Computer', 'kohm-pyoo-tah'], ['D', 'Danke', 'Thank you', 'dahn-keh'], ['E', 'Essen', 'Food / eating', 'eh-sen'],
  ['F', 'Familie', 'Family', 'fah-mee-lee-eh'], ['G', 'Guten Tag', 'Good day', 'goo-ten tahk'], ['H', 'Hallo', 'Hello', 'hah-loh'], ['I', 'Information', 'Information', 'in-for-mah-tsee-ohn'], ['J', 'Jahr', 'Year', 'yahr'],
  ['K', 'Kaffee', 'Coffee', 'kah-fay'], ['L', 'Liebe', 'Love', 'lee-beh'], ['M', 'Mutter', 'Mother', 'moot-tah'], ['N', 'Nacht', 'Night', 'nahn-cht'], ['O', 'Obst', 'Fruit', 'ohpst'],
  ['P', 'Papier', 'Paper', 'pah-peer'], ['Q', 'Quelle', 'Source', 'kvehl-leh'], ['R', 'Regen', 'Rain', 'ray-gen'], ['S', 'Schule', 'School', 'shoo-leh'], ['T', 'Tag', 'Day', 'tahk'],
  ['U', 'Uhr', 'Clock', 'oor'], ['V', 'Vater', 'Father', 'fah-tah'], ['W', 'Wasser', 'Water', 'vahs-sah'], ['X', 'Xylophon', 'Xylophone', 'xü-loh-fohn'], ['Y', 'Yoga', 'Yoga', 'yoh-gah'], ['Z', 'Zeit', 'Time', 'tsayt'],
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoDaysAgo(days) {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().slice(0, 10);
}

async function clearGerman(userId) {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));
  const items = res.Items || [];
  for (const it of items) {
    await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { userId, recordId: it.recordId } }));
  }
  return items.length;
}

async function seed(userId) {
  let total = 0;
  for (const level of Object.keys(SEED)) {
    const lv = SEED[level];

    // Chapters first so items can be tagged to them.
    const chapterTitles = [];
    const chapterIdByTitle = {};
    for (let i = 0; i < lv.chapters.length; i++) {
      const ch = await german.addChapter(userId, { title: lv.chapters[i], level, sortOrder: i });
      chapterTitles.push(ch.title);
      chapterIdByTitle[ch.title] = ch.recordId;
      total++;
    }
    const tagFn = (chIdx) => {
      if (chIdx == null || !chapterTitles[chIdx]) return {};
      const title = chapterTitles[chIdx];
      return { chapterId: chapterIdByTitle[title], chapterTitle: title };
    };

    for (const v of lv.vocab) {
      await german.addVocab(userId, { word: v.w, translation: v.t, example: v.ex, notes: '', category: v.cat, level, ...tagFn(v.ch) });
      total++;
    }
    const chCount = chapterTitles.length;
    for (const [i, g] of lv.grammar.entries()) {
      await german.addGrammar(userId, { rule: g.rule, explanation: g.expl, examples: g.exs || [], category: g.cat, level, ...tagFn(i % chCount) });
      total++;
    }
    for (const [i, vb] of lv.verbs.entries()) {
      await german.addVerb(userId, { infinitive: vb.i, meaning: vb.meaning, ich: vb.ich, du: vb.du, erSieEs: vb.er, wir: vb.wir, ihr: vb.ihr, Sie: vb.sie, category: vb.cat, level, ...tagFn(i % chCount) });
      total++;
    }
    for (const [i, d] of lv.dialogues.entries()) {
      const exchanges = d.lines.map(([speakerIndex, text]) => ({ speakerIndex, text }));
      await german.addDialogue(userId, { title: d.title, level, participants: d.parts, exchanges, ...tagFn(i % chCount) });
      total++;
    }
    for (const [i, m] of lv.memos.entries()) {
      await german.addMemo(userId, { title: m.title, content: m.content, germanContent: m.german, englishContent: m.english, level, ...tagFn(i % chCount) });
      total++;
    }
    for (const [i, e] of lv.expressions.entries()) {
      await german.addExpression(userId, { phrase: e.p, translation: e.t, category: e.cat, level, ...tagFn(i % chCount) });
      total++;
    }
    for (const [i, id] of lv.idioms.entries()) {
      await german.addIdiom(userId, { phrase: id.p, translation: id.t, meaning: id.meaning, usage: id.usage, level, ...tagFn(i % chCount) });
      total++;
    }
    for (const [i, mk] of lv.mistakes.entries()) {
      await german.addMistake(userId, { incorrect: mk.inc, correct: mk.cor, why: mk.why, level, ...tagFn(i % chCount) });
      total++;
    }
    for (const b of lv.books) {
      await german.addBook(userId, { name: b.name, author: b.author, notes: b.notes, level });
      total++;
    }
    for (const r of lv.resources) {
      await german.addResource(userId, { url: r.url, kind: r.kind, handle: r.handle, title: r.title, author: r.author, level });
      total++;
    }
    for (const n of lv.notes) {
      await german.saveNote(userId, isoDaysAgo(n.daysAgo), { content: n.content, noteCategory: n.cat, level, ...tagFn(n.ch) });
      total++;
    }
    console.log(`✔ ${level}: chapters=${lv.chapters.length} vocab=${lv.vocab.length} grammar=${lv.grammar.length} verbs=${lv.verbs.length} dialogues=${lv.dialogues.length} memos=${lv.memos.length} expressions=${lv.expressions.length} idioms=${lv.idioms.length} mistakes=${lv.mistakes.length} books=${lv.books.length} resources=${lv.resources.length} notes=${lv.notes.length}`);
  }

  // A1.1 alphabet (only level that has it).
  for (let i = 0; i < ALPHABET.length; i++) {
    const [letter, example, english, pronunciation] = ALPHABET[i];
    await german.addAlphabet(userId, { letter, example, english, pronunciation, sortOrder: i, level: 'A1.1' });
    total++;
  }
  console.log(`✔ Alphabet (A1.1): 26 letters`);
  return total;
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: node scripts/seed-german.js <email>');
    process.exit(1);
  }
  let user = await getUserByEmail(email);
  if (!user) {
    const passwordHash = await bcrypt.hash('123456789', 10);
    user = await createUser({ email, passwordHash, firstName: 'Seed', lastName: 'User' });
    console.log(`Created user ${email}`);
  }
  const userId = user.userId;
  console.log(`Target: ${email} (${userId})`);
  const removed = await clearGerman(userId);
  console.log(`Cleared ${removed} existing German records`);
  const total = await seed(userId);
  console.log(`DONE — seeded ${total} German records for ${email}`);
  process.exit(0);
})().catch(err => {
  console.error('FATAL', err);
  process.exit(1);
});
