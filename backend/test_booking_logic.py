import unittest
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from backend.database import Base, SessionLocal, engine
from backend.main import app
from backend.models import Booking, Resource, ResourceType, User
from backend.security import create_access_token, hash_password


class BookingLogicTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    def test_booking_model_exists_and_has_required_fields(self):
        self.assertEqual(Booking.__tablename__, "bookings")
        self.assertTrue(hasattr(Booking, "resource_id"))
        self.assertTrue(hasattr(Booking, "user_id"))
        self.assertTrue(hasattr(Booking, "start_at"))
        self.assertTrue(hasattr(Booking, "end_at"))
        self.assertTrue(hasattr(Booking, "status"))

    def test_sqlite_schema_can_be_created(self):
        Base.metadata.create_all(bind=engine)
        self.assertTrue(True)

    def test_booking_endpoint_blocks_overlap_and_sets_resource_status(self):
        with SessionLocal() as db:
            user = User(
                name="Alice",
                email="alice-booking@example.com",
                password_hash=hash_password("secret123"),
                role="cititor",
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            resource_type = ResourceType(name="Echipament", description="Test")
            db.add(resource_type)
            db.commit()
            db.refresh(resource_type)

            resource = Resource(
                name="Laptop test",
                description="Resource used in integration smoke test",
                type_id=resource_type.id,
                status="disponibil",
            )
            db.add(resource)
            db.commit()
            db.refresh(resource)
            token = create_access_token(str(user.id))

        client = TestClient(app)
        first_start = datetime.now(timezone.utc) + timedelta(hours=1)
        first_end = first_start + timedelta(hours=2)
        response = client.post(
            f"/resources/{resource.id}/bookings",
            json={
                "start_at": first_start.isoformat(),
                "end_at": first_end.isoformat(),
                "notes": "Demo booking",
            },
            cookies={"access_token": token},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["status"], "confirmed")

        with SessionLocal() as db:
            updated = db.get(Resource, resource.id)
            self.assertEqual(updated.status, "in_utilizare")

        overlap_response = client.post(
            f"/resources/{resource.id}/bookings",
            json={
                "start_at": (first_start + timedelta(minutes=30)).isoformat(),
                "end_at": (first_end - timedelta(minutes=30)).isoformat(),
                "notes": "Overlap",
            },
            cookies={"access_token": token},
        )
        self.assertEqual(overlap_response.status_code, 409)
        self.assertIn("already exists", overlap_response.json()["detail"].lower())


if __name__ == "__main__":
    unittest.main()
