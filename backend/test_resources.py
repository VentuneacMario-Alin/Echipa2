import os
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_rrm.db")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import func, select  # noqa: E402

from backend.database import Base, SessionLocal, engine  # noqa: E402
from backend.main import app  # noqa: E402
from backend.models import ResourceAttachment, ResourceAttribute, ResourceTag, User  # noqa: E402
from backend.security import hash_password  # noqa: E402


class ResourceTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            db.add(User(name="E", email="e@example.com", password_hash=hash_password("parola1234"), role="editor"))
            db.add(User(name="C", email="c@example.com", password_hash=hash_password("parola1234"), role="cititor"))
            db.commit()
        self.editor = TestClient(app)
        self.editor.post("/auth/login", json={"email": "e@example.com", "password": "parola1234"})
        self.reader = TestClient(app)
        self.reader.post("/auth/login", json={"email": "c@example.com", "password": "parola1234"})
        self.type_id = self.editor.post("/resources/catalog/types", json={"name": "Echipament"}).json()["id"]

    def create(self, **extra):
        return self.editor.post("/resources", json={"name": "Osciloscop", "type_id": self.type_id, **extra})

    def test_anonymous_can_read_but_not_write(self):
        resource_id = self.create().json()["id"]
        anonymous = TestClient(app)
        self.assertEqual(anonymous.get(f"/resources/{resource_id}").status_code, 200)
        self.assertEqual(anonymous.post("/resources", json={"name": "x", "type_id": self.type_id}).status_code, 401)
        self.assertEqual(self.reader.post("/resources", json={"name": "x", "type_id": self.type_id}).status_code, 403)
        self.assertEqual(self.reader.delete(f"/resources/{resource_id}").status_code, 403)

    def test_create_read_update_cycle(self):
        created = self.create(
            description="d", tags=["Fizica", " fizica "], attributes={"model": "X1"},
            attachments=[{"kind": "link", "title": "Manual", "url": "https://exemplu.ro/manual"}],
        )
        self.assertEqual(created.status_code, 201, created.text)
        body = created.json()
        self.assertEqual(body["tags"], ["fizica"])
        self.assertEqual(body["type_name"], "Echipament")
        updated = self.editor.patch(f"/resources/{body['id']}", json={"status": "mentenanta", "tags": ["nou"]})
        self.assertEqual(updated.json()["status"], "mentenanta")
        self.assertEqual(updated.json()["tags"], ["nou"])
        self.assertEqual(updated.json()["attributes"], {"model": "X1"})
        self.assertEqual(self.editor.get("/resources/9999").status_code, 404)

    def test_validation_errors(self):
        self.assertEqual(self.create(name="   ").status_code, 422)
        self.assertEqual(self.create(status="alt").status_code, 422)
        self.assertEqual(self.create(type_id=999).status_code, 404)
        bad_link = self.create(attachments=[{"kind": "link", "url": "javascript:alert(1)"}])
        self.assertEqual(bad_link.status_code, 422)
        self.assertEqual(self.create(tags=["x" * 60]).status_code, 422)
        resource_id = self.create().json()["id"]
        self.assertEqual(self.editor.patch(f"/resources/{resource_id}", json={"name": None}).status_code, 422)

    def test_identifier_must_be_unique(self):
        first = self.create(identifier="INV-1").json()
        self.assertEqual(self.create(identifier="INV-1").status_code, 409)
        other = self.create(identifier="INV-2").json()
        self.assertEqual(self.editor.patch(f"/resources/{other['id']}", json={"identifier": "INV-1"}).status_code, 409)
        self.assertEqual(self.editor.patch(f"/resources/{first['id']}", json={"identifier": "INV-1"}).status_code, 200)
        self.assertEqual(self.create(identifier="  ").status_code, 201)
        self.assertEqual(self.create(identifier="").status_code, 201)

    def test_delete_removes_related_rows(self):
        resource_id = self.create(
            tags=["a"], attributes={"k": "v"},
            attachments=[{"kind": "link", "url": "https://exemplu.ro"}],
        ).json()["id"]
        self.assertEqual(self.editor.delete(f"/resources/{resource_id}").status_code, 204)
        self.assertEqual(self.editor.get(f"/resources/{resource_id}").status_code, 404)
        with SessionLocal() as db:
            for model in (ResourceTag, ResourceAttribute, ResourceAttachment):
                self.assertEqual(db.scalar(select(func.count()).select_from(model)), 0)


if __name__ == "__main__":
    unittest.main()
