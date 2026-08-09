UPDATE league_teams
SET manager_id = NULL
WHERE manager_id IN (SELECT id FROM managers WHERE display_name = '--hidden--')


DELETE FROM managers WHERE display_name = '--hidden--'


SELECT count(*) FROM managers

SELECT count(*) FROM managers WHERE display_name = '--hidden--'
