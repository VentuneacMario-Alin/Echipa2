# Research Resource Manager – Backend

API REST (FastAPI + SQLAlchemy) pentru gestionarea resurselor de cercetare. Servește și frontend-ul static din `../frontend`.

## Instalare și rulare

```bash
# din radacina repository-ului
python -m venv backend/.venv
backend/.venv/Scripts/activate        # Windows (Linux/Mac: source backend/.venv/bin/activate)
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env  # apoi editati secretul JWT si contul de admin
uvicorn backend.main:app --reload
```

Aplicația rulează la http://127.0.0.1:8000, documentația Swagger la `/docs`, verificarea stării la `/health`.
Baza de date implicită este SQLite (`research_resources.db`), creată automat la prima pornire, împreună cu tipurile de resurse și categoriile inițiale.

## Configurare (`backend/.env`)

| Variabilă | Rol |
|---|---|
| `DATABASE_URL` | Șirul de conexiune SQLAlchemy |
| `JWT_SECRET_KEY` | Secretul de semnare a sesiunii (obligatoriu de schimbat) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Durata sesiunii |
| `COOKIE_SECURE` | `true` când aplicația rulează prin HTTPS |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Opționale; creează administratorul inițial la pornire |

## Roluri

- **cititor** (implicit la înregistrare): poate vedea, căuta și filtra resursele.
- **editor**: în plus, adaugă/modifică/șterge resurse, categorii și tipuri.
- **admin**: în plus, administrează utilizatorii (`/users`).

## Endpoint-uri principale

| Metodă | Cale | Acces |
|---|---|---|
| POST | `/auth/register`, `/auth/login`, `/auth/logout` | public |
| GET | `/auth/me` | autentificat |
| GET | `/resources` (`q`, `status`, `type_id`, `category_id`, `tag`, `sort`, `order`, `skip`, `limit`) | public, antet `X-Total-Count` |
| GET | `/resources/{id}` | public |
| POST / PATCH / DELETE | `/resources`, `/resources/{id}` | editor |
| GET | `/resources/catalog/types`, `/categories`, `/tags` | public |
| POST / PATCH / DELETE | `/resources/catalog/types`, `/resources/catalog/categories` | editor |
| GET / PATCH | `/users`, `/users/{id}` | admin |

Rezervările (`/resources/{id}/bookings`) sunt în afara domeniului primei versiuni, dar rămân disponibile.

## Teste

```bash
python -m unittest discover -s backend -t . -p "test_*.py"
```

Testele folosesc o bază separată (`test_rrm.db`), nu baza de date de dezvoltare.

## Stil de cod

PEP 8; linii de maximum 120 de caractere; denumiri `snake_case`; mesajele de eroare ale API-ului sunt în engleză.
