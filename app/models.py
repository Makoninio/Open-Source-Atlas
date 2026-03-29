from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class TrackedRepository(TimestampMixin, Base):
    __tablename__ = "tracked_repositories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner: Mapped[str] = mapped_column(String(255), nullable=False)
    repo_name: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(512), nullable=False, unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    raw_payloads: Mapped[list["RawRepositoryPayload"]] = relationship(back_populates="tracked_repository")
    repository: Mapped["Repository"] = relationship(back_populates="tracked_repository", uselist=False)


class RawRepositoryPayload(Base):
    __tablename__ = "raw_repository_payloads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tracked_repository_id: Mapped[int] = mapped_column(ForeignKey("tracked_repositories.id"), nullable=False, index=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)

    tracked_repository: Mapped[TrackedRepository] = relationship(back_populates="raw_payloads")


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tracked_repository_id: Mapped[int] = mapped_column(
        ForeignKey("tracked_repositories.id"), nullable=False, unique=True, index=True
    )
    github_repo_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    owner_login: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(255), nullable=True)
    default_branch: Mapped[str] = mapped_column(String(255), nullable=False)
    stars: Mapped[int] = mapped_column(Integer, nullable=False)
    forks: Mapped[int] = mapped_column(Integer, nullable=False)
    watchers: Mapped[int] = mapped_column(Integer, nullable=False)
    open_issues: Mapped[int] = mapped_column(Integer, nullable=False)
    repo_created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    repo_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    pushed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    tracked_repository: Mapped[TrackedRepository] = relationship(back_populates="repository")
    repository_contributors: Mapped[list["RepositoryContributor"]] = relationship(back_populates="repository")
    issues: Mapped[list["Issue"]] = relationship(back_populates="repository")
    pull_requests: Mapped[list["PullRequest"]] = relationship(back_populates="repository")
    commits: Mapped[list["Commit"]] = relationship(back_populates="repository")


class Contributor(Base):
    __tablename__ = "contributors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    github_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True, index=True)
    login: Mapped[str] = mapped_column(String(255), nullable=False)
    html_url: Mapped[str] = mapped_column(Text, nullable=False)
    avatar_url: Mapped[str] = mapped_column(Text, nullable=True)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    repository_contributors: Mapped[list["RepositoryContributor"]] = relationship(back_populates="contributor")


class RepositoryContributor(Base):
    __tablename__ = "repository_contributors"
    __table_args__ = (UniqueConstraint("repository_id", "contributor_id", name="uq_repository_contributor_pair"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"), nullable=False, index=True)
    contributor_id: Mapped[int] = mapped_column(ForeignKey("contributors.id"), nullable=False, index=True)
    contributions: Mapped[int] = mapped_column(Integer, nullable=False)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    repository: Mapped[Repository] = relationship(back_populates="repository_contributors")
    contributor: Mapped[Contributor] = relationship(back_populates="repository_contributors")


class Issue(Base):
    __tablename__ = "issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    github_issue_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True, index=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"), nullable=False, index=True)
    issue_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[str] = mapped_column(String(50), nullable=False)
    author_login: Mapped[str] = mapped_column(String(255), nullable=True)
    comments_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    is_pull_request: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    repository: Mapped[Repository] = relationship(back_populates="issues")


class PullRequest(Base):
    __tablename__ = "pull_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    github_pr_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True, index=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"), nullable=False, index=True)
    pr_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[str] = mapped_column(String(50), nullable=False)
    author_login: Mapped[str] = mapped_column(String(255), nullable=True)
    comments_count: Mapped[int] = mapped_column(Integer, nullable=False)
    review_comments_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    merged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    repository: Mapped[Repository] = relationship(back_populates="pull_requests")


class Commit(Base):
    __tablename__ = "commits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    github_commit_sha: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"), nullable=False, index=True)
    author_login: Mapped[str] = mapped_column(String(255), nullable=True)
    commit_message: Mapped[str] = mapped_column(Text, nullable=False)
    commit_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    repository: Mapped[Repository] = relationship(back_populates="commits")
