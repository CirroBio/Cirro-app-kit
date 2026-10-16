#!/usr/bin/env python3
"""Print the Cirro API surface for the installed @cirrobio/api-client.

Usage: python3 api_surface.py <node_modules dir>

Reads dist/apis/*Api.d.ts and lists every public method with its request fields
and return type, plus the DataService getter that exposes each API class.
"""
import glob, json, os, re, sys

nm = sys.argv[1] if len(sys.argv) > 1 else "node_modules"
apis = os.path.join(nm, "@cirrobio", "api-client", "dist", "apis")
if not os.path.isdir(apis):
    sys.exit(f"Not found: {apis}. Pass the node_modules directory that contains @cirrobio/api-client.")

version = json.load(open(os.path.join(nm, "@cirrobio", "api-client", "package.json")))["version"]

# DataService getters: prefer the .d.ts shipped in the sdk package
getters = {}
ds_candidates = glob.glob(os.path.join(nm, "@cirrobio", "sdk", "dist", "types", "data", "data.service.d.ts")) + \
                glob.glob(os.path.join(nm, "@cirrobio", "sdk", "src", "data", "data.service.ts"))
for path in ds_candidates:
    for name, cls in re.findall(r"get (\w+)\(\): (\w+)", open(path).read()):
        getters[cls] = name
    if getters:
        break

print(f"# Cirro API surface (@cirrobio/api-client {version})\n")
for f in sorted(glob.glob(os.path.join(apis, "*Api.d.ts"))):
    src = open(f).read()
    cls = os.path.basename(f)[:-5]
    reqs = {}
    for m in re.finditer(r"export interface (\w+Request) \{(.*?)\n\}", src, re.S):
        reqs[m.group(1)] = [l.strip().rstrip(";") for l in m.group(2).strip().split("\n") if l.strip()]
    # Object return types span several lines and contain their own `>;`, so match braces explicitly
    methods = re.findall(r"^\s+(\w+)\((?:requestParameters\??: (\w+), )?initOverrides[^)]*\): Promise<(\{[\s\S]*?\}|.+?)>;", src, re.M)
    methods = [(n, r, " ".join(t.split())) for n, r, t in methods if not n.endswith(("Raw", "RequestOpts"))]
    where = f"`data.{getters[cls]}`" if cls in getters else "not on DataService in this version"
    print(f"## {cls} ({where})\n")
    for name, req, ret in methods:
        params = "{ " + ", ".join(reqs.get(req, [])) + " }" if req else ""
        print(f"- `{name}({params})` → `{ret}`")
    print()
