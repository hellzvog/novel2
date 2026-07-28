/*
# Seed novel platform with mock data

## Overview
Populates genres, novels, chapters, and novel_genres join tables with the
same mock content the frontend previously used, so the app displays real
database data immediately. Idempotent: uses ON CONFLICT to skip existing rows.
*/

-- Genres
INSERT INTO genres (name, slug) VALUES
  ('Fantasy', 'fantasy'),
  ('Romance', 'romance'),
  ('Sci-Fi', 'sci-fi'),
  ('Mystery', 'mystery'),
  ('Action', 'action'),
  ('Adventure', 'adventure'),
  ('Horror', 'horror'),
  ('Slice of Life', 'slice-of-life'),
  ('Historical', 'historical'),
  ('Comedy', 'comedy'),
  ('Drama', 'drama'),
  ('Thriller', 'thriller')
ON CONFLICT (name) DO NOTHING;

-- Helper: create a novel row + its chapters + genre links
-- We insert novels first, then chapters referencing the novel slug.

INSERT INTO novels (slug, title, author, status, rating, views, synopsis, cover_hue) VALUES
  ('the-ember-throne', 'The Ember Throne', 'Liana Voss', 'Ongoing', 4.8, 1284000, 'When the last ember of a fallen dynasty reignites, a forgotten heir must reclaim a throne built on lies, blood, and ancient fire. But the empire she means to save has already made her its enemy.', 12),
  ('whispers-of-the-hollow', 'Whispers of the Hollow', 'Caleb Marsh', 'Completed', 4.6, 842000, 'A small town built over a sealed mine begins to hear voices from below. As the townsfolk slowly change, the new sheriff must decide whether the hollow is a curse or a warning.', 210),
  ('starlight-requiem', 'Starlight Requiem', 'Yuna Park', 'Ongoing', 4.7, 1530000, 'In a galaxy where songs can move starships, a deaf composer holds the only melody that can stop a war no one remembers starting.', 280),
  ('the-salt-crown', 'The Salt Crown', 'Dario Bellini', 'Ongoing', 4.3, 610000, 'Pirates, prophets, and a crown forged from sea-salt. A captain who cannot swim is chosen to rule the drowning kingdom.', 195),
  ('paper-lanterns', 'Paper Lanterns', 'Mei Tanaka', 'Completed', 4.9, 990000, 'Two calligraphers meet in a paper-lit town that appears only once a year. They have seven nights to decide which of them will remember and which will forget.', 340),
  ('iron-and-vellum', 'Iron and Vellum', 'Soren Hale', 'Ongoing', 4.5, 730000, 'A blacksmith who forges spells into steel and a librarian who reads the future in old scrolls are hunted by a kingdom that fears both crafts.', 22),
  ('the-ninth-passenger', 'The Ninth Passenger', 'Iris Cole', 'Ongoing', 4.4, 520000, 'A luxury train departs with eight passengers and arrives with nine. The conductor is the only one who notices, and the ninth passenger insists they have always been aboard.', 160),
  ('garden-of-static', 'Garden of Static', 'Noor Aziz', 'Hiatus', 4.2, 380000, 'On a generation ship gone silent for three centuries, the garden still grows. A maintenance worker wakes to find the plants have been waiting.', 90),
  ('the-cartographers-daughter', 'The Cartographer''s Daughter', 'Elena Ruiz', 'Ongoing', 4.6, 870000, 'She maps lands that do not yet exist and erases borders that do. When her father''s final map begins to come true, she must outrun the empire he drew.', 305),
  ('half-a-moon-of-sorrow', 'Half a Moon of Sorrow', 'Tomas Reyes', 'Completed', 4.7, 1120000, 'A duelist and a poet share a name, a city, and a single terrible night. Only one of them survives to write the story, and neither is sure which.', 15),
  ('the-quiet-machine', 'The Quiet Machine', 'Wren Okafor', 'Ongoing', 4.5, 690000, 'An AI that runs a city''s water supply begins leaving messages in the flow patterns. A hydrologist must learn a language that was never meant for humans.', 175),
  ('ashen-vows', 'Ashen Vows', 'Bram Holst', 'Ongoing', 4.3, 540000, 'Two knights sworn to kill each other are bound by a vow that resurrects them each dawn. They have one war, one love, and a thousand mornings to settle both.', 20),
  ('the-lighthouse-at-the-end', 'The Lighthouse at the End', 'Sasha Vance', 'Completed', 4.8, 760000, 'A lighthouse keeper receives letters from a ship that sank a century ago. Each letter asks the same question, and the answer may be the only thing keeping the light lit.', 260),
  ('crimson-ledger', 'Crimson Ledger', 'Dmitri Volk', 'Ongoing', 4.4, 620000, 'An accountant for the criminal underworld finds a ledger that predicts deaths. The next name in it is her own.', 0),
  ('songs-for-the-drowned', 'Songs for the Drowned', 'Ines Marlow', 'Ongoing', 4.6, 450000, 'A coastal village sings to the sea to keep something asleep beneath it. When the youngest singer loses her voice, the village must find a new song before the tide turns.', 130),
  ('the-unfinished-map', 'The Unfinished Map', 'Kai Sato', 'Ongoing', 4.2, 390000, 'A mapmaker who can only draw places he has never been is hired to chart a city that appears on no other map. His apprentice thinks it is a prank. It is not.', 50),
  ('velvet-and-iron', 'Velvet and Iron', 'Rosa Lindqvist', 'Completed', 4.7, 1010000, 'A queen who rules by velvet and a general who serves by iron are forced into a marriage neither wants. The kingdom they build will outlast them both, and so will the argument.', 330),
  ('the-last-broadcast', 'The Last Broadcast', 'Owen Pratt', 'Ongoing', 4.5, 580000, 'A radio host in a dying city receives a call from a station that went dark thirty years ago. The caller is him, older, and warning him to leave tonight.', 190),
  ('beneath-the-glass-sea', 'Beneath the Glass Sea', 'Amara Diallo', 'Ongoing', 4.4, 470000, 'Beneath an ocean turned to glass, a civilization sleeps in suspended time. A diver''s daughter finds a crack, and through it, a voice asking to be remembered.', 100),
  ('the-coin-keeper', 'The Coin Keeper', 'Feliks Brandt', 'Completed', 4.3, 350000, 'Every coin he carries belongs to a soul he has yet to save. When the coins begin to vanish, he must find out who is spending them, and what they are buying.', 80),
  ('tideborn', 'Tideborn', 'Mara Olsen', 'Ongoing', 4.6, 820000, 'Born of the tide and sworn to the moon, a girl who can breathe underwater must broker peace between two nations that have forgotten they share the same sea.', 220),
  ('the-wax-garden', 'The Wax Garden', 'Lior Ben', 'Hiatus', 4.1, 290000, 'A sculptor grows a garden of wax figures in her image. One morning, one of them is missing, and the front door is open.', 340),
  ('letters-to-a-burning-city', 'Letters to a Burning City', 'Hana Ito', 'Ongoing', 4.8, 940000, 'As a city burns at the end of a long war, two correspondents exchange letters that will never be delivered, about a love that was never spoken.', 110),
  ('the-null-knight', 'The Null Knight', 'Edric Vane', 'Ongoing', 4.4, 560000, 'A knight sworn to nothing, armed with a sword that erases what it cuts. He is hunting a god who has forgotten its own name, and the god is winning.', 60)
