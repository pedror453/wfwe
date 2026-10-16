using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;

namespace Kermo.Gateway
{
    public static class Program
    {
        static readonly object LogGate = new object();
        static string logFile;

        public static void Log(string line)
        {
            string s = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + line;
            lock (LogGate)
            {
                try { Console.WriteLine(s); } catch (Exception) { }
                try { if (logFile != null) File.AppendAllText(logFile, s + Environment.NewLine, Encoding.UTF8); } catch (Exception) { }
            }
        }

        public static int Main(string[] args)
        {
            try { Console.OutputEncoding = new UTF8Encoding(false); } catch (Exception) { }
            string cfgPath = args.Length > 0 ? args[0] : Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "gateway.config.json");
            GatewayConfig cfg = GatewayConfig.Load(cfgPath);
            logFile = Path.Combine(Path.GetDirectoryName(Path.GetFullPath(cfgPath)), "gateway.log");
            if (Array.IndexOf(cfg.AllowedInfobases, cfg.Ref) < 0)
            {
                Log("Інформаційна база '" + cfg.Ref + "' не дозволена налаштуванням AllowedInfobases. Запуск скасовано.");
                return 2;
            }
            var store = new SessionStore(cfg);
            var api = new Api(cfg, store);
            var listener = new HttpListener();
            listener.Prefixes.Add(cfg.Listen);
            listener.Start();
            Log("Кермо-шлюз " + Api.Version + " слухає " + cfg.Listen + " -> 1С " + cfg.Srvr + "\\" + cfg.Ref + " (ліміт сеансів " + cfg.MaxSessions + ")");
            while (true)
            {
                HttpListenerContext ctx = listener.GetContext();
                ThreadPool.QueueUserWorkItem(delegate (object o)
                {
                    try { api.Handle(ctx); }
                    catch (Exception e) { Log("збій обробки запиту: " + Late.Err(e)); try { ctx.Response.Abort(); } catch (Exception) { } }
                });
            }
        }
    }
}
