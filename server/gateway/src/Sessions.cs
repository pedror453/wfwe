using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Threading;

namespace Kermo.Gateway
{
    /// <summary>Сеанс користувача: власний STA-потік із одним COM-з'єднанням 1С (одна ліцензія 1С на сеанс).</summary>
    public sealed class Session
    {
        public string Token = "";
        public string User = "";
        public string Platform = "";
        public List<string> Roles = new List<string>();
        public DateTime LastUsed = DateTime.UtcNow;
        OneC db;
        Thread thread;
        readonly BlockingCollection<Action> queue = new BlockingCollection<Action>();
        volatile bool closed;

        public static Session Open(GatewayConfig cfg, string user, string password)
        {
            var s = new Session { User = user };
            Exception err = null;
            var ready = new ManualResetEventSlim(false);
            s.thread = new Thread(delegate ()
            {
                try { s.db = OneC.Connect(cfg, user, password); }
                catch (Exception e) { err = e; ready.Set(); return; }
                s.Roles = s.db.Roles;
                s.Platform = s.db.Platform;
                ready.Set();
                foreach (Action a in s.queue.GetConsumingEnumerable())
                {
                    try { a(); } catch (Exception) { }
                }
                try { s.db.Dispose(); } catch (Exception) { }
            });
            s.thread.SetApartmentState(ApartmentState.STA);
            s.thread.IsBackground = true;
            s.thread.Start();
            if (!ready.Wait(cfg.CallTimeoutSeconds * 1000)) { s.Close(); throw new ApiException(504, "1С не відповіла вчасно."); }
            if (err != null) { s.Close(); throw new Exception(Late.Err(err)); }
            var buf = new byte[24];
            using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(buf);
            s.Token = Convert.ToBase64String(buf).Replace('+', '-').Replace('/', '_').TrimEnd('=');
            return s;
        }

        public void Close()
        {
            closed = true;
            try { queue.CompleteAdding(); } catch (Exception) { }
        }

        public T Run<T>(Func<OneC, T> f, int timeoutMs)
        {
            if (closed) throw new ApiException(401, "Сеанс завершено. Увійдіть знову.");
            T result = default(T);
            Exception ex = null;
            var done = new ManualResetEventSlim(false);
            queue.Add(delegate ()
            {
                try { result = f(db); } catch (Exception e) { ex = e; }
                done.Set();
            });
            if (!done.Wait(timeoutMs)) throw new ApiException(504, "1С не відповіла вчасно.");
            LastUsed = DateTime.UtcNow;
            if (ex != null)
            {
                var api = ex as ApiException;
                if (api != null) throw api;
                string msg = Late.Err(ex);
                throw new ApiException(502, "Помилка 1С: " + (msg.Length > 400 ? msg.Substring(0, 400) : msg));
            }
            return result;
        }
    }

    public sealed class SessionStore
    {
        readonly GatewayConfig cfg;
        readonly Dictionary<string, Session> map = new Dictionary<string, Session>();
        readonly object gate = new object();
        Timer sweeper;
        public string Platform = "";

        public SessionStore(GatewayConfig c)
        {
            cfg = c;
            sweeper = new Timer(delegate (object o) { Sweep(); }, null, 60000, 60000);
        }

        public Session Login(string user, string password)
        {
            lock (gate)
            {
                if (map.Count >= cfg.MaxSessions)
                {
                    // Ліцензії 1С обмежені: звільняємо найдовше неактивний сеанс, лише якщо він простоює понад 2 хвилини.
                    Session oldest = null;
                    foreach (Session x in map.Values) { if (oldest == null || x.LastUsed < oldest.LastUsed) oldest = x; }
                    if (oldest != null && (DateTime.UtcNow - oldest.LastUsed).TotalMinutes > 2) { map.Remove(oldest.Token); oldest.Close(); }
                    else throw new ApiException(503, "Досягнуто ліміт одночасних сеансів (" + cfg.MaxSessions + "). Спробуйте за кілька хвилин.");
                }
            }
            Session s = Session.Open(cfg, user, password);
            lock (gate) { map[s.Token] = s; }
            if (s.Platform.Length > 0) Platform = s.Platform;
            return s;
        }

        public Session Get(string token)
        {
            lock (gate)
            {
                Session s;
                return map.TryGetValue(token ?? "", out s) ? s : null;
            }
        }

        public void Close(string token)
        {
            Session s = null;
            lock (gate) { if (map.TryGetValue(token ?? "", out s)) map.Remove(token); }
            if (s != null) s.Close();
        }

        void Sweep()
        {
            var stale = new List<Session>();
            lock (gate)
            {
                foreach (Session s in map.Values) { if ((DateTime.UtcNow - s.LastUsed).TotalMinutes > cfg.IdleMinutes) stale.Add(s); }
                foreach (Session s in stale) map.Remove(s.Token);
            }
            foreach (Session s in stale) { s.Close(); Program.Log("сеанс завершено за неактивністю"); }
        }
    }
}
