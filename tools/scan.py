#!/usr/bin/env python3
"""Scan a Cirro frontend project for common security and configuration problems.

Usage: python3 scan.py <project dir>

Prints findings as: SEVERITY  file:line  rule  snippet
Exit code 1 if any HIGH finding, else 0. Findings are leads for a human or
Claude to confirm, not verdicts; read the code around each one.
"""
import json, os, re, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
SKIP_DIRS = {"node_modules", "dist", "build", ".git", ".next", "coverage"}
CODE_EXT = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".html")

RULES = [
    ("HIGH", "client-secret", re.compile(r"client[_-]?secret\s*[:=]", re.I),
     "A client secret in frontend code is readable by every visitor"),
    ("HIGH", "aws-key-literal", re.compile(r"\b(AKIA|ASIA)[0-9A-Z]{16}\b"),
     "Looks like an AWS access key in source"),
    ("HIGH", "token-in-storage", re.compile(r"(localStorage|sessionStorage)\.setItem\([^)]*(token|credential|secret|jwt)", re.I),
     "Tokens or credentials written to web storage are exposed to any XSS"),
    ("HIGH", "static-token-provider", re.compile(r"StaticInteractiveAuthTokenProvider|StaticTokenAuthProvider"),
     "Static token provider; confirm it is unreachable in production builds"),
    ("MEDIUM", "log-secret", re.compile(r"console\.(log|debug|info|warn|error)\([^)]*(accessToken|access_token|idToken|secretAccessKey|sessionToken|credentials|signedUrl)", re.I),
     "Logging tokens, AWS credentials or signed URLs"),
    ("MEDIUM", "token-in-url", re.compile(r"[?&](access_token|token|id_token)=\$\{", re.I),
     "Token placed in a URL (ends up in logs and history)"),
    ("MEDIUM", "dangerous-html", re.compile(r"dangerouslySetInnerHTML|\.innerHTML\s*="),
     "Raw HTML rendering; Cirro names, metadata and file contents must be rendered as text"),
    ("MEDIUM", "sql-interpolation", re.compile(r"query:\s*`[^`]*\$\{"),
     "SQL built by string interpolation (Sheets queryData); use querySheetData filters or an allow-list"),
    ("MEDIUM", "eval", re.compile(r"\beval\(|new Function\("),
     "Dynamic code execution"),
    ("LOW", "default-api-base", re.compile(r"new DataService\(\s*\{\s*tokenGetter[^}]*\}\s*\)"),
     "DataService without basePath defaults to /api, which only works on the Cirro origin; set the tenant API URL"),
    ("LOW", "stored-signed-url", re.compile(r"(useState|set[A-Z]\w*)\([^)]*getSignedUrl", re.I),
     "Signed URLs stored in state expire (5 min default); store the file and sign on use"),
]


def walk(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for f in filenames:
            yield os.path.join(dirpath, f)


def scan_code(findings):
    for path in walk(ROOT):
        if not path.endswith(CODE_EXT):
            continue
        try:
            lines = open(path, encoding="utf-8", errors="ignore").read().splitlines()
        except OSError:
            continue
        for i, line in enumerate(lines, 1):
            for sev, rule, rx, why in RULES:
                if rx.search(line):
                    findings.append((sev, f"{os.path.relpath(path, ROOT)}:{i}", rule, line.strip()[:120], why))


def scan_env(findings):
    for path in walk(ROOT):
        name = os.path.basename(path)
        if not name.startswith(".env") or name.endswith(".example"):
            continue
        rel = os.path.relpath(path, ROOT)
        text = open(path, encoding="utf-8", errors="ignore").read()
        if re.search(r"SECRET|TOKEN", text):
            findings.append(("HIGH", rel, "secret-in-env",
                             "env file mentions SECRET/TOKEN", "VITE_* variables are bundled into the client; secrets must not be here"))
        gi = os.path.join(ROOT, ".gitignore")
        if not (os.path.exists(gi) and re.search(r"^\.env", open(gi).read(), re.M)):
            findings.append(("MEDIUM", rel, "env-not-ignored", ".env files not in .gitignore", "Risk of committing tenant config or dev tokens"))
            break


def scan_package(findings):
    pj = os.path.join(ROOT, "package.json")
    if not os.path.exists(pj):
        findings.append(("LOW", "package.json", "no-package-json", "", "Not a Node project root; pass the app directory"))
        return
    pkg = json.load(open(pj))
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    for name, ver in deps.items():
        if name.startswith("@cirrobio/") and not re.fullmatch(r"\d+\.\d+\.\d+", ver):
            findings.append(("MEDIUM", "package.json", "unpinned-cirro", f"{name}: {ver}",
                             "Cirro packages are pre-1.0; pin exact versions"))


def scan_manifest(findings):
    path = os.path.join(ROOT, "cirro-permissions.json")
    if not os.path.exists(path):
        findings.append(("MEDIUM", "cirro-permissions.json", "no-permission-manifest", "",
                         "No permission manifest; admins can't grant least privilege (see docs/permissions.md)"))
        return
    try:
        m = json.load(open(path))
    except ValueError as e:
        findings.append(("MEDIUM", "cirro-permissions.json", "bad-permission-manifest", str(e)[:120], "Manifest is not valid JSON"))
        return
    for section in ("required", "optional"):
        for entry in m.get(section, []):
            if not (entry.get("reason") or entry.get("feature")):
                findings.append(("LOW", "cirro-permissions.json", "manifest-missing-reason", entry.get("permission", "?"),
                                 "Each permission needs a reason (required) or feature (optional) for reviewing admins"))


def main():
    findings = []
    scan_code(findings)
    scan_env(findings)
    scan_package(findings)
    scan_manifest(findings)
    order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    findings.sort(key=lambda f: (order[f[0]], f[1]))
    for sev, loc, rule, snippet, why in findings:
        print(f"{sev:6}  {loc}  {rule}\n        {why}" + (f"\n        > {snippet}" if snippet else ""))
    counts = {s: sum(1 for f in findings if f[0] == s) for s in order}
    print(f"\n{counts['HIGH']} high, {counts['MEDIUM']} medium, {counts['LOW']} low")
    sys.exit(1 if counts["HIGH"] else 0)


if __name__ == "__main__":
    main()
