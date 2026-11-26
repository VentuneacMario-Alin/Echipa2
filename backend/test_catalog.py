import os
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_rrm.db")

from fastapi.testclient import TestClient  # noqa: E402

from backend.database import Base, SessionLocal, engine  # noqa: E402
from backend.main import app  # noqa: E402
from backend.models import User  # noqa: E402
from backend.security import hash_password  # noqa: E402


def make_client(role: str, email: str) -> TestClient:
    with SessionLocal() as db:
        db.add(User(name=role, email=email, password_hash=hash_password("parola1234"), role=role))
        db.commit()
    client = TestClient(app)
    response = client.post("/auth/login", json={"email": email, "password": "parola1234"})
    assert response.status_code == 200
    return client


class CatalogTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        self.editor = make_client("editor", "editor@example.com")
        self.reader = make_client("cititor", "reader@example.com")

    def test_reader_cannot_modify_catalog(self):
        self.assertEqual(self.reader.post("/resources/catalog/types", json={"name": "T"}).status_code, 403)
        self.assertEqual(self.reader.delete("/resources/catalog/types/1").status_code, 403)

    def test_type_crud_and_duplicates(self):
        created = self.editor.post("/resources/catalog/types", json={"name": "Reactiv"}).json()
        dup = self.editor.post("/resources/catalog/types", json={"name": "reactiv"})
        self.assertEqual(dup.status_code, 409)
        updated = self.editor.patch(f"/resources/catalog/types/{created['id']}", json={"name": "Reactivi"})
        self.assertEqual(updated.json()["name"], "Reactivi")
        self.assertEqual(self.editor.delete(f"/resources/catalog/types/{created['id']}").status_code, 204)
        self.assertEqual(self.editor.delete(f"/resources/catalog/types/{created['id']}").status_code, 404)

    def test_type_in_use_cannot_be_deleted(self):
        type_id = self.editor.post("/resources/catalog/types", json={"name": "Aparat"}).json()["id"]
        self.editor.post("/resources", json={"name": "Microscop", "type_id": type_id})
        self.assertEqual(self.editor.delete(f"/resources/catalog/types/{type_id}").status_code, 409)

    def test_category_hierarchy_rules(self):
        parent = self.editor.post("/resources/catalog/categories", json={"name": "Fizica"}).json()
        child = self.editor.post(
            "/resources/catalog/categories", json={"name": "Optica", "parent_id": parent["id"]}
        ).json()
        again = self.editor.post(
            "/resources/catalog/categories", json={"name": "optica", "parent_id": parent["id"]}
        )
        self.assertEqual(again.status_code, 409)
        cycle = self.editor.patch(
            f"/resources/catalog/categories/{parent['id']}", json={"parent_id": child["id"]}
        )
        self.assertEqual(cycle.status_code, 422)
        self.assertEqual(self.editor.delete(f"/resources/catalog/categories/{parent['id']}").status_code, 409)
        self.assertEqual(self.editor.delete(f"/resources/catalog/categories/{child['id']}").status_code, 204)
        self.assertEqual(self.editor.delete(f"/resources/catalog/categories/{parent['id']}").status_code, 204)

    def test_category_in_use_cannot_be_deleted(self):
        type_id = self.editor.post("/resources/catalog/types", json={"name": "Aparat"}).json()["id"]
        category = self.editor.post("/resources/catalog/categories", json={"name": "Chimie2"}).json()
        self.editor.post("/resources", json={"name": "Balanta", "type_id": type_id, "category_id": category["id"]})
        self.assertEqual(self.editor.delete(f"/resources/catalog/categories/{category['id']}").status_code, 409)


if __name__ == "__main__":
    unittest.main()
