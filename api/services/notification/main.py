import asyncio
import json
from contextlib import asynccontextmanager

import aio_pika
from fastapi import FastAPI

from config import env

# =====================================================
# SETTINGS
# =====================================================

settings = env.Settings()

PREFETCH_COUNT = 500
MAX_CONCURRENT_NOTIFICATIONS = 500

# =====================================================
# GLOBALS
# =====================================================

rabbit_connection = None
rabbit_channel = None
rabbit_exchange = None

running_tasks: set[asyncio.Task] = set()

notification_semaphore = asyncio.Semaphore(
    MAX_CONCURRENT_NOTIFICATIONS
)

# =====================================================
# NOTIFICATION LOGIC
# =====================================================

async def send_success_notification(data: dict):

    payment_id = data.get("payment_id")
    student_id = data.get("student_id")
    amount = data.get("amount")
    reference = data.get("reference")
    transaction_id = data.get("transaction_id")

    # Simulate email/SMS/push provider call
    await asyncio.sleep(0.2)

    print(
        f"\n"
        f"[Notification Service] "
        f"SUCCESS NOTIFICATION\n"
        f"Student ID      : {student_id}\n"
        f"Payment ID      : {payment_id}\n"
        f"Amount          : ${amount:.2f}\n"
        f"Reference       : {reference}\n"
        f"Transaction ID  : {transaction_id}\n"
        f"-------------------------------------\n"
    )

# =====================================================
# MESSAGE PROCESSOR
# =====================================================

async def process_notification(message: aio_pika.IncomingMessage):
    async with notification_semaphore:
        async with message.process():
            payload = json.loads(message.body.decode())
            await send_success_notification(payload)

# =====================================================
# CONSUMER
# =====================================================

async def consume_payment_successes():
    print("[Notification Service] Consumer starting...")
    queue = await rabbit_channel.declare_queue(
        "notification_success_queue",
        durable=True,
    )

    await queue.bind(
        rabbit_exchange,
        routing_key="payment.processed.success",
    )

    print(
        "[Notification Service] "
        "Listening for payment.processed.success"
    )

    async with queue.iterator() as iterator:
        async for message in iterator:
            task = asyncio.create_task(process_notification(message))
            running_tasks.add(task)
            task.add_done_callback(
                running_tasks.discard
            )

# =====================================================
# STARTUP
# =====================================================

async def startup():
    global rabbit_connection
    global rabbit_channel
    global rabbit_exchange

    for i in range(10):
        try:
            rabbit_connection = await aio_pika.connect_robust(
                settings.rabbitmq_url
            )
            break
        except Exception as err:
            if i == 9:
                raise
            print(f"[Notification Service] RabbitMQ connection attempt {i+1}/10 failed ({err}), retrying in 2s...")
            await asyncio.sleep(2)

    rabbit_channel = await rabbit_connection.channel()

    await rabbit_channel.set_qos(
        prefetch_count=PREFETCH_COUNT
    )

    rabbit_exchange = await rabbit_channel.declare_exchange(
        "microservices_exchange",
        aio_pika.ExchangeType.TOPIC,
        durable=True,
    )

    print(
        "[Notification Service] "
        "RabbitMQ connected"
    )

# =====================================================
# SHUTDOWN
# =====================================================

async def shutdown():

    print(
        "[Notification Service] "
        "Shutting down..."
    )

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
    consumer_task = asyncio.create_task(consume_payment_successes())
    yield
    consumer_task.cancel()
    try:
        await consumer_task
    except asyncio.CancelledError:
        pass
    await shutdown()

# =====================================================
# FASTAPI APP
# =====================================================

app = FastAPI(
    title="Notification Service",
    lifespan=lifespan,
)

@app.get("/")
async def root():

    return {
        "service": "notification-service",
        "status": "running",
        "prefetch_count": PREFETCH_COUNT,
        "max_concurrent_notifications": (
            MAX_CONCURRENT_NOTIFICATIONS
        ),
    }