from __future__ import annotations

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
    commits_df = pd.read_csv(exports_dir / "commits.csv")
    issues_df = pd.read_csv(exports_dir / "issues.csv")
    prs_df = pd.read_csv(exports_dir / "pull_requests.csv")
    contribs_df = pd.read_csv(exports_dir / "contributors.csv")
    repo_contribs_df = pd.read_csv(exports_dir / "repository_contributors.csv")

    repos_df["repo_created_at"] = pd.to_datetime(repos_df["repo_created_at"], utc=True)
    repos_df["scraped_at"] = pd.to_datetime(repos_df["scraped_at"], utc=True)
    commits_df["commit_date"] = pd.to_datetime(commits_df["commit_date"], utc=True, errors="coerce")

    commit_counts = commits_df.groupby("repository_id").size().rename("commit_count")
    issue_counts = (
        issues_df[issues_df["is_pull_request"] == False].groupby("repository_id").size().rename("issue_count")
    )
    pr_counts = prs_df.groupby("repository_id").size().rename("pr_count")
    contributor_counts = repo_contribs_df.groupby("repository_id").size().rename("contributor_count")

    repo_summary = repos_df.merge(commit_counts, left_on="id", right_index=True, how="left")
    repo_summary = repo_summary.merge(issue_counts, left_on="id", right_index=True, how="left")
    repo_summary = repo_summary.merge(pr_counts, left_on="id", right_index=True, how="left")
    repo_summary = repo_summary.merge(contributor_counts, left_on="id", right_index=True, how="left")
    repo_summary = repo_summary.fillna(
        {"commit_count": 0, "issue_count": 0, "pr_count": 0, "contributor_count": 0}
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
                "open_issues": int(row.open_issues),
                "issues": int(row.issue_count),
                "pull_requests": int(row.pr_count),
                "commits": int(row.commit_count),
                "contributors": int(row.contributor_count),
                "created_year": int(row.repo_created_at.year),
                "age_years": int(max(current_year - row.repo_created_at.year, 0)),
            }
        )

    repo_map = dict(zip(repos_df["id"], repos_df["full_name"]))
    monthly_commits = commits_df.dropna(subset=["commit_date"]).copy()
    monthly_commits["month"] = monthly_commits["commit_date"].dt.strftime("%Y-%m")
    monthly_counts = (
        monthly_commits.groupby(["month", "repository_id"]).size().unstack(fill_value=0).sort_index().tail(12)
    )

    monthly_activity = []
    for month, values in monthly_counts.iterrows():
        monthly_activity.append(
            {
                "month": month,
                "counts": {repo_map[int(repo_id)]: int(count) for repo_id, count in values.items() if int(count) > 0},
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
            "total_commits": int(commit_counts.sum()) if not commit_counts.empty else 0,
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
