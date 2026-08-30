-- Dev/party seed: one live game with the 10 clues from the design and no teams.
-- Apply:  npx wrangler d1 execute zoo-hunt --local --file=seed/dev.sql
--         npx wrangler d1 execute zoo-hunt --remote --file=seed/dev.sql

INSERT INTO games (id, code, name, status, default_points, approval_mode, created_at)
VALUES ('game-zaid-29', 'ZOO-2929', 'Zaid Turns 29 — Bronx Zoo Scavenger Hunt', 'live', 150, 'manual', (strftime('%s','now') * 1000));

INSERT INTO clues (id, game_id, sort_order, title, body, animal, points, status, map_x, map_y) VALUES
('clue-01', 'game-zaid-29', 1,  'Splash Happy',      'Despite my rotund appearance, I''m amongst the most lethal aquatic dwellers!',                          'hippo',     150, 'available', 0.22, 0.18),
('clue-02', 'game-zaid-29', 2,  'Striped & Proud',   'Black and white and loved all over — no two of us wear the same coat.',                                'zebra',     150, 'available', 0.72, 0.16),
('clue-03', 'game-zaid-29', 3,  'Lunch in the Trees','My imposing stature makes it tough to seek shelter in rain. The leaves keep me sated, though!',       'giraffe',   150, 'available', 0.58, 0.36),
('clue-04', 'game-zaid-29', 4,  'Big Ears',          'I hear the world with my ears. Humans are very precious to me.',                                       'elephant',  150, 'locked',    0.30, 0.42),
('clue-05', 'game-zaid-29', 5,  'Cool Swimmer',      'Slicked up, I playfully glide through the water with a force!',                                        'sea lion',  150, 'locked',    0.80, 0.52),
('clue-06', 'game-zaid-29', 6,  'Small but Bold',    'I''m tiny but tough. I dig and I climb. Find me on the ground or up on a vine!',                        'meerkat',   150, 'locked',    0.18, 0.62),
('clue-07', 'game-zaid-29', 7,  'Black & White',     'I wear a tuxedo every day, waddle more than I walk, and I''d rather swim than fly.',                    'penguin',   150, 'locked',    0.50, 0.66),
('clue-08', 'game-zaid-29', 8,  'Royal Roar',        'My mane is my crown and my nap is my kingdom. Listen for me before you see me.',                        'lion',      150, 'locked',    0.68, 0.78),
('clue-09', 'game-zaid-29', 9,  'Bamboo Buddy',      'Not a bear, not a raccoon — a rusty-red climber who snacks on bamboo all afternoon.',                  'red panda', 150, 'locked',    0.26, 0.84),
('clue-10', 'game-zaid-29', 10, 'Monkey Business',   'Curious by nature, I swing, I chatter, I steal your snacks. Find my cousins and say hi for George.',  'monkey',    200, 'locked',    0.52, 0.90);

INSERT INTO bonus_challenges (id, game_id, title, description, points, status, created_at)
VALUES ('bonus-01', 'game-zaid-29', 'Take a team photo with the zoo''s largest animal!', 'Find the biggest animal in the zoo and get your whole team in the photo!', 250, 'inactive', (strftime('%s','now') * 1000));
