"""In-memory HTTP transport for integration tests without outbound sockets."""
import io
from http.client import parse_headers
from urllib.parse import urlsplit
from types import SimpleNamespace
import server

class Socket:
    def __init__(self, raw): self.input = io.BytesIO(raw); self.output = bytearray()
    def makefile(self, *args, **kwargs): return self.input
    def sendall(self, data): self.output.extend(data)

class Response:
    def __init__(self, raw):
        head, self.body = raw.split(b'\r\n\r\n', 1)
        lines = head.split(b'\r\n')
        self.status = int(lines[0].split()[1])
        self.headers = parse_headers(io.BytesIO(b'\r\n'.join(lines[1:]) + b'\r\n\r\n'))
    def read(self): return self.body
    def close(self): pass
    def __enter__(self): return self
    def __exit__(self, *args): self.close()

def urlopen(request):
    if isinstance(request, str):
        from urllib.request import Request
        request = Request(request)
    url = urlsplit(request.full_url)
    body = request.data or b''
    headers = dict(request.header_items())
    headers.update(Host=url.netloc, **{'Content-Length': str(len(body)), 'Connection': 'close'})
    path = url.path + ('?' + url.query if url.query else '')
    raw = (request.get_method() + ' ' + path + ' HTTP/1.1\r\n' + ''.join(k + ': ' + v + '\r\n' for k,v in headers.items()) + '\r\n').encode() + body
    socket = Socket(raw)
    server.Handler(socket, ('127.0.0.1', 12345), SimpleNamespace(server_name='localhost', server_port=8000))
    return Response(bytes(socket.output))
