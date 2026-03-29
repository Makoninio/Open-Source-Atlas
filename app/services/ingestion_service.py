from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.github_client import GitHubClient
from app.models import Commit, Contributor, Issue, PullRequest, RawRepositoryPayload, Repository, RepositoryContributor, TrackedRepository


logger = logging.getLogger(__name__)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_github_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def ingest_repository(session: Session, client: GitHubClient, tracked_repository: TrackedRepository) -> None:
    logger.info("Starting ingestion for %s", tracked_repository.full_name)
    repository = upsert_repository_metadata(session, client, tracked_repository)
    ingest_contributors(session, client, repository)
    ingest_issues(session, client, repository)
    ingest_pull_requests(session, client, repository)
    ingest_commits(session, client, repository)
    logger.info("Finished ingestion for %s", tracked_repository.full_name)


def upsert_repository_metadata(
    session: Session, client: GitHubClient, tracked_repository: TrackedRepository
) -> Repository:
    payload = client.get_repository(tracked_repository.full_name)
    fetched_at = utcnow()

    session.add(
        RawRepositoryPayload(
            tracked_repository_id=tracked_repository.id,
            fetched_at=fetched_at,
            payload=payload,
        )
    )

    values: dict[str, Any] = {
        "tracked_repository_id": tracked_repository.id,
        "github_repo_id": payload["id"],
        "name": payload["name"],
        "full_name": payload["full_name"],
        "owner_login": payload["owner"]["login"],
        "description": payload.get("description"),
        "language": payload.get("language"),
        "default_branch": payload["default_branch"],
        "stars": payload["stargazers_count"],
        "forks": payload["forks_count"],
        "watchers": payload["watchers_count"],
        "open_issues": payload["open_issues_count"],
        "repo_created_at": parse_github_datetime(payload["created_at"]),
        "repo_updated_at": parse_github_datetime(payload["updated_at"]),
        "pushed_at": parse_github_datetime(payload.get("pushed_at")),
        "is_archived": payload["archived"],
        "size": payload["size"],
        "scraped_at": fetched_at,
    }

    stmt = insert(Repository).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[Repository.tracked_repository_id],
        set_={key: values[key] for key in values if key != "tracked_repository_id"},
    )
    session.execute(stmt)
    session.flush()

    logger.info("Saved repository metadata for %s", tracked_repository.full_name)
    return session.query(Repository).filter_by(tracked_repository_id=tracked_repository.id).one()


def ingest_contributors(session: Session, client: GitHubClient, repository: Repository) -> None:
    scraped_at = utcnow()

    for payload in client.get_contributors(repository.full_name):
        contributor_values = {
            "github_user_id": payload["id"],
            "login": payload["login"],
            "html_url": payload["html_url"],
            "avatar_url": payload.get("avatar_url"),
            "type": payload["type"],
            "scraped_at": scraped_at,
        }

        stmt = insert(Contributor).values(**contributor_values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[Contributor.github_user_id],
            set_={key: contributor_values[key] for key in contributor_values if key != "github_user_id"},
        )
        session.execute(stmt)

        contributor = session.execute(
            select(Contributor).where(Contributor.github_user_id == payload["id"])
        ).scalar_one()

        link_values = {
            "repository_id": repository.id,
            "contributor_id": contributor.id,
            "contributions": payload["contributions"],
            "scraped_at": scraped_at,
        }
        link_stmt = insert(RepositoryContributor).values(**link_values)
        link_stmt = link_stmt.on_conflict_do_update(
            constraint="uq_repository_contributor_pair",
            set_={"contributions": link_values["contributions"], "scraped_at": scraped_at},
        )
        session.execute(link_stmt)

    logger.info("Saved contributors for %s", repository.full_name)


def ingest_issues(session: Session, client: GitHubClient, repository: Repository) -> None:
    scraped_at = utcnow()

    for payload in client.get_issues(repository.full_name):
        values = {
            "github_issue_id": payload["id"],
            "repository_id": repository.id,
            "issue_number": payload["number"],
            "title": payload["title"],
            "state": payload["state"],
            "author_login": (payload.get("user") or {}).get("login"),
            "comments_count": payload["comments"],
            "created_at": parse_github_datetime(payload["created_at"]),
            "updated_at": parse_github_datetime(payload["updated_at"]),
            "closed_at": parse_github_datetime(payload.get("closed_at")),
            "is_pull_request": "pull_request" in payload,
            "scraped_at": scraped_at,
        }
        stmt = insert(Issue).values(**values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[Issue.github_issue_id],
            set_={key: values[key] for key in values if key != "github_issue_id"},
        )
        session.execute(stmt)

    logger.info("Saved issues for %s", repository.full_name)


def ingest_pull_requests(session: Session, client: GitHubClient, repository: Repository) -> None:
    scraped_at = utcnow()

    for payload in client.get_pull_requests(repository.full_name):
        values = {
            "github_pr_id": payload["id"],
            "repository_id": repository.id,
            "pr_number": payload["number"],
            "title": payload["title"],
            "state": payload["state"],
            "author_login": (payload.get("user") or {}).get("login"),
            "comments_count": payload.get("comments", 0),
            "review_comments_count": payload.get("review_comments", 0),
            "created_at": parse_github_datetime(payload["created_at"]),
            "updated_at": parse_github_datetime(payload["updated_at"]),
            "closed_at": parse_github_datetime(payload.get("closed_at")),
            "merged_at": parse_github_datetime(payload.get("merged_at")),
            "scraped_at": scraped_at,
        }
        stmt = insert(PullRequest).values(**values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[PullRequest.github_pr_id],
            set_={key: values[key] for key in values if key != "github_pr_id"},
        )
        session.execute(stmt)

    logger.info("Saved pull requests for %s", repository.full_name)


def ingest_commits(session: Session, client: GitHubClient, repository: Repository) -> None:
    scraped_at = utcnow()

    for payload in client.get_commits(repository.full_name):
        commit_info = payload["commit"]
        author = payload.get("author") or {}

        values = {
            "github_commit_sha": payload["sha"],
            "repository_id": repository.id,
            "author_login": author.get("login"),
            "commit_message": commit_info["message"],
            "commit_date": parse_github_datetime(
                (commit_info.get("author") or {}).get("date") or (commit_info.get("committer") or {}).get("date")
            ),
            "scraped_at": scraped_at,
        }
        stmt = insert(Commit).values(**values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[Commit.github_commit_sha],
            set_={key: values[key] for key in values if key != "github_commit_sha"},
        )
        session.execute(stmt)

    logger.info("Saved commits for %s", repository.full_name)
