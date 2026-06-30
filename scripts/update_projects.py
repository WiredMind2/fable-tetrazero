#!/usr/bin/env python3
"""
Project Updater for the Tetrazero Portfolio (Astro version)

Fetches GitHub repos (own + contributed) and updates src/data/projects.json.

Schema per project (see src/content.config.ts):
  id (number), title, description, longDescription,
  techStack (string[]), githubUrl, featured (bool),
  category ('web' | 'fullstack' | 'other')

Behavior notes:
- Existing entries are matched by githubUrl and NEVER have their hand-written
  description/longDescription/techStack/title overwritten (curated copy wins).
  Only `featured` is refreshed from GitHub pins unless --keep-featured is set.
- Entries marked with "ignore": true are kept out of the output but remembered,
  so re-runs don't re-add them.
- New repos get LLM-generated descriptions via OpenRouter (requires
  OPENROUTER_API_KEY; GITHUB_TOKEN recommended to avoid rate limits).

Usage:
  python scripts/update_projects.py [--keep-featured] [--dry-run]
"""

import base64
import json
import os
import sqlite3
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

USERNAME = "WiredMind2"
ROOT = Path(__file__).resolve().parent.parent
PROJECTS_JSON = ROOT / "src" / "data" / "projects.json"

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "tngtech/deepseek-r1t2-chimera:free"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

CACHE_DB = Path(__file__).resolve().parent / "cache.db"
CACHE_TTL = 86400  # 24 hours
MAX_REPOS = 70


# --------------------------------------------------------------------------- #
# Cache
# --------------------------------------------------------------------------- #
def init_db():
    conn = sqlite3.connect(CACHE_DB)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT, timestamp REAL)"
    )
    conn.commit()
    conn.close()


def get_from_cache(key):
    try:
        conn = sqlite3.connect(CACHE_DB)
        row = conn.execute("SELECT value, timestamp FROM cache WHERE key=?", (key,)).fetchone()
        conn.close()
        if row and time.time() - row[1] < CACHE_TTL:
            return json.loads(row[0])
    except Exception as e:
        print(f"Cache read error: {e}")
    return None


def save_to_cache(key, value):
    try:
        conn = sqlite3.connect(CACHE_DB)
        conn.execute(
            "INSERT OR REPLACE INTO cache (key, value, timestamp) VALUES (?, ?, ?)",
            (key, json.dumps(value), time.time()),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Cache write error: {e}")


# --------------------------------------------------------------------------- #
# GitHub
# --------------------------------------------------------------------------- #
def gh_headers():
    return {"Authorization": f"token {GITHUB_TOKEN}"} if GITHUB_TOKEN else {}


def fetch_github_repos(username):
    cache_key = f"repos_{username}"
    cached = get_from_cache(cache_key)
    if cached:
        print(f"Using cached repos for {username}")
        return cached

    response = requests.get(
        f"https://api.github.com/users/{username}/repos",
        params={"sort": "updated", "direction": "desc", "per_page": 100},
        headers=gh_headers(),
    )
    if response.status_code == 200:
        data = response.json()
        save_to_cache(cache_key, data)
        return data
    print(f"Error fetching repos: {response.status_code}")
    return []


def fetch_contributed_repos(username):
    """Repos the user contributed to via PRs, excluding their own."""
    cache_key = f"contributed_repos_{username}"
    cached = get_from_cache(cache_key)
    if cached:
        print(f"Using cached contributed repos for {username}")
        return cached

    print(f"Searching contributed repositories for {username}...")
    response = requests.get(
        "https://api.github.com/search/issues",
        params={
            "q": f"type:pr author:{username} -user:{username}",
            "sort": "updated",
            "order": "desc",
            "per_page": 50,
        },
        headers=gh_headers(),
    )
    if response.status_code != 200:
        print(f"Error searching contributed repos: {response.status_code}")
        return []

    repo_urls = {item["repository_url"] for item in response.json().get("items", [])}
    repos = []
    for r_url in repo_urls:
        try:
            r_res = requests.get(r_url, headers=gh_headers())
            if r_res.status_code == 200 and not r_res.json().get("private", False):
                repos.append(r_res.json())
        except Exception as e:
            print(f"Error fetching repo {r_url}: {e}")

    save_to_cache(cache_key, repos)
    return repos


def fetch_pinned_repos(username):
    if not GITHUB_TOKEN:
        print("GITHUB_TOKEN not found, cannot fetch pinned repos.")
        return []

    cache_key = f"pinned_{username}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached

    query = (
        'query { user(login: "%s") { pinnedItems(first: 6, types: REPOSITORY) '
        "{ nodes { ... on Repository { name } } } } }" % username
    )
    try:
        response = requests.post(
            "https://api.github.com/graphql",
            json={"query": query},
            headers={"Authorization": f"bearer {GITHUB_TOKEN}"},
        )
        if response.status_code == 200:
            nodes = (
                response.json()
                .get("data", {})
                .get("user", {})
                .get("pinnedItems", {})
                .get("nodes", [])
            )
            names = [node["name"] for node in nodes if node]
            save_to_cache(cache_key, names)
            return names
    except Exception as e:
        print(f"Error fetching pinned repos: {e}")
    return []


def fetch_readme(owner, repo):
    cache_key = f"readme_{owner}_{repo}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached

    response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/readme", headers=gh_headers()
    )
    if response.status_code == 200:
        content = base64.b64decode(response.json()["content"]).decode("utf-8")
        save_to_cache(cache_key, content)
        return content
    raise FileNotFoundError(f"No README for {owner}/{repo}")


