#!/usr/bin/env python3
"""
Serve a mirrored copy of the Let's Try textbooks locally.

    python3 serve.py                  # serves ./mirror/site on port 8000
    python3 serve.py --dir D:/lt/site --port 8080

Then open  http://localhost:8000/letstry1  (or /letstry2, /storybooks).
Pages link to routes like /letstry1-3 with no extension; this server maps
them to letstry1-3.html, just like the live site.
"""
import argparse
import functools
import http.server
import os


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        local = super().translate_path(path)
        if not os.path.exists(local) and os.path.exists(local + ".html"):
            return local + ".html"
        if os.path.isdir(local) and path.rstrip("/") in ("", "/"):
            return os.path.join(self.directory, "letstry1.html")
        return local


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=os.path.join("mirror", "site"))
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--host", default="127.0.0.1", help="use 0.0.0.0 to share on your LAN")
    a = ap.parse_args()
    handler = functools.partial(Handler, directory=os.path.abspath(a.dir))
    with http.server.ThreadingHTTPServer((a.host, a.port), handler) as srv:
        print(f"Serving {a.dir} at http://localhost:{a.port}/letstry1  (Ctrl+C to stop)")
        srv.serve_forever()


if __name__ == "__main__":
    main()
