using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace Kermo.Gateway
{
    sealed class Reply
    {
        public int Status = 200;
        public object Body;
        public byte[] Raw;
        public string Type = "application/json";
    }

    sealed class LoginGuard
    {
        readonly Dictionary<string, KeyValuePair<int, DateTime>> fails = new Dictionary<string, KeyValuePair<int, DateTime>>();

        public bool Allow(string key)
        {
            lock (fails)
            {
                KeyValuePair<int, DateTime> e;
                if (!fails.TryGetValue(key, out e)) return true;
                if ((DateTime.UtcNow - e.Value).TotalSeconds > 60) { fails.Remove(key); return true; }
                return e.Key < 5;
            }
        }

        public void Fail(string key)
        {
            lock (fails)
            {
                KeyValuePair<int, DateTime> e;
                if (!fails.TryGetValue(key, out e) || (DateTime.UtcNow - e.Value).TotalSeconds > 60) e = new KeyValuePair<int, DateTime>(0, DateTime.UtcNow);
                fails[key] = new KeyValuePair<int, DateTime>(e.Key + 1, e.Value);
            }
        }

        public void Reset(string key) { lock (fails) { fails.Remove(key); } }
    }

    public sealed class Api
    {
        public const string Version = "0.1.0";
        readonly GatewayConfig cfg;
        readonly SessionStore store;
        readonly LoginGuard guard = new LoginGuard();
        Dictionary<string, object> summary;
        DateTime summaryAt = DateTime.MinValue;
        readonly object summaryGate = new object();

        public Api(GatewayConfig c, SessionStore s) { cfg = c; store = s; }

        public void Handle(HttpListenerContext ctx)
        {
            var sw = Stopwatch.StartNew();
            int status = 500;
            string err = "";
            string path = ctx.Request.Url.AbsolutePath;
            try
            {
                ctx.Response.Headers["Access-Control-Allow-Origin"] = "*";
                ctx.Response.Headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, If-Match";
                ctx.Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, OPTIONS";
                ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
                if (ctx.Request.HttpMethod == "OPTIONS") { status = 204; ctx.Response.StatusCode = 204; return; }
                Reply r = Route(ctx.Request, path);
                status = r.Status;
                Write(ctx.Response, r);
            }
            catch (ApiException e)
            {
                status = e.Status;
                if (e.Status >= 500) err = " :: " + e.Message;
                Write(ctx.Response, Problem(e.Status, e.Message));
            }
            catch (Exception e)
            {
                status = 500;
                err = " :: " + Late.Err(e);
                Write(ctx.Response, Problem(500, "Внутрішня помилка шлюзу: " + Late.Err(e)));
            }
            finally
            {
                try { ctx.Response.Close(); } catch (Exception) { }
                Program.Log(ctx.Request.HttpMethod + " " + path + " -> " + status + " " + sw.ElapsedMilliseconds + " мс" + err);
            }
        }

        static Reply Ok(object body) { return new Reply { Status = 200, Body = body }; }

        static Reply Problem(int status, string detail)
        {
            string title = status == 401 ? "Не авторизовано" : status == 404 ? "Не знайдено" : status == 422 ? "Некоректні дані" : status == 429 ? "Забагато запитів" : status == 502 ? "Помилка 1С" : status == 503 ? "Сервіс недоступний" : status == 504 ? "Час очікування вичерпано" : "Помилка";
            return new Reply { Status = status, Type = "application/problem+json", Body = new Dictionary<string, object> { { "title", title }, { "status", status }, { "detail", detail } } };
        }

        static void Write(HttpListenerResponse res, Reply r)
        {
            res.StatusCode = r.Status;
            if (r.Status == 204) return;
            byte[] bytes = r.Raw != null ? r.Raw : Encoding.UTF8.GetBytes(Json.Write(r.Body));
            res.ContentType = r.Type + (r.Type.StartsWith("application/json") || r.Type.StartsWith("application/problem") || r.Type.StartsWith("text/") ? "; charset=utf-8" : "");
            if (r.Raw == null) res.Headers["Cache-Control"] = "no-store";
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
        }

        Session Auth(HttpListenerRequest req)
        {
            string h = req.Headers["Authorization"] ?? "";
            Session s = h.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? store.Get(h.Substring(7).Trim()) : null;
            if (s == null) throw new ApiException(401, "Сеанс завершено або недійсний. Увійдіть знову.");
            return s;
        }

        // HttpListener.QueryString розкодовує кирилицю в системній кодовій сторінці, тому рядок запиту розбираємо як UTF-8.
        static Dictionary<string, string> QueryParams(HttpListenerRequest req)
        {
            var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            string raw = req.RawUrl ?? "";
            int i = raw.IndexOf('?');
            if (i < 0) return d;
            foreach (string part in raw.Substring(i + 1).Split(new char[] { '&' }, StringSplitOptions.RemoveEmptyEntries))
            {
                int eq = part.IndexOf('=');
                string k = eq < 0 ? part : part.Substring(0, eq);
                string v = eq < 0 ? "" : part.Substring(eq + 1);
                d[Uri.UnescapeDataString(k.Replace('+', ' '))] = Uri.UnescapeDataString(v.Replace('+', ' '));
            }
            return d;
        }

        static string P(Dictionary<string, string> d, string key)
        {
            string v;
            return d.TryGetValue(key, out v) ? v : "";
        }

        static int IntParam(Dictionary<string, string> d, string name, int def)
        {
            int v;
            return int.TryParse(P(d, name), out v) ? v : def;
        }

        Reply Route(HttpListenerRequest req, string path)
        {
            string m = req.HttpMethod;
            if (m == "GET" && path == "/health")
                return Ok(new Dictionary<string, object> { { "status", "ok" }, { "version", Version }, { "infobase", cfg.Ref }, { "platform", store.Platform } });
            if (m == "POST" && path == "/auth/login") return Login(req);
            bool isApi = path == "/capabilities" || path == "/auth/logout" || path.StartsWith("/work-orders") || path.StartsWith("/lookups/");
            if (!isApi)
            {
                if (m == "GET") return Static(path);
                throw new ApiException(404, "Невідомий шлях.");
            }
            Session s = Auth(req);
            if (m == "POST" && path == "/auth/logout") { store.Close(s.Token); return new Reply { Status = 204 }; }
            if (m == "GET" && path == "/capabilities") return Ok(Capabilities());
            if (m == "GET" && path == "/work-orders/summary") return Ok(Summary(s));
            if (m == "GET" && path == "/work-orders")
            {
                var qp = QueryParams(req);
                string q = P(qp, "q").Trim(), st = P(qp, "state");
                int page = IntParam(qp, "page", 1), size = IntParam(qp, "pageSize", 25);
                return Ok(s.Run(db => Repo.ListWorkOrders(db, q, st, page, size), cfg.CallTimeoutSeconds * 1000));
            }
            Match mm = Regex.Match(path, "^/work-orders/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$");
            if (m == "GET" && mm.Success)
            {
                string id = mm.Groups[1].Value;
                return Ok(s.Run(db => Repo.GetWorkOrder(db, id), cfg.CallTimeoutSeconds * 1000));
            }
            Match lk = Regex.Match(path, "^/lookups/([a-zA-Z]+)$");
            if (m == "GET" && lk.Success)
            {
                var qp = QueryParams(req);
                string kind = lk.Groups[1].Value, q = P(qp, "q").Trim();
                int limit = IntParam(qp, "limit", 30);
                return Ok(s.Run(db => Repo.Lookup(db, kind, q, limit), cfg.CallTimeoutSeconds * 1000));
            }
            if (path.StartsWith("/work-orders") && (m == "POST" || m == "PUT"))
                throw new ApiException(501, "Запис і проведення в 1С 8.1 ще не підключено.");
            throw new ApiException(404, "Невідомий шлях.");
        }

        Dictionary<string, object> Summary(Session s)
        {
            lock (summaryGate) { if (summary != null && (DateTime.UtcNow - summaryAt).TotalSeconds < 60) return summary; }
            var v = s.Run(db => Repo.Summary(db), 60000);
            lock (summaryGate) { summary = v; summaryAt = DateTime.UtcNow; }
            return v;
        }

        static Dictionary<string, object> Capabilities()
        {
            const string note = "Недоступно: запис у 1С 8.1 ще не підключено (див. «Про систему»).";
            return new Dictionary<string, object>
            {
                { "workOrders", new Dictionary<string, object> { { "list", true }, { "read", true }, { "create", false }, { "update", false }, { "post", false }, { "unpost", false }, { "print", false } } },
                { "notes", new Dictionary<string, object> { { "create", note }, { "update", note }, { "post", note }, { "unpost", note }, { "print", "Недоступно: друк буде додано після запису документів." } } },
            };
        }

        Reply Login(HttpListenerRequest req)
        {
            string ip = req.RemoteEndPoint != null ? req.RemoteEndPoint.Address.ToString() : "?";
            if (!guard.Allow(ip)) throw new ApiException(429, "Забагато невдалих спроб входу. Зачекайте хвилину.");
            string raw;
            using (var rd = new StreamReader(req.InputStream, Encoding.UTF8)) raw = rd.ReadToEnd();
            var body = Json.ReadObject(raw);
            string user = Json.Str(body, "user").Trim(), pass = Json.Str(body, "password");
            if (user.Length == 0) throw new ApiException(422, "Вкажіть ім’я користувача.");
            try
            {
                Session s = store.Login(user, pass);
                guard.Reset(ip);
                return Ok(new Dictionary<string, object> { { "token", s.Token }, { "expiresIn", cfg.IdleMinutes * 60 }, { "roles", s.Roles } });
            }
            catch (ApiException) { throw; }
            catch (Exception e)
            {
                string msg = Late.Err(e);
                if (msg.IndexOf("Идентификация пользователя не выполнена", StringComparison.OrdinalIgnoreCase) >= 0 || msg.IndexOf("Неправильное имя или пароль", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    guard.Fail(ip);
                    throw new ApiException(401, "Неправильне ім’я користувача або пароль.");
                }
                throw new ApiException(503, "Не вдалося підключитися до 1С: " + (msg.Length > 300 ? msg.Substring(0, 300) : msg));
            }
        }

        static string Mime(string file)
        {
            switch (Path.GetExtension(file).ToLowerInvariant())
            {
                case ".html": return "text/html";
                case ".js": return "text/javascript";
                case ".css": return "text/css";
                case ".svg": return "image/svg+xml";
                case ".png": return "image/png";
                case ".ico": return "image/x-icon";
                case ".json": return "application/json";
                case ".map": return "application/json";
                case ".woff2": return "font/woff2";
                default: return "application/octet-stream";
            }
        }

        Reply Static(string path)
        {
            if (string.IsNullOrEmpty(cfg.WebRoot) || !Directory.Exists(cfg.WebRoot)) throw new ApiException(404, "Невідомий шлях.");
            string root = Path.GetFullPath(cfg.WebRoot);
            string rel = path.TrimStart('/');
            if (rel.Length == 0) rel = "index.html";
            string full = Path.GetFullPath(Path.Combine(root, rel.Replace('/', Path.DirectorySeparatorChar)));
            if (!full.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new ApiException(404, "Невідомий шлях.");
            if (!File.Exists(full))
            {
                if (Path.GetExtension(rel).Length > 0) throw new ApiException(404, "Файл не знайдено.");
                full = Path.Combine(root, "index.html");
                if (!File.Exists(full)) throw new ApiException(404, "Клієнт не встановлено.");
            }
            return new Reply { Status = 200, Raw = File.ReadAllBytes(full), Type = Mime(full) };
        }
    }
}
