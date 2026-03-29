import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

def main():
    root_dir = Path(__file__).resolve().parents[1]
    exports_dir = root_dir / "exports"
    insights_dir = root_dir / "insights"
    insights_dir.mkdir(exist_ok=True)
    
    print("Loading datasets...")
    # Load data
    repos_df = pd.read_csv(exports_dir / "repositories.csv")
    commits_df = pd.read_csv(exports_dir / "commits.csv")
    issues_df = pd.read_csv(exports_dir / "issues.csv")
    prs_df = pd.read_csv(exports_dir / "pull_requests.csv")
    repo_contribs_df = pd.read_csv(exports_dir / "repository_contributors.csv")
    contribs_df = pd.read_csv(exports_dir / "contributors.csv")

    # Map repo id to full name for easy plotting
    repo_map = dict(zip(repos_df['id'], repos_df['full_name']))
    
    print("Generating Command Velocity Over Time...")
    # --- A. Commit Velocity Over Time ---
    commits_df['commit_date'] = pd.to_datetime(commits_df['commit_date'], utc=True)
    commits_df['month_year'] = commits_df['commit_date'].dt.to_period('M')
    commits_df['repo_name'] = commits_df['repository_id'].map(repo_map)
    
    plt.figure(figsize=(12, 6))
    monthly_commits = commits_df.groupby(['month_year', 'repo_name']).size().unstack(fill_value=0)
    monthly_commits.index = monthly_commits.index.to_timestamp()
    
    for col in monthly_commits.columns:
        plt.plot(monthly_commits.index, monthly_commits[col], label=col, marker='')
        
    plt.title("Commit Velocity Over Time")
    plt.xlabel("Date")
    plt.ylabel("Number of Commits")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(insights_dir / "commit_velocity.png")
    plt.close()

    print("Generating Issue vs PR Volume...")
    # --- B. Issue vs PR Volume ---
    issues_df['repo_name'] = issues_df['repository_id'].map(repo_map)
    prs_df['repo_name'] = prs_df['repository_id'].map(repo_map)
    
    issues_count = issues_df.groupby('repo_name').size()
    prs_count = prs_df.groupby('repo_name').size()
    
    volume_df = pd.DataFrame({'Issues': issues_count, 'Pull Requests': prs_count}).fillna(0)
    
    volume_df.plot(kind='bar', figsize=(10, 6))
    plt.title("Issue vs Pull Request Volume")
    plt.xlabel("Repository")
    plt.ylabel("Count")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(insights_dir / "issues_vs_prs.png")
    plt.close()

    print("Generating Top Contributors Activity...")
    # --- C. Top Contributors Activity ---
    # We use repository_contributors and map to contributor names
    contrib_map = dict(zip(contribs_df['id'], contribs_df['login']))
    repo_contribs_df['login'] = repo_contribs_df['contributor_id'].map(contrib_map)
    
    top_contributors = repo_contribs_df.groupby('login')['contributions'].sum().sort_values(ascending=False).head(15)
    
    plt.figure(figsize=(10, 8))
    # seaborn will warn if we don't use keyword arguments next time, so use orient, hue, legend properly or simply a barplot
    sns.barplot(x=top_contributors.values, y=top_contributors.index, palette='viridis', hue=top_contributors.index, legend=False)
    plt.title("Top 15 Most Active Contributors")
    plt.xlabel("Total Contributions")
    plt.ylabel("Contributor")
    plt.tight_layout()
    plt.savefig(insights_dir / "top_contributors.png")
    plt.close()
    
    print(f"Insights generated successfully in {insights_dir}")

if __name__ == "__main__":
    main()
