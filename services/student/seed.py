from config.db import SessionLocal, engine, Base
from main import StudentDB
from datetime import datetime

def seed():
    print("Seeding students...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Check if we already have students
    if db.query(StudentDB).count() > 0:
        print("Database already contains students. Skipping seed.")
        db.close()
        return

    students = [
        StudentDB(
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        ),
        StudentDB(
            first_name="Jane",
            last_name="Smith",
            email="jane.smith@example.com",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        ),
        StudentDB(
            first_name="Alice",
            last_name="Johnson",
            email="alice.j@example.com",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        ),
        StudentDB(
            first_name="Bob",
            last_name="Wilson",
            email="bob.wilson@example.com",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
    ]

    try:
        db.add_all(students)
        db.commit()
        print(f"Successfully seeded {len(students)} students.")
    except Exception as e:
        print(f"Error seeding students: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
