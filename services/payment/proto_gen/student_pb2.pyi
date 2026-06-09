from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class StudentStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    STUDENT_STATUS_UNSPECIFIED: _ClassVar[StudentStatus]
    STUDENT_STATUS_ACTIVE: _ClassVar[StudentStatus]
    STUDENT_STATUS_INACTIVE: _ClassVar[StudentStatus]
    STUDENT_STATUS_SUSPENDED: _ClassVar[StudentStatus]
STUDENT_STATUS_UNSPECIFIED: StudentStatus
STUDENT_STATUS_ACTIVE: StudentStatus
STUDENT_STATUS_INACTIVE: StudentStatus
STUDENT_STATUS_SUSPENDED: StudentStatus

class Student(_message.Message):
    __slots__ = ("id", "first_name", "last_name", "email", "status", "created_at", "updated_at")
    ID_FIELD_NUMBER: _ClassVar[int]
    FIRST_NAME_FIELD_NUMBER: _ClassVar[int]
    LAST_NAME_FIELD_NUMBER: _ClassVar[int]
    EMAIL_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    UPDATED_AT_FIELD_NUMBER: _ClassVar[int]
    id: int
    first_name: str
    last_name: str
    email: str
    status: StudentStatus
    created_at: _timestamp_pb2.Timestamp
    updated_at: _timestamp_pb2.Timestamp
    def __init__(self, id: _Optional[int] = ..., first_name: _Optional[str] = ..., last_name: _Optional[str] = ..., email: _Optional[str] = ..., status: _Optional[_Union[StudentStatus, str]] = ..., created_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., updated_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class CreateStudentRequest(_message.Message):
    __slots__ = ("first_name", "last_name", "email")
    FIRST_NAME_FIELD_NUMBER: _ClassVar[int]
    LAST_NAME_FIELD_NUMBER: _ClassVar[int]
    EMAIL_FIELD_NUMBER: _ClassVar[int]
    first_name: str
    last_name: str
    email: str
    def __init__(self, first_name: _Optional[str] = ..., last_name: _Optional[str] = ..., email: _Optional[str] = ...) -> None: ...

class CreateStudentResponse(_message.Message):
    __slots__ = ("student",)
    STUDENT_FIELD_NUMBER: _ClassVar[int]
    student: Student
    def __init__(self, student: _Optional[_Union[Student, _Mapping]] = ...) -> None: ...

class GetStudentRequest(_message.Message):
    __slots__ = ("id",)
    ID_FIELD_NUMBER: _ClassVar[int]
    id: int
    def __init__(self, id: _Optional[int] = ...) -> None: ...

class GetStudentResponse(_message.Message):
    __slots__ = ("student",)
    STUDENT_FIELD_NUMBER: _ClassVar[int]
    student: Student
    def __init__(self, student: _Optional[_Union[Student, _Mapping]] = ...) -> None: ...

class UpdateStudentRequest(_message.Message):
    __slots__ = ("id", "first_name", "last_name", "email", "age", "status")
    ID_FIELD_NUMBER: _ClassVar[int]
    FIRST_NAME_FIELD_NUMBER: _ClassVar[int]
    LAST_NAME_FIELD_NUMBER: _ClassVar[int]
    EMAIL_FIELD_NUMBER: _ClassVar[int]
    AGE_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    id: int
    first_name: str
    last_name: str
    email: str
    age: int
    status: StudentStatus
    def __init__(self, id: _Optional[int] = ..., first_name: _Optional[str] = ..., last_name: _Optional[str] = ..., email: _Optional[str] = ..., age: _Optional[int] = ..., status: _Optional[_Union[StudentStatus, str]] = ...) -> None: ...

class UpdateStudentResponse(_message.Message):
    __slots__ = ("student",)
    STUDENT_FIELD_NUMBER: _ClassVar[int]
    student: Student
    def __init__(self, student: _Optional[_Union[Student, _Mapping]] = ...) -> None: ...

class DeleteStudentRequest(_message.Message):
    __slots__ = ("id",)
    ID_FIELD_NUMBER: _ClassVar[int]
    id: int
    def __init__(self, id: _Optional[int] = ...) -> None: ...

class DeleteStudentResponse(_message.Message):
    __slots__ = ("success",)
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    success: bool
    def __init__(self, success: bool = ...) -> None: ...

class ListStudentsRequest(_message.Message):
    __slots__ = ("page", "limit", "status")
    PAGE_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    page: int
    limit: int
    status: StudentStatus
    def __init__(self, page: _Optional[int] = ..., limit: _Optional[int] = ..., status: _Optional[_Union[StudentStatus, str]] = ...) -> None: ...

class Pagination(_message.Message):
    __slots__ = ("page", "limit", "total", "total_pages")
    PAGE_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    TOTAL_FIELD_NUMBER: _ClassVar[int]
    TOTAL_PAGES_FIELD_NUMBER: _ClassVar[int]
    page: int
    limit: int
    total: int
    total_pages: int
    def __init__(self, page: _Optional[int] = ..., limit: _Optional[int] = ..., total: _Optional[int] = ..., total_pages: _Optional[int] = ...) -> None: ...

class ListStudentsResponse(_message.Message):
    __slots__ = ("data", "pagination")
    DATA_FIELD_NUMBER: _ClassVar[int]
    PAGINATION_FIELD_NUMBER: _ClassVar[int]
    data: _containers.RepeatedCompositeFieldContainer[Student]
    pagination: Pagination
    def __init__(self, data: _Optional[_Iterable[_Union[Student, _Mapping]]] = ..., pagination: _Optional[_Union[Pagination, _Mapping]] = ...) -> None: ...

class MakePaymentRequest(_message.Message):
    __slots__ = ("student_id", "amount", "reference")
    STUDENT_ID_FIELD_NUMBER: _ClassVar[int]
    AMOUNT_FIELD_NUMBER: _ClassVar[int]
    REFERENCE_FIELD_NUMBER: _ClassVar[int]
    student_id: int
    amount: float
    reference: str
    def __init__(self, student_id: _Optional[int] = ..., amount: _Optional[float] = ..., reference: _Optional[str] = ...) -> None: ...

class MakePaymentResponse(_message.Message):
    __slots__ = ("success", "message")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    message: str
    def __init__(self, success: bool = ..., message: _Optional[str] = ...) -> None: ...
