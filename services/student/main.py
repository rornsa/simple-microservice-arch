
from contextlib import asynccontextmanager
import asyncio
import json
import aio_pika
from connectrpc.errors import ConnectError
from fastapi import FastAPI
from sqlalchemy import Column, Integer, String
from config import env
from config.db import engine, Base, SessionLocal
from functools import lru_cache
from connectrpc.code import Code

# Global lazy‑initialized RabbitMQ connection (reused across calls)
_rmq_connection: aio_pika.RobustConnection | None = None

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

Base.metadata.create_all(bind=engine)

def seed_data():
    db = SessionLocal()
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

_rmq_channel = None
_rmq_exchange = None
_rmq_lock = asyncio.Lock()

async def init_rabbitmq():
    global _rmq_connection, _rmq_channel, _rmq_exchange
    settings = get_settings()
    _rmq_connection = await aio_pika.connect_robust(settings.rabbitmq_url)
    _rmq_channel = await _rmq_connection.channel()
    _rmq_exchange = await _rmq_channel.declare_exchange(
        "microservices_exchange",
        aio_pika.ExchangeType.TOPIC,
        durable=True,
    )

# -----------------------
# Settings
# -----------------------
@lru_cache
def get_settings():
    return env.Settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_rabbitmq()
    yield
    if _rmq_connection:
        await _rmq_connection.close()

# -----------------------
# FastAPI App
# -----------------------
app = FastAPI(lifespan=lifespan)

# -----------------------
# ConnectRPC imports
# -----------------------
from connectrpc.request import RequestContext
import proto_gen.student_pb2 as student_pb
from proto_gen.student_connect import StudentServiceASGIApplication, StudentService

# -----------------------
# Service Implementation
# -----------------------
class StudentServiceImpl(StudentService):

    async def create_student(
        self,
        request: student_pb.CreateStudentRequest,
        ctx: RequestContext
    ) -> student_pb.CreateStudentResponse:

        db = SessionLocal()
        try:
            existing = db.query(StudentDB).filter(StudentDB.email == request.email).first()
            if existing:
                raise ConnectError(Code.ALREADY_EXISTS, "Email already exists")

            student = StudentDB(
                first_name=request.first_name,
                last_name=request.last_name,
                email=request.email,
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
        request: student_pb.GetStudentRequest,
        ctx: RequestContext
    ) -> student_pb.GetStudentResponse:

        db = SessionLocal()
        try:
            student = db.query(StudentDB).filter(StudentDB.id == request.student_id).first()

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
        request: student_pb.ListStudentsRequest,
        ctx: RequestContext
    ) -> student_pb.ListStudentsResponse:

        db = SessionLocal()
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
        request: student_pb.UpdateStudentRequest,
        ctx: RequestContext
    ) -> student_pb.UpdateStudentResponse:

        db = SessionLocal()
        try:
            student = db.query(StudentDB).filter(StudentDB.id == request.id).first()

            if not student:
                raise ConnectError(Code.NOT_FOUND, "Student not found")

            exist = db.query(StudentDB).filter(StudentDB.email == request.email).first()
            if exist and exist.id != request.id:
                raise ConnectError(Code.ALREADY_EXISTS, "Email already exists")

            if request.HasField("first_name"):
                student.first_name = request.first_name

            if request.HasField("last_name"):
                student.last_name = request.last_name

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
        request: student_pb.DeleteStudentRequest,
        ctx: RequestContext
    ) -> student_pb.DeleteStudentResponse:

        db = SessionLocal()
        try:
            student = db.query(StudentDB).filter(StudentDB.id == request.id).first()

            if not student:
                raise ConnectError(Code.NOT_FOUND, "Student not found")

            student_pb.Student(
                id=student.id,
                email=student.email,
                first_name=student.first_name,
                last_name=student.last_name,
            )

            db.delete(student)
            db.commit()

            return student_pb.DeleteStudentResponse(
                success=True,
            )
        finally:
            db.close()

    async def make_payment(
        self,
        request: student_pb.MakePaymentRequest,
        ctx: RequestContext,
    ) -> student_pb.MakePaymentResponse:

        student_exists = None

        # Fast DB lookup and immediate release
        with SessionLocal() as db:
            student_exists = (
                db.query(StudentDB.id)
                .filter(StudentDB.id == request.student_id)
                .first()
            )

        if not student_exists:
            raise ConnectError(
                Code.NOT_FOUND,
                f"Student with ID {request.student_id} not found",
            )

        event_data = {
            "student_id": request.student_id,
            "amount": request.amount,
            "reference": request.reference,
        }
        try:
            await _rmq_exchange.publish(
                aio_pika.Message(
                    body=json.dumps(event_data).encode(),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key="student.payment.requested",
            )
            return student_pb.MakePaymentResponse(
                success=True,
                message="Payment initiation event published successfully",
            )
        except Exception as err:
            print(f"[Student Service] RabbitMQ publish failed: {err}")

            raise ConnectError(
                Code.INTERNAL,
                "Failed to publish payment request",
            )

# -----------------------
# Mount ConnectRPC
# -----------------------
app.mount("/connect", StudentServiceASGIApplication(StudentServiceImpl()))