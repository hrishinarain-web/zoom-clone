from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..services import meeting_service as svc

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=schemas.UserOut)
def me(db: Session = Depends(get_db)):
    """No auth in scope: always returns the seeded default user."""
    return svc.get_user(db)
