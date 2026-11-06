-- =====================================================================
--  Research Resource Manager — schema PostgreSQL (v1.0)
--  Echipa 2
--
--  Acoperă cerințele funcționale din PRD:
--    - adăugare / vizualizare / editare resurse
--    - organizare pe categorii (ierarhice) și tipuri de resurse
--    - căutare după nume, descriere, etichete, categorie, tip, status
--    - linkuri și fișiere atașate (Q-07)
--    - utilizatori cu roluri pentru controlul modificărilor (Q-03, Q-04)
--  Rezervarea/programarea NU e inclusă (în afara domeniului v1).
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- căutare fuzzy / ILIKE rapid pe nume
CREATE EXTENSION IF NOT EXISTS citext;    -- e-mail case-insensitive

-- ---------------------------------------------------------------------
--  Tipuri enumerate
-- ---------------------------------------------------------------------
CREATE TYPE resource_status AS ENUM (
    'disponibil',
    'in_utilizare',
    'mentenanta',
    'retras'
);

CREATE TYPE attachment_kind AS ENUM ('link', 'fisier');

-- ---------------------------------------------------------------------
--  Funcție comună pentru actualizarea automată a coloanei updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
--  Roluri și utilizatori
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    id          SMALLSERIAL PRIMARY KEY,
    code        VARCHAR(30)  NOT NULL UNIQUE,      -- 'admin', 'editor', 'cititor'
    name        VARCHAR(60)  NOT NULL,
    description TEXT
);

CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         CITEXT       NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    full_name     VARCHAR(120) NOT NULL,
    role_id       SMALLINT     NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
--  Nomenclatoare: tipuri de resurse și categorii (Q-01)
-- ---------------------------------------------------------------------
CREATE TABLE resource_types (
    id          SMALLSERIAL PRIMARY KEY,
    name        VARCHAR(80) NOT NULL UNIQUE,       -- Echipament, Articol, Set de date, Software...
    description TEXT
);

CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    parent_id   INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_categories_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

-- numele trebuie să fie unic în cadrul aceluiași părinte (inclusiv la rădăcină)
CREATE UNIQUE INDEX uq_categories_parent_name
    ON categories (COALESCE(parent_id, 0), lower(name));

-- ---------------------------------------------------------------------
--  Resurse (entitatea centrală)
-- ---------------------------------------------------------------------
CREATE TABLE resources (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(200)    NOT NULL,
    description   TEXT,
    type_id       SMALLINT        NOT NULL REFERENCES resource_types(id) ON DELETE RESTRICT,
    category_id   INTEGER         REFERENCES categories(id) ON DELETE SET NULL,
    status        resource_status NOT NULL DEFAULT 'disponibil',
    location      VARCHAR(200),               -- laborator, sală, server, URL de bază etc.
    identifier    VARCHAR(100),               -- nr. inventar, DOI, ISBN, serie...
    acquired_on   DATE,
    owner_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,   -- responsabil
    created_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
    search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('romanian'::regconfig, coalesce(name, '')),        'A') ||
        setweight(to_tsvector('simple'::regconfig,   coalesce(identifier, '')),  'A') ||
        setweight(to_tsvector('romanian'::regconfig, coalesce(description, '')), 'B') ||
        setweight(to_tsvector('romanian'::regconfig, coalesce(location, '')),    'C')
    ) STORED
);

CREATE UNIQUE INDEX uq_resources_identifier
    ON resources (lower(identifier)) WHERE identifier IS NOT NULL;

CREATE INDEX idx_resources_type       ON resources (type_id);
CREATE INDEX idx_resources_category   ON resources (category_id);
CREATE INDEX idx_resources_status     ON resources (status);
CREATE INDEX idx_resources_owner      ON resources (owner_id);
CREATE INDEX idx_resources_search     ON resources USING GIN (search_vector);
CREATE INDEX idx_resources_name_trgm  ON resources USING GIN (name gin_trgm_ops);

CREATE TRIGGER trg_resources_updated_at
    BEFORE UPDATE ON resources
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
--  Etichete (căutare după „alte caracteristici”, Q-08)
-- ---------------------------------------------------------------------
CREATE TABLE tags (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);
CREATE UNIQUE INDEX uq_tags_name ON tags (lower(name));

