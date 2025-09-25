from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ..models import Notification, User
from ..database import get_session
from typing import List

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/", response_model=List[Notification])
def get_notifications(user_id: int, session: Session = Depends(get_session)):
    return session.exec(select(Notification).where(Notification.user_id == user_id)).all()

@router.post("/", response_model=Notification)
def create_notification(notification: Notification, session: Session = Depends(get_session)):
    session.add(notification)
    session.commit()
    session.refresh(notification)
    return notification

@router.post("/mark-read/{notification_id}")
def mark_notification_read(notification_id: int, session: Session = Depends(get_session)):
    notification = session.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.read = True
    session.add(notification)
    session.commit()
    return {"success": True}

@router.delete("/{notification_id}")
def delete_notification(notification_id: int, session: Session = Depends(get_session)):
    notification = session.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    session.delete(notification)
    session.commit()
    return {"success": True}
