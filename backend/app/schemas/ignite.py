"""AI Ignite task tracker schemas."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Team = Literal["marketing", "spark", "forge", "support", "finance"]
Status = Literal["not_started", "in_progress", "blocked", "done"]
Priority = Literal["low", "medium", "high"]


def _strip(v):
    """Trim strings; blank becomes None so required fields fail validation."""
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


class MemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    team: Team

    _clean = field_validator("name", mode="before")(classmethod(lambda cls, v: _strip(v)))


class MemberUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    team: Team | None = None
    is_active: bool | None = None

    _clean = field_validator("name", mode="before")(classmethod(lambda cls, v: _strip(v)))


class MemberResponse(BaseModel):
    id: str
    name: str
    team: Team
    is_active: bool


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    team: Team
    status: Status = "not_started"
    progress: int = Field(default=0, ge=0, le=100)
    priority: Priority = "medium"
    due_date: date | None = None
    assignee_ids: list[str] = Field(default_factory=list, max_length=20)
    actor: str | None = Field(default=None, max_length=100)

    _clean = field_validator("title", "description", "actor", mode="before")(classmethod(lambda cls, v: _strip(v)))


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    team: Team | None = None
    status: Status | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    priority: Priority | None = None
    due_date: date | None = None
    assignee_ids: list[str] | None = Field(default=None, max_length=20)
    actor: str | None = Field(default=None, max_length=100)

    _clean = field_validator("title", "description", "actor", mode="before")(classmethod(lambda cls, v: _strip(v)))


class TaskResponse(BaseModel):
    id: str
    title: str
    description: str | None
    team: Team
    status: Status
    progress: int
    priority: Priority
    due_date: date | None
    assignees: list[MemberResponse]
    created_by: str | None
    updated_by: str | None
    created_at: datetime
    updated_at: datetime
