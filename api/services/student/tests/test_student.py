
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import StudentDB, Base, StudentServiceImpl
import proto_gen.student_pb2 as student_pb
from connectrpc.errors import ConnectError
from connectrpc.code import Code
from connectrpc.request import RequestContext

@pytest.fixture
def test_db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture
def student_service(test_db_session):
    def session_factory():
        return test_db_session
    return StudentServiceImpl(session_factory)

class DummyContext(RequestContext):
    def __init__(self):
        pass

@pytest.mark.asyncio
async def test_create_student(student_service):
    req = student_pb.CreateStudentRequest(
        first_name="Test",
        last_name="User",
        email="test@example.com",
    )
    res = await student_service.create_student(req, DummyContext())
    assert res.student.first_name == "Test"
    assert res.student.email == "test@example.com"

@pytest.mark.asyncio
async def test_create_student_duplicate_email(student_service, test_db_session):
    # Create first student
    test_db_session.add(
        StudentDB(
            first_name="First", last_name="User", email="duplicate@example.com")
    )
    test_db_session.commit()
    
    req = student_pb.CreateStudentRequest(
        first_name="Second",
        last_name="User",
        email="duplicate@example.com",
    )
    with pytest.raises(ConnectError) as excinfo:
        await student_service.create_student(req, DummyContext())
    assert excinfo.value.code == Code.ALREADY_EXISTS

@pytest.mark.asyncio
async def test_get_student(student_service, test_db_session):
    student = StudentDB(first_name="Get", last_name="Me", email="get@example.com")
    test_db_session.add(student)
    test_db_session.commit()
    test_db_session.refresh(student)

    req = student_pb.GetStudentRequest(id=student.id)
    res = await student_service.get_student(req, DummyContext())
    assert res.student.id == student.id


@pytest.mark.asyncio
async def test_get_student_not_found(student_service):
    req = student_pb.GetStudentRequest(id=999)
    with pytest.raises(ConnectError) as exc_info:
        await student_service.get_student(req, DummyContext())
    assert exc_info.value.code == Code.NOT_FOUND

@pytest.mark.asyncio
async def test_list_students(student_service, test_db_session):
    # Add test students
    for i in range(5):
        test_db_session.add(
            StudentDB(first_name=f"Student{i}", last_name=f"Last{i}", email=f"student{i}@example.com")
        )
    test_db_session.commit()

    req = student_pb.ListStudentsRequest(page=1, limit=3)
    res = await student_service.list_students(req, DummyContext())
    assert len(res.data) == 3
    assert res.pagination.total == 5
    assert res.pagination.total_pages == 2

@pytest.mark.asyncio
async def test_update_student(student_service, test_db_session):
    student = StudentDB(first_name="Old", last_name="Name", email="old@example.com")
    test_db_session.add(student)
    test_db_session.commit()
    test_db_session.refresh(student)

    req = student_pb.UpdateStudentRequest(id=student.id, first_name="New")
    res = await student_service.update_student(req, DummyContext())
    assert res.student.first_name == "New"

@pytest.mark.asyncio
async def test_delete_student(student_service, test_db_session):
    student = StudentDB(first_name="Delete", last_name="Me", email="delete@example.com")
    test_db_session.add(student)
    test_db_session.commit()
    test_db_session.refresh(student)

    req = student_pb.DeleteStudentRequest(id=student.id)
    res = await student_service.delete_student(req, DummyContext())
    assert res.success

    # Verify it's gone
    assert test_db_session.query(StudentDB).filter_by(id=student.id).first() is None

@pytest.mark.asyncio
async def test_make_payment(student_service, test_db_session):
    student = StudentDB(first_name="Payment", last_name="Test", email="payment@example.com")
    test_db_session.add(student)
    test_db_session.commit()
    test_db_session.refresh(student)

    req = student_pb.MakePaymentRequest(
        student_id=student.id, amount=100.0, reference="test123")
    res = await student_service.make_payment(req, DummyContext())
    assert res.success
