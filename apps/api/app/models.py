"""Persistent domain models. All foreign-key personal data cascade on account deletion."""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, Boolean, ForeignKey, Integer, Float, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geography
from app.core.database import Base
from app.events.time import utcnow

def uid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = 'users'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str | None] = mapped_column(Text)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Identity(Base):
    __tablename__ = 'identities'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    subject: Mapped[str] = mapped_column(String(255), unique=True)

class LoginSession(Base):
    __tablename__ = 'sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    csrf: Mapped[str] = mapped_column(String(100))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

class AuthToken(Base):
    __tablename__ = 'auth_tokens'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

class RateBucket(Base):
    __tablename__ = 'rate_buckets'
    key: Mapped[str] = mapped_column(String(255), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

class Event(Base):
    __tablename__ = 'events'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default='')
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    venue: Mapped[str] = mapped_column(String(500))
    address: Mapped[str] = mapped_column(String(1000), default='')
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    location = mapped_column(Geography('POINT', srid=4326), nullable=False)
    categories: Mapped[list] = mapped_column(JSONB, default=list)
    eligibility: Mapped[str] = mapped_column(Text, default='Eligibility unconfirmed')
    price: Mapped[str] = mapped_column(Text, default='Price unconfirmed')
    registration: Mapped[str] = mapped_column(Text, default='Check the source for registration')
    status: Mapped[str] = mapped_column(String(20), default='scheduled')
    version: Mapped[int] = mapped_column(Integer, default=1)
    source_urls: Mapped[list] = mapped_column(JSONB, default=list)
    last_verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class EventSource(Base):
    __tablename__ = 'event_sources'
    key: Mapped[str] = mapped_column(String(1000), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey('events.id', ondelete='CASCADE'), index=True)

class Plan(Base):
    __tablename__ = 'plans'
    __table_args__ = (UniqueConstraint('user_id','event_id'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    event_id: Mapped[str] = mapped_column(ForeignKey('events.id'), index=True)
    status: Mapped[str] = mapped_column(String(10))
    position: Mapped[float] = mapped_column(Float, default=0)
    version: Mapped[int] = mapped_column(Integer, default=1)
    notice: Mapped[str | None] = mapped_column(Text)

class Reminder(Base):
    __tablename__ = 'reminders'
    __table_args__ = (UniqueConstraint('user_id','event_id'), Index('ix_reminder_due','status','remind_at'))
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    event_id: Mapped[str] = mapped_column(ForeignKey('events.id'))
    remind_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    event_version: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default='pending')
    revision: Mapped[int] = mapped_column(Integer, default=1)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    first_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    provider_id: Mapped[str | None] = mapped_column(String(255))
    delivery_payload: Mapped[dict | None] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(String(1000))

class Chat(Base):
    __tablename__ = 'chats'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    event_id: Mapped[str] = mapped_column(ForeignKey('events.id'))
    messages: Mapped[list] = mapped_column(JSONB, default=list)

class SourceRun(Base):
    __tablename__ = 'source_runs'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    source: Mapped[str] = mapped_column(String(255), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    count: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)

class WorkerState(Base):
    __tablename__ = 'worker_state'
    name: Mapped[str] = mapped_column(String(100), primary_key=True)
    last_run: Mapped[datetime] = mapped_column(DateTime(timezone=True))

class MailJob(Base):
    __tablename__ = 'mail_jobs'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    payload: Mapped[dict] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(20), default='pending')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(String(500))