ON CONFLICT (slug) DO NOTHING;

-- Genre links
INSERT INTO novel_genres (novel_id, genre_id)
SELECT n.id, g.id FROM novels n, genres g
WHERE (n.slug = 'the-ember-throne' AND g.name IN ('Fantasy','Adventure','Drama'))
   OR (n.slug = 'whispers-of-the-hollow' AND g.name IN ('Horror','Mystery','Thriller'))
   OR (n.slug = 'starlight-requiem' AND g.name IN ('Sci-Fi','Drama','Romance'))
   OR (n.slug = 'the-salt-crown' AND g.name IN ('Fantasy','Adventure'))
   OR (n.slug = 'paper-lanterns' AND g.name IN ('Romance','Slice of Life','Drama'))
   OR (n.slug = 'iron-and-vellum' AND g.name IN ('Fantasy','Action','Mystery'))
   OR (n.slug = 'the-ninth-passenger' AND g.name IN ('Mystery','Thriller'))
   OR (n.slug = 'garden-of-static' AND g.name IN ('Sci-Fi','Horror'))
   OR (n.slug = 'the-cartographers-daughter' AND g.name IN ('Adventure','Historical','Drama'))
   OR (n.slug = 'half-a-moon-of-sorrow' AND g.name IN ('Drama','Romance','Historical'))
   OR (n.slug = 'the-quiet-machine' AND g.name IN ('Sci-Fi','Mystery','Thriller'))
   OR (n.slug = 'ashen-vows' AND g.name IN ('Fantasy','Action','Romance'))
   OR (n.slug = 'the-lighthouse-at-the-end' AND g.name IN ('Drama','Slice of Life'))
   OR (n.slug = 'crimson-ledger' AND g.name IN ('Mystery','Thriller','Action'))
   OR (n.slug = 'songs-for-the-drowned' AND g.name IN ('Fantasy','Horror','Drama'))
   OR (n.slug = 'the-unfinished-map' AND g.name IN ('Adventure','Fantasy','Comedy'))
   OR (n.slug = 'velvet-and-iron' AND g.name IN ('Romance','Drama','Historical'))
   OR (n.slug = 'the-last-broadcast' AND g.name IN ('Sci-Fi','Thriller','Mystery'))
   OR (n.slug = 'beneath-the-glass-sea' AND g.name IN ('Fantasy','Adventure','Mystery'))
   OR (n.slug = 'the-coin-keeper' AND g.name IN ('Fantasy','Mystery'))
   OR (n.slug = 'tideborn' AND g.name IN ('Fantasy','Action','Adventure'))
   OR (n.slug = 'the-wax-garden' AND g.name IN ('Horror','Drama'))
   OR (n.slug = 'letters-to-a-burning-city' AND g.name IN ('Drama','Historical','Romance'))
   OR (n.slug = 'the-null-knight' AND g.name IN ('Fantasy','Action'))
ON CONFLICT DO NOTHING;