CREATE TABLE resource_tags (
    resource_id BIGINT  NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    tag_id      INTEGER NOT NULL REFERENCES tags(id)      ON DELETE CASCADE,
    PRIMARY KEY (resource_id, tag_id)
);
CREATE INDEX idx_resource_tags_tag ON resource_tags (tag_id);

-- ---------------------------------------------------------------------
--  Linkuri și fișiere atașate (Q-07)
-- ---------------------------------------------------------------------
CREATE TABLE resource_attachments (
    id           BIGSERIAL PRIMARY KEY,
    resource_id  BIGINT          NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    kind         attachment_kind NOT NULL,
    title        VARCHAR(200),
    url          TEXT,                 -- pentru kind = 'link'
    storage_path TEXT,                 -- pentru kind = 'fisier' (cale pe disc / cheie S3)
    file_name    VARCHAR(255),
    mime_type    VARCHAR(100),
    size_bytes   BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
    uploaded_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_attachment_payload CHECK (
        (kind = 'link'   AND url IS NOT NULL AND storage_path IS NULL) OR
        (kind = 'fisier' AND storage_path IS NOT NULL AND file_name IS NOT NULL)
    )
);
CREATE INDEX idx_attachments_resource ON resource_attachments (resource_id);

-- ---------------------------------------------------------------------
--  Atribute specifice tipului (câmpuri care diferă între tipuri, Q-02)
--  ex.: Echipament → „producător”, Set de date → „format”, „licență”
-- ---------------------------------------------------------------------
CREATE TABLE resource_attributes (
    resource_id BIGINT       NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    attr_key    VARCHAR(60)  NOT NULL,
    attr_value  TEXT         NOT NULL,
    PRIMARY KEY (resource_id, attr_key)
);

-- ---------------------------------------------------------------------
--  View pentru ecranul „Lista resurselor”
-- ---------------------------------------------------------------------
CREATE VIEW v_resource_list AS
SELECT
    r.id,
    r.name,
    r.identifier,
    r.status,
    r.location,
    t.name                AS type_name,
    c.name                AS category_name,
    u.full_name           AS owner_name,
    COALESCE(
        (SELECT array_agg(tg.name ORDER BY tg.name)
           FROM resource_tags rt
           JOIN tags tg ON tg.id = rt.tag_id
          WHERE rt.resource_id = r.id),
        '{}'
    )                     AS tags,
    r.updated_at
FROM resources r
JOIN resource_types t ON t.id = r.type_id
LEFT JOIN categories c ON c.id = r.category_id
LEFT JOIN users u      ON u.id = r.owner_id;

-- ---------------------------------------------------------------------
--  Date inițiale (nomenclatoare)
-- ---------------------------------------------------------------------
INSERT INTO roles (code, name, description) VALUES
    ('admin',   'Administrator', 'Gestionează utilizatori, categorii și toate resursele'),
    ('editor',  'Editor',        'Poate adăuga și modifica resurse'),
    ('cititor', 'Cititor',       'Poate doar consulta și căuta resurse');

INSERT INTO resource_types (name, description) VALUES
    ('Echipament',    'Aparatură și dispozitive de laborator'),
    ('Articol',       'Articole științifice, lucrări, rapoarte'),
    ('Carte',         'Cărți și capitole de carte'),
    ('Set de date',   'Seturi de date folosite în cercetare'),
    ('Software',      'Programe, biblioteci, licențe'),
    ('Spațiu',        'Laboratoare, săli, spații de lucru'),
    ('Consumabil',    'Materiale și reactivi');

INSERT INTO categories (name, description) VALUES
    ('Informatică', NULL),
    ('Biologie',    NULL),
    ('Chimie',      NULL),
    ('Fizică',      NULL);

INSERT INTO categories (parent_id, name)
SELECT id, sub FROM categories, (VALUES
    ('Informatică', 'Inteligență artificială'),
    ('Informatică', 'Rețele'),
    ('Biologie',    'Microbiologie')
) AS v(parent, sub)
WHERE categories.name = v.parent;

COMMIT;

-- =====================================================================
--  Exemplu de căutare (nu se execută la init):
--
--  SELECT id, name, ts_rank(search_vector, q) AS rank
--    FROM resources, websearch_to_tsquery('romanian', 'microscop electronic') q
--   WHERE search_vector @@ q
--      OR name ILIKE '%microscop%'
--   ORDER BY rank DESC;
-- =====================================================================
