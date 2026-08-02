
from contextlib import asynccontextmanager
import asyncio
import aio_pika
from connectrpc.errors import ConnectError
from fastapi import FastAPI
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import sessionmaker
from config import env
from config.db import Base
from functools import lru_cache
from connectrpc.code import Code
from typing import Optional, Callable

# -----------------------
# DB Model
# -----------------------
class StudentDB(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, index=True)
    last_name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    created_at = Column(String, index=True)
    updated_at = Column(String, index=True)

# -----------------------
# Settings
# -----------------------
@lru_cache
def get_settings():
    return env.Settings()

# -----------------------
# Service Implementation
# -----------------------
class StudentServiceImpl:
    def __init__(
        self,
        db_session_factory: Callable[[], any],
        rmq_exchange: Optional[aio_pika.Exchange] = None,
    ):
        self.db_session_factory = db_session_factory
        self.rmq_exchange = rmq_exchange

    async def create_student(
        self,
        request,
        ctx,
    ):
        import proto_gen.student_pb2 as student_pb

        db = self.db_session_factory()
        try:
            existing = db.query(StudentDB).filter(StudentDB.email == request.email).first()
            if existing:
                raise ConnectError(Code.ALREADY_EXISTS, "Email already exists")

            from datetime import datetime
            student = StudentDB(
                first_name=request.first_name,
                last_name=request.last_name,
                email=request.email,
                created_at=datetime.now().isoformat(),
                updated_at=datetime.now().isoformat(),
            )
            db.add(student)
            db.commit()
            db.refresh(student)

            return student_pb.CreateStudentResponse(
                student=student_pb.Student(
                    id=student.id,
                    email=student.email,
                    first_name=student.first_name,
                    last_name=student.last_name,
                )
            )
        finally:
            db.close()

    async def get_student(
        self,
        request,
        ctx,
    ):
        import proto_gen.student_pb2 as student_pb

        db = self.db_session_factory()
        try:
            student = db.query(StudentDB).filter(StudentDB.id == request.id).first()

            if not student:
                raise ConnectError(Code.NOT_FOUND, "Student not found")

            return student_pb.GetStudentResponse(
                student=student_pb.Student(
                    id=student.id,
                    email=student.email,
                    first_name=student.first_name,
                    last_name=student.last_name,
                )
            )
        finally:
            db.close()

    async def list_students(
        self,
        request,
        ctx,
    ):
        import proto_gen.student_pb2 as student_pb

        db = self.db_session_factory()
        try:
            page = request.page
            limit = request.limit
            skip = (page - 1) * limit

            students = (
                db.query(StudentDB)
                .offset(skip)
                .limit(limit)
                .all()
            )

            return student_pb.ListStudentsResponse(
                data=[
                    student_pb.Student(
                        id=s.id,
                        email=s.email,
                        first_name=s.first_name,
                        last_name=s.last_name,
                    )
                    for s in students
                ],
                pagination=student_pb.Pagination(
                    page=page,
                    limit=limit,
                    total=db.query(StudentDB).count(),
                    total_pages=(db.query(StudentDB).count() + limit - 1) // limit,
                )
            )
        finally:
            db.close()

    async def update_student(
        self,
        request,
        ctx,
    ):
        import proto_gen.student_pb2 as student_pb

        db = self.db_session_factory()
        try:
            student = db.query(StudentDB).filter(StudentDB.id == request.id).first()

            if not student:
                raise ConnectError(Code.NOT_FOUND, "Student not found")

            if request.HasField("email"):
                exist = db.query(StudentDB).filter(StudentDB.email == request.email).first()
                if exist and exist.id != request.id:
                    raise ConnectError(Code.ALREADY_EXISTS, "Email already exists")
                student.email = request.email

            if request.HasField("first_name"):
                student.first_name = request.first_name

            if request.HasField("last_name"):
                student.last_name = request.last_name

            from datetime import datetime
            student.updated_at = datetime.now().isoformat()

            db.commit()
            db.refresh(student)

            return student_pb.UpdateStudentResponse(
                student=student_pb.Student(
                    id=student.id,
                    email=student.email,
                    first_name=student.first_name,
                    last_name=student.last_name,
                )
            )
        finally:
            db.close()

    async def delete_student(
        self,
        request,
        ctx,
    ):
        import proto_gen.student_pb2 as student_pb

        db = self.db_session_factory()
        try:
            student = db.query(StudentDB).filter(StudentDB.id == request.id).first()

            if not student:
                raise ConnectError(Code.NOT_FOUND, "Student not found")

            db.delete(student)
            db.commit()

            return student_pb.DeleteStudentResponse(
                success=True,
            )
        finally:
            db.close()