# --------------------------------------------------------------------------- #
# LLM generation (OpenRouter)
# --------------------------------------------------------------------------- #
def openrouter_complete(prompt):
    response = requests.post(
        OPENROUTER_URL,
        json={"model": OPENROUTER_MODEL, "messages": [{"role": "user", "content": prompt}]},
        headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
        timeout=30,
    )
    if response.status_code != 200:
        raise RuntimeError(f"OpenRouter error: {response.status_code} - {response.text}")
    text = response.json()["choices"][0]["message"]["content"].strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in "'\"":
        text = text[1:-1]
    if not text:
        raise RuntimeError("Empty OpenRouter response")
    return text


def generate_description(repo, readme):
    cache_key = f"desc_{repo['name']}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached
    desc = openrouter_complete(
        f"Generate a very concise one-sentence description for the GitHub repository "
        f"'{repo['name']}' written in {repo['language'] or 'various languages'}. "
        f"Lead with what is technically hard or impressive about it, not a feature list. "
        f"Original description: {repo.get('description', 'No description provided')}. "
        f"README content: {readme[:500]}. "
        f"Output only the description text, no introductory phrases."
    )
    save_to_cache(cache_key, desc)
    return desc


def generate_long_description(repo, readme):
    cache_key = f"long_desc_{repo['name']}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached
    desc = openrouter_complete(
        f"Generate a detailed description (2-3 sentences) for a GitHub repository named "
        f"'{repo['name']}' written in {repo['language'] or 'various languages'}. "
        f"Lead with purpose and the technically interesting parts. "
        f"Original description: {repo.get('description', 'No description provided')}. "
        f"README content: {readme[:2000]}. "
        f"Output only the description text, no introductory phrases."
    )
    save_to_cache(cache_key, desc)
    return desc


def generate_tags(repo, readme, existing_tags):
    cache_key = f"tags_{repo['name']}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached
    try:
        content = openrouter_complete(
            f"Generate a list of 2-4 technical tags (e.g., React, Python, Machine Learning) "
            f"for a GitHub repository named '{repo['name']}' written in "
            f"{repo['language'] or 'various languages'}. README content: {readme[:2000]}.\n\n"
            f"Existing tags in the system: {', '.join(existing_tags) or 'None'}.\n\n"
            f"Prioritize existing tags when relevant. "
            f"Output only the tags as a comma-separated list, no other text."
        )
        tags = [tag.strip() for tag in content.split(",") if tag.strip()]
        if repo["language"] and repo["language"] not in tags:
            tags.insert(0, repo["language"])
        if tags:
            save_to_cache(cache_key, tags)
            return tags
    except Exception as e:
        print(f"Error generating tags: {e}")
    return [repo["language"]] if repo["language"] else ["Various"]


