from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class Payment(_message.Message):
    __slots__ = ("id", "student_id", "amount", "reference", "status", "transaction_id", "created_at", "updated_at")
    ID_FIELD_NUMBER: _ClassVar[int]
    STUDENT_ID_FIELD_NUMBER: _ClassVar[int]
    AMOUNT_FIELD_NUMBER: _ClassVar[int]
    REFERENCE_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    TRANSACTION_ID_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    UPDATED_AT_FIELD_NUMBER: _ClassVar[int]
    id: int
    student_id: int
    amount: float
    reference: str
    status: str
    transaction_id: str
    created_at: _timestamp_pb2.Timestamp
    updated_at: _timestamp_pb2.Timestamp
    def __init__(self, id: _Optional[int] = ..., student_id: _Optional[int] = ..., amount: _Optional[float] = ..., reference: _Optional[str] = ..., status: _Optional[str] = ..., transaction_id: _Optional[str] = ..., created_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., updated_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class ListPaymentsRequest(_message.Message):
    __slots__ = ("student_id",)
    STUDENT_ID_FIELD_NUMBER: _ClassVar[int]
    student_id: int
    def __init__(self, student_id: _Optional[int] = ...) -> None: ...

class ListPaymentsResponse(_message.Message):
    __slots__ = ("data",)
    DATA_FIELD_NUMBER: _ClassVar[int]
    data: _containers.RepeatedCompositeFieldContainer[Payment]
    def __init__(self, data: _Optional[_Iterable[_Union[Payment, _Mapping]]] = ...) -> None: ...
