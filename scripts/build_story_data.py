from __future__ import annotations

import ast
import json
import sys
from pathlib import Path

import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[1]))


def main() -> None:
    root_dir = Path(__file__).resolve().parents[1]
    exports_dir = root_dir / "exports"
    output_path = root_dir / "frontend" / "data" / "story_data.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    repos_df = pd.read_csv(exports_dir / "repositories.csv")
    stats_df = pd.read_csv(exports_dir / "repository_stats.csv")
    contribs_df = pd.read_csv(exports_dir / "contributors.csv")
    repo_contribs_df = pd.read_csv(exports_dir / "repository_contributors.csv")

    repos_df["repo_created_at"] = pd.to_datetime(repos_df["repo_created_at"], utc=True)
    repos_df["scraped_at"] = pd.to_datetime(repos_df["scraped_at"], utc=True)
    stats_df = stats_df.rename(
        columns={
            "open_issues": "open_issues_summary",
            "total_pull_requests": "pull_requests_summary",
            "open_pull_requests": "open_pull_requests_summary",
        }
    )
    stats_df["weekly_commit_counts"] = stats_df["weekly_commit_counts"].apply(
        lambda value: ast.literal_eval(value) if isinstance(value, str) and value else []
    )

    contributor_counts = repo_contribs_df.groupby("repository_id").size().rename("contributor_count")

    repo_summary = repos_df.copy()
    repo_summary = repo_summary.merge(
        stats_df[
            [
                "repository_id",
                "total_issues",
                "open_issues_summary",
                "pull_requests_summary",
                "open_pull_requests_summary",
                "commits_last_year",
                "weekly_commit_counts",
            ]
        ],
        left_on="id",
        right_on="repository_id",
        how="left",
    )
    repo_summary = repo_summary.merge(contributor_counts, left_on="id", right_index=True, how="left")
    repo_summary = repo_summary.fillna(
        {
            "total_issues": 0,
            "open_issues_summary": 0,
            "pull_requests_summary": 0,
            "open_pull_requests_summary": 0,
            "commits_last_year": 0,
            "contributor_count": 0,
        }
    )

    latest_scrape = repo_summary["scraped_at"].max()
    current_year = latest_scrape.year if pd.notna(latest_scrape) else pd.Timestamp.utcnow().year

    repositories = []
    for row in repo_summary.sort_values("stars", ascending=False).itertuples():
        repositories.append(
            {
                "id": int(row.id),
                "full_name": row.full_name,
                "description": row.description or "",
                "language": row.language or "",
                "stars": int(row.stars),
                "forks": int(row.forks),
                "watchers": int(row.watchers),
                "open_issues": int(row.open_issues_summary),
                "issues": int(row.total_issues),
                "pull_requests": int(row.pull_requests_summary),
                "open_pull_requests": int(row.open_pull_requests_summary),
                "commits": int(row.commits_last_year),
                "contributors": int(row.contributor_count),
                "created_year": int(row.repo_created_at.year),
                "age_years": int(max(current_year - row.repo_created_at.year, 0)),
            }
        )

    repo_map = dict(zip(repos_df["id"], repos_df["full_name"]))
    monthly_buckets: dict[str, dict[str, int]] = {}
    today = pd.Timestamp.utcnow().normalize()
    week_dates = [today - pd.Timedelta(weeks=week_index) for week_index in range(51, -1, -1)]

    for row in repo_summary.itertuples():
        weekly_counts = list(row.weekly_commit_counts) if isinstance(row.weekly_commit_counts, list) else []
        for week_date, count in zip(week_dates[-len(weekly_counts):], weekly_counts):
            month_key = week_date.strftime("%Y-%m")
            monthly_buckets.setdefault(month_key, {})
            monthly_buckets[month_key][repo_map[int(row.id)]] = (
                monthly_buckets[month_key].get(repo_map[int(row.id)], 0) + int(count)
            )

    monthly_activity = []
    for month in sorted(monthly_buckets.keys())[-12:]:
        monthly_activity.append(
            {
                "month": month,
                "counts": {repo_name: int(count) for repo_name, count in monthly_buckets[month].items() if int(count) > 0},
            }
        )

    contributor_lookup = dict(zip(contribs_df["id"], contribs_df["login"]))
    contributor_totals = repo_contribs_df.copy()
    contributor_totals["login"] = contributor_totals["contributor_id"].map(contributor_lookup)
    top_contributors = (
        contributor_totals.groupby("login")["contributions"].sum().sort_values(ascending=False).head(12)
    )

    story_data = {
        "summary": {
            "repo_count": int(len(repositories)),
            "total_stars": int(repo_summary["stars"].sum()),
            "total_commits": int(repo_summary["commits_last_year"].sum()),
            "total_contributors": int(contribs_df["id"].nunique()),
            "generated_at": latest_scrape.strftime("%Y-%m-%d") if pd.notna(latest_scrape) else "Unknown",
        },
        "repositories": repositories,
        "monthly_activity": monthly_activity,
        "top_contributors": [
            {"login": login, "contributions": int(contributions)}
            for login, contributions in top_contributors.items()
            if isinstance(login, str)
        ],
    }

    output_path.write_text(json.dumps(story_data, indent=2))
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
