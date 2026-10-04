-- +goose Up
-- Uploaded profile pictures: the bytes live in file storage under avatar_key; avatar_url is the address
-- clients use (it carries a version so a new picture is not served from a cache).
ALTER TABLE users
    ADD COLUMN avatar_key  text,
    ADD COLUMN avatar_type text,
    ADD CONSTRAINT users_avatar_pair CHECK ((avatar_key IS NULL) = (avatar_type IS NULL));

-- +goose Down
ALTER TABLE users DROP CONSTRAINT users_avatar_pair, DROP COLUMN avatar_type, DROP COLUMN avatar_key;
