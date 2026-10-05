-- +goose Up
-- Published for the cards module, which filters and sorts by custom field values without reaching into another module's table.
CREATE VIEW card_field_directory AS
    SELECT card_id, field_id, workspace_id, value FROM card_field_values;

-- +goose Down
DROP VIEW card_field_directory;