def get_category(language):
    if language in ("JavaScript", "TypeScript", "HTML", "CSS", "PHP", "Astro", "Svelte"):
        return "web"
    if language in ("Python", "Java", "C#", "Go", "Rust"):
        return "fullstack"
    return "other"


# --------------------------------------------------------------------------- #
# Update logic
# --------------------------------------------------------------------------- #
def dedupe_repos(repos):
    """Group by name; prefer non-forks, then stars, then own repos."""
    by_name = {}
    for r in repos:
        by_name.setdefault(r["name"].lower(), []).append(r)

    unique = []
    for duplicates in by_name.values():
        duplicates.sort(
            key=lambda r: (
                not r.get("fork", False),
                r.get("stargazers_count", 0),
                r["owner"]["login"].lower() == USERNAME.lower(),
            ),
            reverse=True,
        )
        unique.append(duplicates[0])
    return unique


def update_projects(repos, pinned, keep_featured=False, dry_run=False):
    existing = []
    if PROJECTS_JSON.exists():
        existing = json.loads(PROJECTS_JSON.read_text(encoding="utf-8"))

    existing_by_url = {p["githubUrl"].lower(): p for p in existing}
    all_tags = {tag for p in existing for tag in p.get("techStack", [])}
    next_id = max((p["id"] for p in existing), default=0) + 1

    projects = []
    for repo in repos[:MAX_REPOS]:
        url = repo["html_url"].lower()
        entry = existing_by_url.get(url)

        if entry is not None:
            # Curated entry: keep all hand-written copy, optionally refresh featured
            if entry.get("ignore") is True:
                projects.append(entry)
                continue
            if not keep_featured and pinned:
                entry["featured"] = repo["name"] in pinned
            projects.append(entry)
            continue

        print(f"New repo: {repo['name']} - generating entry...")
        try:
            readme = fetch_readme(repo["owner"]["login"], repo["name"])
            tags = generate_tags(repo, readme, sorted(all_tags))
            all_tags.update(tags)
            projects.append(
                {
                    "id": next_id,
                    "title": repo["name"].replace("-", " ").replace("_", " ").title(),
                    "description": generate_description(repo, readme),
                    "longDescription": generate_long_description(repo, readme),
                    "techStack": tags,
                    "githubUrl": repo["html_url"],
                    "featured": repo["name"] in pinned,
                    "category": get_category(repo["language"]),
                }
            )
            next_id += 1
        except FileNotFoundError:
            print(f"Skipping {repo['name']}: no README.")
        except Exception as e:
            print(f"Skipping {repo['name']}: {e}")

    # Preserve curated entries whose repos disappeared from the fetched list
    fetched_urls = {r["html_url"].lower() for r in repos}
    for p in existing:
        if p["githubUrl"].lower() not in fetched_urls and p not in projects:
            projects.append(p)

    visible = [p for p in projects if not p.get("ignore")]
    print(f"Total: {len(visible)} visible projects ({len(projects)} tracked)")

    if dry_run:
        print("Dry run - not writing projects.json")
        return

    PROJECTS_JSON.write_text(
        json.dumps(projects, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Updated {PROJECTS_JSON}")


def main():
    init_db()
    keep_featured = "--keep-featured" in sys.argv
    dry_run = "--dry-run" in sys.argv

    print(f"Fetching repositories for {USERNAME}...")
    own = fetch_github_repos(USERNAME) or []
    contributed = fetch_contributed_repos(USERNAME) or []
    repos = dedupe_repos(own + contributed)
    repos = [r for r in repos if not r.get("private", False)]
    repos.sort(key=lambda r: r.get("updated_at", ""), reverse=True)
    print(f"Using {len(repos)} public repositories")

    pinned = fetch_pinned_repos(USERNAME)
    update_projects(repos, pinned, keep_featured=keep_featured, dry_run=dry_run)
    print("Portfolio update complete!")


if __name__ == "__main__":
    main()
