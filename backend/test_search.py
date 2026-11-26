import os
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_rrm.db")

from fastapi.testclient import TestClient  # noqa: E402

from backend.database import Base, SessionLocal, engine  # noqa: E402
from backend.main import app  # noqa: E402
from backend.models import User  # noqa: E402
from backend.security import hash_password  # noqa: E402


class SearchTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            db.add(User(name="E", email="e@example.com", password_hash=hash_password("parola1234"), role="editor"))
            db.commit()
        self.client = TestClient(app)
        self.client.post("/auth/login", json={"email": "e@example.com", "password": "parola1234"})
        self.type_id = self.client.post("/resources/catalog/types", json={"name": "Echipament"}).json()["id"]
        self.parent = self.client.post("/resources/catalog/categories", json={"name": "Biologie"}).json()["id"]
        self.child = self.client.post(
            "/resources/catalog/categories", json={"name": "Microbiologie", "parent_id": self.parent}
        ).json()["id"]
        self.add("Microscop optic", category_id=self.child, tags=["laborator", "optica"],
                 attributes={"producator": "Zeiss"})
        self.add("Centrifuga", category_id=self.parent, status="mentenanta", tags=["laborator"])
        self.add("Set date 100%", description="procent")

    def add(self, name, **extra):
        response = self.client.post("/resources", json={"name": name, "type_id": self.type_id, **extra})
        self.assertEqual(response.status_code, 201, response.text)

    def names(self, **params):
        response = self.client.get("/resources", params=params)
        self.assertEqual(response.status_code, 200, response.text)
        return [item["name"] for item in response.json()], response

    def test_search_by_name_tag_and_attribute(self):
        self.assertEqual(self.names(q="microscop")[0], ["Microscop optic"])
        self.assertEqual(sorted(self.names(q="laborator")[0]), ["Centrifuga", "Microscop optic"])
        self.assertEqual(self.names(q="zeiss")[0], ["Microscop optic"])

    def test_like_wildcards_are_literal(self):
        self.assertEqual(self.names(q="100%")[0], ["Set date 100%"])
        self.assertEqual(self.names(q="%")[0], ["Set date 100%"])

    def test_category_filter_includes_subcategories(self):
        self.assertEqual(sorted(self.names(category_id=self.parent)[0]), ["Centrifuga", "Microscop optic"])
        self.assertEqual(self.names(category_id=self.parent, include_subcategories="false")[0], ["Centrifuga"])

    def test_status_tag_filters_and_invalid_status(self):
        self.assertEqual(self.names(status="mentenanta")[0], ["Centrifuga"])
        self.assertEqual(self.names(tag="OPTICA")[0], ["Microscop optic"])
        self.assertEqual(self.client.get("/resources", params={"status": "inexistent"}).status_code, 422)

    def test_sort_and_total_count(self):
        names, response = self.names(sort="name", order="asc", limit=2)
        self.assertEqual(names, ["Centrifuga", "Microscop optic"])
        self.assertEqual(response.headers["X-Total-Count"], "3")

    def test_tag_catalog(self):
        self.assertEqual(self.client.get("/resources/catalog/tags").json(), ["laborator", "optica"])


if __name__ == "__main__":
    unittest.main()
