using System.IO;
using System.Text;
using System.Web.Script.Serialization;

namespace Kermo.Gateway
{
    /// <summary>Налаштування шлюзу. Секрети (код доступу до бази) беруться лише з файлу конфігурації на сервері.</summary>
    public sealed class GatewayConfig
    {
        public string Listen = "http://127.0.0.1:8480/";
        public string Srvr = "LR";
        public string Ref = "Copymax";
        public string PermissionCode = "";
        public string WebRoot = "";
        public int MaxSessions = 3;
        public int IdleMinutes = 15;
        public int CallTimeoutSeconds = 90;
        // Захист від випадкового підключення до продуктивної бази: інша база вимагає свідомої зміни цього списку.
        public string[] AllowedInfobases = new string[] { "Copymax" };

        public static GatewayConfig Load(string path)
        {
            if (!File.Exists(path)) return new GatewayConfig();
            return new JavaScriptSerializer().Deserialize<GatewayConfig>(File.ReadAllText(path, Encoding.UTF8));
        }
    }
}
