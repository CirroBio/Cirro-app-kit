import glob
import os
import posixpath
import re

from mkdocs.structure.files import File, Files, InclusionLevel

REPO_URL = "https://github.com/CirroBio/Cirro-app-kit"
SITE_PATHS = [
    "README.md",
    "CONTRIBUTING.md",
    "docs/*.md",
    "reference/*.md",
    "templates/*/README.md",
]
# Ranked below the guide so searches for terms like "client ID" land on prose.
REFERENCE_SEARCH_BOOST = 0.5
LINK = re.compile(r"\]\(([^)#\s]+)(#[^)\s]*)?\)")


def on_files(files, config):
    repo_root = os.path.dirname(config.config_file_path)
    site_files = Files([f for f in files if not f.is_documentation_page()])
    for pattern in SITE_PATHS:
        for path in sorted(glob.glob(pattern, root_dir=repo_root)):
            # Set inclusion explicitly: MkDocs' default exclude_docs drops /templates/.
            site_files.append(
                File(
                    path,
                    repo_root,
                    config.site_dir,
                    config.use_directory_urls,
                    inclusion=InclusionLevel.INCLUDED,
                )
            )
    return site_files


def on_page_markdown(markdown, page, config, files):
    if page.file.src_uri.startswith("reference/"):
        page.meta.setdefault("search", {"boost": REFERENCE_SEARCH_BOOST})
    page_dir = posixpath.dirname(page.file.src_uri)

    def rewrite(match):
        target, anchor = match.group(1), match.group(2) or ""
        if re.match(r"^[a-z]+:", target):
            return match.group(0)
        repo_path = posixpath.normpath(posixpath.join(page_dir, target))
        if files.get_file_from_path(repo_path):
            return match.group(0)
        # A directory with a README is a page here, e.g. templates/app.
        readme = posixpath.join(repo_path, "README.md")
        if files.get_file_from_path(readme):
            return f"]({posixpath.relpath(readme, page_dir)}{anchor})"
        kind = "blob" if posixpath.splitext(repo_path)[1] else "tree"
        return f"]({REPO_URL}/{kind}/main/{repo_path}{anchor})"

    return LINK.sub(rewrite, markdown)
