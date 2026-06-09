import asyncio
import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime

import aio_pika
from fastapi import FastAPI
from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    DateTime,
) 
from config import env
from config.db import Base, engine, SessionLocal

# =====================================================
# DATABASE
# =====================================================

class PaymentDB(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)

    student_id = Column(Integer, index=True)
    amount = Column(Float)

    reference = Column(String)

    status = Column(String, default="PENDING")
    transaction_id = Column(String)

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )


Base.metadata.create_all(bind=engine)

# =====================================================
# SETTINGS
# =====================================================

settings = env.Settings()

MAX_CONCURRENT_PAYMENTS = 500
PREFETCH_COUNT = 500

# =====================================================
# GLOBALS
# =====================================================

rabbit_connection = None
rabbit_channel = None
rabbit_exchange = None

running_tasks: set[asyncio.Task] = set()
payment_semaphore = asyncio.Semaphore(MAX_CONCURRENT_PAYMENTS)

# =====================================================
# EXTERNAL BANK API
# =====================================================

async def call_external_bank_api(
    student_id: int,
    amount: float,
    reference: str,
) -> str:
    print(
        f"[Bank] Processing payment "
        f"student={student_id} "
        f"amount={amount}"
    )
    await asyncio.sleep(3)
    return (
        f"TXN-"
        f"{uuid.uuid4().hex[:8].upper()}"
    )

# =====================================================
# EVENT PUBLISHER
# =====================================================

async def publish_payment_success(event: dict):
    await rabbit_exchange.publish(
        aio_pika.Message(
            body=json.dumps(event).encode(),
            delivery_mode=(aio_pika.DeliveryMode.PERSISTENT),
        ),
        routing_key="payment.processed.success",
    )

# =====================================================
# PAYMENT PROCESSOR
# =====================================================

async def process_payment(data: dict):
    async with payment_semaphore:
        student_id = data["student_id"]
        amount = data["amount"]
        reference = data.get("reference")
        payment = None
        try:
            # -----------------------------------------
            # Create payment row
            # -----------------------------------------
            db = SessionLocal()
            payment = PaymentDB(
                student_id=student_id,
                amount=amount,
                reference=reference,
                status="PENDING",
            )
            db.add(payment)
            db.commit()
            db.refresh(payment)
            payment_id = payment.id
            print(f"[Payment] Created payment id={payment.id}")
            db.close()
            # -----------------------------------------
            # External bank
            # -----------------------------------------

            txn_id = await call_external_bank_api(student_id,amount,reference)

            # -----------------------------------------
            # Update payment
            # -----------------------------------------

            db = SessionLocal()
            payment = db.query(PaymentDB).filter(PaymentDB.id == payment_id).first()
            payment.status = "SUCCESS"
            payment.transaction_id = txn_id
            db.commit()
            print(f"[Payment] SUCCESS id={payment.id}")
            db.close()

            # -----------------------------------------
            # Publish success event
            # -----------------------------------------

            await publish_payment_success({
                "payment_id": payment.id,
                "student_id": student_id,
                "amount": amount,
                "reference": reference,
                "transaction_id": txn_id,
                "status": "SUCCESS",
            })

        except Exception as e:
            print(f"[Payment] FAILED student={student_id} error={e}")
            if payment:
                try:
                    payment.status = "FAILED"
                    db.commit()
                except Exception:
                    pass
            raise

# =====================================================
# MESSAGE HANDLER
# =====================================================

async def handle_message(message: aio_pika.IncomingMessage):
    async with message.process():
        payload = json.loads(message.body.decode())
        await process_payment(payload)

# =====================================================
# CONSUMER
# =====================================================

async def consume_payment_requests():
    queue = await rabbit_channel.declare_queue("payment_request_queue", durable=True)
    await queue.bind(rabbit_exchange, routing_key="student.payment.requested")
    async with queue.iterator() as iterator:
        async for message in iterator:
            task = asyncio.create_task(handle_message(message))
            running_tasks.add(task)
            task.add_done_callback(running_tasks.discard)

# =====================================================
# STARTUP
# =====================================================

async def startup():

    global rabbit_connection
    global rabbit_channel
    global rabbit_exchange
    rabbit_connection = await aio_pika.connect_robust(settings.rabbitmq_url)
    rabbit_channel = await rabbit_connection.channel()
    await rabbit_channel.set_qos(prefetch_count=PREFETCH_COUNT)
    rabbit_exchange = await rabbit_channel.declare_exchange(
            "microservices_exchange",
            aio_pika.ExchangeType.TOPIC,
            durable=True,
    )
    print("[Payment Service] RabbitMQ connected")

# =====================================================
# SHUTDOWN
# =====================================================

async def shutdown():
    print("[Payment Service] Shutting down...")
    if running_tasks:
        await asyncio.gather(
            *running_tasks,
            return_exceptions=True,
        )
    if rabbit_connection:
        await rabbit_connection.close()

# =====================================================
# FASTAPI LIFESPAN
# =====================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    await startup()
    consumer_task = asyncio.create_task(consume_payment_requests())
    yield
    consumer_task.cancel()
    try:
        await consumer_task
    except asyncio.CancelledError:
        pass
    await shutdown()

# =====================================================
# RPC IMPLEMENTATION
# =====================================================

from connectrpc.request import RequestContext
from connectrpc.errors import ConnectError
from connectrpc.code import Code
import proto_gen.payment_pb2 as payment_pb
from proto_gen.payment_connect import PaymentServiceASGIApplication, PaymentService
from google.protobuf.timestamp_pb2 import Timestamp

class PaymentServiceImpl(PaymentService):
    async def list_payments(
        self,
        request: payment_pb.ListPaymentsRequest,
        ctx: RequestContext
    ) -> payment_pb.ListPaymentsResponse:

        db = SessionLocal()
        query = db.query(PaymentDB)
        if request.HasField("student_id"):
            query = query.filter(PaymentDB.student_id == request.student_id)
        payments = query.order_by(PaymentDB.created_at.desc()).all()
        db.close()

        def to_proto_timestamp(dt):
            if dt is None:
                return None
            ts = Timestamp()
            ts.FromDatetime(dt)
            return ts

        proto_payments = []
        for p in payments:
            proto_p = payment_pb.Payment(
                id=p.id,
                student_id=p.student_id,
                amount=p.amount,
                reference=p.reference,
                status=p.status,
                created_at=to_proto_timestamp(p.created_at),
                updated_at=to_proto_timestamp(p.updated_at),
            )
            if p.transaction_id:
                proto_p.transaction_id = p.transaction_id
            proto_payments.append(proto_p)
        return payment_pb.ListPaymentsResponse(data=proto_payments)
            
# =====================================================
# FASTAPI
# =====================================================

app = FastAPI(title="Payment Service", lifespan=lifespan)
app.mount("/connect", PaymentServiceASGIApplication(PaymentServiceImpl()))
@app.get("/")
async def root():
    return {"service": "payment-service", "status": "running"}