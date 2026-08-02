import pytest
from unittest.mock import AsyncMock
import main
from main import PaymentServiceImpl
import proto_gen.payment_pb2 as payment_pb

class DummyContext:
    pass

@pytest.fixture
def payment_service():
    return PaymentServiceImpl()

@pytest.mark.asyncio
async def test_make_payment_success(payment_service, monkeypatch):
    monkeypatch.setattr(main, "call_external_bank_api", AsyncMock(return_value="TXN-TEST1234"))
    monkeypatch.setattr(main, "publish_payment_success", AsyncMock())

    req = payment_pb.MakePaymentRequest(student_id=1, amount=50.0, reference="REF123")
    res = await payment_service.make_payment(req, DummyContext())

    assert res.success
    assert res.message == "Payment initiated successfully"