# -----------------------
# Application Setup (Production)
# -----------------------
def create_app(
    db_url: Optional[str] = None,
    rmq_url: Optional[str] = None,
):
    from config.db import engine, SessionLocal as ProdSessionLocal
    from proto_gen.student_connect import StudentServiceASGIApplication, StudentService

    # Use test or prod DB
    if db_url:
        test_engine = create_engine(db_url, connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=test_engine)
        TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
        session_factory = TestSessionLocal
    else:
        Base.metadata.create_all(bind=engine)
        session_factory = ProdSessionLocal

    # Seed data for prod
    if not db_url:
        def seed_data():
            db = session_factory()
            if db.query(StudentDB).count() == 0:
                from datetime import datetime
                students = [
                    StudentDB(first_name="John", last_name="Doe", email="john.doe@example.com", created_at=datetime.now().isoformat(), updated_at=datetime.now().isoformat()),
                    StudentDB(first_name="Jane", last_name="Smith", email="jane.smith@example.com", created_at=datetime.now().isoformat(), updated_at=datetime.now().isoformat()),
                    StudentDB(first_name="Alice", last_name="Johnson", email="alice.j@example.com", created_at=datetime.now().isoformat(), updated_at=datetime.now().isoformat()),
                ]
                db.add_all(students)
                db.commit()
            db.close()
        seed_data()

    # RabbitMQ setup
    _rmq_connection: aio_pika.RobustConnection | None = None
    _rmq_exchange: aio_pika.Exchange | None = None

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        nonlocal _rmq_connection, _rmq_exchange
        settings = get_settings()
        if rmq_url or settings.rabbitmq_url:
            target_url = rmq_url or settings.rabbitmq_url
            for i in range(10):
                try:
                    _rmq_connection = await aio_pika.connect_robust(target_url)
                    break
                except Exception as err:
                    if i == 9:
                        raise
                    print(f"[Student Service] RabbitMQ connection attempt {i+1}/10 failed ({err}), retrying in 2s...")
                    await asyncio.sleep(2)
            _rmq_channel = await _rmq_connection.channel()
            _rmq_exchange = await _rmq_channel.declare_exchange(
                "microservices_exchange",
                aio_pika.ExchangeType.TOPIC,
                durable=True,
            )
            service_impl.rmq_exchange = _rmq_exchange
        yield
        if _rmq_connection:
            await _rmq_connection.close()

    app = FastAPI(lifespan=lifespan)

    # Create service instance
    service_impl = StudentServiceImpl(session_factory, _rmq_exchange)

    # Wrap with connectrpc service class
    class ConnectStudentService(StudentService):
        async def create_student(self, request, ctx): return await service_impl.create_student(request, ctx)
        async def get_student(self, request, ctx): return await service_impl.get_student(request, ctx)
        async def list_students(self, request, ctx): return await service_impl.list_students(request, ctx)
        async def update_student(self, request, ctx): return await service_impl.update_student(request, ctx)
        async def delete_student(self, request, ctx): return await service_impl.delete_student(request, ctx)
        async def make_payment(self, request, ctx): return await service_impl.make_payment(request, ctx)

    app.mount("/connect", StudentServiceASGIApplication(ConnectStudentService()))
    return app

# Create default app for production
app = create_app()
